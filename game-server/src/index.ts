import { Server, Socket } from "socket.io";
import { createServer } from "http";
import { deflate, inflate } from 'pako';

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
}

interface GameState {
    id: string;
    privacy: string;
    players: Player[];
    arena: Arena;
    round: number;
    player1Time: number;
    player2Time: number;
    visibleTiles: { row: number; col: number }[];
}

interface Tile {
    x: number;
    y: number;
    g?: number;
    h?: number;
    f?: number;
    parent?: Tile | null;
    row?: number;
    col?: number;
}

let gameState: GameState | null = null;
let gameInterval: NodeJS.Timeout | null = null;
let gameId = process.env.GAME_ID || "unknown";
const port = parseInt(process.env.PORT || "3000");

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

    // Log all incoming events for debugging
    socket.onAny((eventName, ...args) => {
        console.log(`[${gameId}] Received event '${eventName}' from ${socket.id}:`, args);
    });

    socket.on("join", (data: { gameId: string; name: string; avatar: string }) => {
        console.log(`[${gameId}] JOIN event received:`, data);
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

    socket.on("disconnect", () => {
        console.log(`[${gameId}] Disconnected: ${socket.id}`);
    });
});

function handleJoin(socket: Socket, sessionId: string, userId: string, name: string, avatar: string) {
    console.log(`[${gameId}] handleJoin: ${name} (${userId}) joining session ${sessionId}`);

    if (!gameState) {
        gameState = initializeGame(sessionId);
    }

    const existingPlayer = gameState.players.find(p => p.id === userId);
    if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        const playerIndex = gameState.players.indexOf(existingPlayer);
        
        // Re-assign units if missing (for reconnects)
        if (existingPlayer.units.length === 0) {
            console.log(`[${gameId}] Re-assigning units to rejoined player ${name}`);
            const isPlayer1 = playerIndex === 0;
            const startRow = isPlayer1 ? gameState.arena.p1Start.row : gameState.arena.p2Start.row;
            const startCol = isPlayer1 ? gameState.arena.p1Start.col : gameState.arena.p2Start.col;
            
            // Use offset direction based on player (positive for P1, negative for P2 to stay in bounds)
            const rowOffset = isPlayer1 ? 1 : -1;
            const colOffset = isPlayer1 ? 1 : -1;
            
            existingPlayer.units.push(
                { id: Date.now() + 1, row: startRow, col: startCol, name: "king", action: "attack", canMove: true, canAct: true, health: 40, maxHealth: 40, attack: 30, defense: 10, range: 2, mobility: 3 },
                { id: Date.now() + 2, row: startRow + (2 * rowOffset), col: startCol, name: "melee", action: "attack", canMove: true, canAct: true, health: 30, maxHealth: 30, attack: 30, defense: 10, range: 1, mobility: 2 },
                { id: Date.now() + 3, row: startRow, col: startCol + (2 * colOffset), name: "ranged", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 20, defense: 0, range: 3, mobility: 3 },
                { id: Date.now() + 4, row: startRow + (1 * rowOffset), col: startCol, name: "mage", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 40, defense: 0, range: 2, mobility: 2 },
                { id: Date.now() + 5, row: startRow, col: startCol + (1 * colOffset), name: "healer", action: "heal", canMove: true, canAct: true, health: 10, maxHealth: 10, attack: 30, defense: 0, range: 2, mobility: 4 },
                { id: Date.now() + 6, row: startRow + (2 * rowOffset), col: startCol + (1 * colOffset), name: "cavalry", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 20, defense: 10, range: 1, mobility: 4 },
                { id: Date.now() + 7, row: startRow + (2 * rowOffset), col: startCol + (2 * colOffset), name: "scout", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 10, defense: 10, range: 1, mobility: 5 },
                { id: Date.now() + 8, row: startRow + (1 * rowOffset), col: startCol + (2 * colOffset), name: "tank", action: "attack", canMove: true, canAct: true, health: 40, maxHealth: 40, attack: 10, defense: 20, range: 1, mobility: 2 }
            );
        }
        
        socket.emit("joined", { playerIndex });
        console.log(`[${gameId}] Re-joined existing player ${name} as player ${playerIndex + 1} with ${existingPlayer.units.length} units`);
        
        // If game already started (has 2 players), send start event
        if (gameState.players.length === 2) {
            console.log(`[${gameId}] Sending start event to rejoined player`);
            socket.emit("start", { round: gameState.round });
        }
        
        // Send current state immediately
        broadcastState();
        return;
    }

    if (gameState.players.length >= 2) {
        console.log(`[${gameId}] Game full`);
        socket.emit("error", { message: "Game is full" });
        return;
    }

    const isPlayer1 = gameState.players.length === 0;
    const player: Player = {
        id: userId,
        userId,
        socketId: socket.id,
        name,
        profileimage: avatar || "default",
        units: [],
    };

    const startRow = isPlayer1 ? gameState.arena.p1Start.row : gameState.arena.p2Start.row;
    const startCol = isPlayer1 ? gameState.arena.p1Start.col : gameState.arena.p2Start.col;
    
    console.log(`[${gameId}] Spawning units for ${name} (Player ${isPlayer1 ? 1 : 2}) at row:${startRow} col:${startCol}`);

    // Use offset direction based on player (positive for P1, negative for P2 to stay in bounds)
    const rowOffset = isPlayer1 ? 1 : -1;
    const colOffset = isPlayer1 ? 1 : -1;

    player.units.push(
        { id: 1, row: startRow, col: startCol, name: "king", action: "attack", canMove: true, canAct: true, health: 40, maxHealth: 40, attack: 30, defense: 10, range: 2, mobility: 3 },
        { id: 2, row: startRow + (2 * rowOffset), col: startCol, name: "melee", action: "attack", canMove: true, canAct: true, health: 30, maxHealth: 30, attack: 30, defense: 10, range: 1, mobility: 2 },
        { id: 3, row: startRow, col: startCol + (2 * colOffset), name: "ranged", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 20, defense: 0, range: 3, mobility: 3 },
        { id: 4, row: startRow + (1 * rowOffset), col: startCol, name: "mage", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 40, defense: 0, range: 2, mobility: 2 },
        { id: 5, row: startRow, col: startCol + (1 * colOffset), name: "healer", action: "heal", canMove: true, canAct: true, health: 10, maxHealth: 10, attack: 30, defense: 0, range: 2, mobility: 4 },
        { id: 6, row: startRow + (2 * rowOffset), col: startCol + (1 * colOffset), name: "cavalry", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 20, defense: 10, range: 1, mobility: 4 },
        { id: 7, row: startRow + (2 * rowOffset), col: startCol + (2 * colOffset), name: "scout", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 10, defense: 10, range: 1, mobility: 5 },
        { id: 8, row: startRow + (1 * rowOffset), col: startCol + (2 * colOffset), name: "tank", action: "attack", canMove: true, canAct: true, health: 40, maxHealth: 40, attack: 10, defense: 20, range: 1, mobility: 2 }
    );
    
    console.log(`[${gameId}] Player ${name} has ${player.units.length} units`);

    gameState.players.push(player);
    const playerIndex = gameState.players.length - 1;

    socket.emit("joined", { playerIndex });
    console.log(`[${gameId}] Player ${name} joined as player ${playerIndex + 1}`);

    if (gameState.players.length === 2) {
        startGame();
    }

    broadcastState();
}

