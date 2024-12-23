import { Server } from "http";
import type { Express, RequestHandler } from "express";
import { Server as SocketIoServer } from "socket.io";

let io: SocketIoServer | undefined;

export default function (server: Server, app: Express, sessionMiddleware: RequestHandler): SocketIoServer {
    if(io === undefined) {
        io = new SocketIoServer(server);

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

            socket.on("disconnect", () => {
                // @ts-expect-error TODO figure out the type for session on request
                console.log(`client disconnected (${socket.request.session.id})`);
            })
        })

        io.engine.use(sessionMiddleware);
    }

    return io;
}