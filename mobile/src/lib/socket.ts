import { io, Socket } from 'socket.io-client';
import { API_ORIGIN, getToken } from './api';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  // On rend toujours l'instance existante, connectee ou non : socket.io la reconnecte seul.
  // Tester `connected` ouvrait un second socket pendant chaque reconnexion et doublait les
  // ecouteurs de message:new.
  if (socket) return socket;
  socket = io(`${API_ORIGIN}/ws`, {
    // Relu a chaque (re)connexion : le jeton d'acces expire apres 30 minutes.
    auth: (cb) => {
      void getToken().then((token) => cb({ token }));
    },
    transports: ['websocket'],
    autoConnect: true,
  });
  // Le serveur coupe la connexion quand il refuse le jeton, et socket.io ne retente pas seul.
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') setTimeout(() => socket?.connect(), 3000);
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