function startGame() {
    if (!gameState || gameState.players.length !== 2) return;
    gameState.round = 0;
    gameState.player1Time = 600;
    gameState.player2Time = 600;
    console.log(`[${gameId}] Game started! Round 0, Player 1's turn`);
    io?.emit("start", { round: 0 });

    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (!gameState || gameState.players.length !== 2) return;

        if (gameState.round % 2 === 0) {
            gameState.player1Time--;
            if (gameState.player1Time <= 0) {
                console.log(`[${gameId}] Player 1 ran out of time`);
                endGame(1);
            }
        } else {
            gameState.player2Time--;
            if (gameState.player2Time <= 0) {
                console.log(`[${gameId}] Player 2 ran out of time`);
                endGame(0);
            }
        }
        broadcastState();
    }, 1000);
}

function endGame(winnerIndex: number) {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (gameState) {
        io?.emit("gameOver", { winner: gameState.players[winnerIndex]?.name });
    }
    console.log(`[${gameId}] Game ended, winner: ${winnerIndex}`);
    gameState = null;
}

function handleMove(socket: Socket, userId: string, unitId: number, row: number, col: number) {
    if (!gameState) return;
    const player = gameState.players.find(p => p.id === userId);
    if (!player) return;
    if (gameState.players[gameState.round % 2] !== player) return;

    const unit = player.units.find(u => u.id === unitId);
    if (!unit || !unit.canMove) return;

    if (isValidMove(unit, { row, col }, gameState)) {
        const origin = { row: unit.row, col: unit.col };
        unit.row = row;
        unit.col = col;
        unit.canMove = false;
        console.log(`[${gameId}] Move: ${unit.name} to (${row}, ${col})`);
        io?.emit("moved", { unitId, row, col, origin });
    }

    broadcastState();
}

function handleAction(socket: Socket, userId: string, unitId: number, row: number, col: number) {
    if (!gameState) return;
    const player = gameState.players.find(p => p.id === userId);
    if (!player) return;
    if (gameState.players[gameState.round % 2] !== player) return;

    const unit = player.units.find(u => u.id === unitId);
    if (!unit || !unit.canAct) return;

    const targetUnit = gameState.players
        .flatMap(p => p.units)
        .find(u => u.row === row && u.col === col);

    if (!targetUnit) return;

    const targetOwner = gameState.players.find(p => p.units.some(u => u.id === targetUnit.id));

    if (isValidAction(unit, { row, col }, gameState)) {
        if (targetOwner && targetOwner.id !== player.id) {
            const damage = Math.floor(unit.attack * (1 - targetUnit.defense / (targetUnit.defense + 20)));
            targetUnit.health -= damage;
            console.log(`[${gameId}] Attack: ${unit.name} hit ${targetUnit.name} for ${damage} dmg`);
            if (targetUnit.health <= 0) {
                for (const p of gameState.players) {
                    p.units = p.units.filter(u => u.id !== targetUnit.id);
                }
            }
        } else {
            targetUnit.health = Math.min(targetUnit.health + unit.attack, targetUnit.maxHealth);
            console.log(`[${gameId}] Heal: ${unit.name} healed for ${unit.attack}`);
        }
        unit.canAct = false;
        io?.emit("acted", { unitId, row, col, targetHealth: targetUnit.health });
    }

    broadcastState();
}

