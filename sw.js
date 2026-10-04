// Service Worker:オフラインでも開けるよう、アプリのファイルを端末に保存しておく
// js/version.js の APP_VERSION が変わると、新しいキャッシュが作られて更新される。

importScripts('./js/version.js');

// Cache Storage は creative-hues.github.io の他アプリと共有なので、名前に必ずアプリ名を付ける
const CACHE_PREFIX = 'yururi-diary-';
const CACHE = `${CACHE_PREFIX}${self.APP_VERSION}`;

// ファイルを増やしたら、ここにも追加すること
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/feedback.css',
  './js/version.js',
  './js/app.js',
  './js/no-zoom.js',
  './js/drafts.js',
  './js/config.js',
  './js/util.js',
  './js/db.js',
  './js/seed.js',
  './js/prefs.js',
  './js/backup.js',
  './js/pwa.js',
  './js/ui.js',
  './js/router.js',
  './js/routes.js',
  './js/screens/home.js',
  './js/screens/settings.js',
  './js/screens/backup.js',
  './js/constants.js',
  './js/components.js',
  './js/choices.js',
  './js/doses.js',
  './js/drag-sort.js',
  './js/record-dialog.js',
  './js/support.js',
  './js/screens/mood.js',
  './js/screens/condition.js',
  './js/screens/meal.js',
  './js/screens/medicine.js',
  './js/screens/vital.js',
  './js/screens/list-editor.js',
  './js/screens/edit-choices.js',
  './js/screens/diary.js',
  './js/screens/signal.js',
  './js/screens/consult.js',
  './js/screens/worksheet.js',
  './js/charts.js',
  './js/periods.js',
  './js/month-calendar.js',
  './js/screens/calendar.js',
  './js/screens/day.js',
  './js/screens/report.js',
  './js/lock.js',
  './js/lock-screen.js',
  './js/passcode-pad.js',
  './js/screens/lock.js',
  './js/forgot-guide.js',
  './js/feedback/client.js',
  './js/feedback/form.js',
  './js/feedback/sent.js',
  './js/feedback-setup.js',
  './js/screens/feedback.js',
  './js/screens/help.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
    )),
  );
});

// 画面の「更新する」ボタンから呼ばれる
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req)));
});
