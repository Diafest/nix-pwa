// v2.5: номер версии теперь общий с Android (versionName) — синхронизируем
// оба при каждом релизе, а не ведём отдельный счётчик кэша.
// Правки этой сессии: пустая полоса в календарях месяца/привычки/heatmap на
// iOS Safari устранена (grid-auto-rows). MONTHLY-повтор и навигация по
// месяцам больше не перепрыгивают через месяц на датах 29-31. Разбор дат из
// текста задачи больше не вырезает случайные короткие числа по всей строке.
// Словари меток (#категория, !приоритет, ~энергия) синхронизированы с Android.
// Фокус-таймер считает оставшееся время от абсолютного момента окончания,
// а не тиками — переживает сворачивание вкладки без рассинхронизации.
// Версию ОБЯЗАТЕЛЬНО поднимать при каждом релизе — иначе установленная
// PWA продолжит отдавать старые app.js и styles.css из кэша.
const CACHE = 'nix-v2_5';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('./index.html');
      })
  );
});
