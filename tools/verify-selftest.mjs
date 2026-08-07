import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\韦佳\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const URL = 'file:///D:/miniprogram/daily-budget/dist/index.html#selftest';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

await page.goto(URL, { waitUntil: 'load' });
// 自检在 load 后 500ms 触发，等面板出现（用文本定位，避免属性选择器兼容问题）
await page.waitForFunction(
  () => [...document.querySelectorAll('div')].some(d => d.textContent.includes('记账 App 自检报告')),
  { timeout: 8000 }
);
await page.waitForTimeout(300);

const report = await page.evaluate(() => {
  const panel = [...document.querySelectorAll('div')].find(d => d.textContent.includes('记账 App 自检报告'));
  if (!panel) return { found: false };
  const lines = [...panel.querySelectorAll('div')]
    .map(d => d.textContent.trim())
    .filter(t => /PASS|FAIL/.test(t));
  const allPass = !panel.textContent.includes('✗ FAIL') && panel.textContent.includes('✓ PASS');
  return { found: true, allPass, lines };
});

console.log('=== 真机自检面板（无头模拟 #selftest）===');
console.log('面板出现:', report.found);
console.log('全部通过:', report.allPass);
(report.lines || []).forEach(l => console.log('  ' + l));
console.log('运行时错误:', errors.length ? errors.join('\n') : '(无)');

// 验证真实数据未被破坏（还原后不应残留“自检-测试餐”）
const residue = await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('budget_records_v2') || '{}');
  let found = false;
  Object.values(a).forEach(arr => (arr || []).forEach(e => { if (e.desc && e.desc.includes('自检')) found = true; }));
  return found;
});
console.log('真实数据残留测试条目:', residue ? '有（异常!）' : '无（已正确还原）');

await browser.close();
process.exit(report.found && report.allPass && !residue && errors.length === 0 ? 0 : 1);
