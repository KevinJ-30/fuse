import { Server } from 'socket.io';

let io: Server;

export function setIO(socketIO: Server): void {
  io = socketIO;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
