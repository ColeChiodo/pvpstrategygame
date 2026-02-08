import express from "express";
import { isAuthenticated } from "../middleware/auth";
import prisma from "../config/database";
import { createGameServer, destroyGameServer } from "../services/k8s";

const router = express.Router();

interface MatchmakingQueue {
  userId: string;
  joinedAt: Date;
}

const matchmakingQueue: MatchmakingQueue[] = [];
const activeGames = new Map<string, { hostUserId: string; port: number; status: string }>();

router.post("/join", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    
    const existingIndex = matchmakingQueue.findIndex(m => m.userId === userId);
    if (existingIndex !== -1) {
      return res.status(400).json({ error: "Already in queue" });
    }

    matchmakingQueue.push({ userId, joinedAt: new Date() });

    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift()!;
      const player2 = matchmakingQueue.shift()!;

      const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      activeGames.set(gameId, {
        hostUserId: player1.userId,
        port: 0,
        status: "starting",
      });

      try {
        await prisma.gameSession.create({
          data: {
            id: gameId,
            player1Id: player1.userId,
            player2Id: player2.userId,
            status: "match_found",
          },
        });
      } catch (dbError) {
        console.error("Game session creation failed:", dbError);
        activeGames.delete(gameId);
        return res.status(500).json({ error: "Failed to create game session" });
      }

      let serverUrl = null;
      let port = null;
      
      const localMode = process.env.LOCAL_GAME_SERVER === "true";
      
      try {
        if (localMode) {
          const localPort = 3000 + Math.floor(Math.random() * 1000);
          serverUrl = `http://localhost:${localPort}`;
          port = localPort;
        } else {
          const server = await createGameServer(gameId);
          serverUrl = server?.url || null;
          port = server?.port || null;
        }
      } catch (k8sError) {
        console.warn("K8s unavailable, running without game server");
      }

      return res.json({
        success: true,
        gameId,
        matched: true,
        opponent: player2.userId,
        serverUrl,
        port,
      });
    }

    res.json({ success: true, matched: false, position: matchmakingQueue.length });
  } catch (error) {
    console.error("Matchmaking error:", error);
    res.status(500).json({ error: "Matchmaking failed" });
  }
});

router.post("/leave", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const index = matchmakingQueue.findIndex(m => m.userId === userId);
    
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to leave queue" });
  }
});

router.get("/status", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    
    const gameSession = await prisma.gameSession.findFirst({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: { in: ["match_found", "in_progress"] },
      },
    });

    if (gameSession) {
      const opponentId = gameSession.player1Id === userId ? gameSession.player2Id : gameSession.player1Id;
      const opponent = await prisma.user.findUnique({
        where: { id: opponentId },
        select: { displayName: true, avatar: true },
      });

      return res.json({
        inQueue: false,
        queuePosition: 0,
        queueSize: matchmakingQueue.length,
        gameSession: {
          id: gameSession.id,
          status: gameSession.status,
          serverUrl: gameSession.serverUrl,
          port: gameSession.port,
          isHost: gameSession.player1Id === userId,
          opponent: opponent || { displayName: "Unknown", avatar: null },
        },
      });
    }

    const inQueue = matchmakingQueue.some(m => m.userId === userId);
    const queuePosition = matchmakingQueue.findIndex(m => m.userId === userId) + 1;

    res.json({
      inQueue,
      queuePosition: inQueue ? queuePosition : 0,
      queueSize: matchmakingQueue.length,
      gameSession: null,
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});

router.get("/game/:gameId", isAuthenticated, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = (req.user as any).id;

    const game = await prisma.gameSession.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (game.player1Id !== userId && game.player2Id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const isPlayer1 = game.player1Id === userId;
    const opponentId = isPlayer1 ? game.player2Id : game.player1Id;

    const opponent = await prisma.user.findUnique({
      where: { id: opponentId },
      select: { displayName: true, avatar: true },
    });

    res.json({
      gameId: game.id,
      status: game.status,
      serverUrl: game.serverUrl,
      port: game.port,
      isHost: game.player1Id === userId,
      opponent: opponent || { displayName: "Unknown", avatar: null },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get game" });
  }
});

router.post("/game/:gameId/end", isAuthenticated, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = (req.user as any).id;

    const game = await prisma.gameSession.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (game.player1Id !== userId) {
      return res.status(403).json({ error: "Only host can end game" });
    }

    await destroyGameServer(gameId);

    await prisma.gameSession.update({
      where: { id: gameId },
      data: { status: "completed" },
    });

    activeGames.delete(gameId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to end game" });
  }
});

export default router;
