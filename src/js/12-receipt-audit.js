// 小票数据接收、核对与展示；识图和 AI 粘贴共用，不改写已有账目。
function receiptNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const s = value.trim().replace(/^[¥￥]\s*/, '');
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeReceiptItem(item) {
  if (typeof item === 'string' && item.trim()) item = { name: item };
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('商品明细里有无法读取的条目，请用最新模板重新整理后粘贴');
  }
  const txt = v => typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
  return {
    name: txt(item.name ?? item['品名'] ?? item['商品名称']),
    sku: txt(item.sku ?? item['货号']),
    unitPrice: receiptNumber(item.unitPrice ?? item['单价']),
    qty: receiptNumber(item.qty ?? item.quantity ?? item['数量']),
    unit: txt(item.unit ?? item['单位']),
    subtotal: receiptNumber(item.subtotal ?? item['小计'])
  };
}

function prepareReceiptData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.orders) {
    throw new Error('这次请整理一张小票的商品明细；多个独立订单请分别粘贴');
  }
  const amount = receiptNumber(data.amount);
  if (!(amount > 0)) throw new Error('没有读到有效的实付总金额，请检查 AI 回复');
  let items = data.items;
  if (typeof items === 'string' && items.trim()) {
    try { items = JSON.parse(items); }
    catch (e) { throw new Error('商品明细格式不完整，请重新复制完整回复；已有表单未替换'); }
  }
  if (items == null || items === '') items = [];
  if (!Array.isArray(items)) throw new Error('商品明细不是列表，请用最新模板重新整理；已有表单未替换');
  items = items.map(normalizeReceiptItem);
  let receiptNote = '';
  // 仅恢复明确用分号或换行分隔的名称，不从描述猜价格，不拆普通逗号。
  if (!items.length && typeof data.desc === 'string' && /[;；\n]/.test(data.desc)) {
    const names = data.desc.split(/[;；\n]+/).map(s => s.trim()).filter(Boolean);
    if (names.length >= 2 && names.every(s => s.length <= 100)) {
      items = names.map(name => normalizeReceiptItem({ name }));
      receiptNote = '这些名称从描述中分行整理，是否为独立商品请对照原票。原回复没有逐项价格；请用最新模板重新识别以补全。';
    }
  }
  return {
    ...data, amount, items, receiptNote, discount: receiptNumber(data.discount) || 0,
    desc: typeof data.desc === 'string' ? data.desc : '',
    place: typeof data.place === 'string' ? data.place : '',
    shopName: typeof data.shopName === 'string' ? data.shopName : ''
  };
}

function calcItemSubtotal(it) {
  const sub = receiptNumber(it.subtotal);
  if (sub !== null) return Math.round(sub * 100) / 100;
  const p = receiptNumber(it.unitPrice), q = receiptNumber(it.qty);
  return p !== null && q !== null ? Math.round(p * q * 100) / 100 : null;
}

function auditReceipt(entry) {
  if (!entry || !Array.isArray(entry.items) || !entry.items.length) return null;
  let items;
  try { items = entry.items.map(normalizeReceiptItem); } catch (e) { return null; }
  let sumItems = 0, missingCount = 0, missingSubtotalCount = 0;
  const badCalcRows = [];
  items.forEach((it, i) => {
    const sub = calcItemSubtotal(it);
    if (sub === null) missingSubtotalCount++;
    else sumItems += sub;
    if (!it.name || it.unitPrice === null || it.qty === null || sub === null) missingCount++;
    if (it.unitPrice !== null && it.qty !== null && sub !== null) {
      const calc = Math.round(it.unitPrice * it.qty * 100) / 100;
      if (Math.abs(Math.round((calc - sub) * 100)) > 2) badCalcRows.push(i);
    }
  });
  sumItems = Math.round(sumItems * 100) / 100;
  const totalAmt = receiptNumber(entry.amount), discount = receiptNumber(entry.discount) || 0;
  const expected = Math.round((sumItems - discount) * 100) / 100;
  const diff = totalAmt === null ? null : Math.round((expected - totalAmt) * 100) / 100;
  let status = 'ok';
  if (missingCount || badCalcRows.length || diff === null) status = 'warn';
  else if (Math.abs(diff) > 0.01) status = 'bad';
  return { status, items, sumItems, totalAmt, discount, expected, diff, missingCount,
    missingSubtotalCount, badCalcRows, itemCount: items.length };
}

