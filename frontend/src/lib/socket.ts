'use client';

import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  // On rend l’instance existante même pendant la connexion : sinon un second
  // appel pendant ce court instant ouvrirait un socket supplémentaire.
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
  socket = io(`${url}/ws`, {
    // Fonction, donc relue a chaque (re)connexion : le jeton d'acces expire apres 30 minutes
    // et une valeur figee a la creation serait refusee par le serveur au premier retour reseau.
    auth: (cb) => cb({ token: getToken() }),
    // Ordre par défaut de socket.io : la poignée de main passe en polling puis
    // monte en websocket. Forcer websocket en premier échoue une fois et laisse
    // une erreur dans la console de chaque page.
    transports: ['polling', 'websocket'],
    autoConnect: true,
  });
  // Quand le serveur refuse le jeton il coupe lui-meme la connexion, et socket.io ne retente
  // alors pas tout seul : on relance avec le jeton courant tant que la session est ouverte.
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' && getToken()) {
      setTimeout(() => socket?.connect(), 3000);
    }
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
