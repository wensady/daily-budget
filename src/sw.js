// Service Worker — 记账本离线缓存
// 每次更新 HTML 时，改一下版本号即可让 SW 自动更新缓存
const CACHE_NAME = 'budget-app-v2';

// 需要预缓存的文件（相对于 SW 所在目录）
const FILES_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png'
];

// 安装阶段：缓存核心文件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll 中任一失败都不影响整体（icon 可能不存在时跳过）
      return Promise.allSettled(
        FILES_TO_CACHE.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  // 立即激活，不等待旧版本关闭
  self.skipWaiting();
});

// 激活阶段：清理旧版本缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 拦截请求：缓存优先，失败时回落到缓存（Network First for HTML，Cache First for assets）
self.addEventListener('fetch', event => {
  const req = event.request;
  // 只处理 GET 请求
  if (req.method !== 'GET') return;

  event.respondWith(
    // 先尝试网络（保证拿到最新数据）
    fetch(req)
      .then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() => {
        // 网络不可用，返回缓存
        return caches.match(req).then(cached => {
          if (cached) return cached;
          // 回落到主页面（离线时所有路径都返回 HTML）
          return caches.match('./index.html');
        });
      })
  );
});
