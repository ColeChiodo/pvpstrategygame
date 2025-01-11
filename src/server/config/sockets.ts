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
                image: 'sample.png',
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

            app.get("io").emit('gameState', gameState);

            if (gameState.players.length < 2) {
                let newPlayer : Player = {
                    id: socket.id,
                    name: "Player " + gameState.players.length + 1,
                    units: [],
                };
                newPlayer.units.push({
                    row: 7,
                    col: 7,
                    name: "test",
                    health: 3,
                    maxHealth: 3,
                    attack: 1,
                    defense: 1,
                    range: 1,
                    mobility: 3,
                });
                gameState.players.push(newPlayer);
            }
        
            socket.on('player-action', (action: string) => {
                console.log(`Received action from player ${socket.id}:`, action);
                app.get("io").emit('gameState', gameState);
            });

            socket.on("disconnect", () => {
                // @ts-expect-error TODO figure out the type for session on request
                console.log(`client disconnected (${socket.request.session.id})`);
                gameState.players = gameState.players.filter((player) => player.id !== socket.id);
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
    image: string;
    tiles: number[][];
}

interface Unit {
    row: number;
    col: number;

    name: string;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    mobility: number;
}