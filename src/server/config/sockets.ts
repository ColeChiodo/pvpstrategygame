import { Server } from "http";
import type { Express, RequestHandler } from "express";
import { Server as SocketIoServer } from "socket.io";

let io: SocketIoServer | undefined;

export default function (server: Server, app: Express, sessionMiddleware: RequestHandler): SocketIoServer {
    if(io === undefined) {
        io = new SocketIoServer(server);

        let gameState = {
            players: [] as string[],
            box: {
                x: 0,
                y: 0,
                color: 'red',
                height: 50,
                width: 50,
            },
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
                gameState.players.push(socket.id);
            }
        
            socket.on('player-action', (action: string) => {
                console.log(`Received action from player ${socket.id}:`, action);

                if (action === 'ArrowRight') {
                    gameState.box.x += 10;
                } else if (action === 'ArrowLeft') {
                    gameState.box.x -= 10;
                } else if (action === 'ArrowUp') {
                    gameState.box.y -= 10;
                } else if (action === 'ArrowDown') {
                    gameState.box.y += 10;
                }
                app.get("io").emit('gameState', gameState);
            });

            socket.on("disconnect", () => {
                // @ts-expect-error TODO figure out the type for session on request
                console.log(`client disconnected (${socket.request.session.id})`);
            })
        })

        io.engine.use(sessionMiddleware);
    }

    return io;
}