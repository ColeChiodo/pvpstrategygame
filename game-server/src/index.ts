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

const games: { [gameId: string]: GameState } = {};
const playerGameMap: { [userId: string]: string } = {};
const MAX_TIME = 60 * 10;
const TICKRATE = 1;

const gameId = process.env.GAME_ID || "unknown";
const port = parseInt(process.env.PORT || "3000");

const httpServer = createServer((req, res) => {
    console.log(`[${gameId}] HTTP Request: ${req.method} ${req.url}`);
    if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "healthy", gameId }));
        return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found", url: req.url }));
});

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://fortezza.colechiodo.cc",
    "https://apifortezza.colechiodo.cc",
    "https://gamefortezza.colechiodo.cc"
];

console.log(`[${gameId}] ALLOWED_ORIGINS:`, ALLOWED_ORIGINS);

const io = new Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"],
        credentials: true,
    },
    path: "/socket.io",
});

io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    console.log(`[${gameId}] Client connected: ${userId}, socket: ${socket.id}`);

    if (!userId) {
        socket.disconnect();
        return;
    }

    socket.on('join-game', (gameSessionId: string, name: string, avatar: string) => {
        console.log(`[${gameId}] User ${userId} (${name}) joining game ${gameSessionId}`);
        joinGame(socket, gameSessionId, userId, name, avatar);
    });

    socket.on('player-unit-move', (unitID: number, target: { x: number; y: number; row: number; col: number }) => {
        const gId = playerGameMap[userId];
        if (!gId || !games[gId]) return;
        handleUnitMove(socket, gId, unitID, target);
    });

    socket.on('player-unit-action', (unitID: number, tile: { x: number; y: number; row: number; col: number }) => {
        const gId = playerGameMap[userId];
        if (!gId || !games[gId]) return;
        handleUnitAction(socket, gId, unitID, tile);
    });

    socket.on('force-end-turn', () => {
        const gId = playerGameMap[userId];
        if (!gId || !games[gId]) return;
        handleForceEndTurn(socket, gId);
    });

    socket.on('force-unit-end-turn', (unitID: number) => {
        const gId = playerGameMap[userId];
        if (!gId || !games[gId]) return;
        handleForceUnitEndTurn(socket, gId, unitID);
    });

    socket.on("disconnect", () => {
        console.log(`[${gameId}] Client disconnected: ${userId}`);
    });
});

