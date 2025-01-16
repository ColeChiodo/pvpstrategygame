import { Server } from "http";
import type { Express, RequestHandler } from "express";
import { Server as SocketIoServer, Socket } from "socket.io";

let io: SocketIoServer | undefined;

const MAX_TIME = 60 * 5; 

export default function (server: Server, app: Express, sessionMiddleware: RequestHandler): SocketIoServer {
    if(io === undefined) {
        io = new SocketIoServer(server);

        app.set("io", io);
        io.on("connection", (socket) => {
            // @ts-expect-error
            const sessionID = socket.request.session.id;

            console.log(`client connected (${sessionID})`);
            console.log(`client socket id (${socket.id})`);

            let gameID: string;

            // Check if the player is already part of a game
            let existingGameID = Object.keys(games).find(gameID => 
                games[gameID].players.some(player => player.id === sessionID)
            );
            if (!existingGameID) {
                // find first instance of a game that has less than 2 players, get the game id
                existingGameID = Object.keys(games).find(gameID => games[gameID].players.length < 2 && games[gameID].privacy === 'public');
            }
            
            if (existingGameID) {
                gameID = existingGameID;
            } else {
                // Create a new game
                gameID = generateGameId();
                games[gameID] = initializeGameState(gameID);
                let gameState = games[gameID];
                let interval = setInterval(() => {
                    if (gameState.players.length === 2) {
                        if (gameState.round % 2 === 0) {
                            gameState.player1Time -= 1;
        
                            if (gameState.player1Time === 0) {
                                console.log(`${gameState.players[0].name} ran out of time`);
                                endGame(gameID, interval);
                            }
                        } else {
                            gameState.player2Time -= 1;
        
                            if (gameState.player2Time === 0) {
                                console.log(`${gameState.players[1].name} ran out of time`);
                                endGame(gameID, interval);
                            }
                        }

                        if (gameState.players[0].units.length === 0) {
                            console.log(`${gameState.players[0].name} has no units left`);
                            endGame(gameID, interval);
                        }

                        if (gameState.players[1].units.length === 0) {
                            console.log(`${gameState.players[1].name} has no units left`);
                            endGame(gameID, interval);
                        }
                    }
                    emitGameState(gameID);
                }, 1000);
            }

            const initGameState = games[gameID];
            
            if (initGameState.players.length < 2 && !initGameState.players.find(p => p.id === sessionID)) {
                addPlayerToGame(initGameState, socket);
            } else if (initGameState.players.length < 2 && initGameState.players.find(p => p.id === sessionID)) {
                const player = initGameState.players.find(p => p.id === sessionID);
                if (player) player.socket = socket.id;
            } else if (initGameState.players.length === 2) {
                const player = initGameState.players.find(p => p.id === sessionID);
                if (player) player.socket = socket.id;
            }

            emitGameState(gameID);
            
            // Game Logic
            socket.on('player-unit-move', (unitID: number, tile: { x: number, y: number, row: number, col: number }) => {
                const gameID = getGameIdForPlayer(sessionID); // Function to get the gameId for this player
                const gameState = games[gameID];
            
                // Find player and unit
                const player = gameState.players.find(p => p.id === sessionID);
                if (!player) return;
                const unit = player.units.find(u => u.id === unitID);
                if (!unit) return;
                if (!unit.canMove) return;
                let otherUnit = gameState.players.find((player) => player.units.find((unit) => unit.row === tile.row && unit.col === tile.col));
                if (otherUnit && otherUnit.id !== sessionID) return;
            
                if (unit && isValidMove(unit, tile, gameState.arena)) {
                    unit.row = tile.row;
                    unit.col = tile.col;
                    unit.canMove = false;
                }

                console.log(`[${gameID}]: ${player.name}: unit ${unitID} moving to tile (${tile.row}, ${tile.col})`);
                socket.emit('player-unit-moved', unitID, tile);
                emitGameState(gameID);
            });

            socket.on('player-unit-action', (unitID: number, tile: { x: number, y: number, row: number, col: number }) => {
                const gameID = getGameIdForPlayer(sessionID); // Function to get the gameId for this player
                const gameState = games[gameID];
            
                // Find player and unit
                const player = gameState.players.find(p => p.id === sessionID);
                if (!player) return;
                const unit = player.units.find(u => u.id === unitID);
                if (!unit) return;
                if (!unit.canAct) return;

                let otherUnitsOwner = gameState.players.find((player) => player.units.find((unit) => unit.row === tile.row && unit.col === tile.col));
                if (!otherUnitsOwner) return;
                let otherUnit = otherUnitsOwner.units.find((unit) => unit.row === tile.row && unit.col === tile.col);
                if (!otherUnit) return;

                if(unit && isValidAction(unit, tile, gameState.arena)) {
                    if (sessionID !== otherUnitsOwner.id) {
                        // attack
                        otherUnit.health -= unit.attack;
                        console.log(`[${gameID}]: ${player.name}: unit ${unitID} attacking at tile (${tile.row}, ${tile.col}). ${otherUnit.id} has ${otherUnit.health} health remaining.`);
                        if (otherUnit.health <= 0) {
                            otherUnitsOwner.units = otherUnitsOwner.units.filter((unit) => unit.id !== otherUnit.id);
                        }
                    } else {
                        // heal
                        otherUnit.health += unit.attack;
                        if (otherUnit.health > otherUnit.maxHealth) {
                            otherUnit.health = otherUnit.maxHealth;
                        }
                        console.log(`[${gameID}]: ${player.name}: unit ${unitID} healing at tile (${tile.row}, ${tile.col}). ${otherUnit.id} has ${otherUnit.health} health remaining.`);
                    }
                    unit.canAct = false;
                }
                emitGameState(gameID);
            });

            socket.on("force-end-turn", () => {
                const gameID = getGameIdForPlayer(sessionID); // Function to get the gameId for this player
                const gameState = games[gameID];
                
                const player = gameState.players.find(p => p.id === sessionID);
                if (!player) return;
                if (gameState.players[gameState.round % 2] !== player) {
                    return;
                }
                nextRound();
            });

            socket.on("disconnect", () => {
                console.log(`client disconnected (${sessionID})`);
                // if disconnect and only one player in game, close game
                const gameID = getGameIdForPlayer(sessionID);
                const gameState = games[gameID];

                if (gameState.players.length !== 2){
                    console.log(`[${gameID}]: Closing Game...`);
                    delete games[gameID];
                }
            });

            function endGame(gameID: string, interval: NodeJS.Timeout) {
                clearInterval(interval);
                emitGameState(gameID);
                console.log(`[${gameID}]: Closing Game...`);
                delete games[gameID];
            }

            function nextRound() {
                const gameID = getGameIdForPlayer(sessionID); // Function to get the gameId for this player
                const gameState = games[gameID];
            
                // Find player and unit
                const oldPlayer = gameState.players.find(p => p.id === sessionID);
                if (!oldPlayer) return;
                gameState.round += 1;
                let newPlayer = gameState.players[gameState.round % 2];

                let playerTime = null;

                if (gameState.round % 2 === 0) {
                    playerTime = gameState.player1Time;
                } else {
                    playerTime = gameState.player2Time;
                }

                playerTime += 5;
                if (playerTime > MAX_TIME) {
                    playerTime = MAX_TIME;
                }

                oldPlayer.units.forEach((unit) => {
                    unit.canAct = false;
                    unit.canMove = false;
                });

                newPlayer.units.forEach((unit) => {
                    unit.canAct = true;
                    unit.canMove = true;
                });

                emitGameState(gameID);
            }
            
            function emitGameState(gameId: string) {
                const gameState = games[gameId];
                if (!gameState) return;
                for (let player of gameState.players) {
                    let playerGameState = getPlayerGameState(gameState, player);
                    app.get('io').to(player.socket).emit('gameState', playerGameState);
                }
            }
            
        });

        io.engine.use(sessionMiddleware);
    }

    return io;
}

