/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ISC ServiceWorker - Push Notifications Scaffold
 *
 * Handles push notifications for new messages when app is closed.
 * Uses encrypted payload relay through minimal push server.
 */

declare const self: any;

const CACHE_NAME = 'isc-v1';

// Install event - cache assets
self.addEventListener('install', (event: any) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache: Cache) => {
      return cache.addAll(['/', '/index.html', '/manifest.webmanifest']);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event: any) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames: string[]) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request).then((response: Response | undefined) => {
      return response || fetch(event.request);
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event: any) => {
  console.log('[ServiceWorker] Push received');

  let data: any = {};

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    console.warn('[ServiceWorker] Failed to parse push data:', err);
  }

  const title = data.title || 'ISC - New Message';
  const options: any = {
    body: data.body || 'You have a new message',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: {
      url: data.url || '/#/chats',
      peerId: data.peerId,
      timestamp: data.timestamp || Date.now(),
    },
    actions: [
      { action: 'reply', title: 'Reply' },
      { action: 'open', title: 'Open' },
    ],
    tag: `isc-message-${data.peerId || 'default'}`,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click - open app
self.addEventListener('notificationclick', (event: any) => {
  console.log('[ServiceWorker] Notification click:', event.action);

  event.notification.close();

  const url = event.notification.data?.url || '/#/chats';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList: any[]) => {
      if (clientList.length > 0) {
        clientList[0].focus();
        clientList[0].postMessage({
          type: 'NOTIFICATION_CLICK',
          action: event.action,
          peerId: event.notification.data?.peerId,
        });
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});

// Message from client (main app)
self.addEventListener('message', (event: any) => {
  console.log('[ServiceWorker] Message from client:', event.data);

  const { type } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'SUBSCRIBE_TO_PUSH':
      event.ports?.[0]?.postMessage({
        type: 'PUSH_SUBSCRIPTION_READY',
        payload: { supported: 'PushManager' in self },
      });
      break;
  }
});

console.log('[ServiceWorker] Script loaded');
