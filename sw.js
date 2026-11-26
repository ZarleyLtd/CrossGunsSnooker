var CACHE = 'crossguns-shell-v3';
var SHELL = [
  './',
  './index.html',
  './fixtures.html',
  './results.html',
  './leagues.html',
  './handicaps.html',
  './top-breaks.html',
  './rules.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/css/brief-message.css',
  './assets/css/contextual-help.css',
  './assets/css/home-carousel.css',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/js/scripts.min.js',
  './assets/js/config/app-config.js',
  './assets/js/utils/api-client.js',
  './assets/js/utils/current-competition.js',
  './assets/js/utils/nav-competition.js',
  './assets/js/utils/admin-mode.js',
  './assets/js/utils/player-session.js',
  './assets/js/utils/formatters.js',
  './assets/js/utils/image-loader.js',
  './assets/js/utils/nav-active.js',
  './assets/css/jp-logo.css',
  './assets/icons/jpLogo-white-rotated-2000.png',
  './assets/icons/jpLogo-animated.svg',
  './assets/js/components/jp-logo.js',
  './assets/js/utils/knockout-rounds.js',
  './assets/js/utils/knockout-bracket.js',
  './assets/js/utils/brief-message.js',
  './assets/js/utils/league-group-filter.js',
  './assets/js/utils/image-compress.js',
  './assets/js/utils/help-catalog.js',
  './assets/js/components/contextual-help.js',
  './assets/js/components/result-slip-upload.js',
  './assets/js/components/league-standings.js',
  './assets/js/pages/index.js',
  './assets/js/pages/fixtures.js',
  './assets/js/pages/results.js',
  './assets/js/pages/leagues.js',
  './assets/js/pages/handicaps.js',
  './assets/js/pages/top-breaks.js',
  './assets/js/main.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL);
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
      return caches.delete(key);
    }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(function (response) {
    var copy = response.clone();
    caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
    return response;
  }).catch(function () {
    return caches.match(event.request);
  }));
});
