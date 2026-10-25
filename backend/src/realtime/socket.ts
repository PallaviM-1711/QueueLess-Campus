import type { Server } from 'socket.io';

let socketServer: Server | undefined;

export function setSocketServer(server: Server): void {
  socketServer = server;
}

export function getSocketServer(): Server {
  if (!socketServer) throw new Error('Socket.IO server has not been initialized');
  return socketServer;
}
