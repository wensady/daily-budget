    // ══ 代付 / 平摊（双向）══
    // 支出条目可选字段 split，表示“这笔钱里有一部分是要和别人算清的”：
    //   dir: 'owe-me'  → 别人欠我（我垫付了，之后要收回）
    //   dir: 'i-owe'   → 我欠别人（这笔里有一部分是我该还别人的）
    //   amount: 平摊金额；note: 备注；settled: 是否已结清
    // 记账金额永远是你实付的全额；标记 split 只是记下“谁和谁差多少”。
    // 结清时：owe-me 自动记一笔收入（收回）；i-owe 自动记一笔支出（还钱）。
    //
    // 兼容旧数据：早期只有 split.owedToMe（无 dir），视为 'owe-me'。
    function normSplit(s) {
      if (!s) return null;
      if (typeof s.dir === 'string') return s;                       // 新格式
      const amt = (+s.owedToMe > 0) ? +s.owedToMe : 0;
      return { dir: 'owe-me', amount: amt, note: s.note || '', settled: !!s.settled };
    }

    // ── 代付标记弹窗 ──
    let _aaEditIndex = -1;
    let _aaDir = 'owe-me';
    function setAaDir(dir) {
      _aaDir = dir;
      document.querySelectorAll('#aa-dir .aa-dir-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
      const isOwe = dir === 'owe-me';
      document.getElementById('aa-tip-owe').style.display = isOwe ? '' : 'none';
      document.getElementById('aa-tip-ipay').style.display = isOwe ? 'none' : '';
      document.getElementById('aa-owed-label').textContent = isOwe ? '别人一共欠我' : '我一共欠';
      document.getElementById('aa-sheet-title').textContent = isOwe ? '🧮 这笔有别人欠我的' : '🧮 这笔有我欠别人的';
    }
    function openAaSheet(i) {
      const e = entries[i];
      if (!e || e.type === 'income') return;
      _aaEditIndex = i;
      const s = normSplit(e.split);
      _aaDir = s ? s.dir : 'owe-me';
      // 同步方向 UI
      document.querySelectorAll('#aa-dir .aa-dir-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === _aaDir));
      document.getElementById('aa-tip-owe').style.display = _aaDir === 'owe-me' ? '' : 'none';
      document.getElementById('aa-tip-ipay').style.display = _aaDir === 'i-owe' ? '' : 'none';
      document.getElementById('aa-owed-label').textContent = _aaDir === 'owe-me' ? '别人一共欠我' : '我一共欠';
      document.getElementById('aa-sheet-title').textContent = _aaDir === 'owe-me' ? '🧮 这笔有别人欠我的' : '🧮 这笔有我欠别人的';
      const total = e.amount;
      document.getElementById('aa-sheet-sub').textContent =
        (e.desc || SPEND_LBL[e.spendKey] || '这笔') + ' · ¥' + total.toFixed(2);
      document.getElementById('aa-total-hint').textContent = '¥' + total.toFixed(2);
      const owedEl = document.getElementById('aa-owed-input');
      const noteEl = document.getElementById('aa-note');
      const delBtn = document.getElementById('aa-sheet-del');
      if (s && s.amount > 0) {
        owedEl.value = s.amount;
        noteEl.value = s.note || '';
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
        showToast((_aaDir === 'owe-me' ? '别人欠我的' : '我欠别人的') + '要在 0 ~ ¥' + total.toFixed(2) + ' 之间');
        return;
      }
      const note = document.getElementById('aa-note').value.trim();
      e.split = { dir: _aaDir, amount: +owed.toFixed(2), note, settled: false };
      saveRec(getDate(), entries);
      closeAaSheet();
      renderList();
      showToast(_aaDir === 'owe-me'
        ? '已记下：别人欠你 ¥' + e.split.amount.toFixed(2)
        : '已记下：你欠别人 ¥' + e.split.amount.toFixed(2));
    }
    function clearAaSplit() {
      const e = entries[_aaEditIndex];
      if (e) { delete e.split; saveRec(getDate(), entries); }
      closeAaSheet();
      renderList();
      showToast('已取消平摊标记');
    }
    function closeAaSheet() {
      document.getElementById('aa-sheet-mask').classList.remove('show');
      _aaEditIndex = -1;
    }

    // ── 点一条账后的操作菜单（编辑 / 平摊 / 删除）──
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
      if (aaBtn) aaBtn.style.display = isInc ? 'none' : '';   // 收入没有“平摊”
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

    // ── 首页横幅（有未结清的平摊时显示，双向）──
    function renderHomeOwe() {
      const banner = document.getElementById('home-owe-banner');
      if (!banner) return;
      const owe = collectOwed().reduce((s, x) => s + x.owed, 0);
      const ipay = collectIPay().reduce((s, x) => s + x.owed, 0);
      if (owe > 0 || ipay > 0) {
        banner.style.display = 'flex';
        const parts = [];
        if (owe > 0) parts.push('别人还欠你 <b>¥' + owe.toFixed(2) + '</b>');
        if (ipay > 0) parts.push('你欠别人 <b>¥' + ipay.toFixed(2) + '</b>');
        document.getElementById('home-owe-sum').innerHTML = parts.join(' · ');
      } else {
        banner.style.display = 'none';
      }
    }
    function gotoOwed() {
      switchPage('stats');
      setTimeout(() => {
        const hasOwe = collectOwed().length > 0;
        if (typeof statsScrollTo === 'function') statsScrollTo(hasOwe ? 'owed-card' : 'ipay-card');
      }, 120);
    }

    // ── 统计页“别人欠我”清单（owe-me）──
    function collectOwed() {
      const all = loadRec(), out = [];
      Object.keys(all).forEach(dk => (all[dk] || []).forEach(e => {
        const s = normSplit(e.split);
        if (e.type !== 'income' && s && s.dir === 'owe-me' && s.amount > 0 && !s.settled) {
          out.push({
            dk, ts: e.ts,
            desc: e.desc || (SPEND_LBL[e.spendKey] || '消费'),
            owed: s.amount, note: s.note || ''
          });
        }
      }));
      return out.sort((a, b) => (a.dk < b.dk ? 1 : -1));
    }
    function renderOwed() {
      const card = document.getElementById('owed-card');
      if (!card) return;
      const list = collectOwed();
      if (!list.length) { card.style.display = 'none'; document.getElementById('owed-sum').textContent = ''; return; }
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
        </div>`).join('');
    }
    function settleOwed(dk, ts) {
      const all = loadRec();
      const e = (all[dk] || []).find(x => x.ts === ts);
      if (!e || !e.split) return;
      const s = normSplit(e.split);
      const amt = s.amount;
      e.split = { ...s, settled: true };
      const tk = todayKey();
      const todayEnts = all[tk] || [];
      todayEnts.push({
        ts: Date.now(), type: 'income', amount: amt,
        srcKey: 'transfer', desc: '代付收回' + (s.note ? '·' + s.note : '')
      });
      all[tk] = todayEnts;
      localStorage.setItem(SK, JSON.stringify(all));
      if (typeof loadDateEntries === 'function') loadDateEntries();
      renderOwed(); renderIPay(); renderHomeOwe();
      if (typeof curM !== 'undefined') renderMS(curM, allMonths());
      showToast('已收回 ¥' + amt.toFixed(2) + '，已记入今日收入');
    }

    // ── 统计页“我应付”清单（i-owe，对称实现）──
    function collectIPay() {
      const all = loadRec(), out = [];
      Object.keys(all).forEach(dk => (all[dk] || []).forEach(e => {
        const s = normSplit(e.split);
        if (e.type !== 'income' && s && s.dir === 'i-owe' && s.amount > 0 && !s.settled) {
          out.push({
            dk, ts: e.ts,
            desc: e.desc || (SPEND_LBL[e.spendKey] || '消费'),
            owed: s.amount, note: s.note || ''
          });
        }
      }));
      return out.sort((a, b) => (a.dk < b.dk ? 1 : -1));
    }
    function renderIPay() {
      const card = document.getElementById('ipay-card');
      if (!card) return;
      const list = collectIPay();
      if (!list.length) { card.style.display = 'none'; document.getElementById('ipay-sum').textContent = ''; return; }
      card.style.display = 'block';
      const sum = list.reduce((s, x) => s + x.owed, 0);
      document.getElementById('ipay-sum').textContent = '共 ¥' + sum.toFixed(2);
      document.getElementById('ipay-list').innerHTML = list.map(x =>
        `<div class="owed-row">
          <div class="owed-meta">
            <div class="owed-desc">${x.desc}${x.note ? ' · ' + x.note : ''}</div>
            <div class="owed-date">${x.dk.slice(5).replace('-', '月')}日欠</div>
          </div>
          <div class="owed-amt">¥${x.owed.toFixed(2)}</div>
          <button class="ipay-settle" onclick='settleIPay(${JSON.stringify(x.dk)},${x.ts})'>已还清</button>
        </div>`).join('');
    }
    function settleIPay(dk, ts) {
      const all = loadRec();
      const e = (all[dk] || []).find(x => x.ts === ts);
      if (!e || !e.split) return;
      const s = normSplit(e.split);
      const amt = s.amount;
      e.split = { ...s, settled: true };
      const tk = todayKey();
      const todayEnts = all[tk] || [];
      todayEnts.push({
        ts: Date.now(), type: 'expense', amount: amt,
        spendKey: 'other', bigCat: '其他',
        desc: '还钱' + (s.note ? '·' + s.note : ''), note: ''
      });
      all[tk] = todayEnts;
      localStorage.setItem(SK, JSON.stringify(all));
      if (typeof loadDateEntries === 'function') loadDateEntries();
      renderOwed(); renderIPay(); renderHomeOwe();
      if (typeof curM !== 'undefined') renderMS(curM, allMonths());
      showToast('已还清 ¥' + amt.toFixed(2) + '，已记入今日支出');
    }
