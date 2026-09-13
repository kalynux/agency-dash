// Firebase Cloud Messaging service worker — receives push while the dashboard
// tab is in the background or closed.
//
// Service workers cannot read Vite env vars, so the Firebase config is
// hardcoded here. KEEP IN SYNC with the VITE_FIREBASE_* values in BOTH
// env/.env.development AND env/.env.production — they hold the same values,
// because `bingoo-22222` is the messaging project for both environments.
//
// Nothing checks the three copies against each other, and drift is silent in the
// worst way: registration succeeds against one project and delivery is attempted
// against another, so push simply never arrives and no error is raised anywhere.
//
// Only compat builds work inside a service worker (importScripts).

importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBEm8btwePIHHYpSs41zebr6KmHIuWinA0',
  authDomain: 'bingoo-22222.firebaseapp.com',
  projectId: 'bingoo-22222',
  messagingSenderId: '741831724264',
  appId: '1:741831724264:web:6741494f37bd0bd0d34d5d',
});

const messaging = firebase.messaging();

// Messages WITH a `notification` key are displayed by the FCM SDK
// automatically; this handler renders data-only messages.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const data = payload.data || {};
  self.registration.showNotification(data.title || 'Wi-Agency', {
    body: data.body || '',
    icon: '/favicon-256.png', // without this the OS falls back to the browser's own mark
    tag: data.notificationId || undefined, // collapse duplicate deliveries
    data: { url: data.url || '/' },
  });
});

// Focus an existing dashboard tab, or open one, when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
