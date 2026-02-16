import express from "express";
import passport from "../config/passport";
import { isAuthenticated } from "../middleware/auth";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/play`);
  },
);

router.get("/discord", passport.authenticate("discord"));

router.get(
  "/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/play`);
  },
);

router.get("/steam", passport.authenticate("steam"));

router.get(
  "/steam/callback",
  passport.authenticate("steam", {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/play`);
  },
);

router.get("/status", (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user as any;
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        level: user.level,
        xp: user.xp,
        currency: user.currency,
        rank: user.rank,
        hasAcceptedTerms: !!user.termsAcceptedAt,
        isAdmin: !!user.isAdmin,
      },
    });
  } else {
    res.json({ authenticated: false });
  }
});

router.post("/update-display-name", isAuthenticated, async (req, res) => {
  const user = req.user as any;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const { displayName } = req.body;

  if (!displayName || displayName.length < 3 || displayName.length > 20) {
    res.status(400).json({ error: "Display name must be between 3 and 20 characters" });
    return;
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { displayName },
    });

    res.json({ success: true, displayName: updatedUser.displayName });
  } catch (error) {
    console.error("Error updating display name:", error);
    res.status(500).json({ error: "Failed to update display name" });
  }
});

router.post("/accept-terms", isAuthenticated, async (req, res) => {
  const user = req.user as any;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { termsAcceptedAt: new Date() },
    });

    res.json({ success: true, hasAcceptedTerms: !!updatedUser.termsAcceptedAt });
  } catch (error) {
    console.error("Error accepting terms:", error);
    res.status(500).json({ error: "Failed to accept terms" });
  }
});

router.post("/logout", isAuthenticated, (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.json({ success: true });
  });
});

router.get("/seasons", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const ranks = await prisma.rank.findMany({
      where: { userId: user.id },
      select: { season: true },
      orderBy: { season: 'desc' },
    });

    const seasons = ranks.map(r => r.season);
    res.json({ seasons });
  } catch (error) {
    console.error("Error fetching seasons:", error);
    res.status(500).json({ error: "Failed to fetch seasons" });
  }
});

router.get("/rank/:season", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { season } = req.params;
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const rank = await prisma.rank.findFirst({
      where: { userId: user.id, season: parseInt(season) },
    });

    if (!rank) {
      return res.json({ rank: null });
    }

    res.json({
      rank: {
        elo: rank.elo,
        tier: rank.tier,
        wins: rank.wins,
        losses: rank.losses,
        streak: rank.streak,
        longestStreak: rank.longestStreak,
        season: rank.season,
      },
    });
  } catch (error) {
    console.error("Error fetching season rank:", error);
    res.status(500).json({ error: "Failed to fetch season rank" });
  }
});

export default router;
