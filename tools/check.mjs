// 校验 dist/index.html 里内联 JS 的语法，并检查关键元素是否齐全
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(ROOT, 'dist', 'index.html');
const html = readFileSync(dist, 'utf8');

// 1. 语法检查
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
const tmp = join(ROOT, 'dist', '_check.js');
writeFileSync(tmp, js);
try {
  execFileSync(process.execPath, ['--check', tmp]);
  console.log('✓ 内联 JS 语法通过');
} catch (e) {
  console.log('✗ JS 语法错误：\n' + (e.stderr ? e.stderr.toString() : e.message));
  process.exitCode = 1;
} finally {
  unlinkSync(tmp);
}

// 2. 关键元素存在性
const must = [
  'id="extra-fields"', 'id="extra-toggle"',
  'id="income-list-card"', 'id="income-add-btn"', 'id="menu-aa-btn"',
  'function renderIncomeList', 'function editIncome', 'function toggleExtra',
  'function openEntryMenu', 'function addIncome',
];
let miss = 0;
for (const p of must) {
  if (html.includes(p)) console.log('  ✓ ' + p);
  else { console.log('  ✗ 缺失 ' + p); miss++; }
}
console.log(miss === 0 ? '✓ 关键元素齐全' : `✗ 缺 ${miss} 项`);
if (miss) process.exitCode = 1;
