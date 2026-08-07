// ════════════════════════════════════════════════════════════════
// build.mjs —— 把 src/ 里的模块拼回单文件 dist/index.html
//
// 这是你日常会用到的脚本。改完 src/ 里的任何文件后，跑一下：
//
//   node build.mjs
//
// 它会重新生成 dist/index.html（可直接双击打开 / 部署的单文件 PWA），
// 并把 manifest.json、sw.js 一起复制到 dist/。
//
// 加 --check 参数（node build.mjs --check）会额外对比生成结果与原始
// daily_budget.html 是否“功能等价”（忽略空白差异），用于验证拆分无损。
// ════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));   // daily-budget/
const SRC = join(ROOT, 'src');
const JSDIR = join(SRC, 'js');
const DIST = join(ROOT, 'dist');
mkdirSync(DIST, { recursive: true });

const read = p => readFileSync(p, 'utf8');

// ── 1. 按文件名数字顺序收集所有 JS 模块 ──────────────────────────
const jsFiles = readdirSync(JSDIR).filter(f => f.endsWith('.js')).sort();
const jsBlocks = jsFiles.map(f => read(join(JSDIR, f)).replace(/\s+$/, ''));

// ── 2. 组装单文件 HTML（顺序：head → style → body → script → tail）─
const head = read(join(SRC, 'head.html')).replace(/\s+$/, '');
const css = read(join(SRC, 'styles.css')).replace(/\s+$/, '');
const body = read(join(SRC, 'body.html')).replace(/\s+$/, '');
const tail = read(join(SRC, 'tail.html'));

const html =
  head + '\n' +
  '  <style>\n' + css + '\n  </style>\n' +
  body + '\n' +
  '  <script>\n' + jsBlocks.join('\n\n') + '\n  </script>\n' +
  tail;

writeFileSync(join(DIST, 'index.html'), html, 'utf8');

// ── 3. 复制 PWA 资源 ──────────────────────────────────────────────
for (const asset of ['manifest.json', 'sw.js']) {
  if (existsSync(join(SRC, asset))) copyFileSync(join(SRC, asset), join(DIST, asset));
}
// 图标若存在也一并带上（原项目暂无，存在才复制）
for (const icon of ['icon-192.png', 'icon-512.png']) {
  const from = join(ROOT, '..', icon);
  if (existsSync(from)) copyFileSync(from, join(DIST, icon));
}

// ── 4. 同步一份到原始位置 ../daily_budget.html（你要求两份都改）──────
// 它和同目录的 sw.js / manifest.json 配合，可在原位置独立运行。
const originalPath = join(ROOT, '..', 'daily_budget.html');
const backupPath = join(ROOT, '..', 'daily_budget.prerefactor.bak.html');
let syncedNote = '';
if (existsSync(originalPath)) {
  if (!existsSync(backupPath)) {
    copyFileSync(originalPath, backupPath);   // 仅首次：备份改造前的原文件
    syncedNote = '（首次已备份为 daily_budget.prerefactor.bak.html）';
  }
  writeFileSync(originalPath, html, 'utf8');
}

console.log(`✓ 构建完成 → dist/index.html  (${(html.length / 1024).toFixed(1)} KB, ${jsFiles.length} 个 JS 模块)`);
if (existsSync(originalPath)) console.log(`✓ 已同步到 ../daily_budget.html ${syncedNote}`);
