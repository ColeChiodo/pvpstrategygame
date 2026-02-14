import express from "express";
import { isAuthenticated } from "../middleware/auth";
import prisma from "../config/database";

const router = express.Router();

router.get("/user/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    const gameStats = await prisma.gameStats.findMany({
      where: { userId },
    });

    if (!gameStats.length) {
      return res.json({
        totalGames: 0,
        wins: 0,
        losses: 0,
        unitsKilled: 0,
        unitsLost: 0,
        damageDealt: 0,
        damageHealed: 0,
        totalDuration: 0,
        mvpUnit: null,
      });
    }

    const totals = gameStats.reduce((acc, stat) => ({
      unitsKilled: acc.unitsKilled + stat.unitsKilled,
      unitsLost: acc.unitsLost + stat.unitsLost,
      damageDealt: acc.damageDealt + stat.damageDealt,
      damageHealed: acc.damageHealed + stat.damageHealed,
      totalDuration: acc.totalDuration + stat.duration,
      meleeKilled: (acc as any).meleeKilled + stat.meleeKilled,
      rangedKilled: (acc as any).rangedKilled + stat.rangedKilled,
      mageKilled: (acc as any).mageKilled + stat.mageKilled,
      healerKilled: (acc as any).healerKilled + stat.healerKilled,
      cavalryKilled: (acc as any).cavalryKilled + stat.cavalryKilled,
      scoutKilled: (acc as any).scoutKilled + stat.scoutKilled,
      tankKilled: (acc as any).tankKilled + stat.tankKilled,
      kingKilled: (acc as any).kingKilled + stat.kingKilled,
      meleeDamage: (acc as any).meleeDamage + stat.meleeDamage,
      rangedDamage: (acc as any).rangedDamage + stat.rangedDamage,
      mageDamage: (acc as any).mageDamage + stat.mageDamage,
      healerDamage: (acc as any).healerDamage + stat.healerDamage,
      cavalryDamage: (acc as any).cavalryDamage + stat.cavalryDamage,
      scoutDamage: (acc as any).scoutDamage + stat.scoutDamage,
      tankDamage: (acc as any).tankDamage + stat.tankDamage,
      kingDamage: (acc as any).kingDamage + stat.kingDamage,
      meleeHealing: (acc as any).meleeHealing + stat.meleeHealing,
      rangedHealing: (acc as any).rangedHealing + stat.rangedHealing,
      mageHealing: (acc as any).mageHealing + stat.mageHealing,
      healerHealing: (acc as any).healerHealing + stat.healerHealing,
      cavalryHealing: (acc as any).cavalryHealing + stat.cavalryHealing,
      scoutHealing: (acc as any).scoutHealing + stat.scoutHealing,
      tankHealing: (acc as any).tankHealing + stat.tankHealing,
      kingHealing: (acc as any).kingHealing + stat.kingHealing,
    }), {
      unitsKilled: 0,
      unitsLost: 0,
      damageDealt: 0,
      damageHealed: 0,
      totalDuration: 0,
    } as any);

    const rank = await prisma.rank.findUnique({
      where: { userId },
    });

    const units = [
      { type: 'melee', kills: totals.meleeKilled, damage: totals.meleeDamage },
      { type: 'ranged', kills: totals.rangedKilled, damage: totals.rangedDamage },
      { type: 'mage', kills: totals.mageKilled, damage: totals.mageDamage },
      { type: 'healer', kills: totals.healerKilled, damage: totals.healerDamage },
      { type: 'cavalry', kills: totals.cavalryKilled, damage: totals.cavalryDamage },
      { type: 'scout', kills: totals.scoutKilled, damage: totals.scoutDamage },
      { type: 'tank', kills: totals.tankKilled, damage: totals.tankDamage },
      { type: 'king', kills: totals.kingKilled, damage: totals.kingDamage },
    ];

    const mvpUnit = units.reduce((best, current) => {
      const currentScore = current.kills * 10 + current.damage / 10;
      const bestScore = (best.kills * 10 + best.damage / 10);
      return currentScore > bestScore ? current : best;
    });

    res.json({
      totalGames: gameStats.length,
      wins: rank?.wins || 0,
      losses: rank?.losses || 0,
      unitsKilled: totals.unitsKilled,
      unitsLost: totals.unitsLost,
      damageDealt: totals.damageDealt,
      damageHealed: totals.damageHealed,
      totalDuration: totals.totalDuration,
      mvpUnit: mvpUnit.kills > 0 || mvpUnit.damage > 0 ? mvpUnit : null,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

router.get("/match-history/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    const offset = parseInt(req.query.offset as string) || 0;

    const gameSessions = await prisma.gameSession.findMany({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: "completed",
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const matches = await Promise.all(
      gameSessions.map(async (session) => {
        const isPlayer1 = session.player1Id === userId;
        const opponentId = isPlayer1 ? session.player2Id : session.player1Id;
        const opponent = await prisma.user.findUnique({
          where: { id: opponentId },
          select: { displayName: true, avatar: true },
        });

        const playerStats = isPlayer1
          ? await prisma.gameStats.findFirst({ where: { gameSessionId: session.id, isPlayer1: true } })
          : await prisma.gameStats.findFirst({ where: { gameSessionId: session.id, isPlayer1: false } });

        const replay = await prisma.replay.findFirst({
          where: { gameSessionId: session.id, userId: userId },
        });

        const won = session.winnerId === userId;

        return {
          gameId: session.id,
          won,
          opponent: opponent ? { displayName: opponent.displayName, avatar: opponent.avatar } : null,
          endReason: session.endReason,
          duration: playerStats?.duration || 0,
          unitsKilled: playerStats?.unitsKilled || 0,
          unitsLost: playerStats?.unitsLost || 0,
          damageDealt: playerStats?.damageDealt || 0,
          hasReplay: !!replay,
          createdAt: session.updatedAt,
        };
      })
    );

    res.json({ matches });
  } catch (error) {
    console.error("Error fetching match history:", error);
    res.status(500).json({ error: "Failed to fetch match history" });
  }
});

export default router;
