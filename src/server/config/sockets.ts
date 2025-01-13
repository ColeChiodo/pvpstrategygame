import { Server } from "http";
import type { Express, RequestHandler } from "express";
import { Server as SocketIoServer } from "socket.io";

let io: SocketIoServer | undefined;

const MAX_TIME = 60 * 10; // 10 minutes

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
            round: 0,
            player1Time: MAX_TIME,
            player2Time: MAX_TIME,
        };

        setInterval(() => {
            if (gameState.players.length === 2) {
                if (gameState.round % 2 === 0) {
                    gameState.player1Time -= 1;

                    if (gameState.player1Time < 0) {
                        console.log(`${gameState.players[0].name} ran out of time`);
                    }
                } else {
                    gameState.player2Time -= 1;

                    if (gameState.player2Time < 0) {
                        console.log(`${gameState.players[1].name} ran out of time`);
                    }
                }
            }
        }, 1000);

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

            if (gameState.players.length < 2) {
                // if socket.request.session.id is in gameState.players, then don't add it again
                // @ts-expect-error
                if (!gameState.players.find((player) => player.id === socket.request.session.id)) {
                    // @ts-expect-error
                    console.log(`Adding ${socket.request.session.user.username} to game`);
                    let newPlayer : Player = {
                        // @ts-expect-error TODO figure out the type for session on request
                        id: socket.request.session.id,
                        // @ts-expect-error TODO figure out the type for session on request
                        name: socket.request.session.user.username,
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
                    socket.emit('gameState', gameState);
                } else {
                    // @ts-expect-error TODO figure out the type for session on request
                    console.log(`Player ${socket.request.session.user.username} reconnected`);
                }
            }
            
            if (gameState.players.length === 2) {
                // @ts-expect-error
                if (!gameState.players.find((player) => player.id === socket.request.session.id)) {
                    socket.disconnect();
                }
            }

            socket.on('player-unit-move', (unitID: number, tile: { x: number, y: number, row: number, col: number }) => {
                // @ts-expect-error
                console.log(`${socket.request.session.user.username}: unit ${unitID} moved to tile (${tile.row}, ${tile.col})`);
                // @ts-expect-error
                let player = gameState.players.find((player) => player.name === socket.request.session.user.username);
                if (!player) return;
                let unit = player.units.find((unit) => unit.id === unitID);
                if (!unit) return;
                if (!unit.canMove) return;
                unit.canMove = false;

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
                // @ts-expect-error
                console.log(`${socket.request.session.user.username}: unit ${unitID} performing action on (${tile.row}, ${tile.col})`);
                // @ts-expect-error
                let player = gameState.players.find((player) => player.name === socket.request.session.user.username);
                if (!player) return;
                let unit = player.units.find((unit) => unit.id === unitID);
                if (!unit) return;
                if (!unit.canAct) return;
                unit.canAct = false;

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

                // @ts-expect-error
                if (socket.request.session.id !== otherUnitsOwner.id) {
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

                app.get("io").emit('gameState', gameState);
            });

            setInterval(() => {
                if (gameState.players.length === 2 && gameState.round === 0) {
                    console.log("Game started");
                    nextRound();
                }

                app.get("io").emit('gameState', gameState);
            }, 1000);

            socket.on("force-end-turn", () => {
                // if socket.request.session.id is player with current turn, then end turn
                // @ts-expect-error
                let player = gameState.players.find((player) => player.id === socket.request.session.id);
                if (gameState.players[gameState.round % 2] !== player) {
                    return;
                }
                nextRound();
            });

            function nextRound() {
                let oldPlayer = gameState.players[gameState.round % 2];
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
            }

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
    canMove: boolean;
    canAct: boolean;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    mobility: number;
}