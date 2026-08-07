// 验证“代付（简化版）”核心逻辑：标记欠款、收回自动记收入、账对平
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}: 得到 ${JSON.stringify(got)}, 期望 ${JSON.stringify(want)}`); }
}

// 标记“别人欠我”：金额必须 0 < owed <= total
function readOwed(total, input) {
  const owed = parseFloat(input);
  if (isNaN(owed) || owed <= 0 || owed > total) return null;
  return +owed.toFixed(2);
}
eq('正常标记', readOwed(300, '200'), 200);
eq('欠款=全额(全替别人付)', readOwed(300, '300'), 300);
eq('欠款超过总额无效', readOwed(300, '400'), null);
eq('0无效', readOwed(300, '0'), null);
eq('空无效', readOwed(300, ''), null);

// 模拟账本：聚餐当天付 300（支出），标记别人欠我 200
const book = {
  '2026-06-18': [{ ts: 1, type: 'expense', amount: 300, desc: '聚餐', split: { owedToMe: 200, settled: false } }],
};
// 收回：在“今天”记一笔收入 200，原条目标记 settled
function settle(all, dk, ts, todayKey) {
  const e = all[dk].find(x => x.ts === ts);
  const amt = e.split.owedToMe;
  e.split.settled = true;
  (all[todayKey] = all[todayKey] || []).push({ ts: 99, type: 'income', amount: amt, srcKey: 'transfer', desc: '代付收回' });
  return amt;
}
const recovered = settle(book, '2026-06-18', 1, '2026-06-20');
eq('收回金额', recovered, 200);
eq('原支出未被改动', book['2026-06-18'][0].amount, 300);
eq('原条目已标记收回', book['2026-06-18'][0].split.settled, true);
eq('今天生成了一笔收入', book['2026-06-20'][0], { ts: 99, type: 'income', amount: 200, srcKey: 'transfer', desc: '代付收回' });

// 账对平：总支出 - 总收入 = 真实花销
let exp = 0, inc = 0;
Object.values(book).forEach(ents => ents.forEach(e => {
  if (e.type === 'income') inc += e.amount; else exp += e.amount;
}));
eq('总支出', exp, 300);
eq('总收入', inc, 200);
eq('真实净花销 = 支出-收入', exp - inc, 100);

// “别人欠我”清单：只算 owedToMe>0 且未收回
function collectOwed(all) {
  let n = 0;
  Object.values(all).forEach(ents => ents.forEach(e => {
    if (e.type !== 'income' && e.split && e.split.owedToMe > 0 && !e.split.settled) n += e.split.owedToMe;
  }));
  return n;
}
eq('收回后欠款清单归零', collectOwed(book), 0);

console.log(`\n${fail === 0 ? '✓ 全部通过' : '✗ 有失败'}：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail ? 1 : 0;
