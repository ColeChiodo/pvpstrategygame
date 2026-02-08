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

export default router;
