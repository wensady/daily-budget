// ════════════════════════════════════════════════════════════════
// 12-receipt-audit.js —— 小票明细核算与渲染
//
// 三层校验：
//   L1: 单行 unitPrice * qty = subtotal
//   L2: Sum(subtotal) - discount = entry.amount
//   L3: 缺漏字段检测（识别 OCR 漏抓的行）
// ════════════════════════════════════════════════════════════════

// 计算单行小计：优先 subtotal；否则 unitPrice * qty
function calcItemSubtotal(it) {
  if (it.subtotal != null && it.subtotal !== '') {
    const v = parseFloat(it.subtotal);
    if (!isNaN(v)) return Math.round(v * 100) / 100;
  }
  if (it.unitPrice != null && it.qty != null) {
    const p = parseFloat(it.unitPrice), q = parseFloat(it.qty);
    if (!isNaN(p) && !isNaN(q)) return Math.round(p * q * 100) / 100;
  }
  return null;
}

// 三层校验
function auditReceipt(entry) {
  if (!entry || !entry.items || !entry.items.length) return null;
  const items = entry.items;
  let sumItems = 0, missingCount = 0, badCalcRows = [];
  items.forEach((it, i) => {
    const sub = calcItemSubtotal(it);
    if (sub == null) { missingCount++; }
    else {
      sumItems += sub;
      if (it.unitPrice != null && it.qty != null) {
        const p = parseFloat(it.unitPrice), q = parseFloat(it.qty);
        if (!isNaN(p) && !isNaN(q)) {
          const calc = Math.round(p * q * 100) / 100;
          if (Math.abs(calc - sub) > 0.02) badCalcRows.push(i);
        }
      }
    }
  });
  sumItems = Math.round(sumItems * 100) / 100;
  const totalAmt = entry.amount || 0;
  const discount = entry.discount || 0;
  const expected = Math.round((sumItems - discount) * 100) / 100;
  const diff = Math.round((expected - totalAmt) * 100) / 100;
  let status;
  if (missingCount > 0 && sumItems === 0) status = 'warn';
  else if (Math.abs(diff) <= 0.01) status = 'ok';
  else if (missingCount > 0) status = 'warn';
  else status = 'bad';
  return { status, sumItems, totalAmt, discount, expected, diff, missingCount, badCalcRows, itemCount: items.length };
}

function receiptBadgeHTML(e) {
  const r = auditReceipt(e);
  if (!r) return '';
  let cls, txt;
  if (r.status === 'ok')        { cls = 'rb-ok';   txt = '\u2713 明细核平'; }
  else if (r.status === 'warn') { cls = 'rb-warn'; txt = '\u26A0 明细缺数'; }
  else                          { cls = 'rb-bad';  txt = '\u2717 金额差\u00A5' + Math.abs(r.diff).toFixed(2); }
  return '<span class="receipt-badge ' + cls + '">' + txt + '</span>';
}

function receiptSectionHTML(e) {
  const r = auditReceipt(e);
  if (!r) return '';
  const items = e.items || [];
  let rowsHTML = '';
  items.forEach((it, i) => {
    const sub = calcItemSubtotal(it);
    const miss = sub == null;
    const badCalc = r.badCalcRows.includes(i);
    const cls = miss ? 'ri-row ri-miss' : (badCalc ? 'ri-row ri-bad' : 'ri-row');
    const subTxt = miss ? '<span class="ri-miss-txt">缺数</span>' : '\u00A5' + sub.toFixed(2);
    const sku = it.sku ? '<span class="ri-sku">' + escapeHTML(it.sku) + '</span>' : '';
    const name = escapeHTML(it.name || '') || '<span class="ri-miss-txt">无品名</span>';
    const unit = it.unit ? '/' + escapeHTML(it.unit) : '';
    const priceTxt = (it.unitPrice != null && it.unitPrice !== '') ? '\u00A5' + parseFloat(it.unitPrice).toFixed(2) : '\u2014';
    const qtyTxt = (it.qty != null && it.qty !== '') ? (parseFloat(it.qty) + unit) : '\u2014';
    rowsHTML += '<div class="' + cls + '">' +
                '<div class="ri-name">' + sku + name + '</div>' +
                '<div class="ri-price">' + priceTxt + '</div>' +
                '<div class="ri-qty">' + qtyTxt + '</div>' +
                '<div class="ri-sub">' + subTxt + '</div>' +
                '</div>';
  });
  let sumHTML = '';
  if (r.discount > 0) {
    sumHTML += '<div class="ri-row ri-sum"><div class="ri-name">优惠/抹零</div><div class="ri-price">\u2014</div><div class="ri-qty">\u2014</div><div class="ri-sub">-\u00A5' + r.discount.toFixed(2) + '</div></div>';
  }
  sumHTML += '<div class="ri-row ri-sum"><div class="ri-name">明细合计</div><div class="ri-price">\u2014</div><div class="ri-qty">\u2014</div><div class="ri-sub">\u00A5' + r.sumItems.toFixed(2) + '</div></div>';
  sumHTML += '<div class="ri-row ri-sum ' + (r.status === 'ok' ? 'ri-sum-ok' : (r.status === 'warn' ? 'ri-sum-warn' : 'ri-sum-bad')) + '"><div class="ri-name">账面金额</div><div class="ri-price">\u2014</div><div class="ri-qty">\u2014</div><div class="ri-sub">\u00A5' + r.totalAmt.toFixed(2) + '</div></div>';
  if (r.status !== 'ok') {
    let tip;
    if (r.status === 'warn') tip = '有 ' + r.missingCount + ' 行缺单价/数量，无法核对';
    else if (r.diff > 0) tip = '明细比账面多 \u00A5' + r.diff.toFixed(2) + '（可能漏记优惠）';
    else tip = '明细比账面少 \u00A5' + Math.abs(r.diff).toFixed(2) + '（可能漏记商品）';
    sumHTML += '<div class="ri-tip">' + tip + '</div>';
  }
  const id = 'ris_' + Math.random().toString(36).slice(2, 9);
  return '<div class="receipt-section">' +
           '<button class="receipt-expand-btn" onclick="toggleReceipt(\'' + id + '\', this)">\u25B8 查看明细（' + r.itemCount + ' 项）</button>' +
           '<div class="receipt-items-detail" id="' + id + '" style="display:none">' +
             '<div class="ri-table">' +
               '<div class="ri-row ri-hd"><div class="ri-name">品名</div><div class="ri-price">单价</div><div class="ri-qty">数量</div><div class="ri-sub">小计</div></div>' +
               rowsHTML + sumHTML +
             '</div>' +
           '</div>' +
         '</div>';
}

function toggleReceipt(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  const cur = btn.textContent.replace(/^[\u25B8\u25BE]\s*/, '');
  btn.textContent = open ? ('\u25B8 ' + cur) : ('\u25BE ' + cur);
}

function escapeHTML(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function clearOcrItems() {
  delete window._ocrItems;
  delete window._ocrDiscount;
}
