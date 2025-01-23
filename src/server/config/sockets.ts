import { Server } from "http";
import type { Express, RequestHandler } from "express";
import { Server as SocketIoServer, Socket } from "socket.io";

let io: SocketIoServer | undefined;

const MAX_TIME = 60 * 5; 
const TICKRATE = 8;

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

            socket.on('create-game', (isPrivate: boolean, joinCode: string | null) => {
                // Check if the player is already part of a game
                let isValid = true;
                let existingGameID = Object.keys(games).find(gameID => 
                    games[gameID].players.some(player => player.id === sessionID)
                );
                if (!existingGameID) {
                    if (!isPrivate) {
                        // can replace with much more advance matchmaking algorithm
                        existingGameID = Object.keys(games).find(gameID => games[gameID].players.length < 2 && games[gameID].privacy === 'public');
                    }
                    else if (joinCode) {
                        const privateCode = "game-" + joinCode.toString();
                        existingGameID = Object.keys(games).find(gameID => games[gameID].id === privateCode && games[gameID].privacy === 'private');
                        console.log(existingGameID);
                        if (!existingGameID) {
                            socket.emit('invalid-code');
                            isValid = false;
                        }
                    }
                }

                if (isValid){
                    if (existingGameID) {
                        gameID = existingGameID;
                    } else {
                        // Create a new game
                        gameID = generateGameId();
                        const match = gameID.match(/\d+/);
                        const gameCode = match![0];
                        socket.emit('game-code', { code: gameCode });
                        games[gameID] = initializeGameState(gameID, isPrivate);
                        let gameState = games[gameID];
                        
                        let tick = 0;
                        let interval = setInterval(() => {
                            if (tick % TICKRATE === 0) {
                                if (gameState.players.length === 2) {
                                    if (gameState.round % 2 === 0) {
                                        gameState.player1Time -= 1;
                    
                                        if (gameState.player1Time === 0) {
                                            console.log(`${gameState.players[0].name} ran out of time`);
                                            winnerChosen(gameID, gameState.players[1]);
                                            endGame(gameID, interval);
                                        }
                                    } else {
                                        gameState.player2Time -= 1;
                    
                                        if (gameState.player2Time === 0) {
                                            console.log(`${gameState.players[1].name} ran out of time`);
                                            winnerChosen(gameID, gameState.players[0]);
                                            endGame(gameID, interval);
                                        }
                                    }
        
                                    if (gameState.players[0].units.length === 0) {
                                        console.log(`${gameState.players[0].name} has no units left`);
                                        winnerChosen(gameID, gameState.players[1]);
                                        endGame(gameID, interval);
                                    }
        
                                    if (gameState.players[1].units.length === 0) {
                                        console.log(`${gameState.players[1].name} has no units left`);
                                        winnerChosen(gameID, gameState.players[0]);
                                        endGame(gameID, interval);
                                    }

                                    const player1King = gameState.players[0].units.find(u => u.name === "king");
                                    const player2King = gameState.players[1].units.find(u => u.name === "king");

                                    if(!player1King) {
                                        console.log(`${gameState.players[0].name}'s King is Dead.`);
                                        winnerChosen(gameID, gameState.players[1]);
                                        endGame(gameID, interval);
                                    }
                                    if(!player2King) {
                                        console.log(`${gameState.players[1].name}'s King is Dead.`);
                                        winnerChosen(gameID, gameState.players[0]);
                                        endGame(gameID, interval);
                                    }
                                }
                            }
                            emitGameState(gameID);
                            tick++;
                        }, 1000 / TICKRATE);
                    }
    
                    const initGameState = games[gameID];
                
                    if (initGameState.players.length < 2 && !initGameState.players.find(p => p.id === sessionID)) {
                        addPlayerToGame(initGameState, socket);
                        if (initGameState.players.length === 2) {
                            nextRound();
                        }
                    } else if (initGameState.players.length < 2 && initGameState.players.find(p => p.id === sessionID)) {
                        const player = initGameState.players.find(p => p.id === sessionID);
                        if (player) player.socket = socket.id;
                    } else if (initGameState.players.length === 2) {
                        const player = initGameState.players.find(p => p.id === sessionID);
                        if (player) player.socket = socket.id;
                    }
                }
                emitGameState(gameID);
            });
            
            // Game Logic
            socket.on('player-unit-move', (unitID: number, target: { x: number, y: number, row: number, col: number }) => {
                const gameID = getGameIdForPlayer(sessionID); // Function to get the gameId for this player
                const gameState = games[gameID];
            
                // Find player and unit
                const player = gameState.players.find(p => p.id === sessionID);
                if (!player) return;
                const unit = player.units.find(u => u.id === unitID);
                if (!unit) return;
                if (!unit.canMove) return;
                let otherUnit = gameState.players.find((player) => player.units.find((unit) => unit.row === target.row && unit.col === target.col));
                if (otherUnit && otherUnit.id !== sessionID) return;
            
                if (unit && isValidMove(unit, target, gameState)) {
                    const origin: {row: number, col: number} = {row: unit.row, col: unit.col};
                    for (let player of gameState.players) {
                        app.get('io').to(player.socket).emit('player-unit-moving', unit, origin, target);
                    }
                    unit.row = target.row;
                    unit.col = target.col;
                    unit.canMove = false;   
                }

                console.log(`[${gameID}]: ${player.name}: unit ${unitID} moving to tile (${target.row}, ${target.col})`);
                
                emitGameState(gameID);
            });

            socket.on('player-unit-action', (unitID: number, tile: { x: number, y: number, row: number, col: number }) => {
                const gameID = getGameIdForPlayer(sessionID); 
                const gameState = games[gameID];
            
                const player = gameState.players.find(p => p.id === sessionID);
                if (!player) return;
                const unit = player.units.find(u => u.id === unitID);
                if (!unit) return;
                if (!unit.canAct) return;

                let otherUnitsOwner = gameState.players.find((player) => player.units.find((unit) => unit.row === tile.row && unit.col === tile.col));
                if (!otherUnitsOwner) return;
                let otherUnit = otherUnitsOwner.units.find((unit) => unit.row === tile.row && unit.col === tile.col);
                if (!otherUnit) return;

                if(unit && isValidAction(unit, tile, gameState)) {
                    if (sessionID !== otherUnitsOwner.id) {
                        // attack
                        otherUnit.health -= unit.attack * (1 - otherUnit.defense / (otherUnit.defense + 20));
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
                const gameID = getGameIdForPlayer(sessionID);
                const gameState = games[gameID];
                
                const player = gameState.players.find(p => p.id === sessionID);
                if (!player) return;
                if (gameState.players[gameState.round % 2] !== player) {
                    return;
                }
                nextRound();
            });

            socket.on("force-unit-end-turn", (unitID: number) => {
                const gameID = getGameIdForPlayer(sessionID);
                const gameState = games[gameID];
                
                const player = gameState.players.find(p => p.id === sessionID);
                if (!player) return;
                const unit = player.units.find(u => u.id === unitID);
                if (!unit) return;

                unit.canMove = false;
                unit.canAct = false;

                emitGameState(gameID);
            });

            socket.on("disconnect", () => {
                console.log(`client disconnected (${sessionID})`);
                // if disconnect and only one player in game, close game
                const gameID = getGameIdForPlayer(sessionID);
                const gameState = games[gameID];
                if (!gameState || !gameState.players) return;
                if (gameState.players.length !== 2){
                    let interval = setInterval(() => {}, 9999);
                    endGame(gameID, interval);
                }
                
            });

            function endGame(gameID: string, interval: NodeJS.Timeout) {
                clearInterval(interval);
                emitGameState(gameID);
                console.log(`[${gameID}]: Closing Game...`);
                if(games[gameID]){
                    delete games[gameID];
                }
            }

            function nextRound() {
                const gameID = getGameIdForPlayer(sessionID); 
                const gameState = games[gameID];
            
                const oldPlayer = gameState.players.find(p => p.id === sessionID);
                if (!oldPlayer) return;
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

                oldPlayer.units.forEach((unit) => {
                    unit.canAct = false;
                    unit.canMove = false;
                });

                newPlayer.units.forEach((unit) => {
                    unit.canAct = true;
                    unit.canMove = true;
                });

                emitGameState(gameID);

                for (let player of gameState.players) {
                    app.get('io').to(player.socket).emit('nextRound', gameState.players[gameState.round % 2]);
                }
            }
            
            function emitGameState(gameID: string) {
                const gameState = games[gameID];
                if (!gameState) return;
                for (let player of gameState.players) {
                    let playerGameState = getPlayerGameState(gameState, player);
                    app.get('io').to(player.socket).emit('gameState', playerGameState);
                }
            }

            function winnerChosen(gameID: string, winner: Player) {
                const gameState = games[gameID];
                if (!gameState) return;
                for (let player of gameState.players) {
                    app.get('io').to(player.socket).emit('gameOver', winner);
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
    p1Start: { row: number, col: number };
    p2Start: { row: number, col: number };
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
    idleFrames: number;
    currentFrame: number;
    framesElapsed: number;
    framesHold: number;
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

interface Tile {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: Tile | null;
}

const games: { [gameId: string]: GameState } = {}; // Store all games by ID

const playerGameMap: { [sessionId: string]: string } = {}; // Maps session ID to game ID

function generateGameId(): string {
    return `game-${Date.now()}`;
}

// A*
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

                // Check the path for obstacles or terrain that blocks movement
                const path = astarPath(row, col, targetRow, targetCol, arena);
                if (path.length - 1 > mobility) continue;
                let canMove = true;
                let mobilityPenalty = 0;
                for (const tile of path) {
                    const terrain: number = arena.tiles[tile.y][tile.x];

                    if((row !== tile.y && col !== tile.x) && hasUnit(tile.y, tile.x, gameState)) {
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
                    validTiles.push({row: row + i, col: col + j});
                }
            }
        }
    }

    if (!validTiles.find((validTile) => validTile.row === tile.row && validTile.col === tile.col)){
        console.log("Invalid move");
        return false;
    }

    return true;
}

// Bresenham
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
                    // Check the path for tiles that can restrict visibility
                    const path = bresenhamPath(row, col, targetRow, targetCol);
                    let canSee = true;
                    let rangePenalty = 0;

                    for (const tile of path) {
                        if (arena.tiles){
                            const terrain: number = arena.tiles[tile.y][tile.x];

                            if (terrain === 4) {
                                canSee = false;
                                break;
                            }
                        }
                    }

                    if (canSee && (range - rangePenalty >= 0)) {
                        validTiles.push({row: row + i, col: col + j});
                    }
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

// tile types 0 hole 1 ground 2 hill 3 forest 4 wall
function initializeGameState(gameID: string, isPrivate: boolean): GameState {
    return {
        id: gameID,
        privacy: isPrivate ? "private" : "public",
        players: [] as Player[],
        arena: {
            width: 1024,
            height: 512,
            name: 'debug',
            tiles: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1]
            ],
            heightMap: [
                [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
                [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
                [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
                [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
                [3, 3, 3, 3, 3, 3, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
                [2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
                [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
                [2, 2, 2, 2, 2, 2, 2, 1.5, 1.5, 1.5, 2, 2, 2, 1.5, 1.5, 1.5, 2, 2, 2, 2],
                [2, 2, 2, 2, 2, 2, 2, 1.5, 1.5, 1.5, 2, 2, 2, 1.5, 1.5, 1.5, 2, 2, 2, 2],
                [2, 2, 2, 2, 2, 2, 2, 1.5, 1.5, 1.5, 2, 2, 2, 1.5, 1.5, 1.5, 2, 2, 2, 2],
                [2, 2, 2, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
                [2, 2, 2, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
                [2, 2, 2, 1.5, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
            ],
            obstacles: [
                {
                    name: "example_house",
                    row: 2, 
                    col: 19,
                    sprite: {
                        width: 96,
                        height: 96,
                        name: "example_house",
                        image: "example_house",
                    }
                }
            ],
            p1Start: {row: 0, col: 0},
            p2Start: {row: 19, col: 19},
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
    let temp = { ...gameState };

    temp.arena = { ...gameState.arena };
    temp.players = gameState.players.map(player => ({
        ...player,
        units: player.units.map(unit => ({ ...unit })),
    }));

    // calculate Fog Of War
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
                        let visibilityPenalty = 0;

                        for (const tile of path) {
                            if (temp.arena.tiles){
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

                        if (canSee && (viewDistance - visibilityPenalty >= 0)) {
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

function adjacentTile(row1: number, col1: number, row2: number, col2: number): boolean {
    return (row1 === row2 && col1 === col2) || 
           (Math.abs(row1 - row2) === 1 && col1 === col2) || 
           (Math.abs(col1 - col2) === 1 && row1 === row2);
}

// Bresenham's Line Algorithm
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

// A* Pathfinding Algorithm
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
        // Sort openList by F cost (lowest F cost first)
        openList.sort((a, b) => a.f - b.f);
        const current = openList.shift()!; // Get the tile with the lowest F cost

        // If we've reached the goal, reconstruct the path
        if (current.x === endTile.x && current.y === endTile.y) {
            const path: { x: number, y: number }[] = [];
            let currentTile: Tile | null = current;
            while (currentTile) {
                path.unshift({ x: currentTile.x, y: currentTile.y });
                currentTile = currentTile.parent;
            }
            return path;
        }

        closedList.add(`${current.x},${current.y}`);

        // Check all neighbors
        for (const { x: dx, y: dy } of neighbors) {
            const neighborX = current.x + dx;
            const neighborY = current.y + dy;

            // Check if the neighbor is within bounds and is not an obstacle (assuming 1 = walkable, 0 = obstacle) and height difference is not >= 1.5
            if (neighborX >= 0 && neighborX < grid[0].length && neighborY >= 0 && neighborY < grid.length && (grid[neighborY][neighborX] !== 0 && grid[neighborY][neighborX] !== 4) && arena.heightMap[neighborY][neighborX] - arena.heightMap[current.y][current.x] <= 1.5) {
                const neighbor: Tile = {
                    x: neighborX,
                    y: neighborY,
                    g: current.g + 1, // Assume cost to move to any neighbor is 1
                    h: heuristic({ x: neighborX, y: neighborY, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }),
                    f: 0,
                    parent: current
                };                

                if (closedList.has(`${neighbor.x},${neighbor.y}`)) {
                    continue; // Skip if already evaluated
                }

                // Check if this neighbor is better (lower f) than any previously evaluated
                if (!openList.some(tile => tile.x === neighbor.x && tile.y === neighbor.y)) {
                    neighbor.f = neighbor.g + neighbor.h;
                    openList.push(neighbor);
                }
            }
        }
    }

    return []; // No path found
}

function heuristic(a: Tile, b: Tile): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hasUnit(row: number, col: number, gameState: GameState): boolean {
    const units = [...gameState.players[0].units, ...gameState.players[1].units];
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            return true;
        }
    }
    return false;
}

function addPlayerToGame(gameState: GameState, socket: Socket) {
    // @ts-expect-error
    const sessionID = socket.request.session.id;
    // @ts-expect-error
    const username = socket.request.session.user.username;
    // @ts-expect-error
    const profilePic = socket.request.session.user.image;

    console.log(`Adding ${username} to game ${gameState.id} with profile image ${profilePic}`);

    let newPlayer: Player = {
        id: sessionID,
        socket: socket.id,
        name: username,
        profileimage: profilePic ? profilePic : "default",
        units: [],
    };

    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row : gameState.arena.p2Start.row,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col : gameState.arena.p2Start.row,
        name: "king",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 4,
        maxHealth: 4,
        attack: 3,
        defense: 1,
        range: 2,
        mobility: 3,
    });

    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row + 2 : gameState.arena.p2Start.row - 2,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col : gameState.arena.p2Start.row,
        name: "melee",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 3,
        maxHealth: 3,
        attack: 3,
        defense: 1,
        range: 1,
        mobility: 2,
    });
    
    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row : gameState.arena.p2Start.row,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col + 2 : gameState.arena.p2Start.row - 2,
        name: "ranged",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 2,
        maxHealth: 2,
        attack: 2,
        defense: 0,
        range: 3,
        mobility: 3,
    });
    
    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row + 1 : gameState.arena.p2Start.row - 1,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col : gameState.arena.p2Start.row,
        name: "mage",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 2,
        maxHealth: 2,
        attack: 4,
        defense: 0,
        range: 2,
        mobility: 2,
    });
    
    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row : gameState.arena.p2Start.row,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col + 1 : gameState.arena.p2Start.row - 1,
        name: "healer",
        action: "heal",
        canMove: true,
        canAct: true,
        health: 1,
        maxHealth: 1,
        attack: 3,
        defense: 0,
        range: 2,
        mobility: 4,
    });
    
    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row + 2 : gameState.arena.p2Start.row - 2,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col + 1 : gameState.arena.p2Start.row - 1,
        name: "cavalry",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 2,
        maxHealth: 2,
        attack: 2,
        defense: 1,
        range: 1,
        mobility: 4,
    });
    
    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row + 2 : gameState.arena.p2Start.row - 2,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col + 2 : gameState.arena.p2Start.row - 2,
        name: "scout",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 2,
        maxHealth: 2,
        attack: 1,
        defense: 1,
        range: 1,
        mobility: 5,
    });
    
    newPlayer.units.push({
        id: (newPlayer.units.length + 1) + (gameState.players.length === 1 ? 50 : 0),
        row: gameState.players.length === 0 ? gameState.arena.p1Start.row + 1 : gameState.arena.p2Start.row - 1,
        col: gameState.players.length === 0 ? gameState.arena.p1Start.col + 2 : gameState.arena.p2Start.row - 2,
        name: "tank",
        action: "attack",
        canMove: true,
        canAct: true,
        health: 4,
        maxHealth: 4,
        attack: 1,
        defense: 2,
        range: 1,
        mobility: 2,
    });

    gameState.players.push(newPlayer);
    playerGameMap[sessionID] = gameState.id;
}