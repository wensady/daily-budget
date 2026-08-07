// 本地静态服务器 —— 让同一 WiFi 下的手机能打开 dist/ 测试
//   用法：node tools/serve.mjs
// 然后用手机浏览器访问终端打印的「手机访问」地址。
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const DIST = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');
const PORT = 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = join(DIST, p);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, '0.0.0.0', () => {
  const ips = [];
  Object.values(networkInterfaces()).forEach(list =>
    (list || []).forEach(i => { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); }));
  console.log('记账本本地服务器已启动：');
  console.log('  本机访问：  http://localhost:' + PORT);
  ips.forEach(ip => console.log('  手机访问：  http://' + ip + ':' + PORT + '   （手机和电脑连同一 WiFi）'));
  console.log('停止：按 Ctrl + C');
});
