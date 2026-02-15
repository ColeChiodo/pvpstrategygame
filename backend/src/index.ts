import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";
import cors from "cors";
import passport from "./config/passport";
import prisma from "./config/database";
import redis from "./config/redis";
import authRoutes from "./routes/auth";
import patchNotesRoutes from "./routes/patchNotes";
import avatarsRoutes from "./routes/avatars";
import matchmakingRoutes from "./routes/matchmaking";
import statsRoutes from "./routes/stats";
import { createProxyMiddleware } from "http-proxy-middleware";
import { Server as SocketIOServer } from "socket.io";
import { setMatchmakingIO } from "./routes/matchmaking";
import path from "path";

const PORT = process.env.PORT || 3000;

async function main() {
  // Cleanup old game sessions on startup - only waiting sessions can be safely removed
  // Mark in_progress/match_found as abandoned instead of deleting
  try {
    await prisma.gameSession.deleteMany({
      where: {
        status: "waiting",
      },
    });
    await prisma.gameSession.updateMany({
      where: {
        status: { in: ["match_found", "in_progress"] },
      },
      data: {
        status: "abandoned",
      },
    });
    console.log("Cleaned up old game sessions");
  } catch (err) {
    console.warn("Failed to cleanup game sessions:", err);
  }

  const app = express();

  // Trust Cloudflare proxy for proper HTTPS detection (secure cookies)
  app.set("trust proxy", 1);

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL || "http://localhost:5173",
          process.env.GAME_URL || "http://localhost:4000"
        ];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }),
  );

  // JSON parser
  app.use(express.json());

  // Static files for patch notes images
  app.use("/assets/patchnotes", express.static(path.join(process.cwd(), "assets", "patchnotes")));

  // Redis client
  const redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
  await redisClient.connect();

  const isProduction = process.env.NODE_ENV === "production";

  // Session middleware
  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        domain: isProduction ? ".colechiodo.cc" : undefined,
        sameSite: isProduction ? "none" : "lax",
      },
    }),
  );

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/patch-notes", patchNotesRoutes);
  app.use("/api", avatarsRoutes);
  app.use("/api/matchmaking", matchmakingRoutes);
  app.use("/api/stats", statsRoutes);

  // Game server WebSocket proxy
  app.use("/game-ws", createProxyMiddleware({
    target: "http://localhost:3000",
    changeOrigin: true,
    ws: true,
    pathFilter: "/game-ws",
  }));

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Socket.IO setup
  const io = new SocketIOServer(server, {
    cors: {
      origin: [process.env.FRONTEND_URL || "http://localhost:5173", process.env.GAME_URL || "http://localhost:4000"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    
    socket.on("authenticate", (userId: string) => {
      socket.join(userId);
      console.log(`[SOCKET] User ${userId} joined room ${userId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  // Pass socket.io instance to matchmaking routes
  setMatchmakingIO(io);

  // Graceful shutdown
  const gracefulShutdown = async () => {
    console.log("Shutting down gracefully...");
    server.close(() => console.log("HTTP server closed"));
    await prisma.$disconnect();
    await redisClient.quit();
    process.exit(0);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

// Run main and handle errors
main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
