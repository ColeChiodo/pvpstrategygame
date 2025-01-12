import { Server } from "http";
import type { Express, RequestHandler } from "express";
import { Server as SocketIoServer } from "socket.io";

let io: SocketIoServer | undefined;

export default function (server: Server, app: Express, sessionMiddleware: RequestHandler): SocketIoServer {
    if(io === undefined) {
        io = new SocketIoServer(server);

        let gameState = {
            players: [] as Player[],
            arena: {
                width: 1024,
                height: 512,
                name: 'sample',
                tiles: [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
                        [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
                        [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
                        [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
            } as Arena,
        };

        app.set("io", io);
        io.on("connection", (socket) => {
            const { request } = socket;
                    
            socket.use((_, next) => {
                // @ts-expect-error TODO figure out the type for session on request
                request.session.reload((error) => {
                    if(error) {
                        socket.disconnect();
                    } else {
                        next();
                    }
                })
            });

            // @ts-expect-error TODO figure out the type for session on request
            console.log(`client connected (${socket.request.session.id})`);

            app.get("io").emit('gameState', gameState); // change this to initalize game state

            if (gameState.players.length < 2) {
                let newPlayer : Player = {
                    id: socket.id,
                    name: "Player " + gameState.players.length + 1,
                    units: [],
                };
                newPlayer.units.push({
                    id: newPlayer.units.length + 1,
                    row: gameState.players.length === 0 ? 0 : 9,
                    col: gameState.players.length === 0 ? 0 : 9,
                    name: "attack_guy",
                    action: "attack",
                    health: 3,
                    maxHealth: 3,
                    attack: 1,
                    defense: 1,
                    range: 2,
                    mobility: 2,
                });
                newPlayer.units.push({
                    id: newPlayer.units.length + 1,
                    row: gameState.players.length === 0 ? 1 : 8,
                    col: gameState.players.length === 0 ? 1 : 8,
                    name: "heal_guy",
                    action: "heal",
                    health: 1,
                    maxHealth: 1,
                    attack: 2,
                    defense: 1,
                    range: 2,
                    mobility: 2,
                });
                gameState.players.push(newPlayer);
            }
            
            if (gameState.players.length === 2) {
                if (!gameState.players.find((player) => player.id === socket.id)) {
                    socket.disconnect();
                }
            }
            
            // not used
            socket.on('player-action', (action: string) => {
                console.log(`Received action from player ${socket.id}:`, action);
                app.get("io").emit('gameState', gameState);
            });

            socket.on('player-unit-move', (unitID: number, tile: { x: number, y: number, row: number, col: number }) => {
                console.log(`${socket.id}: unit ${unitID} moved to tile (${tile.row}, ${tile.col})`);
                let player = gameState.players.find((player) => player.id === socket.id);
                if (!player) return;
                let unit = player.units.find((unit) => unit.id === unitID);
                if (!unit) return;

                if (unit.row === tile.row && unit.col === tile.col) {
                    // do nothing
                } else {
                    let otherUnit = gameState.players.find((player) => player.units.find((unit) => unit.row === tile.row && unit.col === tile.col));
                    if (otherUnit) return;

                    let mobility = unit.mobility;
                    let row = unit.row;
                    let col = unit.col;

                    let validTiles = [];

                    for (let i = -mobility; i <= mobility; i++){
                        for (let j = -mobility; j <= mobility; j++){
                            if (Math.abs(i) + Math.abs(j) <= mobility){
                                if (row + i >= 0 && row + i < gameState.arena.height && col + j >= 0 && col + j < gameState.arena.width){
                                    validTiles.push({row: row + i, col: col + j});
                                }
                            }
                        }
                    }

                    if (!validTiles.find((validTile) => validTile.row === tile.row && validTile.col === tile.col)){
                        console.log("Invalid move");
                        return;
                    }

                    unit.row = tile.row;
                    unit.col = tile.col;
                }

                socket.emit('player-unit-moved', unitID, tile);
                app.get("io").emit('gameState', gameState);
            });

            socket.on('player-unit-action', (unitID: number, tile: { x: number, y: number, row: number, col: number }) => {
                console.log(`${socket.id}: unit ${unitID} performing action on (${tile.row}, ${tile.col})`);
                let player = gameState.players.find((player) => player.id === socket.id);
                if (!player) return;
                let unit = player.units.find((unit) => unit.id === unitID);
                if (!unit) return;

                let otherUnitsOwner = gameState.players.find((player) => player.units.find((unit) => unit.row === tile.row && unit.col === tile.col));
                if (!otherUnitsOwner) return;
                let otherUnit = otherUnitsOwner.units.find((unit) => unit.row === tile.row && unit.col === tile.col);
                if (!otherUnit) return;

                // if other unit in range
                let range = unit.range;
                let row = unit.row;
                let col = unit.col;

                let validTiles = [];

                for (let i = -range; i <= range; i++){
                    for (let j = -range; j <= range; j++){
                        if (Math.abs(i) + Math.abs(j) <= range){
                            if (row + i >= 0 && row + i < gameState.arena.height && col + j >= 0 && col + j < gameState.arena.width){
                                validTiles.push({row: row + i, col: col + j});
                            }
                        }
                    }
                }

                if (!validTiles.find((validTile) => validTile.row === tile.row && validTile.col === tile.col)){
                    console.log("Invalid attack");
                    return;
                }

                if (socket.id !== otherUnitsOwner.id) {
                    // attack
                    otherUnit.health -= unit.attack;
                    console.log(`Unit ${unitID} attacked unit ${otherUnit.id} for ${unit.attack} damage. ${otherUnit.id} has ${otherUnit.health} health remaining.`);
                    if (otherUnit.health <= 0) {
                        console.log(`Unit ${otherUnit.id} has died.`);
                        otherUnitsOwner.units = otherUnitsOwner.units.filter((unit) => unit.id !== otherUnit.id);
                    }
                } else {
                    // heal
                    otherUnit.health += unit.attack;
                    if (otherUnit.health > otherUnit.maxHealth) {
                        otherUnit.health = otherUnit.maxHealth;
                    }
                    console.log(`Unit ${unitID} healed unit ${otherUnit.id} for ${unit.attack} health. ${otherUnit.id} has ${otherUnit.health} health remaining.`);
                }

                //socket.emit('player-unit-actioned', unitID, tile);
                app.get("io").emit('gameState', gameState);
            });

            // after 1 second, send the gameState to the client
            setTimeout(() => {
                app.get("io").emit('gameState', gameState);
            }, 1);

            socket.on("disconnect", () => {
                // @ts-expect-error TODO figure out the type for session on request
                console.log(`client disconnected (${socket.request.session.id})`);
            })
        })

        io.engine.use(sessionMiddleware);
    }

    return io;
}

interface Player {
    id: string;
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
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    mobility: number;
}