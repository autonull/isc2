/**
 * ISC ServiceWorker - Push Notifications Scaffold
 *
 * Handles push notifications for new messages when app is closed.
 * Uses encrypted payload relay through minimal push server.
 */

const CACHE_NAME = 'isc-v1';
const PUSH_TOPIC = 'isc:push';

// Install event - cache assets
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.webmanifest',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event: PushEvent) => {
  console.log('[ServiceWorker] Push received');

  let data: any = {};
  
  try {
    if (event.data) {
      // Payload is encrypted - in production, decrypt here
      data = event.data.json();
    }
  } catch (err) {
    console.warn('[ServiceWorker] Failed to parse push data:', err);
  }

  const title = data.title || 'ISC - New Message';
  const options: NotificationOptions = {
    body: data.body || 'You have a new message',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/#/chats',
      peerId: data.peerId,
      timestamp: data.timestamp || Date.now(),
    },
    actions: [
      {
        action: 'reply',
        title: 'Reply',
      },
      {
        action: 'open',
        title: 'Open',
      },
    ],
    tag: `isc-message-${data.peerId || 'default'}`,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click - open app
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[ServiceWorker] Notification click:', event.action);

  event.notification.close();

  if (event.action === 'reply') {
    // Handle reply action - open chat with focus on input
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const url = event.notification.data?.url || '/#/chats';
        
        if (clients.length > 0) {
          // Focus existing window
          clients[0].focus();
          clients[0].postMessage({
            type: 'NOTIFICATION_CLICK',
            action: 'reply',
            peerId: event.notification.data?.peerId,
          });
        } else {
          // Open new window
          self.clients.openWindow(url);
        }
      })
    );
  } else {
    // Default action - open app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const url = event.notification.data?.url || '/';
        
        if (clients.length > 0) {
          clients[0].focus();
          clients[0].postMessage({
            type: 'NOTIFICATION_CLICK',
            action: 'open',
            peerId: event.notification.data?.peerId,
          });
        } else {
          self.clients.openWindow(url);
        }
      })
    );
  }
});

// Message from client (main app)
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  console.log('[ServiceWorker] Message from client:', event.data);

  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'REQUEST_NOTIFICATION_PERMISSION':
      // Trigger permission request from client
      break;

    case 'SUBSCRIBE_TO_PUSH':
      // Client wants to subscribe to push notifications
      // In production, this would register with a push server
      event.ports?.[0]?.postMessage({
        type: 'PUSH_SUBSCRIPTION_READY',
        payload: { supported: 'PushManager' in self },
      });
      break;

    case 'UNSUBSCRIBE_FROM_PUSH':
      // Client wants to unsubscribe
      break;
  }
});

console.log('[ServiceWorker] Script loaded');
