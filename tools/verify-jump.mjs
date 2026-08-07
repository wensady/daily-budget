import { chromium } from 'playwright-core';
const EXE='C://Users//韦佳//AppData//Local//ms-playwright//chromium-1234//chrome-win64//chrome.exe';
const URL='file:///D:/miniprogram/daily-budget/dist/index.html';
const browser=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForTimeout(400);
// 构造一个“上个月”的日期
const dk = await page.evaluate(()=>{
  const d=new Date(); d.setDate(15); d.setMonth(d.getMonth()-1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
});
await page.evaluate((dk)=>{
  const rec={};
  rec[dk]=[{ts:Date.now(),type:'expense',amount:120,spendKey:'dinner',bigCat:'餐饮',desc:'上月晚餐',place:'餐厅',note:''}];
  localStorage.setItem('budget_records_v2',JSON.stringify(rec));
  if(typeof loadDateEntries==='function') loadDateEntries();
  if(typeof renderStats==='function') renderStats();
},dk);
await page.waitForTimeout(150);
console.log('=== TEST D: 从统计页 jumpToEdit 上月条目，改金额 120 -> 555 ===');
await page.evaluate((dk)=>{ jumpToEdit(dk,0); },dk);
await page.waitForTimeout(150);
const editingLoaded = await page.evaluate(()=>({
  amt: document.getElementById('amount-input').value,
  dateVal: document.getElementById('record-date').value
}));
await page.evaluate(()=>{ document.getElementById('amount-input').value='555'; });
await page.evaluate(()=>{ document.getElementById('add-btn').click(); });
await page.waitForTimeout(200);
const result = await page.evaluate((dk)=>{
  const a=JSON.parse(localStorage.getItem('budget_records_v2'));
  const arr=a[dk]||[];
  return { savedAmt: arr[0]?arr[0].amount:'(条目消失)', count: arr.length };
},dk);
const stats = await page.evaluate(()=>{ switchPage('stats'); return document.getElementById('q-month').textContent; });
console.log('编辑前表单金额:',editingLoaded.amt,'| 日期选择器:',editingLoaded.dateVal);
console.log('保存后该月金额:',result.savedAmt,'| 条目数:',result.count,'| 统计本月合计:',stats);
console.log('错误:', errors.length?errors.join('\n'):'(无)');
await browser.close();
