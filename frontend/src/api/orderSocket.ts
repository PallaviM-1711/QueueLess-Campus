import { io, type Socket } from 'socket.io-client';

export function connectOrderSocket(): Socket | null {
  const token = localStorage.getItem('qlc_token');
  if (!token) return null;
  return io(import.meta.env.VITE_API_URL || window.location.origin, {
    path: '/socket.io',
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
  });
}
