import { chromium } from 'playwright-core';

const EXE = 'C:\\Users\\韦佳\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const URL = 'file:///D:/miniprogram/daily-budget/dist/index.html';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// 今天日期 key
const today = await page.evaluate(() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
});

// 种入一条测试数据：一条支出 50 元（无 split）
await page.evaluate((dk) => {
  const rec = {};
  rec[dk] = [{
    ts: Date.now(), type: 'expense', amount: 50, spendKey: 'lunch',
    bigCat: '餐饮', desc: '测试午餐', place: '食堂', note: ''
  }];
  localStorage.setItem('budget_records_v2', JSON.stringify(rec));
  if (typeof loadDateEntries === 'function') loadDateEntries();
  if (typeof renderStats === 'function') renderStats();
}, today);
await page.waitForTimeout(200);

console.log('=== TEST A: 编辑金额 50 -> 999，确认后统计是否变化 ===');
const before = await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('budget_records_v2'));
  return a[Object.keys(a)[0]][0].amount;
});

// 进入编辑（模拟从统计/日历 jumpToEdit）
await page.evaluate(() => { editEntry(0); });
await page.waitForTimeout(100);
// 改金额
await page.evaluate(() => { document.getElementById('amount-input').value = '999'; });
// 点确定
await page.evaluate(() => { document.getElementById('add-btn').click(); });
await page.waitForTimeout(200);

const afterEdit = await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('budget_records_v2'));
  const arr = a[Object.keys(a)[0]];
  return arr[0].amount;
});
// 切到统计页，读取本月合计
const statsMonth = await page.evaluate(() => {
  switchPage('stats');
  return document.getElementById('q-month').textContent;
});
console.log('编辑前金额:', before, '| 编辑后金额:', afterEdit, '| 统计本月合计:', statsMonth);

console.log('\n=== TEST B: AA 代付（别人欠我 30）是否写入并统计显示 ===');
// 回到记账，打开代付弹窗
await page.evaluate(() => { switchPage('record'); openAaSheet(0); });
await page.waitForTimeout(100);
await page.evaluate(() => { document.getElementById('aa-owed-input').value = '30'; });
await page.evaluate(() => { document.getElementById('aa-sheet-mask').classList.add('show'); saveAaSheet(); });
await page.waitForTimeout(200);

const splitSaved = await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('budget_records_v2'));
  const e = a[Object.keys(a)[0]][0];
  return e.split ? e.split.owedToMe : null;
});
const owedCardVisible = await page.evaluate(() => {
  switchPage('stats');
  const card = document.getElementById('owed-card');
  return card ? (card.style.display !== 'none') : 'no-card';
});
const owedSum = await page.evaluate(() => {
  const el = document.getElementById('owed-sum');
  return el ? el.textContent : 'no-el';
});
console.log('split 保存值:', splitSaved, '| 统计"别人欠我"卡片显示:', owedCardVisible, '| 欠款合计:', owedSum);

console.log('\n=== TEST C: 再编辑该条目，split 是否保留 ===');
await page.evaluate(() => { switchPage('record'); editEntry(0); });
await page.evaluate(() => { document.getElementById('amount-input').value = '888'; });
await page.evaluate(() => { document.getElementById('add-btn').click(); });
await page.waitForTimeout(150);
const splitAfterEdit = await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('budget_records_v2'));
  const e = a[Object.keys(a)[0]][0];
  return e.split ? e.split.owedToMe : 'LOST';
});
console.log('再次编辑后 split 值:', splitAfterEdit);

console.log('\n=== 运行时错误 ===');
console.log(errors.length ? errors.join('\n') : '(无)');

await browser.close();
