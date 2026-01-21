import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function initSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });
  }

  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
};
