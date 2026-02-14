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

    // First check if player is already in an active match
    const existingGame = await prisma.gameSession.findFirst({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: { in: ["match_found", "in_progress"] },
      },
    });

    if (existingGame) {
      console.log(`[MATCHMAKING] User ${userId} rejoining existing game: ${existingGame.id}`);
      const opponentId = existingGame.player1Id === userId ? existingGame.player2Id : existingGame.player1Id;
      const opponent = await prisma.user.findUnique({
        where: { id: opponentId },
        select: { displayName: true, avatar: true },
      });

      return res.json({
        success: true,
        matched: true,
        gameId: existingGame.id,
        serverUrl: existingGame.serverUrl,
        isHost: existingGame.player1Id === userId,
        opponent: opponent || { displayName: "Unknown", avatar: null },
        rejoin: true,
      });
    }

    // Check if already in queue
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

router.get("/queue-count", async (req, res) => {
  try {
    const queueCount = matchmakingQueue.length;
    
    // Count unique players in active games
    const activeGames = await prisma.gameSession.findMany({
      where: {
        status: { in: ["match_found", "in_progress"] },
      },
      select: {
        player1Id: true,
        player2Id: true,
      },
    });
    
    const activePlayerIds = new Set<string>();
    for (const game of activeGames) {
      activePlayerIds.add(game.player1Id);
      if (game.player2Id) {
        activePlayerIds.add(game.player2Id);
      }
    }
    
    const totalOnline = queueCount + activePlayerIds.size;
    
    res.json({ 
      count: totalOnline,
      inQueue: queueCount,
      inGame: activePlayerIds.size,
    });
  } catch (error) {
    console.error("Queue count error:", error);
    res.status(500).json({ error: "Failed to get queue count" });
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

router.post("/game/:gameId/complete", async (req, res) => {
  const { gameId } = req.params;
  const { secret, winnerId, loserId, endReason, duration, player1Stats, player2Stats, replayEvents } = req.body;

  const EXPECTED_SECRET = process.env.GAME_SERVER_SECRET;
  if (!secret || secret !== EXPECTED_SECRET) {
    console.log(`[COMPLETE-GAME] Invalid secret for game ${gameId}`);
    return res.status(403).json({ error: "Forbidden" });
  }

  console.log(`[COMPLETE-GAME] Game server signaling completion for ${gameId}`);
  try {
    const game = await prisma.gameSession.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      console.log(`[COMPLETE-GAME] Game ${gameId} not found`);
      return res.status(404).json({ error: "Game not found" });
    }

    if (game.status === "completed") {
      console.log(`[COMPLETE-GAME] Game ${gameId} already completed`);
      return res.json({ success: true });
    }

    await destroyGameServer(gameId);

    const isPlayer1Winner = winnerId === game.player1Id;

    await prisma.gameSession.update({
      where: { id: gameId },
      data: { 
        status: "completed",
        winnerId,
        loserId,
        endReason,
      },
    });

    // Calculate XP rewards
    const BASE_XP_WIN = 50;
    const BASE_XP_LOSS = 15;
    const XP_PER_LEVEL = 250;

    // Get current user data for XP calculation
    const winnerUser = await prisma.user.findUnique({ where: { id: winnerId } });
    const loserUser = loserId ? await prisma.user.findUnique({ where: { id: loserId } }) : null;

    let winnerXpGain = 0;
    let loserXpGain = 0;
    let winnerLeveledUp = false;
    let loserLeveledUp = false;

    if (winnerUser && player1Stats) {
      const stats = isPlayer1Winner ? player1Stats : player2Stats;
      winnerXpGain = BASE_XP_WIN + Math.floor((stats?.unitsKilled || 0) * 5);
      const newTotalXp = (winnerUser.xp || 0) + winnerXpGain;
      const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;
      
      await prisma.user.update({
        where: { id: winnerId },
        data: { 
          xp: newTotalXp,
          level: newLevel,
          currency: winnerUser.currency + (newLevel > winnerUser.level ? 100 : 0),
        },
      });
      winnerLeveledUp = newLevel > winnerUser.level;
    }

    if (loserUser && loserId && player1Stats && player2Stats) {
      const stats = !isPlayer1Winner ? player1Stats : player2Stats;
      loserXpGain = BASE_XP_LOSS + Math.floor((stats?.unitsKilled || 0) * 3);
      const newTotalXp = (loserUser.xp || 0) + loserXpGain;
      const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;
      
      await prisma.user.update({
        where: { id: loserId },
        data: { 
          xp: newTotalXp,
          level: newLevel,
        },
      });
      loserLeveledUp = newLevel > loserUser.level;
    }

    // Update rank wins/losses and streaks
    if (winnerId) {
      console.log(`[COMPLETE-GAME] Updating rank for winner ${winnerId}`);
      const winnerRank = await prisma.rank.findUnique({ where: { userId: winnerId } });
      const newStreak = (winnerRank?.streak || 0) + 1;
      const newLongestStreak = Math.max(winnerRank?.longestStreak || 0, newStreak);
      
      await prisma.rank.upsert({
        where: { userId: winnerId },
        update: { 
          wins: { increment: 1 },
          streak: newStreak,
          longestStreak: newLongestStreak,
        },
        create: { userId: winnerId, wins: 1, losses: 0, streak: 1, longestStreak: 1, elo: 1000, tier: "BRONZE" },
      });
    }
    if (loserId) {
      console.log(`[COMPLETE-GAME] Updating rank for loser ${loserId}`);
      await prisma.rank.upsert({
        where: { userId: loserId },
        update: { 
          losses: { increment: 1 },
          streak: 0, // Reset streak on loss
        },
        create: { userId: loserId, wins: 0, losses: 1, streak: 0, longestStreak: 0, elo: 1000, tier: "BRONZE" },
      });
    }

    // Get updated user data to return
    const updatedWinnerUser = winnerId ? await prisma.user.findUnique({ 
      where: { id: winnerId },
      select: { level: true, xp: true, currency: true }
    }) : null;
    
    const updatedLoserUser = loserId ? await prisma.user.findUnique({ 
      where: { id: loserId },
      select: { level: true, xp: true, currency: true }
    }) : null;

    if (player1Stats && player2Stats) {
      await prisma.gameStats.create({
        data: {
          gameSessionId: game.id,
          userId: game.player1Id,
          isPlayer1: true,
          unitsKilled: player1Stats.unitsKilled || 0,
          unitsLost: player1Stats.unitsLost || 0,
          damageDealt: player1Stats.damageDealt || 0,
          damageHealed: player1Stats.damageHealed || 0,
          rounds: player1Stats.rounds || 0,
          duration: duration || 0,
          timeUsed: player1Stats.timeUsed || 0,
          attacksMade: player1Stats.attacksMade || 0,
          killsLanded: player1Stats.killsLanded || 0,
          avgDamagePerAttack: player1Stats.avgDamagePerAttack || 0,
          remainingKingHealth: player1Stats.remainingKingHealth || 0,
          meleeDamage: player1Stats.meleeDamage || 0,
          rangedDamage: player1Stats.rangedDamage || 0,
          mageDamage: player1Stats.mageDamage || 0,
          healerDamage: player1Stats.healerDamage || 0,
          cavalryDamage: player1Stats.cavalryDamage || 0,
          scoutDamage: player1Stats.scoutDamage || 0,
          tankDamage: player1Stats.tankDamage || 0,
          kingDamage: player1Stats.kingDamage || 0,
          meleeHealing: player1Stats.meleeHealing || 0,
          rangedHealing: player1Stats.rangedHealing || 0,
          mageHealing: player1Stats.mageHealing || 0,
          healerHealing: player1Stats.healerHealing || 0,
          cavalryHealing: player1Stats.cavalryHealing || 0,
          scoutHealing: player1Stats.scoutHealing || 0,
          tankHealing: player1Stats.tankHealing || 0,
          kingHealing: player1Stats.kingHealing || 0,
          meleeKilled: player1Stats.meleeKilled || 0,
          rangedKilled: player1Stats.rangedKilled || 0,
          mageKilled: player1Stats.mageKilled || 0,
          healerKilled: player1Stats.healerKilled || 0,
          cavalryKilled: player1Stats.cavalryKilled || 0,
          scoutKilled: player1Stats.scoutKilled || 0,
          tankKilled: player1Stats.tankKilled || 0,
          kingKilled: player1Stats.kingKilled || 0,
          meleeLost: player1Stats.meleeLost || 0,
          rangedLost: player1Stats.rangedLost || 0,
          mageLost: player1Stats.mageLost || 0,
          healerLost: player1Stats.healerLost || 0,
          cavalryLost: player1Stats.cavalryLost || 0,
          scoutLost: player1Stats.scoutLost || 0,
          tankLost: player1Stats.tankLost || 0,
          kingLost: player1Stats.kingLost || 0,
        },
      });

      await prisma.gameStats.create({
        data: {
          gameSessionId: game.id,
          userId: game.player2Id,
          isPlayer1: false,
          unitsKilled: player2Stats.unitsKilled || 0,
          unitsLost: player2Stats.unitsLost || 0,
          damageDealt: player2Stats.damageDealt || 0,
          damageHealed: player2Stats.damageHealed || 0,
          rounds: player2Stats.rounds || 0,
          duration: duration || 0,
          timeUsed: player2Stats.timeUsed || 0,
          attacksMade: player2Stats.attacksMade || 0,
          killsLanded: player2Stats.killsLanded || 0,
          avgDamagePerAttack: player2Stats.avgDamagePerAttack || 0,
          remainingKingHealth: player2Stats.remainingKingHealth || 0,
          meleeDamage: player2Stats.meleeDamage || 0,
          rangedDamage: player2Stats.rangedDamage || 0,
          mageDamage: player2Stats.mageDamage || 0,
          healerDamage: player2Stats.healerDamage || 0,
          cavalryDamage: player2Stats.cavalryDamage || 0,
          scoutDamage: player2Stats.scoutDamage || 0,
          tankDamage: player2Stats.tankDamage || 0,
          kingDamage: player2Stats.kingDamage || 0,
          meleeHealing: player2Stats.meleeHealing || 0,
          rangedHealing: player2Stats.rangedHealing || 0,
          mageHealing: player2Stats.mageHealing || 0,
          healerHealing: player2Stats.healerHealing || 0,
          cavalryHealing: player2Stats.cavalryHealing || 0,
          scoutHealing: player2Stats.scoutHealing || 0,
          tankHealing: player2Stats.tankHealing || 0,
          kingHealing: player2Stats.kingHealing || 0,
          meleeKilled: player2Stats.meleeKilled || 0,
          rangedKilled: player2Stats.rangedKilled || 0,
          mageKilled: player2Stats.mageKilled || 0,
          healerKilled: player2Stats.healerKilled || 0,
          cavalryKilled: player2Stats.cavalryKilled || 0,
          scoutKilled: player2Stats.scoutKilled || 0,
          tankKilled: player2Stats.tankKilled || 0,
          kingKilled: player2Stats.kingKilled || 0,
          meleeLost: player2Stats.meleeLost || 0,
          rangedLost: player2Stats.rangedLost || 0,
          mageLost: player2Stats.mageLost || 0,
          healerLost: player2Stats.healerLost || 0,
          cavalryLost: player2Stats.cavalryLost || 0,
          scoutLost: player2Stats.scoutLost || 0,
          tankLost: player2Stats.tankLost || 0,
          kingLost: player2Stats.kingLost || 0,
        },
      });
    }

    // Save replay data for both players
    if (replayEvents && replayEvents.length > 0) {
      const matchData = {
        events: replayEvents,
        duration,
        winnerId,
        loserId,
        endReason,
        player1Stats,
        player2Stats,
      };

      try {
        // Save replay for player 1
        await prisma.replay.upsert({
          where: { gameSessionId_userId: { gameSessionId: game.id, userId: game.player1Id } },
          create: {
            gameSessionId: game.id,
            userId: game.player1Id,
            matchData: matchData as any,
            winnerId,
            duration: duration || 0,
          },
          update: {
            matchData: matchData as any,
            winnerId,
            duration: duration || 0,
          },
        });

        // Save replay for player 2
        await prisma.replay.upsert({
          where: { gameSessionId_userId: { gameSessionId: game.id, userId: game.player2Id } },
          create: {
            gameSessionId: game.id,
            userId: game.player2Id,
            matchData: matchData as any,
            winnerId,
            duration: duration || 0,
          },
          update: {
            matchData: matchData as any,
            winnerId,
            duration: duration || 0,
          },
        });

        // Clean up old replays - keep only last 5 per player
        const MAX_REPLAYS = 5;

        for (const playerId of [game.player1Id, game.player2Id]) {
          const playerReplays = await prisma.replay.findMany({
            where: { userId: playerId },
            orderBy: { createdAt: 'desc' },
          });
          console.log(`[COMPLETE-GAME] Player ${playerId} has ${playerReplays.length} replays`);

          if (playerReplays.length > MAX_REPLAYS) {
            const replaysToDelete = playerReplays.slice(MAX_REPLAYS);
            const idsToDelete = replaysToDelete.map(r => r.id);
            await prisma.replay.deleteMany({
              where: { id: { in: idsToDelete } },
            });
            console.log(`[COMPLETE-GAME] Deleted ${idsToDelete.length} old replays for user ${playerId}`);
          }
        }
      } catch (replayError) {
        console.error("[COMPLETE-GAME] Error saving replays:", replayError);
      }
    }

    activeGames.delete(gameId);

    console.log(`[COMPLETE-GAME] Game ${gameId} completed successfully`);
    res.json({ 
      success: true,
      winner: updatedWinnerUser ? {
        level: updatedWinnerUser.level,
        xp: updatedWinnerUser.xp,
        xpGained: winnerXpGain,
        leveledUp: winnerLeveledUp,
        currencyGained: winnerLeveledUp ? 100 : 0,
      } : null,
      loser: updatedLoserUser ? {
        level: updatedLoserUser.level,
        xp: updatedLoserUser.xp,
        xpGained: loserXpGain,
        leveledUp: loserLeveledUp,
        currencyGained: loserLeveledUp ? 100 : 0,
      } : null,
    });
  } catch (error) {
    console.error(`[COMPLETE-GAME] Error completing game ${gameId}:`, error);
    res.status(500).json({ error: "Failed to complete game" });
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
