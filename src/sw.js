// Service Worker — 记账本离线缓存（重定向安全版）
// 修复：原版直接 `return fetch(req)`，当 Cloudflare 返回 3xx 重定向时，
// SW 把重定向响应透传给导航请求，Chrome 报
// "response served by service worker has redirected" 并拒绝加载页面。
// 本版遇到重定向会自己 follow 到最终地址再返回，绝不把 3xx 透传给浏览器。
const CACHE_NAME = 'budget-app-v3'; // 升版本号，强制浏览器弃用旧 SW

const FILES_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(FILES_TO_CACHE.map(url => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 只缓存同源的 200 响应，避免缓存跨域/重定向内容
function cachePut(req, res) {
  if (!res || res.status !== 200) return;
  try {
    if (new URL(req.url).origin !== self.location.origin) return;
  } catch (e) { return; }
  caches.open(CACHE_NAME).then(cache => cache.put(req, res).catch(() => {}));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      let res = await fetch(req);
      // 关键修复：SW 不能把重定向响应透传给导航请求，否则 Chrome 报错。
      // 遇到重定向就自己 follow 到最终地址，再返回最终响应。
      if (res.redirected) {
        res = await fetch(res.url, { redirect: 'follow' });
      }
      cachePut(req, res.clone());
      return res;
    } catch (e) {
      // 离线兜底：先找缓存的资源，导航请求回落到缓存的 index.html
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