function joinGame(socket: Socket, gameSessionId: string, userId: string, name: string, avatar: string) {
    let gameState = games[gameSessionId];

    if (!gameState) {
        gameState = initializeGameState(gameSessionId);
        games[gameSessionId] = gameState;

        let tick = 0;
        const interval = setInterval(() => {
            if (tick % TICKRATE === 0 && gameState.players.length === 2) {
                if (gameState.round % 2 === 0) {
                    gameState.player1Time -= 1;
                    if (gameState.player1Time <= 0) {
                        console.log(`${gameState.players[0].name} ran out of time`);
                        endGame(gameSessionId, interval, gameState.players[1]);
                    }
                } else {
                    gameState.player2Time -= 1;
                    if (gameState.player2Time <= 0) {
                        console.log(`${gameState.players[1].name} ran out of time`);
                        endGame(gameSessionId, interval, gameState.players[0]);
                    }
                }

                if (gameState.players[0].units.length === 0) {
                    console.log(`${gameState.players[0].name} has no units left`);
                    endGame(gameSessionId, interval, gameState.players[1]);
                }
                if (gameState.players[1].units.length === 0) {
                    console.log(`${gameState.players[1].name} has no units left`);
                    endGame(gameSessionId, interval, gameState.players[0]);
                }

                const p1King = gameState.players[0].units.find(u => u.name === "king");
                const p2King = gameState.players[1].units.find(u => u.name === "king");
                if (!p1King) endGame(gameSessionId, interval, gameState.players[1]);
                if (!p2King) endGame(gameSessionId, interval, gameState.players[0]);
            }
            emitGameState(gameSessionId);
            tick++;
        }, 1000 / TICKRATE);
    }

    if (gameState.players.length < 2) {
        const newPlayer: Player = {
            id: userId,
            userId: userId,
            socketId: socket.id,
            name: name,
            profileimage: avatar || "default",
            units: [],
        };

        const isPlayer1 = gameState.players.length === 0;
        const startRow = isPlayer1 ? gameState.arena.p1Start.row : gameState.arena.p2Start.row;
        const startCol = isPlayer1 ? gameState.arena.p1Start.col : gameState.arena.p2Start.col;

        newPlayer.units.push({ id: 1, row: startRow, col: startCol, name: "king", action: "attack", canMove: true, canAct: true, health: 40, maxHealth: 40, attack: 30, defense: 10, range: 2, mobility: 3 });
        newPlayer.units.push({ id: 2, row: startRow + 2, col: startCol, name: "melee", action: "attack", canMove: true, canAct: true, health: 30, maxHealth: 30, attack: 30, defense: 10, range: 1, mobility: 2 });
        newPlayer.units.push({ id: 3, row: startRow, col: startCol + 2, name: "ranged", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 20, defense: 0, range: 3, mobility: 3 });
        newPlayer.units.push({ id: 4, row: startRow + 1, col: startCol, name: "mage", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 40, defense: 0, range: 2, mobility: 2 });
        newPlayer.units.push({ id: 5, row: startRow, col: startCol + 1, name: "healer", action: "heal", canMove: true, canAct: true, health: 10, maxHealth: 10, attack: 30, defense: 0, range: 2, mobility: 4 });
        newPlayer.units.push({ id: 6, row: startRow + 2, col: startCol + 1, name: "cavalry", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 20, defense: 10, range: 1, mobility: 4 });
        newPlayer.units.push({ id: 7, row: startRow + 2, col: startCol + 2, name: "scout", action: "attack", canMove: true, canAct: true, health: 20, maxHealth: 20, attack: 10, defense: 10, range: 1, mobility: 5 });
        newPlayer.units.push({ id: 8, row: startRow + 1, col: startCol + 2, name: "tank", action: "attack", canMove: true, canAct: true, health: 40, maxHealth: 40, attack: 10, defense: 20, range: 1, mobility: 2 });

        gameState.players.push(newPlayer);
        playerGameMap[userId] = gameSessionId;

        socket.emit('game-joined', { gameId: gameSessionId, playerIndex: gameState.players.length - 1 });

        if (gameState.players.length === 2) {
            nextRound(gameSessionId);
        }
    } else {
        const existingPlayer = gameState.players.find(p => p.id === userId);
        if (existingPlayer) {
            existingPlayer.socketId = socket.id;
            socket.emit('game-joined', { gameId: gameSessionId, playerIndex: gameState.players.indexOf(existingPlayer) });
        }
    }

    emitGameState(gameSessionId);
}

function handleUnitMove(socket: Socket, gameSessionId: string, unitID: number, target: { row: number; col: number }) {
    const gameState = games[gameSessionId];
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === playerGameMap[gameSessionId]);
    if (!player) return;

    const unit = player.units.find(u => u.id === unitID);
    if (!unit || !unit.canMove) return;

    if (isValidMove(unit, target, gameState)) {
        const origin = { row: unit.row, col: unit.col };
        unit.row = target.row;
        unit.col = target.col;
        unit.canMove = false;

        console.log(`[${gameSessionId}]: ${player.name}: unit ${unitID} moving to tile (${target.row}, ${target.col})`);

        for (const p of gameState.players) {
            io?.to(p.socketId).emit('player-unit-moving', {
                unit: { ...unit, owner: undefined },
                origin,
                target
            });
        }
    }

    emitGameState(gameSessionId);
}

function handleUnitAction(socket: Socket, gameSessionId: string, unitID: number, tile: { row: number; col: number }) {
    const gameState = games[gameSessionId];
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === playerGameMap[gameSessionId]);
    if (!player) return;

    const unit = player.units.find(u => u.id === unitID);
    if (!unit || !unit.canAct) return;

    let otherUnitsOwner = gameState.players.find(p => p.units.find(u => u.row === tile.row && u.col === tile.col));
    if (!otherUnitsOwner) return;
    const otherUnit = otherUnitsOwner.units.find(u => u.row === tile.row && u.col === tile.col);
    if (!otherUnit) return;

    if (isValidAction(unit, tile, gameState)) {
        let healthBefore = otherUnit.health;
        let healthAfter: number;

        if (player.id !== otherUnitsOwner.id) {
            healthAfter = otherUnit.health - Math.floor(unit.attack * (1 - otherUnit.defense / (otherUnit.defense + 20)));
            console.log(`[${gameSessionId}]: ${player.name}: unit ${unitID} attacking at tile (${tile.row}, ${tile.col})`);
            if (healthAfter <= 0) {
                otherUnitsOwner.units = otherUnitsOwner.units.filter(u => u.id !== otherUnit.id);
            }
        } else {
            healthAfter = Math.min(otherUnit.health + unit.attack, otherUnit.maxHealth);
            console.log(`[${gameSessionId}]: ${player.name}: unit ${unitID} healing at tile (${tile.row}, ${tile.col})`);
        }

        otherUnit.health = healthAfter;
        unit.canAct = false;

        for (const p of gameState.players) {
            io?.to(p.socketId).emit('player-unit-acting', { unit: { ...unit, owner: undefined } });
            io?.to(p.socketId).emit('animate-healthbar', { ...otherUnit, owner: undefined }, healthBefore, healthAfter);
        }
    }

    emitGameState(gameSessionId);
}

