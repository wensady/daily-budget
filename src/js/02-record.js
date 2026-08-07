    // ══ 固定地点 ══
    const PIN_KEY = 'budget_pins';
    function getPins() { try { return JSON.parse(localStorage.getItem(PIN_KEY)) || []; } catch(e) { return []; } }
    function savePins(arr) { localStorage.setItem(PIN_KEY, JSON.stringify(arr)); }

    function togglePinCurrent() {
      const val = document.getElementById('place-input').value.trim();
      if (!val) return;
      const pins = getPins();
      const idx = pins.indexOf(val);
      if (idx >= 0) { pins.splice(idx, 1); }
      else { pins.unshift(val); }
      savePins(pins);
      updatePinBtn(val);
      buildFreqPlaces();
    }

    function updatePinBtn(val) {
      const pins = getPins();
      const btn = document.getElementById('pin-btn');
      const hint = document.getElementById('pin-hint');
      const isPinned = val && pins.includes(val);
      btn.classList.toggle('pinned', isPinned);
      hint.style.display = isPinned ? 'block' : 'none';
    }

    function renderPins() {
      const pins = getPins();
      const wrap = document.getElementById('pinned-wrap');
      const row = document.getElementById('pinned-chips');
      if (!pins.length) { wrap.style.display = 'none'; return; }
      wrap.style.display = 'block';
      row.innerHTML = pins.map(pl =>
        `<button class="pchip" onclick='setPinnedPlace(${JSON.stringify(pl)})'>
          📌 ${pl}
          <span class="pchip-del" onclick='event.stopPropagation();unpinPlace(${JSON.stringify(pl)})'>×</span>
        </button>`
      ).join('');
    }

    function setPinnedPlace(pl) {
      document.getElementById('place-input').value = pl;
      document.querySelectorAll('.chip[data-group="place"]').forEach(x => x.classList.remove('sel'));
      document.getElementById('shop-box').classList.remove('show');
      updatePinBtn(pl);
    }

    function unpinPlace(pl) {
      const pins = getPins().filter(p => p !== pl);
      savePins(pins);
      renderPins();
      buildFreqPlaces();
      const cur = document.getElementById('place-input').value.trim();
      if (cur === pl) updatePinBtn('');
    }

    // ══ 常用地点（出现1次即显示，最多8个，固定地点排前）══
    function buildFreqPlaces() {
      renderPins();
      const all = loadRec(), cnt = {};
      const pins = getPins();
      Object.values(all).forEach(ents => (ents || []).forEach(e => {
        if (e.place) { cnt[e.place] = (cnt[e.place] || 0) + 1; }
      }));
      // 过滤掉已固定的，避免重复
      const sorted = Object.entries(cnt)
        .filter(([pl]) => !pins.includes(pl))
        .sort((a, b) => b[1] - a[1]).slice(0, 8);
      const wrap = document.getElementById('freq-wrap');
      const chips = document.getElementById('freq-chips');
      if (!sorted.length) { wrap.style.display = 'none'; return; }
      wrap.style.display = 'block';
      chips.innerHTML = sorted.map(([pl]) =>
        `<button class="fchip" onclick='setFreqPlace(${JSON.stringify(pl)})'>📍 ${pl}</button>`
      ).join('');
    }

    function setFreqPlace(pl) {
      document.getElementById('place-input').value = pl;
      document.querySelectorAll('.chip[data-group="place"]').forEach(x => x.classList.remove('sel'));
      document.getElementById('shop-box').classList.remove('show');
      updatePinBtn(pl);
    }

    // ══ 智能推荐：历史记录（所有分类通用）══
    function buildCatHistory(spendKey) {
      const all = loadRec();
      const freq = {};
      Object.values(all).forEach(ents => (ents || []).forEach(e => {
        if (e.spendKey === spendKey && e.desc && e.type !== 'income') {
          const k = e.desc;
          if (!freq[k]) freq[k] = { count: 0, lastAmt: 0, minAmt: Infinity, maxAmt: 0 };
          freq[k].count++;
          freq[k].lastAmt = e.amount;
          freq[k].minAmt = Math.min(freq[k].minAmt, e.amount);
          freq[k].maxAmt = Math.max(freq[k].maxAmt, e.amount);
        }
      }));
      const sorted = Object.entries(freq).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
      const box = document.getElementById('cat-hist-box');
      const chips = document.getElementById('cat-hist-chips');
      const lbl = document.getElementById('cat-hist-label-text');
      if (!sorted.length) { box.style.display = 'none'; return; }
      const catName = SPEND_LBL[spendKey] || '此类';
      lbl.textContent = catName + ' · 最近记过';
      chips.innerHTML = sorted.map(([desc, info]) => {
        // 价格浮动超50%视为不固定，仅显示"上次"不自动填入
        const variable = info.maxAmt > info.minAmt * 1.5 && info.count > 1;
        const fmtAmt = n => n % 1 === 0 ? n : n.toFixed(2);
        const priceLabel = variable
          ? `上次¥${fmtAmt(info.lastAmt)}`
          : `¥${fmtAmt(info.lastAmt)}`;
        // ⚠ onclick 必须用单引号包裹，避免 JSON.stringify 的双引号冲突
        return `<button class='hchip' onclick='applyHistChip(${JSON.stringify(desc)},${info.lastAmt},${variable})'>
          ${desc}<span class='hprice'>${priceLabel}</span>
        </button>`;
      }).join('');
      box.style.display = 'block';
    }

    function applyHistChip(desc, amt, variable) {
      const descEl = document.getElementById('desc-input');
      const amtEl  = document.getElementById('amount-input');
      descEl.value = desc;
      // 价格不固定时不自动填金额，只填描述；价格固定且金额框为空时自动填入
      if (!variable && !amtEl.value) {
        amtEl.value = amt;
        // 刷新金额芯片高亮
        document.querySelectorAll('.achip').forEach(b => {
          const v = parseFloat(b.textContent.replace(/[¥★\s]/g, ''));
          b.classList.toggle('sel-amt', v === amt);
        });
      }
      // 已选中样式反馈：让点击过的芯片变灰，表示已使用
      document.querySelectorAll('.hchip').forEach(b => b.classList.remove('hchip-used'));
      // 找到刚点的那个（通过 desc 匹配）
      document.querySelectorAll('.hchip').forEach(b => {
        if (b.childNodes[0] && b.childNodes[0].textContent.trim() === desc) {
          b.classList.add('hchip-used');
        }
      });
      // 滚动让金额框可见（若金额已填则滚到地点，否则滚到金额）
      const target = (!variable && amtEl.value) ? descEl : amtEl;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ══ 智能金额建议（基于同类历史均价 + 频次）══
    function buildSmartAmt(spendKey) {
      const lbl = document.getElementById('smart-amt-label-text');
      if (!spendKey) { document.getElementById('smart-amt-box').style.display = 'none'; return; }
      if (lbl) lbl.textContent = (SPEND_LBL[spendKey] || '此类') + ' 常用金额';
      const all = loadRec();
      const amtFreq = {};
      Object.values(all).forEach(ents => (ents || []).forEach(e => {
        if (e.spendKey === spendKey && e.amount > 0 && e.type !== 'income') {
          const rounded = Math.round(e.amount * 2) / 2; // 精确到 0.5 元
          amtFreq[rounded] = (amtFreq[rounded] || 0) + 1;
        }
      }));
      const sorted = Object.entries(amtFreq).sort((a, b) => b[1] - a[1]);
      const topAmt = sorted.length ? parseFloat(sorted[0][0]) : null;
      // 取频次前5，再按金额排序展示
      const display = sorted.slice(0, 5).map(([a]) => parseFloat(a)).sort((a, b) => a - b);
      const box = document.getElementById('smart-amt-box');
      const chips = document.getElementById('smart-amt-chips');
      if (!display.length) { box.style.display = 'none'; return; }
      chips.innerHTML = display.map(amt => {
        const isStar = amt === topAmt;
        const label = amt % 1 === 0 ? '¥' + amt : '¥' + amt.toFixed(1);
        // 使用单引号包裹 onclick，数字直接嵌入无引号冲突
        return `<button class="achip${isStar ? ' star' : ''}" onclick='pickAmt(${amt})'>${label}${isStar ? ' ★' : ''}</button>`;
      }).join('');
      box.style.display = 'block';
    }

    function pickAmt(amt) {
      document.getElementById('amount-input').value = amt;
      // 更新选中高亮
      document.querySelectorAll('.achip').forEach(b => {
        const v = parseFloat(b.textContent.replace(/[¥★\s]/g, ''));
        b.classList.toggle('sel-amt', v === amt);
      });
    }

    // ══ 智能地点推荐（分类预设 + 历史频率叠加）══
    const PLACE_SUGGEST = {
      breakfast: ['canteen','convenience','home_market','restaurant'],
      lunch:     ['canteen','restaurant','meituan','eleme','home_market'],
      dinner:    ['restaurant','canteen','meituan','eleme','home_market'],
      snack:     ['convenience','canteen','meituan','eleme'],
      meal:      ['meituan','eleme','restaurant','canteen'],
      grocery:   ['wet_market','supermarket','home_market'],
      transport: ['transit'],
      household: ['supermarket','taobao','jd','pdd','home_market'],
      medical:   ['hospital','clinic','pharmacy'],
      education: ['school','taobao','jd','online_other'],
      entertainment: ['mall','gym','online_other'],
      beauty:    ['salon','supermarket','taobao'],
      gift:      ['mall','taobao','jd'],
      clothes:   ['mall','taobao','jd','pdd'],
      pet:       ['supermarket','taobao','jd'],
      repair:    ['home_market','mall'],
      travel:    ['transit','online_other'],
      other:     []
    };

    function buildSmartPlace(spendKey) {
      const box = document.getElementById('smart-place-box');
      const chipsEl = document.getElementById('smart-place-chips');
      const lbl = document.getElementById('smart-place-label-text');
      // 统计该类别历史地点频次
      const all = loadRec();
      const hist = {};
      Object.values(all).forEach(ents => (ents || []).forEach(e => {
        if (e.spendKey === spendKey && e.place && e.type !== 'income') {
          hist[e.place] = (hist[e.place] || 0) + 1;
        }
      }));
      // 预设地点
      const presets = (PLACE_SUGGEST[spendKey] || []).map(k => ({ key: k, label: PLACE_LBL[k], score: 0 }));
      // 叠加历史频次到预设，再补充纯历史地点
      presets.forEach(p => { if (hist[p.label]) p.score += hist[p.label] * 2; });
      const presetLabels = new Set(presets.map(p => p.label));
      Object.entries(hist).forEach(([pl, cnt]) => {
        if (!presetLabels.has(pl)) presets.push({ key: '', label: pl, score: cnt });
      });
      const final = presets.filter(p => p.label).sort((a, b) => b.score - a.score).slice(0, 5);
      if (!final.length) { box.style.display = 'none'; return; }
      lbl.textContent = (SPEND_LBL[spendKey] || '此类') + ' · 常去地点';
      chipsEl.innerHTML = final.map(p =>
        `<button class='spchip' onclick='applySmartPlace(${JSON.stringify(p.label)},${JSON.stringify(p.key)})'>${p.label}</button>`
      ).join('');
      box.style.display = 'block';
    }

    function applySmartPlace(label, placeKey) {
      document.getElementById('place-input').value = label;
      document.querySelectorAll('.chip[data-group="place"]').forEach(x => x.classList.remove('sel'));
      if (placeKey) {
        const pc = document.querySelector(`.chip[data-group="place"][data-key="${placeKey}"]`);
        if (pc) pc.classList.add('sel');
        const sb = document.getElementById('shop-box');
        if (ONLINE_KEYS.includes(placeKey)) { sb.classList.add('show'); document.getElementById('shop-input').focus(); }
        else sb.classList.remove('show');
      }
      updatePinBtn(label);
      // 选中态反馈：高亮刚点的智能地点芯片
      document.querySelectorAll('.spchip').forEach(b => {
        b.classList.toggle('spchip-sel', b.textContent.trim() === label);
      });
    }

    // ══ 购物模式 ══
    // ══ Chip 交互 ══
    document.addEventListener('click', e => {
      const c = e.target.closest('.chip[data-group]');
      if (!c) return;
      const g = c.dataset.group;
      document.querySelectorAll(`.chip[data-group="${g}"]`).forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
      if (g === 'place') {
        const key = c.dataset.key;
        const label = PLACE_LBL[key] || '';
        document.getElementById('place-input').value = label;
        const sb = document.getElementById('shop-box');
        if (ONLINE_KEYS.includes(key)) { sb.classList.add('show'); document.getElementById('shop-input').focus(); }
        else sb.classList.remove('show');
      }
      if (g === 'spend') {
        buildCatHistory(c.dataset.key);
        buildSmartAmt(c.dataset.key);
        buildSmartPlace(c.dataset.key);
      }
    });
    document.getElementById('place-input').addEventListener('input', () => {
      document.querySelectorAll('.chip[data-group="place"]').forEach(x => x.classList.remove('sel'));
      document.getElementById('shop-box').classList.remove('show');
      updatePinBtn(document.getElementById('place-input').value.trim());
    });

    // ══ 条目状态 ══
    let entries = [];        // 所有条目
    let editingIndex = -1;   // -1=新增模式  >=0=编辑第i条
    let editingDate = '';    // 编辑时记录原始日期，支持跨日期移动条目
    let incomeEditIndex = -1;// -1=新增收入  >=0=编辑第i条收入

    function loadDateEntries() {
      const ex = loadRec()[getDate()];
      entries = (ex && Array.isArray(ex)) ? [...ex] : [];
      renderList();
      buildFreqPlaces();
    }
    loadDateEntries();

    function renderList() {
      const dk = getDate();
      const card = document.getElementById('entry-card');
      const list = document.getElementById('entry-list');
      const totEl = document.getElementById('entry-total');
      const lbl = document.getElementById('entry-date-lbl');
      const hint = document.getElementById('unsaved-hint');
      const doneBar = document.getElementById('done-bar');

      lbl.textContent = dk === todayKey() ? '今天' : fmtDay(dk);

      // 只显示支出（收入单独在下面的“今日收入”列表里）
      const exp = entries.map((e, i) => ({ e, i })).filter(x => x.e.type !== 'income');
      if (!exp.length) {
        card.style.display = 'none';
        doneBar.style.display = 'none';
        hint.style.display = 'none';
      } else {
        card.style.display = 'block';
        hint.style.display = 'none';
        doneBar.style.display = 'flex';
        list.innerHTML = exp.map(({ e, i }) => {
          const shop = e.shopName ? `·${e.shopName}` : '';
          const pl = e.place ? (e.place + shop) : '';
          const reasonTxt = e.reasonText || (e.reasonKey ? REASON_LBL[e.reasonKey] : '');
          const isEditing = (i === editingIndex);
          const _s = (typeof normSplit === 'function') ? normSplit(e.split) : (e.split || null);
          const aaTag = (_s && _s.amount > 0) ? `<div class="eaa">${_s.dir === 'i-owe' ? '🧮 我欠别人' : '🧮 别人欠我'} ¥${_s.amount.toFixed(2)}${_s.settled ? '（已还清）' : ''}</div>` : '';
          return `<div class="eitem ${isEditing ? 'unsaved' : 'saved'}" onclick="openEntryMenu(${i})" style="cursor:pointer" title="点击操作">
      <span class="ecat">${e.bigCat || '其他'}</span>
      <div class="emeta">
        <div class="edesc">${e.desc || SPEND_LBL[e.spendKey] || '消费'}</div>
        ${pl ? `<div class="eplace">📍 ${pl}</div>` : ''}
        ${reasonTxt ? `<div class="ereason">${reasonTxt}</div>` : ''}
        ${aaTag}
      </div>
      <div class="eright">
        <span class="eamt">¥${e.amount.toFixed(2)}</span>
        <span class="echevron">›</span>
      </div>
    </div>`;
        }).join('');
        const tot = exp.reduce((s, x) => s + x.e.amount, 0);
        totEl.innerHTML = `合计：<strong>¥${tot.toFixed(2)}</strong>`;
      }

      renderIncomeList();
      renderHomeOwe();
    }

    // 今日收入列表（① 收入可查 / 改 / 删）
    function renderIncomeList() {
      const card = document.getElementById('income-list-card');
      if (!card) return;
      const inc = entries.map((e, i) => ({ e, i })).filter(x => x.e.type === 'income');
      if (!inc.length) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      document.getElementById('income-list').innerHTML = inc.map(({ e, i }) =>
        `<div class="eitem saved" onclick="openEntryMenu(${i})" style="cursor:pointer" title="点击操作">
      <span class="ecat inc">${INCOME_LBL[e.srcKey] || '收入'}</span>
      <div class="emeta">
        <div class="edesc">${e.desc || INCOME_LBL[e.srcKey] || '收入'}</div>
      </div>
      <div class="eright">
        <span class="eamt inc">+¥${e.amount.toFixed(2)}</span>
        <span class="echevron">›</span>
      </div>
    </div>`).join('');
      const tot = inc.reduce((s, x) => s + x.e.amount, 0);
      document.getElementById('income-total').innerHTML = `今日收入：<strong>¥${tot.toFixed(2)}</strong>`;
    }

    function delEntry(i) {
      if (editingIndex === i) cancelEdit();
      else if (editingIndex > i) editingIndex--;
      if (incomeEditIndex === i) { resetIncomeForm(); document.getElementById('income-form-card').style.display = 'none'; }
      else if (incomeEditIndex > i) incomeEditIndex--;
      entries.splice(i, 1);
      saveRec(getDate(), entries);
      renderList();
    }

    function editEntry(i) {
      const e = entries[i];
      editingIndex = i;
      editingDate = getDate(); // 记录原始日期，编辑时可能改日期选择器

      // 填回金额
      document.getElementById('amount-input').value = e.amount;

      // 填回「花了什么」chip
      document.querySelectorAll('.chip[data-group="spend"]').forEach(c => {
        c.classList.toggle('sel', c.dataset.key === e.spendKey);
      });

      // 填回描述
      document.getElementById('desc-input').value = e.desc || '';

      // 填回地点 chip
      document.querySelectorAll('.chip[data-group="place"]').forEach(c => c.classList.remove('sel'));
      const matchPlace = Object.entries(PLACE_LBL).find(([, lbl]) => lbl === e.place);
      if (matchPlace) {
        const pc = document.querySelector(`.chip[data-group="place"][data-key="${matchPlace[0]}"]`);
        if (pc) pc.classList.add('sel');
        const sb = document.getElementById('shop-box');
        if (ONLINE_KEYS.includes(matchPlace[0])) { sb.classList.add('show'); }
        else sb.classList.remove('show');
      } else {
        document.getElementById('shop-box').classList.remove('show');
      }
      document.getElementById('place-input').value = e.place || '';
      document.getElementById('shop-input').value = e.shopName || '';

      // 填回「为什么花」chip
      document.querySelectorAll('.chip[data-group="reason"]').forEach(c => {
        c.classList.toggle('sel', c.dataset.key === e.reasonKey);
      });
      document.getElementById('reason-input').value =
        (e.reasonKey ? '' : (e.reasonText || ''));

      // 切换按钮文字 & 提示条
      document.getElementById('add-btn').textContent = '✓ 更新这笔';
      document.getElementById('edit-hint-bar').classList.add('show');

      // 若这笔填过地点/原因，自动展开折叠区，方便看到并修改
      if (e.place || e.reasonKey || e.reasonText) toggleExtra(true);

      // 滚动到表单顶部
      document.getElementById('amount-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
      renderList();
    }

    function clearSmartBoxes() {
      ['cat-hist-box','smart-amt-box','smart-place-box'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      // 清理芯片选中/已用状态
      document.querySelectorAll('.hchip-used').forEach(b => b.classList.remove('hchip-used'));
      document.querySelectorAll('.spchip-sel').forEach(b => b.classList.remove('spchip-sel'));
      document.querySelectorAll('.achip.sel-amt').forEach(b => b.classList.remove('sel-amt'));
    }

    function cancelEdit() {
      editingIndex = -1;
      editingDate = '';
      document.getElementById('add-btn').textContent = '＋ 添加这笔';
      document.getElementById('edit-hint-bar').classList.remove('show');
      // 清空表单
      document.getElementById('amount-input').value = '';
      document.getElementById('desc-input').value = '';
      document.getElementById('reason-input').value = '';
      document.querySelectorAll('.chip[data-group="spend"],.chip[data-group="reason"]').forEach(x => x.classList.remove('sel'));
      clearSmartBoxes();
      renderList();
    }

    // ══ 收入快记 ══
    function toggleIncomeForm() {
      const card = document.getElementById('income-form-card');
      const visible = card.style.display !== 'none';
      if (visible) { card.style.display = 'none'; return; }
      resetIncomeForm();                       // 以“新增”模式打开
      card.style.display = 'block';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('income-amt').focus();
    }

    function resetIncomeForm() {
      incomeEditIndex = -1;
      document.getElementById('income-amt').value = '';
      document.getElementById('income-desc').value = '';
      document.querySelectorAll('.chip[data-group="income"]').forEach(x => x.classList.remove('sel'));
      const btn = document.getElementById('income-add-btn');
      if (btn) btn.textContent = '✓ 确认收入';
    }

    // 编辑一笔已记的收入（① 收入可改）
    function editIncome(i) {
      const e = entries[i];
      if (!e || e.type !== 'income') return;
      incomeEditIndex = i;
      const card = document.getElementById('income-form-card');
      card.style.display = 'block';
      document.getElementById('income-amt').value = e.amount;
      document.querySelectorAll('.chip[data-group="income"]').forEach(c => c.classList.toggle('sel', c.dataset.key === e.srcKey));
      document.getElementById('income-desc').value = e.desc || '';
      const btn = document.getElementById('income-add-btn');
      if (btn) btn.textContent = '✓ 更新收入';
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function addIncome() {
      const amtEl = document.getElementById('income-amt');
      const amount = parseFloat(amtEl.value);
      if (!amount || amount <= 0) {
        amtEl.style.borderBottomColor = '#e74c3c';
        setTimeout(() => amtEl.style.borderBottomColor = '', 1200);
        amtEl.focus(); return;
      }
      const sc = document.querySelector('.chip[data-group="income"].sel');
      const srcKey = sc ? sc.dataset.key : 'other';
      const desc = document.getElementById('income-desc').value.trim() || INCOME_LBL[srcKey];
      const isUpd = incomeEditIndex >= 0;
      const entry = {
        ts: isUpd ? entries[incomeEditIndex].ts : Date.now(),
        type: 'income', amount, srcKey, desc
      };
      if (isUpd) entries[incomeEditIndex] = entry;
      else entries.push(entry);
      saveRec(getDate(), entries);
      resetIncomeForm();
      document.getElementById('income-form-card').style.display = 'none';
      renderList();
      showToast(isUpd ? '收入已更新 ✓' : '收入已记 ✓');
    }

    // ③ 地点/原因 折叠开关
    function toggleExtra(force) {
      const box = document.getElementById('extra-fields');
      const btn = document.getElementById('extra-toggle');
      if (!box) return;
      const on = (force !== undefined) ? force : (box.style.display === 'none' || !box.style.display);
      box.style.display = on ? 'block' : 'none';
      if (btn) btn.textContent = on ? '－ 收起 地点 · 原因' : '＋ 地点 · 原因（选填）';
    }

    // ══ 添加/更新这笔 ══
    document.getElementById('add-btn').addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('amount-input').value);
      const ain = document.getElementById('amount-input');
      if (!amount || amount <= 0) { ain.classList.add('err'); setTimeout(() => ain.classList.remove('err'), 1200); ain.focus(); return; }
      const sc = document.querySelector('.chip[data-group="spend"].sel');
      const sk = sc ? sc.dataset.key : 'other';
      const pc = document.querySelector('.chip[data-group="place"].sel');
      const pk = pc ? pc.dataset.key : '';
      const rc = document.querySelector('.chip[data-group="reason"].sel');
      const shop = document.getElementById('shop-input').value.trim();
      const pm = document.getElementById('place-input').value.trim();
      const reasonText = document.getElementById('reason-input').value.trim();

      const entry = {
        ts: editingIndex >= 0 ? entries[editingIndex].ts : Date.now(),
        amount, spendKey: sk, bigCat: CAT_MAP[sk] || '其他',
        desc: document.getElementById('desc-input').value.trim() || SPEND_LBL[sk] || '',
        place: pm || (pk ? PLACE_LBL[pk] : ''),
        shopName: ONLINE_KEYS.includes(pk) ? shop : '',
        reasonKey: rc ? rc.dataset.key : '',
        reasonText: reasonText || (rc ? REASON_LBL[rc.dataset.key] : ''),
        note: '',
        // 编辑时保留原 split（AA 分摊信息），避免编辑保存后丢失
        ...(editingIndex >= 0 && entries[editingIndex].split ? { split: entries[editingIndex].split } : {})
      };

      const isUpdate = editingIndex >= 0;
      if (isUpdate) {
        const newDate = getDate();
        const origDate = editingDate || newDate;
        if (origDate && origDate !== newDate) {
          // ── 日期改变：从旧日期删除，往新日期插入 ──
          const oldEnts = (loadRec()[origDate] || []).filter((_, idx) => idx !== editingIndex);
          saveRec(origDate, oldEnts);
          const newEnts = loadRec()[newDate] || [];
          newEnts.push(entry);
          saveRec(newDate, newEnts);
          // 刷新当前视图为新日期
          loadDateEntries();
        } else {
          // ── 日期不变：直接覆盖 ──
          entries[editingIndex] = entry;
          saveRec(newDate, entries);
          renderList();
        }
      } else {
        entries.push(entry);
        saveRec(getDate(), entries);
        renderList();
      }

      // 重置编辑状态
      editingIndex = -1;
      editingDate = '';
      document.getElementById('add-btn').textContent = '＋ 添加这笔';
      document.getElementById('edit-hint-bar').classList.remove('show');

      buildFreqPlaces();

      // 清空金额/类别/原因，保留地点（方便连续记同一地点）
      document.getElementById('amount-input').value = '';
      document.getElementById('desc-input').value = '';
      document.getElementById('reason-input').value = '';
      document.getElementById('shop-input').value = '';
      document.querySelectorAll('.chip[data-group="spend"],.chip[data-group="reason"]').forEach(x => x.classList.remove('sel'));
      clearSmartBoxes();

      const dayTot = entries.reduce((s, e) => s + e.amount, 0);
      if (isUpdate) {
        showToast('✓ 已更新 ¥' + amount.toFixed(2));
      } else {
        showToast('✓ 已记 ¥' + amount.toFixed(2) + '   今日合计 ¥' + dayTot.toFixed(2));
      }
    });
