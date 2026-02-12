import { Server, Socket } from "socket.io";
import { createServer } from "http";
import { deflate, inflate } from 'pako';

const MAX_TIME = 60 * 10;
const TICKRATE = 1;

interface Player {
    id: string;
    userId: string;
    socketId: string;
    name: string;
    profileimage: string;
    units: Unit[];
}

interface Arena {
    width: number;
    height: number;
    name: string;
    tiles: number[][];
    heightMap: number[][];
    obstacles: Obstacle[];
    p1Start: { row: number; col: number };
    p2Start: { row: number; col: number };
}

interface Obstacle {
    name: string;
    row: number;
    col: number;
    sprite: Sprite;
}

interface Sprite {
    width: number;
    height: number;
    name: string;
    image: string;
    idleFrames?: number;
    currentFrame?: number;
    framesElapsed?: number;
    framesHold?: number;
}

interface Unit {
    id: number;
    row: number;
    col: number;
    name: string;
    action: string;
    canMove: boolean;
    canAct: boolean;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    mobility: number;
    mobilityRemaining: number;
}

interface GameState {
    id: string;
    privacy: string;
    players: Player[];
    arena: Arena;
    round: number;
    player1Time: number;
    player2Time: number;
    player1UltCharge: number;
    player2UltCharge: number;
    visibleTiles: { row: number; col: number }[];
}

interface Tile {
    x: number;
    y: number;
    g?: number;
    h?: number;
    f?: number;
    parent?: Tile | null;
}

let gameState: GameState | null = null;
let gameInterval: NodeJS.Timeout | null = null;
let gameId = process.env.GAME_ID || "unknown";
const port = parseInt(process.env.PORT || "3000");

// Connection timeout handling
let connectionWarningTimeout: NodeJS.Timeout | null = null;
let connectionCloseTimeout: NodeJS.Timeout | null = null;
let serverStartTime: number | null = null;
const CONNECTION_WARNING_DELAY = 10000;
const CONNECTION_CLOSE_DELAY = 30000;
const REQUIRED_PLAYERS = 2;

function startConnectionTimeout() {
    if (serverStartTime) return;
    serverStartTime = Date.now();
    console.log(`[${gameId}] Starting connection timeout monitoring`);

    connectionWarningTimeout = setTimeout(() => {
        if (gameState && gameState.players.length < REQUIRED_PLAYERS) {
            console.log(`[${gameId}] WARNING: Only ${gameState.players.length}/${REQUIRED_PLAYERS} players connected after 10s`);
            io?.emit("connectionWarning", {
                message: "Server will close in 30 seconds if opponent doesn't connect",
                connectedPlayers: gameState.players.length,
                requiredPlayers: REQUIRED_PLAYERS,
                secondsRemaining: 30
            });

            connectionCloseTimeout = setTimeout(() => {
                if (gameState && gameState.players.length < REQUIRED_PLAYERS) {
                    console.log(`[${gameId}] Closing server - insufficient players after timeout`);
                    io?.emit("serverClosing", {
                        reason: "Opponent failed to connect within timeout period",
                        connectedPlayers: gameState.players.length
                    });
                    setTimeout(() => {
                        shutdownServer();
                    }, 2000);
                }
            }, CONNECTION_CLOSE_DELAY);
        }
    }, CONNECTION_WARNING_DELAY);
}

function clearConnectionTimeouts() {
    if (connectionWarningTimeout) {
        clearTimeout(connectionWarningTimeout);
        connectionWarningTimeout = null;
    }
    if (connectionCloseTimeout) {
        clearTimeout(connectionCloseTimeout);
        connectionCloseTimeout = null;
    }
}

function shutdownServer() {
    console.log(`[${gameId}] Shutting down due to insufficient connections`);
    io?.close();
    httpServer.close();
    process.exit(0);
}

const httpServer = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "healthy", gameId }));
        return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
});

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
    path: "/socket.io",
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
});

console.log(`[${gameId}] Server starting, allowed origins:`, ALLOWED_ORIGINS);