function handleForceEndTurn(socket: Socket, gameSessionId: string) {
    const gameState = games[gameSessionId];
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === playerGameMap[gameSessionId]);
    if (!player) return;
    if (gameState.players[gameState.round % 2] !== player) return;

    nextRound(gameSessionId);
}

function handleForceUnitEndTurn(socket: Socket, gameSessionId: string, unitID: number) {
    const gameState = games[gameSessionId];
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === playerGameMap[gameSessionId]);
    if (!player) return;
    const unit = player.units.find(u => u.id === unitID);
    if (!unit) return;

    unit.canMove = false;
    unit.canAct = false;
    emitGameState(gameSessionId);
}

function nextRound(gameSessionId: string) {
    const gameState = games[gameSessionId];
    if (!gameState) return;

    const oldPlayer = gameState.players[gameState.round % 2];
    gameState.round++;

    const newPlayer = gameState.players[gameState.round % 2];

    if (gameState.round % 2 === 0) {
        gameState.player1Time = Math.min(gameState.player1Time + 5, MAX_TIME);
    } else {
        gameState.player2Time = Math.min(gameState.player2Time + 5, MAX_TIME);
    }

    oldPlayer.units.forEach(u => { u.canAct = false; u.canMove = false; });
    newPlayer.units.forEach(u => { u.canAct = true; u.canMove = true; });

    emitGameState(gameSessionId);

    for (const p of gameState.players) {
        io?.to(p.socketId).emit('nextRound', { socket: newPlayer.socketId });
    }
}

function emitGameState(gameSessionId: string) {
    const gameState = games[gameSessionId];
    if (!gameState) return;

    for (const player of gameState.players) {
        const playerGameState = getPlayerGameState(gameState, player);
        const serializedData = JSON.stringify(playerGameState);
        const compressed = deflate(serializedData);
        io?.to(player.socketId).emit('gameState', compressed);
    }
}

function getPlayerGameState(gameState: GameState, player: Player): GameState {
    const temp: GameState = {
        ...gameState,
        arena: { ...gameState.arena },
        players: gameState.players.map(p => ({
            ...p,
            units: p.units.map(u => ({ ...u })),
        })),
        visibleTiles: [],
    };

    let visibleTiles: { row: number; col: number }[] = [];
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
                        for (const t of path) {
                            const terrain = temp.arena.tiles[t.y][t.x];
                            if (terrain === 3 && !adjacentTile(row, col, t.y, t.x)) { canSee = false; break; }
                            if (terrain === 4) { canSee = false; break; }
                        }
                        if (canSee && !visibleTiles.some(vt => vt.row === targetRow && vt.col === targetCol)) {
                            visibleTiles.push({ row: targetRow, col: targetCol });
                        }
                    }
                }
            }
        }
    }

    temp.visibleTiles = visibleTiles;

    const otherPlayer = temp.players.find(p => p.id !== player.id);
    if (otherPlayer) {
        otherPlayer.units = otherPlayer.units.filter(u =>
            visibleTiles.some(vt => vt.row === u.row && vt.col === u.col)
        );
    }

    return temp;
}

function endGame(gameSessionId: string, interval: NodeJS.Timeout, winner?: Player) {
    clearInterval(interval);
    console.log(`[${gameSessionId}]: Game ended`);
    delete games[gameSessionId];
}

