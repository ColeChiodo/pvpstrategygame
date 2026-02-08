import express from "express";
import { isAuthenticated } from "../middleware/auth";
import prisma from "../config/database";
import path from "path";
import fs from "fs";

const router = express.Router();

interface AvatarInfo {
  id: string;
  path: string;
  price: number | null;
  owned: boolean;
}

router.get("/avatars", isAuthenticated, async (req, res) => {
  try {
    const avatarsDir = path.join(process.cwd(), "..", "frontend", "public", "assets", "avatars");
    
    if (!fs.existsSync(avatarsDir)) {
      return res.json({ avatars: [], ownedIds: [] });
    }

    const avatarFolders = fs.readdirSync(avatarsDir);
    const avatars: AvatarInfo[] = [];
    const ownedIds: string[] = [];

    for (const folder of avatarFolders) {
      const folderPath = path.join(avatarsDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const price = folder === "free" ? null : parseInt(folder) || null;

      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (!file.match(/\.(png|jpg|jpeg|webp|svg)$/i)) continue;

        const avatarPath = `/assets/avatars/${folder}/${file}`;
        const avatarId = `${folder}/${file.replace(/\.[^/.]+$/, "")}`;

        avatars.push({
          id: avatarId,
          path: avatarPath,
          price,
          owned: price === null,
        });

        if (price === null) {
          ownedIds.push(avatarId);
        }
      }
    }

    const userPurchased = await prisma.purchasedItem.findMany({
      where: {
        userId: (req.user as any).id,
        type: "avatar",
      },
      select: { key: true },
    });

    for (const purchased of userPurchased) {
      ownedIds.push(purchased.key);
      const avatar = avatars.find(a => a.id === purchased.key);
      if (avatar) {
        avatar.owned = true;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: (req.user as any).id },
      select: { avatar: true },
    });

    const currentAvatar = user?.avatar;

    res.json({ avatars, ownedIds, currentAvatar });
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

    const folder = avatarId.split("/")[0];
    const price = folder === "free" ? null : parseInt(folder) || 0;

    if (price === null) {
      return res.status(400).json({ error: "This avatar is free" });
    }

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
