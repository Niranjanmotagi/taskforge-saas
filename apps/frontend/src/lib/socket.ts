import { io, type Socket } from 'socket.io-client';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';

let socket: Socket | null = null;

/** Empty socketUrl means "same origin as the page" (production single-domain). */
function resolveSocketUrl(): string {
  if (clientEnv.socketUrl) return clientEnv.socketUrl;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Singleton socket, (re)connected with the current access token. */
export function getSocket(): Socket {
  const token = useAuthStore.getState().accessToken;
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      transports: ['websocket'],
      auth: { token },
      autoConnect: Boolean(token),
    });
  } else if (token && (socket.auth as { token?: string }).token !== token) {
    socket.auth = { token };
    if (socket.connected) socket.disconnect();
    socket.connect();
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