function isValidMove(unit: Unit, tile: { row: number; col: number }, gameState: GameState): boolean {
    const arena = gameState.arena;
    let mobility = unit.mobility;
    let row = unit.row;
    let col = unit.col;

    for (let i = -mobility; i <= mobility; i++) {
        for (let j = -mobility; j <= mobility; j++) {
            if (Math.abs(i) + Math.abs(j) <= mobility) {
                const targetRow = row + i;
                const targetCol = col + j;
                if (targetRow < 0 || targetCol < 0 || targetRow >= arena.tiles.length || targetCol >= arena.tiles[0].length) continue;
                if (hasUnit(targetRow, targetCol, gameState) && (i !== 0 || j !== 0)) continue;
                if (arena.tiles[targetRow][targetCol] === 0) continue;

                const path = astarPath(row, col, targetRow, targetCol, arena);
                if (path.length - 1 > mobility) continue;

                let canMove = true;
                let mobilityPenalty = 0;
                for (const t of path) {
                    const terrain = arena.tiles[t.y][t.x];
                    if ((row !== t.y && col !== t.x) && hasUnit(t.y, t.x, gameState)) { canMove = false; break; }
                    if (terrain === 0 || terrain === 4) { canMove = false; break; }
                    if (terrain === 2) mobilityPenalty += 2;
                }

                if (canMove && (mobility - mobilityPenalty >= 0) && targetRow === tile.row && targetCol === tile.col) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isValidAction(unit: Unit, tile: { row: number; col: number }, gameState: GameState): boolean {
    const arena = gameState.arena;
    let range = unit.range;

    for (let i = -range; i <= range; i++) {
        for (let j = -range; j <= range; j++) {
            if (Math.abs(i) + Math.abs(j) <= range) {
                const targetRow = unit.row + i;
                const targetCol = unit.col + j;
                if (targetRow === unit.row && targetCol === unit.col) continue;

                if (targetRow >= 0 && targetRow < arena.tiles.length && targetCol >= 0 && targetCol < arena.tiles[0].length) {
                    const path = bresenhamPath(unit.row, unit.col, targetRow, targetCol);
                    let canSee = true;
                    for (const t of path) {
                        if (arena.tiles[t.y][t.x] === 4) { canSee = false; break; }
                    }
                    if (canSee && targetRow === tile.row && targetCol === tile.col) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function hasUnit(row: number, col: number, gameState: GameState): boolean {
    for (const p of gameState.players) {
        if (p.units.some(u => u.row === row && u.col === col)) return true;
    }
    return false;
}

function adjacentTile(row1: number, col1: number, row2: number, col2: number): boolean {
    return (row1 === row2 && col1 === col2) || (Math.abs(row1 - row2) === 1 && col1 === col2) || (Math.abs(col1 - col2) === 1 && row1 === row2);
}

function bresenhamPath(startRow: number, startCol: number, endRow: number, endCol: number): Tile[] {
    const path: Tile[] = [];
    let x = startCol;
    let y = startRow;
    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const sx = startCol < endCol ? 1 : -1;
    const sy = startRow < endRow ? 1 : -1;
    let err = dx - dy;

    while (x !== endCol || y !== endRow) {
        path.push({ x, y, row: y, col: x });
        const e2 = err * 2;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
    }
    path.push({ x, y, row: y, col: x });
    return path;
}

function astarPath(startRow: number, startCol: number, endRow: number, endCol: number, arena: Arena): Tile[] {
    const grid = arena.tiles;
    const openList: Tile[] = [];
    const closedList = new Set<string>();

    const startTile: Tile = { x: startCol, y: startRow, g: 0, h: heuristic({ x: startCol, y: startRow, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }), f: 0, parent: null };
    openList.push(startTile);

    const neighbors = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

    while (openList.length > 0) {
        openList.sort((a, b) => (a.f || 0) - (b.f || 0));
        const current = openList.shift()!;

        if (current.x === endCol && current.y === endRow) {
            const path: Tile[] = [];
            let curr: Tile | null = current;
            while (curr) { path.unshift({ x: curr.x, y: curr.y, row: curr.y, col: curr.x }); curr = curr.parent || null; }
            return path;
        }

        closedList.add(`${current.x},${current.y}`);

        for (const { x: dx, y: dy } of neighbors) {
            const nx = current.x + dx;
            const ny = current.y + dy;

            if (nx >= 0 && nx < grid[0].length && ny >= 0 && ny < grid.length &&
                grid[ny][nx] !== 0 && grid[ny][nx] !== 4 &&
                arena.heightMap[ny][nx] - arena.heightMap[current.y][current.x] <= 1.5) {

                const neighbor: Tile = {
                    x: nx, y: ny,
                    g: (current.g || 0) + 1,
                    h: heuristic({ x: nx, y: ny, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }),
                    f: 0, parent: current
                };

                if (!closedList.has(`${neighbor.x},${neighbor.y}`)) {
                    neighbor.f = (neighbor.g || 0) + (neighbor.h || 0);
                    const existing = openList.find(t => t.x === neighbor.x && t.y === neighbor.y);
                    if (!existing || (neighbor.f || 0) < (existing.f || 0)) {
                        openList.push(neighbor);
                    }
                }
            }
        }
    }
    return [];
}

function heuristic(a: Tile, b: Tile): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function initializeGameState(gameSessionId: string): GameState {
    return {
        id: gameSessionId,
        privacy: 'public',
        players: [],
        arena: {
            width: 1024, height: 512, name: 'field',
            tiles: [
                [1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
                [0,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,0],
                [0,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0],
                [0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0],
                [0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0,0,0],
                [0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0,0,0],
                [0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0],
                [0,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0],
                [0,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,0],
                [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1]
            ],
            heightMap: [
                [3.5,3.5,3.5,3,3,0,0,0,0,0,0,0,0,0,0,3,2.5,2.5,2.5,2.5],
                [3.5,3.5,3.5,3,3,3,3,3,3,3,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2,2,2],
                [3.5,3.5,3.5,3,3,3,3,3,3,3,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2,2,2],
                [3,3,3,3,3,3,3,3,2.5,2.5,2.5,2.5,2.5,2,2,2,2,2,2,2],
                [3,3,3,3,3,3,2.5,2.5,2.5,2.5,2.5,2,2,2,2,2,2,2,2,2],
                [0,3,3,3,3,2.5,2.5,2.5,2.5,2.5,2.5,2,2,2,2,2,2,2,2,0],
                [0,3,3,3,2.5,2.5,2.5,2.5,0,0,0,0,2,2,2,2,2,2,2,0],
                [0,3,2.5,2.5,2.5,2,2,0,0,0,0,0,0,2,2,2,2,2,2,0],
                [0,0,2.5,2.5,2,2,0,0,0,0,0,0,0,0,1.5,1.5,1.5,1.5,0,0],
                [0,0,0,2,2,2,0,0,0,0,0,0,0,0,1.5,1.5,1.5,0,0,0],
                [0,0,0,2,1.5,1.5,0,0,0,0,0,0,0,0,1.5,1.5,1.5,0,0,0],
                [0,0,2,2,1.5,1.5,0,0,0,0,0,0,0,0,1,1,1,1,0,0],
                [0,2,2,1.5,1.5,1.5,1.5,0,0,0,0,0,0,1,1,1,1,1,1,0],
                [0,2,2,1.5,1.5,1.5,1.5,1,0,0,0,0,1,1,1,1,1,1,1,0],
                [0,2,2,1.5,1.5,1.5,1.5,1,1,1,1,1,1,1,1,1,1,1,1,0],
                [2.5,2,2,1.5,1.5,1.5,1.5,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [2.5,2,2,1.5,1.5,1.5,1.5,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [2.5,2,2,1.5,1.5,1.5,1.5,1,1,1,1,1,1,1,1,1,1,0.5,0.5,0.5],
                [2.5,2,2,1.5,1.5,1.5,1.5,1,1,1,1,1,1,1,1,1,1,0.5,0.5,0.5],
                [2.5,2,2,1.5,1.5,0,0,0,0,0,0,0,0,0,0,1,1,0.5,0.5,0.5],
            ],
            obstacles: [
                { name: "well1", row: 1, col: 18, sprite: { width: 32, height: 64, name: "well", image: "well" } },
                { name: "well2", row: 16, col: 3, sprite: { width: 32, height: 64, name: "well", image: "well" } }
            ],
            p1Start: { row: 0, col: 0 },
            p2Start: { row: 19, col: 19 },
        },
        round: 0,
        player1Time: MAX_TIME,
        player2Time: MAX_TIME,
        visibleTiles: [{ row: -1, col: -1 }],
    };
}

httpServer.listen(port, () => {
    console.log(`[${gameId}] Game server listening on port ${port}`);
});

process.on("SIGTERM", () => {
    console.log(`[${gameId}] Received SIGTERM, shutting down...`);
    io.close();
    httpServer.close();
    process.exit(0);
});
