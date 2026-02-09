import { Server } from "socket.io";
import { createServer } from "http";

interface GamePlayer {
  id: string;
  userId: string;
  connected: boolean;
}

const players = new Map<string, GamePlayer>();
const gameId = process.env.GAME_ID || "unknown";
const port = parseInt(process.env.PORT || "3000");

const httpServer = createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", gameId }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://fortezza.colechiodo.cc",
];

console.log(`[${gameId}] ALLOWED_ORIGINS:`, ALLOWED_ORIGINS);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: `/game/${gameId}/socket.io`,
});

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId as string;
  
  if (!userId) {
    socket.disconnect();
    return;
  }

  console.log(`[${gameId}] Player connected: ${userId}`);

  players.set(userId, {
    id: socket.id,
    userId,
    connected: true,
  });

  io.emit("game:state", {
    gameId,
    players: Array.from(players.keys()),
    playerCount: players.size,
  });

  socket.on("game:action", (data) => {
    socket.broadcast.emit("game:action", {
      playerId: userId,
      action: data,
      timestamp: Date.now(),
    });
  });

  socket.on("game:chat", (data) => {
    io.emit("game:chat", {
      playerId: userId,
      message: data.message,
      timestamp: Date.now(),
    });
  });

  socket.on("disconnect", () => {
    console.log(`[${gameId}] Player disconnected: ${userId}`);
    players.delete(userId);

    io.emit("game:state", {
      gameId,
      players: Array.from(players.keys()),
      playerCount: players.size,
    });
  });
});

httpServer.listen(port, () => {
  console.log(`[${gameId}] Game server listening on port ${port}`);
});

process.on("SIGTERM", () => {
  console.log(`[${gameId}] Received SIGTERM, shutting down...`);
  io.close();
  httpServer.close();
  process.exit(0);
});