function receiptStatusText(r) {
  if (r.status === 'ok') return '✓ 明细核平';
  if (r.missingCount) return '⚠ 明细缺数';
  if (r.status === 'warn') return '⚠ 明细待核对';
  return '金额差 ¥' + Math.abs(r.diff).toFixed(2);
}

function receiptBadgeHTML(e) {
  const r = auditReceipt(e);
  return r ? '<span class="receipt-badge rb-' + r.status + '">' + receiptStatusText(r) + '</span>' : '';
}

function receiptTableHTML(e) {
  const r = auditReceipt(e);
  if (!r) return '';
  const number = n => n === null ? '—' : n.toFixed(2);
  const cells = (name, price, qty, sub) => '<div class="ri-name" role="cell">' + name + '</div><div class="ri-price" role="cell">' + price + '</div><div class="ri-qty" role="cell">' + qty + '</div><div class="ri-sub" role="cell">' + sub + '</div>';
  const rows = r.items.map((it, i) => {
    const sub = calcItemSubtotal(it);
    const missing = !it.name || it.unitPrice === null || it.qty === null || sub === null;
    const unit = it.unit ? '<small class="ri-unit">' + escapeHTML(it.unit) + '</small>' : '';
    const sku = it.sku ? '<span class="ri-sku">' + escapeHTML(it.sku) + '</span>' : '';
    const computed = it.subtotal === null && sub !== null ? '<small class="ri-unit" title="按单价乘数量计算，原票未提供小计">计算值</small>' : '';
    return '<div role="row" class="ri-row ri-item' + (missing ? ' ri-miss' : '') + (r.badCalcRows.includes(i) ? ' ri-bad' : '') + '">' + cells(
      (escapeHTML(it.name) || '<span class="ri-miss-txt">品名待补</span>') + sku,
      number(it.unitPrice), (it.qty === null ? '—' : String(it.qty)) + unit, number(sub) + computed
    ) + '</div>';
  }).join('');
  const sum = (label, value, cls = '') => '<div role="row" class="ri-row ri-sum ' + cls + '"><div class="ri-name" role="cell">' + label + '</div><div class="ri-sub" role="cell">' + value + '</div></div>';
  const totalLabel = r.missingSubtotalCount && r.missingSubtotalCount < r.itemCount ? '已知明细合计' : '明细合计';
  let totals = sum(totalLabel, r.missingSubtotalCount === r.itemCount ? '—' : number(r.sumItems));
  if (r.discount) totals += sum('优惠 / 抹零', number(-r.discount));
  totals += sum('账面金额', number(r.totalAmt), 'ri-paid');
  const tips = [];
  if (r.missingCount) tips.push(r.missingCount + ' 项信息不完整，空缺用「—」表示，不代表 0 元。');
  if (r.badCalcRows.length) tips.push(r.badCalcRows.length + ' 项单价 × 数量与票面小计有差异，请核对计量精度或优惠；这里保留票面小计。');
  if (!r.missingSubtotalCount && r.diff !== null && Math.abs(r.diff) > 0.01) tips.push('明细扣除优惠后比账面' + (r.diff > 0 ? '多' : '少') + ' ¥' + Math.abs(r.diff).toFixed(2) + '，请对照原票。');
  if (e.receiptNote) tips.push(String(e.receiptNote));
  return '<div class="ri-table"><div class="ri-caption"><span>商品清单 · ' + r.itemCount + ' 项</span><span>金额单位：元</span></div>' +
    '<div role="table" aria-label="小票商品明细"><div class="ri-row ri-hd" role="row"><div class="ri-name" role="columnheader">品名</div><div class="ri-price" role="columnheader">单价</div><div class="ri-qty" role="columnheader">数量</div><div class="ri-sub" role="columnheader">小计</div></div>' + rows + totals + '</div>' +
    '<div class="ri-audit rb-' + r.status + '">' + receiptStatusText(r) + '</div>' +
    tips.map(t => '<p class="ri-tip">' + escapeHTML(t) + '</p>').join('') + '</div>';
}