io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    console.log(`[${gameId}] Socket connected: ${socket.id}, userId: ${userId}`);

    if (!userId) {
        console.log(`[${gameId}] No userId, disconnecting`);
        socket.disconnect();
        return;
    }

    socket.onAny((eventName, ...args) => {
        console.log(`[${gameId}] Received event '${eventName}' from ${socket.id}:`, args);
    });

    socket.on("join", (data: { gameId: string; name: string; avatar: string }) => {
        console.log(`[${gameId}] JOIN event received from ${socket.id} (userId: ${userId}):`, JSON.stringify(data));
        if (!serverStartTime) {
            console.log(`[${gameId}] Starting connection timeout`);
            startConnectionTimeout();
        }
        handleJoin(socket, data.gameId, userId, data.name, data.avatar);
    });

    socket.on("move", (data: { unitId: number; row: number; col: number }) => {
        handleMove(socket, userId, data.unitId, data.row, data.col);
    });

    socket.on("action", (data: { unitId: number; row: number; col: number }) => {
        handleAction(socket, userId, data.unitId, data.row, data.col);
    });

    socket.on("endTurn", () => {
        handleEndTurn(socket, userId);
    });

    socket.on("forceUnitEndTurn", (data: { unitId: number }) => {
        handleForceUnitEndTurn(socket, userId, data.unitId);
    });

    socket.on("displayEmote", (data: { src: string; sid: string }) => {
        handleDisplayEmote(socket, userId, data.src, data.sid);
    });

    socket.on("disconnect", () => {
        console.log(`[${gameId}] Disconnected: ${socket.id}`);
        handleDisconnect(socket, userId);
    });
});

