import { io, Socket } from "socket.io-client";

declare global {
  interface Window {
    socket: Socket;
    gameID: number;
  }
}

window.socket = io();