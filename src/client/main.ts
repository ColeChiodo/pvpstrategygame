import { io, Socket } from "socket.io-client";

declare global {
  interface Window {
    socket: Socket;
    gameID: number;
    gainNode: GainNode;
  }
}

window.socket = io();