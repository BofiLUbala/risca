/* Service worker des notifications push RISAC (Firebase Cloud Messaging).
 *
 * Recoit les messages quand aucun onglet n'est ouvert. Un service worker ne lit
 * pas les variables d'environnement : la configuration est passee par la page
 * via postMessage, puis conservee pour les demarrages suivants.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

let started = false;

function start(config) {
  if (started || !config || !config.apiKey) return;
  started = true;
  firebase.initializeApp(config);

  firebase.messaging().onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(n.title || 'RISAC', {
      body: n.body || '',
      icon: '/brand/risac-emblem.png',
      badge: '/brand/risac-emblem.png',
      tag: data.kind || 'risac',
      data: { link: data.link || '/' },
    });
  });
}

// La page envoie la configuration des qu'elle enregistre le service worker.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RISAC_FIREBASE_CONFIG') {
    start(event.data.config);
  }
});

// Clic sur la notification : on reutilise un onglet deja ouvert si possible.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return clients.openWindow(link);
    }),
  );
});
