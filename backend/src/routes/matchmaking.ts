import express from "express";
import { isAuthenticated } from "../middleware/auth";
import prisma from "../config/database";
import { createGameServer, destroyGameServer } from "../services/k8s";
import { Server as SocketIOServer } from "socket.io";

const router = express.Router();

interface MatchmakingQueue {
  userId: string;
  joinedAt: Date;
}

let io: SocketIOServer | null = null;

export function setMatchmakingIO(socketIO: SocketIOServer) {
  io = socketIO;
}

const matchmakingQueue: MatchmakingQueue[] = [];
const activeGames = new Map<string, { hostUserId: string; status: string }>();

router.post("/join", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    
    const existingIndex = matchmakingQueue.findIndex(m => m.userId === userId);
    if (existingIndex !== -1) {
      return res.status(400).json({ error: "Already in queue" });
    }

    console.log(`[MATCHMAKING] User ${userId} joined queue. Queue size: ${matchmakingQueue.length + 1}`);
    matchmakingQueue.push({ userId, joinedAt: new Date() });

    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift()!;
      const player2 = matchmakingQueue.shift()!;

      console.log(`[MATCHMAKING] Match found! Player1: ${player1.userId}, Player2: ${player2.userId}`);

      const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      activeGames.set(gameId, {
        hostUserId: player1.userId,
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
        console.log(`[MATCHMAKING] Game session created: ${gameId}`);
      } catch (dbError) {
        console.error("[MATCHMAKING] Game session creation failed:", dbError);
        activeGames.delete(gameId);
        return res.status(500).json({ error: "Failed to create game session" });
      }

      let serverUrl: string | null = null;
      
      const localMode = process.env.LOCAL_GAME_SERVER === "true";
      
      try {
        if (localMode) {
          serverUrl = `http://localhost:3000`;
        } else {
          const server = await createGameServer(gameId);
          serverUrl = server?.url || null;
          console.log(`[MATCHMAKING] Game server created: ${serverUrl}`);
        }
      } catch (k8sError) {
        console.log("[MATCHMAKING] K8s unavailable, running without game server");
      }

      if (player2.userId === userId) {
        console.log(`[MATCHMAKING] Sending match response to player2: ${userId}`);
        if (io) {
          io.to(player1.userId).emit("match:found", { gameId, opponent: player2.userId, serverUrl });
          console.log(`[MATCHMAKING] Socket notification sent to player1: ${player1.userId}`);
        } else {
          console.log(`[MATCHMAKING] ERROR: io is null!`);
        }
        return res.json({
          success: true,
          gameId,
          matched: true,
          opponent: player1.userId,
          serverUrl,
        });
      }

      console.log(`[MATCHMAKING] Sending match response to player1: ${userId}`);
      if (io) {
        io.to(player2.userId).emit("match:found", { gameId, opponent: player1.userId, serverUrl });
        console.log(`[MATCHMAKING] Socket notification sent to player2: ${player2.userId}`);
      } else {
        console.log(`[MATCHMAKING] ERROR: io is null!`);
      }
      return res.json({
        success: true,
        gameId,
        matched: true,
        opponent: player2.userId,
        serverUrl,
      });
    }

    console.log(`[MATCHMAKING] User ${userId} waiting in queue. Position: ${matchmakingQueue.length}`);
    res.json({ success: true, matched: false, position: matchmakingQueue.length });
  } catch (error) {
    console.error("[MATCHMAKING] Matchmaking error:", error);
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
  const userId = (req.user as any).id;
  console.log(`[GAME-DETAILS] Fetching game ${req.params.gameId} for user ${userId}`);
  try {
    const { gameId } = req.params;
    const userId = (req.user as any).id;

    const game = await prisma.gameSession.findUnique({
      where: { id: gameId },
    });

    console.log(`[GAME-DETAILS] Game found:`, JSON.stringify(game, null, 2));

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (game.player1Id !== userId && game.player2Id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const isPlayer1 = game.player1Id === userId;
    const opponentId = isPlayer1 ? game.player2Id : game.player1Id;

    console.log(`[GAME-DETAILS] opponentId:`, opponentId);

    const opponent = await prisma.user.findUnique({
      where: { id: opponentId },
      select: { displayName: true, avatar: true },
    });

    console.log(`[GAME-DETAILS] opponent found:`, opponent);

    res.json({
      gameId: game.id,
      status: game.status,
      serverUrl: game.serverUrl,
      isHost: game.player1Id === userId,
      opponent: opponent || { displayName: "Unknown", avatar: null },
    });
  } catch (error) {
    console.error("[GAME-DETAILS] Error:", error);
    res.status(500).json({ error: "Failed to get game" });
  }
});

router.post("/game/:gameId/end", isAuthenticated, async (req, res) => {
  const userId = (req.user as any).id;
  console.log(`[END-GAME] Request received from user ${userId} for game ${req.params.gameId}`);
  try {
    const { gameId } = req.params;
    const userId = (req.user as any).id;

    const game = await prisma.gameSession.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      console.log(`[END-GAME] Game ${gameId} not found`);
      return res.status(404).json({ error: "Game not found" });
    }

    if (game.player1Id !== userId) {
      console.log(`[END-GAME] User ${userId} is not host (player1 is ${game.player1Id})`);
      return res.status(403).json({ error: "Only host can end game" });
    }

    console.log(`[END-GAME] Destroying game server for ${gameId}`);
    await destroyGameServer(gameId);

    await prisma.gameSession.update({
      where: { id: gameId },
      data: { status: "completed" },
    });

    activeGames.delete(gameId);

    console.log(`[END-GAME] Game ${gameId} ended successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[END-GAME] Error ending game ${req.params.gameId}:`, error);
    res.status(500).json({ error: "Failed to end game" });
  }
});

export default router;