interface Player {
    id: string;
    socket: string;
    name: string;
    units: Unit[];
}

interface Arena {
    width: number;
    height: number;
    name: string;
    tiles: number[][];
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
    visibleTiles: { row: number, col: number }[];
}

const games: { [gameId: string]: GameState } = {}; // Store all games by ID

const playerGameMap: { [sessionId: string]: string } = {}; // Maps session ID to game ID

function addPlayerToGame(gameState: GameState, socket: Socket) {
    // @ts-expect-error
    const sessionID = socket.request.session.id;
    // @ts-expect-error
    const username = socket.request.session.user.username;

    console.log(`Adding ${username} to game ${gameState.id}`);

    let newPlayer: Player = {
        id: sessionID,
        socket: socket.id,
        name: username,
        units: [],
    };

    newPlayer.units.push({
        id: newPlayer.units.length + 1,
        row: gameState.players.length === 0 ? 0 : 9,
        col: gameState.players.length === 0 ? 0 : 9,
        name: "attack_guy",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 3,
        maxHealth: 3,
        attack: 1,
        defense: 1,
        range: 1,
        mobility: 3,
    });

    newPlayer.units.push({
        id: newPlayer.units.length + 1,
        row: gameState.players.length === 0 ? 1 : 8,
        col: gameState.players.length === 0 ? 1 : 8,
        name: "heal_guy",
        action: "heal",
        canMove: true,
        canAct: true,
        health: 1,
        maxHealth: 1,
        attack: 2,
        defense: 1,
        range: 2,
        mobility: 3,
    });

    gameState.players.push(newPlayer);
    playerGameMap[sessionID] = gameState.id;
}

