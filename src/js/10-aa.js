    // ══ 代付 / 别人欠我（简化版）══
    // 支出条目可选字段 split = { owedToMe: 别人欠我多少, note, settled }
    // 记账金额永远是你实付的全额；标“代付”只是记下“这笔里有多少是别人欠我的”。
    // 点“已收回”→ 自动在今天记一笔收入（代付收回），支出/收入两笔真实记录，账自然对平。

    // ── 代付标记弹窗 ──
    let _aaEditIndex = -1;
    function openAaSheet(i) {
      const e = entries[i];
      if (!e || e.type === 'income') return;
      _aaEditIndex = i;
      const total = e.amount;
      document.getElementById('aa-sheet-sub').textContent =
        (e.desc || SPEND_LBL[e.spendKey] || '这笔') + ' · ¥' + total.toFixed(2);
      document.getElementById('aa-total-hint').textContent = '¥' + total.toFixed(2);
      const owedEl = document.getElementById('aa-owed-input');
      const noteEl = document.getElementById('aa-note');
      const delBtn = document.getElementById('aa-sheet-del');
      if (e.split && e.split.owedToMe > 0) {
        owedEl.value = e.split.owedToMe;
        noteEl.value = e.split.note || '';
        delBtn.style.display = '';
      } else {
        owedEl.value = '';
        noteEl.value = '';
        delBtn.style.display = 'none';
      }
      document.getElementById('aa-sheet-mask').classList.add('show');
      setTimeout(() => owedEl.focus(), 100);
    }
    function saveAaSheet() {
      const e = entries[_aaEditIndex];
      if (!e) return;
      const total = e.amount;
      const owed = parseFloat(document.getElementById('aa-owed-input').value);
      if (isNaN(owed) || owed <= 0 || owed > total) {
        showToast('别人欠我的要在 0 ~ ¥' + total.toFixed(2) + ' 之间');
        return;
      }
      const note = document.getElementById('aa-note').value.trim();
      e.split = { owedToMe: +owed.toFixed(2), note, settled: false };
      saveRec(getDate(), entries);
      closeAaSheet();
      renderList();
      showToast('已记下：别人欠你 ¥' + e.split.owedToMe.toFixed(2));
    }
    function clearAaSplit() {
      const e = entries[_aaEditIndex];
      if (e) { delete e.split; saveRec(getDate(), entries); }
      closeAaSheet();
      renderList();
      showToast('已取消代付标记');
    }
    function closeAaSheet() {
      document.getElementById('aa-sheet-mask').classList.remove('show');
      _aaEditIndex = -1;
    }

    // ── 点一条账后的操作菜单（编辑 / 代付 / 删除）──
    let _menuIndex = -1;
    function openEntryMenu(i) {
      const e = entries[i];
      if (!e) return;
      _menuIndex = i;
      const isInc = e.type === 'income';
      const name = e.desc || (isInc ? INCOME_LBL[e.srcKey] : SPEND_LBL[e.spendKey]) || '这笔';
      document.getElementById('entry-menu-sub').textContent =
        name + ' · ' + (isInc ? '+' : '') + '¥' + e.amount.toFixed(2);
      const aaBtn = document.getElementById('menu-aa-btn');
      if (aaBtn) aaBtn.style.display = isInc ? 'none' : '';   // 收入没有“代付”
      document.getElementById('entry-menu-mask').classList.add('show');
    }
    function closeEntryMenu() {
      document.getElementById('entry-menu-mask').classList.remove('show');
      _menuIndex = -1;
    }
    function menuEdit() {
      const i = _menuIndex; closeEntryMenu();
      if (i < 0) return;
      if (entries[i] && entries[i].type === 'income') editIncome(i);
      else editEntry(i);
    }
    function menuAa() { const i = _menuIndex; closeEntryMenu(); if (i >= 0) openAaSheet(i); }
    function menuDel() {
      const i = _menuIndex; closeEntryMenu();
      if (i >= 0 && confirm('确定删除这笔吗？')) delEntry(i);
    }

    // ── 首页“别人欠我”横幅（仅有未收回欠款时显示）──
    function renderHomeOwe() {
      const banner = document.getElementById('home-owe-banner');
      if (!banner) return;
      const sum = collectOwed().reduce((s, x) => s + x.owed, 0);
      if (sum > 0) {
        banner.style.display = 'flex';
        document.getElementById('home-owe-sum').textContent = '¥' + sum.toFixed(2);
      } else {
        banner.style.display = 'none';
      }
    }
    function gotoOwed() {
      switchPage('stats');
      setTimeout(() => { if (typeof statsScrollTo === 'function') statsScrollTo('owed-card'); }, 120);
    }

    // ── 统计页“别人欠我”清单 ──
    function collectOwed() {
      const all = loadRec(), out = [];
      Object.keys(all).forEach(dk => (all[dk] || []).forEach(e => {
        if (e.type !== 'income' && e.split && e.split.owedToMe > 0 && !e.split.settled) {
          out.push({
            dk, ts: e.ts,
            desc: e.desc || (SPEND_LBL[e.spendKey] || '消费'),
            owed: e.split.owedToMe, note: e.split.note || ''
          });
        }
      }));
      return out.sort((a, b) => (a.dk < b.dk ? 1 : -1));
    }
    function renderOwed() {
      const card = document.getElementById('owed-card');
      if (!card) return;
      const list = collectOwed();
      if (!list.length) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      const sum = list.reduce((s, x) => s + x.owed, 0);
      document.getElementById('owed-sum').textContent = '共 ¥' + sum.toFixed(2);
      document.getElementById('owed-list').innerHTML = list.map(x =>
        `<div class="owed-row">
          <div class="owed-meta">
            <div class="owed-desc">${x.desc}${x.note ? ' · ' + x.note : ''}</div>
            <div class="owed-date">${x.dk.slice(5).replace('-', '月')}日垫付</div>
          </div>
          <div class="owed-amt">¥${x.owed.toFixed(2)}</div>
          <button class="owed-settle" onclick='settleOwed(${JSON.stringify(x.dk)},${x.ts})'>已收回</button>
        </div>`
      ).join('');
    }
    // 收回：标记原条目已收回，并在“今天”自动记一笔收入（代付收回）
    function settleOwed(dk, ts) {
      const all = loadRec();
      const e = (all[dk] || []).find(x => x.ts === ts);
      if (!e || !e.split) return;
      const amt = e.split.owedToMe;
      e.split.settled = true;
      const tk = todayKey();
      const todayEnts = all[tk] || [];
      todayEnts.push({
        ts: Date.now(), type: 'income', amount: amt,
        srcKey: 'transfer', desc: '代付收回' + (e.split.note ? '·' + e.split.note : '')
      });
      all[tk] = todayEnts;
      localStorage.setItem(SK, JSON.stringify(all));
      // 刷新：当前记账日列表 + 统计 + 横幅
      if (typeof loadDateEntries === 'function') loadDateEntries();
      renderOwed();
      renderHomeOwe();
      if (typeof curM !== 'undefined') renderMS(curM, allMonths());
      showToast('已收回 ¥' + amt.toFixed(2) + '，已记入今日收入');
    }
