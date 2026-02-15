import express from "express";
import { isAuthenticated } from "../middleware/auth";
import { isAdmin } from "../middleware/admin";
import prisma from "../config/database";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadDir = path.join(process.cwd(), "assets", "patchnotes");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const [patchNotes, total] = await Promise.all([
      prisma.patchNote.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.patchNote.count(),
    ]);

    res.json({
      patchNotes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching patch notes:", error);
    res.status(500).json({ error: "Failed to fetch patch notes" });
  }
});

router.get("/latest", async (req, res) => {
  try {
    const latest = await prisma.patchNote.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!latest) {
      return res.json({ version: "v0.1.0", title: "Welcome to Fortezza Tactics Online!" });
    }

    res.json({
      version: latest.version,
      title: latest.title,
    });
  } catch (error) {
    console.error("Error fetching latest patch note:", error);
    res.status(500).json({ error: "Failed to fetch latest patch note" });
  }
});

router.post("/upload", isAuthenticated, isAdmin, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imageUrl = `/assets/patchnotes/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.post("/", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { version, title, content, imageUrl } = req.body;

    if (!version || !title || !content) {
      return res.status(400).json({ error: "Version, title, and content are required" });
    }

    const patchNote = await prisma.patchNote.create({
      data: {
        version,
        title,
        content,
        imageUrl,
      },
    });

    res.json(patchNote);
  } catch (error) {
    console.error("Error creating patch note:", error);
    res.status(500).json({ error: "Failed to create patch note" });
  }
});

router.put("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { version, title, content, imageUrl } = req.body;

    if (!version || !title || !content) {
      return res.status(400).json({ error: "Version, title, and content are required" });
    }

    const patchNote = await prisma.patchNote.update({
      where: { id },
      data: {
        version,
        title,
        content,
        imageUrl,
      },
    });

    res.json(patchNote);
  } catch (error) {
    console.error("Error updating patch note:", error);
    res.status(500).json({ error: "Failed to update patch note" });
  }
});

router.delete("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.patchNote.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting patch note:", error);
    res.status(500).json({ error: "Failed to delete patch note" });
  }
});

export default router;