function handleEndTurn(socket: Socket, userId: string) {
    if (!gameState) return;
    const player = gameState.players.find(p => p.id === userId);
    if (!player) return;
    if (gameState.players[gameState.round % 2] !== player) return;

    const oldPlayer = gameState.players[gameState.round % 2];
    gameState.round++;

    const newPlayer = gameState.players[gameState.round % 2];

    if (gameState.round % 2 === 0) {
        gameState.player1Time = Math.min(gameState.player1Time + 5, 600);
    } else {
        gameState.player2Time = Math.min(gameState.player2Time + 5, 600);
    }

    oldPlayer.units.forEach(u => { u.canAct = false; u.canMove = false; });
    newPlayer.units.forEach(u => { u.canAct = true; u.canMove = true; });

    console.log(`[${gameId}] Turn ended. Round ${gameState.round}, Player ${(gameState.round % 2) + 1}'s turn`);
    io?.emit("turn", { round: gameState.round });

    broadcastState();
}

function broadcastState() {
    if (!gameState || !io) return;
    const state = getPlayerGameState(gameState, gameState.players[0]);
    const compressed = deflate(JSON.stringify(state));
    gameState.players.forEach(p => {
        const playerState = getPlayerGameState(gameState!, p);
        const compressedPlayer = deflate(JSON.stringify(playerState));
        io!.to(p.socketId).emit("state", compressedPlayer);
    });
}

function getPlayerGameState(gs: GameState, player: Player): GameState {
    const temp = { ...gs, arena: { ...gs.arena }, players: gs.players.map(p => ({ ...p, units: p.units.map(u => ({ ...u })) })), visibleTiles: [] as { row: number; col: number }[] };

    const visible: { row: number; col: number }[] = [];
    for (const unit of player.units) {
        for (let i = -6; i <= 6; i++) {
            for (let j = -6; j <= 6; j++) {
                if (Math.abs(i) + Math.abs(j) <= 6) {
                    const r = unit.row + i, c = unit.col + j;
                    if (r >= 0 && r < gs.arena.tiles.length && c >= 0 && c < gs.arena.tiles[0].length) {
                        if (!visible.some(v => v.row === r && v.col === c)) visible.push({ row: r, col: c });
                    }
                }
            }
        }
    }
    temp.visibleTiles = visible;

    const other = temp.players.find(p => p.id !== player.id);
    if (other) {
        const beforeFilter = other.units.length;
        other.units = other.units.filter(u => visible.some(v => v.row === u.row && v.col === u.col));
        console.log(`[${gameId}] Fog of war: ${player.name} sees ${other.units.length}/${beforeFilter} enemy units`);
    }

    // Log units for this player
    const thisPlayer = temp.players.find(p => p.id === player.id);
    console.log(`[${gameId}] Sending state to ${player.name}: ${thisPlayer?.units.length} own units, ${other?.units.length || 0} visible enemy units`);

    return temp;
}

function isValidMove(unit: Unit, tile: { row: number; col: number }, gs: GameState): boolean {
    const dist = Math.abs(unit.row - tile.row) + Math.abs(unit.col - tile.col);
    if (dist > unit.mobility) return false;
    if (gs.arena.tiles[tile.row]?.[tile.col] === 0) return false;
    for (const p of gs.players) {
        if (p.units.some(u => u.row === tile.row && u.col === tile.col)) return false;
    }
    return true;
}

function isValidAction(unit: Unit, tile: { row: number; col: number }, gs: GameState): boolean {
    const dist = Math.abs(unit.row - tile.row) + Math.abs(unit.col - tile.col);
    return dist <= unit.range && dist > 0;
}

function initializeGame(id: string): GameState {
    return {
        id, privacy: "public", players: [],
        arena: {
            width: 1024, height: 512, name: "field",
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
                [2.5, 2, 2, 1.5, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0.5, 0.5, 0.5]
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
                        image: "well"
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
                        image: "well"
                    }
                }
            ],
            p1Start: { row: 0, col: 0 },
            p2Start: { row: 19, col: 19 }
        },
        round: 0, player1Time: 600, player2Time: 600, visibleTiles: [{ row: -1, col: -1 }]
    };
}

httpServer.listen(port, () => {
    console.log(`[${gameId}] Listening on port ${port}`);
});

process.on("SIGTERM", () => {
    console.log(`[${gameId}] Shutting down`);
    io.close();
    httpServer.close();
    process.exit(0);
});
