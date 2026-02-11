import express from "express";
import { isAuthenticated } from "../middleware/auth";
import prisma from "../config/database";

const router = express.Router();

interface AvatarInfo {
  id: string;
  path: string;
  price: number | null;
  owned: boolean;
}

const AVAILABLE_AVATARS: AvatarInfo[] = [
  { id: "free/default", path: "/assets/avatars/free/default.png", price: null, owned: true },
  { id: "300/kawaiiface", path: "/assets/avatars/300/kawaiiface.png", price: 300, owned: false },
  { id: "300/lemon", path: "/assets/avatars/300/lemon.png", price: 300, owned: false },
];

router.get("/avatars", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;

    const userPurchased = await prisma.purchasedItem.findMany({
      where: {
        userId,
        type: "avatar",
      },
      select: { key: true },
    });

    const ownedIds = new Set(userPurchased.map(p => p.key));

    const avatars: AvatarInfo[] = AVAILABLE_AVATARS.map(avatar => ({
      ...avatar,
      owned: avatar.price === null || ownedIds.has(avatar.id),
    }));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    const currentAvatar = user?.avatar;

    res.json({ avatars, ownedIds: Array.from(ownedIds), currentAvatar });
  } catch (error) {
    console.error("Error fetching avatars:", error);
    res.status(500).json({ error: "Failed to fetch avatars" });
  }
});

router.post("/avatars/equip", isAuthenticated, async (req, res) => {
  try {
    const { avatarId } = req.body;
    const userId = (req.user as any).id;

    const purchased = await prisma.purchasedItem.findUnique({
      where: {
        userId_type_key: {
          userId,
          type: "avatar",
          key: avatarId,
        },
      },
    });

    const isFree = avatarId.startsWith("free/");

    if (!purchased && !isFree) {
      return res.status(403).json({ error: "You do not own this avatar" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatar: `/assets/avatars/${avatarId}.png` },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error equipping avatar:", error);
    res.status(500).json({ error: "Failed to equip avatar" });
  }
});

router.post("/avatars/purchase", isAuthenticated, async (req, res) => {
  try {
    const { avatarId } = req.body;
    const userId = (req.user as any).id;

    const avatarInfo = AVAILABLE_AVATARS.find(a => a.id === avatarId);
    if (!avatarInfo) {
      return res.status(404).json({ error: "Avatar not found" });
    }

    if (avatarInfo.price === null) {
      return res.status(400).json({ error: "This avatar is free" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const purchased = await prisma.purchasedItem.findUnique({
      where: {
        userId_type_key: {
          userId,
          type: "avatar",
          key: avatarId,
        },
      },
    });

    if (purchased) {
      return res.status(400).json({ error: "You already own this avatar" });
    }

    const price = avatarInfo.price;
    const userCurrency = user.currency;
    if (userCurrency < price) {
      return res.status(403).json({ error: `Not enough coins. Need ${price}, have ${userCurrency}` });
    }

    await prisma.$transaction([
      prisma.purchasedItem.create({
        data: {
          userId,
          type: "avatar",
          key: avatarId,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { currency: userCurrency - price },
      }),
    ]);

    res.json({ success: true, remainingCurrency: userCurrency - price });
  } catch (error) {
    console.error("Error purchasing avatar:", error);
    res.status(500).json({ error: "Failed to purchase avatar" });
  }
});

export default router;
