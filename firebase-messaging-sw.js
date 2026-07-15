// firebase-messaging-sw.js
// Ye file aayush-manager.html ke SAATH WALE FOLDER (root) me honi chahiye.
// Iska kaam: jab app/tab band ho tab bhi background me push notification dikhana.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Bro yahan WAHI firebaseConfig daalo jo aayush-manager.html me diya hai (same values).
firebase.initializeApp({
  apiKey: "AIzaSyAPIrnP8lxdzQyoyWrY3WZk8_RZnLYAaX0",
  authDomain: "dukan-516b9.firebaseapp.com",
  projectId: "dukan-516b9",
  storageBucket: "dukan-516b9.firebasestorage.app",
  messagingSenderId: "591645438475",
  appId: "1:591645438475:web:b17e8039501d91a4060d0e"
});

const messaging = firebase.messaging();

// Jab app band ho / background me ho, ye function chalta hai
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "AAYUSH MANAGER";
  const body = payload.notification?.body || "Stock check karo";
  self.registration.showNotification(title, {
    body,
    icon: "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js", // chaho toh apna shop logo URL daal do
    badge: "",
    tag: "low-stock-alert",
    vibrate: [200, 100, 200]
  });
});

// Notification pe tap karne par app khol de
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
