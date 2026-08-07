    // ══ PWA Service Worker 注册 ══
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
          // SW 注册失败（本地文件协议下正常，GitHub Pages 上会成功）
        });
      });
    }
