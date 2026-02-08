import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

interface GamePlayer {
  id: string;
  userId: string;
  socket: Socket;
}

interface GameState {
  gameId: string;
  players: Map<string, GamePlayer>;
  status: "waiting" | "active" | "completed";
  createdAt: Date;
}

const games = new Map<string, GameState>();

export function setupGameServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const gameId = socket.handshake.query.gameId as string;
    const userId = socket.handshake.query.userId as string;

    if (!gameId || !userId) {
      return next(new Error("Missing gameId or userId"));
    }

    socket.data.gameId = gameId;
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const { gameId, userId } = socket.data;
    console.log(`Player connected: ${userId} to game ${gameId}`);

    let game = games.get(gameId);

    if (!game) {
      game = {
        gameId,
        players: new Map(),
        status: "waiting",
        createdAt: new Date(),
      };
      games.set(gameId, game);
    }

    if (game.status === "completed") {
      socket.emit("game:ended", { reason: "Game has ended" });
      socket.disconnect();
      return;
    }

    const player: GamePlayer = {
      id: socket.id,
      userId,
      socket,
    };

    game.players.set(userId, player);

    socket.emit("game:joined", {
      gameId,
      playerId: userId,
      players: Array.from(game.players.keys()),
    });

    socket.to(gameId).emit("player:joined", {
      playerId: userId,
      players: Array.from(game.players.keys()),
    });

    if (game.players.size >= 2 && game.status === "waiting") {
      game.status = "active";
      io.to(gameId).emit("game:started", {
        timestamp: Date.now(),
      });
    }

    socket.on("game:action", (data) => {
      if (game?.status === "active") {
        socket.to(gameId).emit("game:action", {
          playerId: userId,
          action: data,
          timestamp: Date.now(),
        });
      }
    });

    socket.on("game:chat", (data) => {
      io.to(gameId).emit("game:chat", {
        playerId: userId,
        message: data.message,
        timestamp: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`Player disconnected: ${userId} from game ${gameId}`);
      game?.players.delete(userId);

      if (game) {
        io.to(gameId).emit("player:left", {
          playerId: userId,
          players: Array.from(game.players.keys()),
        });

        if (game.players.size === 0) {
          games.delete(gameId);
          console.log(`Game ${gameId} cleaned up (no players)`);
        }
      }
    });

    socket.on("game:end", (data) => {
      const playerEntry = game?.players.get(userId);
      if (playerEntry && data.winnerId === userId) {
        io.to(gameId).emit("game:ended", {
          winnerId: userId,
          reason: data.reason || "Player surrendered",
          timestamp: Date.now(),
        });
        game!.status = "completed";
      }
    });
  });

  return io;
}

export function getGameState(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function destroyGame(gameId: string): boolean {
  const game = games.get(gameId);
  if (game) {
    game.players.forEach((player) => {
      player.socket.emit("game:destroyed", { reason: "Server shutting down" });
      player.socket.disconnect();
    });
    games.delete(gameId);
    return true;
  }
  return false;
}