function receiptSectionHTML(e) {
  const r = auditReceipt(e);
  if (!r) return '';
  const id = 'ris_' + Math.random().toString(36).slice(2, 11);
  return '<div class="receipt-section"><button type="button" class="receipt-expand-btn" aria-expanded="false" aria-controls="' + id + '" onclick="toggleReceipt(\'' + id + '\', this, event)">▸ 查看明细（' + r.itemCount + ' 项）</button>' +
    '<div class="receipt-items-detail" id="' + id + '" style="display:none">' + receiptTableHTML(e) + '</div></div>';
}

function toggleReceipt(id, btn, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  btn.setAttribute('aria-expanded', String(!open));
  btn.textContent = (open ? '▸ ' : '▾ ') + btn.textContent.replace(/^[▸▾]\s*/, '');
}

function renderReceiptDraft() {
  const box = document.getElementById('receipt-draft');
  if (!box) return;
  const editing = typeof editingIndex !== 'undefined' && editingIndex >= 0 ? entries[editingIndex] : null;
  const active = window._ocrReceiptActive;
  const items = active ? window._ocrItems : editing && editing.items;
  if (!active && (!Array.isArray(items) || !items.length)) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  const title = '<div class="receipt-draft-head"><div><span class="receipt-eyebrow">本次识别的小票</span><h3>这张小票买了什么</h3></div><div class="receipt-draft-actions"><span class="receipt-draft-state">' + (editing ? '编辑中' : '待保存') + '</span><button type="button" class="receipt-clear-btn" onclick="clearReceiptDraft(true)" aria-label="清除本次识别">× 清除</button></div></div>';
  const entry = { items, amount: document.getElementById('amount-input').value,
    discount: active ? window._ocrDiscount : editing.discount,
    receiptNote: active ? window._ocrReceiptNote : editing.receiptNote };
  box.innerHTML = title + (items && items.length
    ? '<p class="receipt-draft-help">核对商品与金额后，点下方「' + (editing ? '更新这笔' : '添加这笔') + '」一起保存。</p>' + receiptTableHTML(entry)
    : '<div class="receipt-empty"><strong>这次只读到了总金额，没有商品明细</strong><p>如果原图有商品清单，请复制最新模板，让 AI 逐项整理后重新粘贴。只有付款金额的图片无法补出商品价格。</p><button type="button" onclick="openAiPaste()">重新粘贴识别结果</button></div>');
}

function escapeHTML(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function clearOcrItems() {
  delete window._ocrItems;
  delete window._ocrDiscount;
  delete window._ocrReceiptNote;
  delete window._ocrReceiptActive;
  const box = document.getElementById('receipt-draft');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

// 识别草稿与手动记账是两条路径。用户点“清除”或清空金额时，
// 只清掉尚未保存的识别结果，不碰已经保存的旧账。
function clearReceiptDraft(keepForm) {
  clearOcrItems();
  if (!keepForm) return;
  const amount = document.getElementById('amount-input');
  const desc = document.getElementById('desc-input');
  const place = document.getElementById('place-input');
  const shop = document.getElementById('shop-input');
  const reason = document.getElementById('reason-input');
  if (amount) amount.value = '';
  if (desc && desc.dataset.receiptDraft === '1') desc.value = '';
  if (place && place.dataset.receiptDraft === '1') place.value = '';
  if (shop && shop.dataset.receiptDraft === '1') shop.value = '';
  if (reason && reason.dataset.receiptDraft === '1') reason.value = '';
  [desc, place, shop, reason].forEach(el => { if (el) delete el.dataset.receiptDraft; });
  document.querySelectorAll('.chip[data-group="spend"],.chip[data-group="place"],.chip[data-group="reason"]').forEach(chip => chip.classList.remove('sel'));
  if (typeof clearSmartBoxes === 'function') clearSmartBoxes();
}

function markReceiptDraftFields() {
  ['desc-input', 'place-input', 'shop-input', 'reason-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.dataset.receiptDraft = '1';
  });
}

document.getElementById('amount-input')?.addEventListener('input', renderReceiptDraft);
document.getElementById('amount-input')?.addEventListener('input', function () {
  if (!this.value.trim() && window._ocrReceiptActive) clearReceiptDraft(false);
});