function initializeGameState(gameID: string, privacy: string): GameState {
    return {
        id: gameID,
        privacy: privacy,
        players: [] as Player[],
        arena: {
            width: 1024,
            height: 512,
            name: 'field',
            tiles: [
                [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
                [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
                [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
                [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
            ],
            heightMap: [
                [3.5, 3.5, 3.5, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 2.5, 2.5, 2.5, 2.5],
                [3.5, 3.5, 3.5, 3, 3, 3, 3, 3, 3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2, 2],
                [3.5, 3.5, 3.5, 3, 3, 3, 3, 3, 3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2, 2, 2],
                [3, 3, 3, 3, 3, 3, 3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 2, 2, 2, 2, 2, 2, 2],
                [3, 3, 3, 3, 3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2, 2, 2, 2, 2, 2, 2, 2],
                [0, 3, 3, 3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2, 2, 2, 2, 2, 2, 2, 0],
                [0, 3, 3, 3, 2.5, 2.5, 2.5, 2.5, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0],
                [0, 3, 2.5, 2.5, 2.5, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0],
                [0, 0, 2.5, 2.5, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 1.5, 1.5, 1.5, 0, 0],
                [0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 1.5, 1.5, 0, 0, 0],
                [0, 0, 0, 2, 1.5, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 1.5, 1.5, 0, 0, 0],
                [0, 0, 2, 2, 1.5, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
                [0, 2, 2, 1.5, 1.5, 1.5, 1.5, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
                [0, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
                [0, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [2.5, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [2.5, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [2.5, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5],
                [2.5, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5],
                [2.5, 2, 2, 1.5, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0.5, 0.5, 0.5],
            ],
            obstacles: [
                {
                    name: "well1",
                    row: 1,
                    col: 18,
                    sprite: {
                        width: 32,
                        height: 64,
                        name: "well",
                        image: "well",
                    }
                },
                {
                    name: "well2",
                    row: 16,
                    col: 3,
                    sprite: {
                        width: 32,
                        height: 64,
                        name: "well",
                        image: "well",
                    }
                }
            ],
            p1Start: { row: 0, col: 0 },
            p2Start: { row: 19, col: 19 },
        } as Arena,
        round: 0,
        player1Time: MAX_TIME,
        player2Time: MAX_TIME,
        player1UltCharge: 0,
        player2UltCharge: 0,
        visibleTiles: [{ row: -1, col: -1 }],
    };
}

function addPlayerToGame(gameState: GameState, socket: Socket, userId: string, name: string, avatar: string) {
    console.log(`[${gameId}] Adding ${name} to game`);

    let newPlayer: Player = {
        id: userId,
        userId: userId,
        socketId: socket.id,
        name: name,
        profileimage: avatar || "default",
        units: [],
    };

    const isPlayer2 = gameState.players.length === 1;
    const unitIdOffset = isPlayer2 ? 50 : 0;
    const startRow = isPlayer2 ? gameState.arena.p2Start.row : gameState.arena.p1Start.col;
    const startCol = isPlayer2 ? gameState.arena.p2Start.row : gameState.arena.p1Start.col;

    newPlayer.units.push({
        id: 1 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row : gameState.arena.p1Start.row,
        col: isPlayer2 ? gameState.arena.p2Start.col : gameState.arena.p1Start.col,
        name: "king",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 40,
        maxHealth: 40,
        attack: 30,
        defense: 10,
        range: 2,
        mobility: 3,
        mobilityRemaining: 3,
    });

    newPlayer.units.push({
        id: 2 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row - 2 : gameState.arena.p1Start.row + 2,
        col: isPlayer2 ? gameState.arena.p2Start.col : gameState.arena.p1Start.col,
        name: "melee",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 30,
        maxHealth: 30,
        attack: 30,
        defense: 10,
        range: 1,
        mobility: 2,
        mobilityRemaining: 2,
    });

    newPlayer.units.push({
        id: 3 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row : gameState.arena.p1Start.row,
        col: isPlayer2 ? gameState.arena.p2Start.col - 2 : gameState.arena.p1Start.col + 2,
        name: "ranged",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 20,
        maxHealth: 20,
        attack: 20,
        defense: 0,
        range: 3,
        mobility: 3,
        mobilityRemaining: 3,
    });

    newPlayer.units.push({
        id: 4 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row - 1 : gameState.arena.p1Start.row + 1,
        col: isPlayer2 ? gameState.arena.p2Start.col : gameState.arena.p1Start.col,
        name: "mage",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 20,
        maxHealth: 20,
        attack: 40,
        defense: 0,
        range: 2,
        mobility: 2,
        mobilityRemaining: 2,
    });

    newPlayer.units.push({
        id: 5 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row : gameState.arena.p1Start.row,
        col: isPlayer2 ? gameState.arena.p2Start.col - 1 : gameState.arena.p1Start.col + 1,
        name: "healer",
        action: "heal",
        canMove: true,
        canAct: true,
        health: 10,
        maxHealth: 10,
        attack: 30,
        defense: 0,
        range: 2,
        mobility: 4,
        mobilityRemaining: 4,
    });

    newPlayer.units.push({
        id: 6 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row - 2 : gameState.arena.p1Start.row + 2,
        col: isPlayer2 ? gameState.arena.p2Start.col - 1 : gameState.arena.p1Start.col + 1,
        name: "cavalry",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 20,
        maxHealth: 20,
        attack: 20,
        defense: 10,
        range: 1,
        mobility: 4,
        mobilityRemaining: 4,
    });

    newPlayer.units.push({
        id: 7 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row - 2 : gameState.arena.p1Start.row + 2,
        col: isPlayer2 ? gameState.arena.p2Start.col - 2 : gameState.arena.p1Start.col + 2,
        name: "scout",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 20,
        maxHealth: 20,
        attack: 10,
        defense: 10,
        range: 1,
        mobility: 5,
        mobilityRemaining: 5,
    });

    newPlayer.units.push({
        id: 8 + unitIdOffset,
        row: isPlayer2 ? gameState.arena.p2Start.row - 1 : gameState.arena.p1Start.row + 1,
        col: isPlayer2 ? gameState.arena.p2Start.col - 2 : gameState.arena.p1Start.col + 2,
        name: "tank",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 40,
        maxHealth: 40,
        attack: 10,
        defense: 20,
        range: 1,
        mobility: 2,
        mobilityRemaining: 2,
    });

    gameState.players.push(newPlayer);
}

function handleJoin(socket: Socket, joinGameId: string, userId: string, name: string, avatar: string) {
    if (!gameState) {
        gameState = initializeGameState(gameId, "private");
    }

    let playerIndex = -1;

    if (gameState.players.length < 2 && !gameState.players.find(p => p.id === userId)) {
        addPlayerToGame(gameState, socket, userId, name, avatar);
        playerIndex = gameState.players.length - 1;

        // Notify player they joined
        socket.emit('joined', { playerIndex });

        if (gameState.players.length === 2) {
            clearConnectionTimeouts();
            startGameLoop();
            // Emit start to both players
            for (let player of gameState.players) {
                const playerSocket = io.sockets.sockets.get(player.socketId);
                if (playerSocket) {
                    playerSocket.emit('start', { round: gameState.round });
                }
            }
            nextRound();
        }
    } else if (gameState.players.find(p => p.id === userId)) {
        const player = gameState.players.find(p => p.id === userId);
        if (player) {
            player.socketId = socket.id;
            playerIndex = gameState.players.indexOf(player);
            console.log(`[${gameId}] Reconnected player ${name}`);
            // Notify reconnected player
            socket.emit('joined', { playerIndex });
            // Send current state immediately
            emitGameState();
        }
    }
}

function startGameLoop() {
    if (gameInterval) return;

    let tick = 0;
    gameInterval = setInterval(() => {
        if (!gameState) return;

        if (tick % TICKRATE === 0 && gameState.players.length === 2) {
            if (gameState.round % 2 === 0) {
                gameState.player1Time -= 1;
                if (gameState.player1Time <= 0) {
                    console.log(`[${gameId}] ${gameState.players[0].name} ran out of time`);
                    winnerChosen(gameState.players[1]);
                    endGame();
                    return;
                }
            } else {
                gameState.player2Time -= 1;
                if (gameState.player2Time <= 0) {
                    console.log(`[${gameId}] ${gameState.players[1].name} ran out of time`);
                    winnerChosen(gameState.players[0]);
                    endGame();
                    return;
                }
            }

            if (gameState.players[0].units.length === 0) {
                console.log(`[${gameId}] ${gameState.players[0].name} has no units left`);
                winnerChosen(gameState.players[1]);
                endGame();
                return;
            }

            if (gameState.players[1].units.length === 0) {
                console.log(`[${gameId}] ${gameState.players[1].name} has no units left`);
                winnerChosen(gameState.players[0]);
                endGame();
                return;
            }

            const player1King = gameState.players[0].units.find(u => u.name === "king");
            const player2King = gameState.players[1].units.find(u => u.name === "king");

            if (!player1King) {
                console.log(`[${gameId}] ${gameState.players[0].name}'s King is Dead.`);
                winnerChosen(gameState.players[1]);
                endGame();
                return;
            }

            if (!player2King) {
                console.log(`[${gameId}] ${gameState.players[1].name}'s King is Dead.`);
                winnerChosen(gameState.players[0]);
                endGame();
                return;
            }
        }

        emitGameState();
        tick++;
    }, 1000 / TICKRATE);
}

function handleMove(socket: Socket, userId: string, unitId: number, targetRow: number, targetCol: number) {
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === userId);
    if (!player) return;

    const unit = player.units.find(u => u.id === unitId);
    if (!unit || !unit.canMove) return;

    let otherUnit = gameState.players.find((p) => p.units.find((u) => u.row === targetRow && u.col === targetCol));
    if (otherUnit && otherUnit.id !== userId) return;

    const target = { x: 0, y: 0, row: targetRow, col: targetCol };

    if (isValidMove(unit, target, gameState)) {
        const origin = { row: unit.row, col: unit.col };

        // Calculate path length for mobility tracking
        const path = astarPath(unit.row, unit.col, targetRow, targetCol, gameState.arena);
        const distanceMoved = Math.max(0, path.length - 1);

        // Update unit position BEFORE emitting so clients get the correct position
        unit.row = targetRow;
        unit.col = targetCol;
        
        // Subtract moved distance from remaining mobility
        unit.mobilityRemaining = Math.max(0, unit.mobilityRemaining - distanceMoved);
        
        // Check if unit should be exhausted
        checkAndExhaustUnit(unit, player, gameState);
        
        console.log(`[${gameId}] ${player.name}: unit ${unitId} moved ${distanceMoved} tiles to (${targetRow}, ${targetCol}), remaining mobility: ${unit.mobilityRemaining}`);

        for (let p of gameState.players) {
            const playerSocket = io.sockets.sockets.get(p.socketId);
            if (playerSocket) {
                playerSocket.emit('unit-moving', { unit: unit, origin: origin, target: target });
            }
        }
    }

    emitGameState();
}

function handleAction(socket: Socket, userId: string, unitId: number, targetRow: number, targetCol: number) {
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === userId);
    if (!player) return;

    const unit = player.units.find(u => u.id === unitId);
    if (!unit || !unit.canAct) return;

    let otherUnitsOwner = gameState.players.find((p) => p.units.find((u) => u.row === targetRow && u.col === targetCol));
    if (!otherUnitsOwner) return;

    let otherUnit = otherUnitsOwner.units.find((u) => u.row === targetRow && u.col === targetCol);
    if (!otherUnit) return;

    const tile = { x: 0, y: 0, row: targetRow, col: targetCol };

    if (isValidAction(unit, tile, gameState)) {
        let healthBefore: number;
        let healthAfter: number;

        if (userId !== otherUnitsOwner.id) {
            healthBefore = otherUnit.health;
            otherUnit.health -= unit.attack * (1 - otherUnit.defense / (otherUnit.defense + 20));
            console.log(`[${gameId}] ${player.name}: unit ${unitId} attacking at tile (${targetRow}, ${targetCol}). ${otherUnit.id} has ${otherUnit.health} health remaining.`);

            if (otherUnit.health <= 0) {
                otherUnitsOwner.units = otherUnitsOwner.units.filter((u) => u.id !== otherUnit!.id);
            }
            healthAfter = otherUnit.health;
        } else {
            healthBefore = otherUnit.health;
            otherUnit.health += unit.attack;
            if (otherUnit.health > otherUnit.maxHealth) {
                otherUnit.health = otherUnit.maxHealth;
            }
            console.log(`[${gameId}] ${player.name}: unit ${unitId} healing at tile (${targetRow}, ${targetCol}). ${otherUnit.id} has ${otherUnit.health} health remaining.`);
            healthAfter = otherUnit.health;
        }

        unit.canAct = false;

        // Check if unit should be exhausted after action
        checkAndExhaustUnit(unit, player, gameState);

        for (let p of gameState.players) {
            const playerSocket = io.sockets.sockets.get(p.socketId);
            if (playerSocket) {
                playerSocket.emit('unit-acting', { unit: unit, target: { row: otherUnit.row, col: otherUnit.col } });
                playerSocket.emit('animate-healthbar', { 
                    unitId: otherUnit.id, 
                    row: otherUnit.row, 
                    col: otherUnit.col, 
                    healthBefore, 
                    healthAfter 
                });
            }
        }
    }

    emitGameState();
}

function handleEndTurn(socket: Socket, userId: string) {
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === userId);
    if (!player) return;

    if (gameState.players[gameState.round % 2] !== player) {
        return;
    }

    nextRound();
}

function handleForceUnitEndTurn(socket: Socket, userId: string, unitId: number) {
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === userId);
    if (!player) return;

    const unit = player.units.find(u => u.id === unitId);
    if (!unit) return;

    unit.canMove = false;
    unit.canAct = false;

    emitGameState();
}

function hasValidActionTarget(unit: Unit, player: Player, gameState: GameState): boolean {
    const range = unit.range;
    const row = unit.row;
    const col = unit.col;

    // Find all enemy and friendly units
    for (const otherPlayer of gameState.players) {
        const isEnemy = otherPlayer.id !== player.id;
        
        for (const otherUnit of otherPlayer.units) {
            const distance = Math.abs(otherUnit.row - row) + Math.abs(otherUnit.col - col);
            if (distance > range || distance === 0) continue;
            
            // Check if target is valid based on unit action type
            if (unit.action === 'heal' && !isEnemy) {
                return true;
            } else if (unit.action === 'attack' && isEnemy) {
                return true;
            }
        }
    }
    
    return false;
}

function checkAndExhaustUnit(unit: Unit, player: Player, gameState: GameState) {
    // Check if unit should be exhausted:
    // 1. No mobility remaining
    // 2. No action available or no valid targets
    
    const noMobility = unit.mobilityRemaining <= 0;
    const actionExhausted = !unit.canAct || !hasValidActionTarget(unit, player, gameState);
    
    if (noMobility && actionExhausted) {
        unit.canMove = false;
        unit.canAct = false;
        console.log(`[${gameId}] Unit ${unit.id} (${unit.name}) exhausted`);
    }
}

function handleDisplayEmote(socket: Socket, userId: string, src: string, sid: string) {
    if (!gameState) return;

    for (let player of gameState.players) {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
            playerSocket.emit('displayEmote', src, sid);
        }
    }
}

function handleDisconnect(socket: Socket, userId: string) {
    if (!gameState || gameState.players.length !== 2) {
        endGame();
    }
}

function nextRound() {
    if (!gameState) return;

    gameState.round += 1;
    let newPlayer = gameState.players[gameState.round % 2];

    if (gameState.round % 2 === 0) {
        gameState.player1Time += 5;
        if (gameState.player1Time > MAX_TIME) {
            gameState.player1Time = MAX_TIME;
        }
    } else {
        gameState.player2Time += 5;
        if (gameState.player2Time > MAX_TIME) {
            gameState.player2Time = MAX_TIME;
        }
    }

    gameState.players.forEach((player, index) => {
        const isActivePlayer = index === gameState!.round % 2;
        player.units.forEach((unit) => {
            unit.canAct = isActivePlayer;
            unit.canMove = isActivePlayer;
            // Reset mobility for new turn
            unit.mobilityRemaining = unit.mobility;
        });
    });

    emitGameState();

    for (let player of gameState.players) {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
            playerSocket.emit('turn', { round: gameState.round });
        }
    }
}

function emitGameState() {
    if (!gameState) return;

    for (let player of gameState.players) {
        let playerGameState = getPlayerGameState(gameState, player);
        const serializedData = JSON.stringify(playerGameState);
        const compressedData = deflate(serializedData);

        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
            playerSocket.emit('state', compressedData);
        }
    }
}

function getPlayerGameState(gameState: GameState, player: Player): GameState {
    let temp = { ...gameState };

    temp.arena = { ...gameState.arena };
    temp.players = gameState.players.map(p => ({
        ...p,
        units: p.units.map(u => ({ ...u })),
    }));

    let visibleTiles: { row: number, col: number }[] = [];
    for (const unit of player.units) {
        const row = unit.row;
        const col = unit.col;
        const modifier = temp.arena.tiles[row][col] === 2 ? 1 : 0;
        const viewDistance = unit.range + unit.mobility + modifier;

        for (let i = -viewDistance; i <= viewDistance; i++) {
            for (let j = -viewDistance; j <= viewDistance; j++) {
                if (Math.abs(i) + Math.abs(j) <= viewDistance) {
                    const targetRow = row + i;
                    const targetCol = col + j;
                    if (targetRow >= 0 && targetRow < temp.arena.tiles.length && targetCol >= 0 && targetCol < temp.arena.tiles[0].length) {
                        const path = bresenhamPath(row, col, targetRow, targetCol);
                        let canSee = true;

                        for (const tile of path) {
                            if (temp.arena.tiles) {
                                const terrain: number = temp.arena.tiles[tile.y][tile.x];

                                if (terrain === 3) {
                                    if (!adjacentTile(row, col, tile.y, tile.x)) {
                                        canSee = false;
                                        break;
                                    }
                                }
                                if (terrain === 4) {
                                    canSee = false;
                                    break;
                                }
                            }
                        }

                        if (canSee) {
                            const newTile = { row: row + i, col: col + j };
                            const isDuplicate = visibleTiles.some(tile => tile.row === newTile.row && tile.col === newTile.col);
                            if (!isDuplicate) {
                                visibleTiles.push(newTile);
                            }
                        }
                    }
                }
            }
        }
    }

    temp.visibleTiles = visibleTiles;

    const otherPlayer = temp.players.find(otherPlayer => otherPlayer.id !== player.id);
    if (otherPlayer) {
        otherPlayer.units = otherPlayer.units.filter(enemyUnit => {
            return visibleTiles.some(visibleTile =>
                visibleTile.row === enemyUnit.row && visibleTile.col === enemyUnit.col
            );
        });
    }

    return temp;
}

function adjacentTile(row1: number, col1: number, row2: number, col2: number): boolean {
    return (row1 === row2 && col1 === col2) ||
        (Math.abs(row1 - row2) === 1 && col1 === col2) ||
        (Math.abs(col1 - col2) === 1 && row1 === row2);
}

function bresenhamPath(startRow: number, startCol: number, endRow: number, endCol: number) {
    const path = [];
    let x = startCol;
    let y = startRow;
    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const sx = startCol < endCol ? 1 : -1;
    const sy = startRow < endRow ? 1 : -1;
    let err = dx - dy;

    while (x !== endCol || y !== endRow) {
        path.push({ x, y });

        const e2 = err * 2;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }

    path.push({ y: endRow, x: endCol });
    return path;
}

function isValidMove(unit: Unit, tile: { x: number, y: number, row: number, col: number }, gameState: GameState): boolean {
    const arena = gameState.arena;
    let mobility = unit.mobility;
    let row = unit.row;
    let col = unit.col;

    let validTiles = [];

    for (let i = -mobility; i <= mobility; i++) {
        for (let j = -mobility; j <= mobility; j++) {
            if (Math.abs(i) + Math.abs(j) <= mobility) {
                const targetRow = row + i;
                const targetCol = col + j;

                if (targetRow < 0 || targetCol < 0 || targetRow >= arena.tiles.length || targetCol >= arena.tiles[0].length) continue;
                if (hasUnit(targetRow, targetCol, gameState) && (i !== 0 || j !== 0)) continue;
                const targetTerrain: number = arena.tiles[targetRow][targetCol];
                if (targetTerrain === 0) continue;

                const path = astarPath(row, col, targetRow, targetCol, arena);
                if (path.length - 1 > mobility) continue;
                let canMove = true;
                let mobilityPenalty = 0;
                for (const tile of path) {
                    const terrain: number = arena.tiles[tile.y][tile.x];

                    if ((row !== tile.y && col !== tile.x) && hasUnit(tile.y, tile.x, gameState)) {
                        canMove = false;
                        break;
                    }

                    if (terrain === 0) {
                        canMove = false;
                        break;
                    } else if (terrain === 2) {
                        mobilityPenalty += 2;
                    } else if (terrain === 3) {
                    } else if (terrain === 4) {
                        canMove = false;
                        break;
                    }
                }

                if (canMove && (mobility - mobilityPenalty >= 0)) {
                    validTiles.push({ row: row + i, col: col + j });
                }
            }
        }
    }

    if (!validTiles.find((validTile) => validTile.row === tile.row && validTile.col === tile.col)) {
        console.log("Invalid move");
        return false;
    }

    return true;
}

function isValidAction(unit: Unit, tile: { x: number, y: number, row: number, col: number }, gameState: GameState): boolean {
    const arena = gameState.arena;
    let range = unit.range;
    let row = unit.row;
    let col = unit.col;

    let validTiles = [];

    for (let i = -range; i <= range; i++) {
        for (let j = -range; j <= range; j++) {
            if (Math.abs(i) + Math.abs(j) <= range) {
                const targetRow = row + i;
                const targetCol = col + j;

                if (targetRow === row && targetCol === col) continue;

                if (targetRow >= 0 && targetRow < arena.tiles.length && targetCol >= 0 && targetCol < arena.tiles[0].length) {
                    const path = bresenhamPath(row, col, targetRow, targetCol);
                    let canSee = true;
                    let rangePenalty = 0;

                    for (const tile of path) {
                        if (arena.tiles) {
                            const terrain: number = arena.tiles[tile.y][tile.x];

                            if (terrain === 4) {
                                canSee = false;
                                break;
                            }
                        }
                    }

                    if (canSee && (range - rangePenalty >= 0)) {
                        validTiles.push({ row: row + i, col: col + j });
                    }
                }
            }
        }
    }

    if (!validTiles.find((validTile) => validTile.row === tile.row && validTile.col === tile.col)) {
        console.log("Invalid attack");
        return false;
    }

    return true;
}

function astarPath(startRow: number, startCol: number, endRow: number, endCol: number, arena: Arena): { x: number, y: number }[] {
    const grid = arena.tiles;
    const openList: Tile[] = [];
    const closedList: Set<string> = new Set();

    const startTile: Tile = {
        x: startCol,
        y: startRow,
        g: 0,
        h: heuristic({ x: startCol, y: startRow, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }),
        f: 0,
        parent: null
    };
    const endTile: Tile = { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null };

    openList.push(startTile);

    const neighbors = [
        { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
    ];

    while (openList.length > 0) {
        openList.sort((a, b) => a.f! - b.f!);
        const current = openList.shift()!;

        if (current.x === endTile.x && current.y === endTile.y) {
            const path: { x: number, y: number }[] = [];
            let currentTile: Tile | null = current;
            while (currentTile) {
                path.unshift({ x: currentTile.x, y: currentTile.y });
                currentTile = currentTile.parent || null;
            }
            return path;
        }

        closedList.add(`${current.x},${current.y}`);

        for (const { x: dx, y: dy } of neighbors) {
            const neighborX = current.x + dx;
            const neighborY = current.y + dy;

            if (neighborX >= 0 && neighborX < grid[0].length && neighborY >= 0 && neighborY < grid.length && (grid[neighborY][neighborX] !== 0 && grid[neighborY][neighborX] !== 4) && arena.heightMap[neighborY][neighborX] - arena.heightMap[current.y][current.x] <= 1.5) {
                const neighbor: Tile = {
                    x: neighborX,
                    y: neighborY,
                    g: (current.g || 0) + 1,
                    h: heuristic({ x: neighborX, y: neighborY, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }),
                    f: 0,
                    parent: current
                };

                if (closedList.has(`${neighbor.x},${neighbor.y}`)) {
                    continue;
                }

                if (!openList.some(tile => tile.x === neighbor.x && tile.y === neighbor.y)) {
                    neighbor.f = (neighbor.g || 0) + (neighbor.h || 0);
                    openList.push(neighbor);
                }
            }
        }
    }

    return [];
}

function heuristic(a: Tile, b: Tile): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hasUnit(row: number, col: number, gameState: GameState): boolean {
    if (gameState.players.length < 2) return false;
    const units = [...gameState.players[0].units, ...gameState.players[1].units];
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            return true;
        }
    }
    return false;
}

function winnerChosen(winner: Player) {
    if (!gameState) return;

    for (let player of gameState.players) {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
            playerSocket.emit('gameOver', winner);
        }
    }

    endGame();
}

function endGame() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    emitGameState();
    console.log(`[${gameId}] Closing Game...`);
}

httpServer.listen(port, () => {
    console.log(`[${gameId}] Game server running on port ${port}`);
});