function generateGameId(): string {
    return `game-${Date.now()}`;
}

function isValidMove(unit: Unit, tile: { x: number, y: number, row: number, col: number }, arena: Arena): boolean {
    let mobility = unit.mobility;
    let row = unit.row;
    let col = unit.col;

    let validTiles = [];

    for (let i = -mobility; i <= mobility; i++){
        for (let j = -mobility; j <= mobility; j++){
            if (Math.abs(i) + Math.abs(j) <= mobility){
                validTiles.push({row: row + i, col: col + j});
            }
        }
    }

    if (!validTiles.find((validTile) => validTile.row === tile.row && validTile.col === tile.col)){
        console.log("Invalid move");
        return false;
    }

    return true;
}

function isValidAction(unit: Unit, tile: { x: number, y: number, row: number, col: number }, arena: Arena): boolean {
    let range = unit.range;
    let row = unit.row;
    let col = unit.col;

    let validTiles = [];

    for (let i = -range; i <= range; i++){
        for (let j = -range; j <= range; j++){
            if (Math.abs(i) + Math.abs(j) <= range){
                if (row + i >= 0 && row + i < arena.height && col + j >= 0 && col + j < arena.width){
                    validTiles.push({row: row + i, col: col + j});
                }
            }
        }
    }

    if (!validTiles.find((validTile) => validTile.row === tile.row && validTile.col === tile.col)){
        console.log("Invalid attack");
        return false;
    }

    return true;
}

function initializeGameState(gameID: string): GameState {
    return {
        id: gameID,
        privacy: 'public',
        players: [] as Player[],
        arena: {
            width: 1024,
            height: 512,
            name: 'sample',
            tiles: [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                    [0, 2, 2, 0, 0, 0, 0, 1, 1, 0],
                    [0, 2, 2, 0, 0, 0, 0, 1, 1, 0],
                    [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
                    [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
        } as Arena,
        round: 0,
        player1Time: MAX_TIME,
        player2Time: MAX_TIME,
        visibleTiles: [{ row: -1, col: -1 }],
    };
}

function getGameIdForPlayer(sessionID: string): string {
    return playerGameMap[sessionID];
}

function getPlayerGameState(gameState: GameState, player: Player): GameState {
    // Shallow copy of the gameState object
    let temp = { ...gameState };

    // Deep copy the `arena` and `players` arrays to avoid mutating the original
    temp.arena = { ...gameState.arena }; // Assuming arena is a simple object (can add deep copy logic if it's more complex)
    temp.players = gameState.players.map(player => ({
        ...player,
        units: player.units.map(unit => ({ ...unit })), // Deep copy of the units array
    }));

    let visibleTiles: { row: number, col: number }[] = [];
    for (const unit of player.units) {
        let viewDistance = unit.range + unit.mobility;
        let row = unit.row;
        let col = unit.col;

        for (let i = -viewDistance; i <= viewDistance; i++) {
            for (let j = -viewDistance; j <= viewDistance; j++) {
                if (Math.abs(i) + Math.abs(j) <= viewDistance) {
                    const targetRow = row + i;
                    const targetCol = col + j;
                    if (targetRow >= 0 && targetRow < temp.arena.tiles.length && targetCol >= 0 && targetCol < temp.arena.tiles[0].length) {
                        // Check the path for tiles that can restrict visibility
                        const path = getPath(row, col, targetRow, targetCol);
                        let canSee = true;
                        let visibilityPenalty = 0;

                        for (const tile of path) {
                            if (temp.arena.tiles){
                                const terrain: number = temp.arena.tiles[tile.y][tile.x];
                                
                                if (terrain === 0) {
                                    canSee = false;
                                    break;
                                } else if (terrain === 2) {
                                    visibilityPenalty += 2;
                                }
                            }
                        }

                        if (canSee && (viewDistance - visibilityPenalty >= 0)) {
                            visibleTiles.push({ row: row + i, col: col + j });
                        }
                    }
                }
            }
        }
    }

    temp.visibleTiles = visibleTiles;

    // For enemy units, if not in visible tiles, remove them
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

// Bresenham's Line Algorithm (diagonals are allowed)
function getPath(startRow: number, startCol: number, endRow: number, endCol: number) {
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