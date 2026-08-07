    // ════════════════════════════════════════════════════════════════
    // 14-selftest.js —— 在真机/浏览器用真实代码验证“编辑→保存→统计”
    // 以及“AA 平摊(split)在再次编辑后是否保留”两个核心修复。
    //
    // 触发方式（二选一）：
    //   ① 打开页面时 URL 带 #selftest  例： index.html#selftest
    //   ② 打开页面时 URL 带 ?selftest=1
    //
    // 全程不破坏真实数据：开始前备份整份记录，结束后原样还原。
    // ════════════════════════════════════════════════════════════════

    function _stNum(t) { const m = String(t || '').replace(/[^\d.]/g, ''); return parseFloat(m) || 0; }

    function runSelfTest() {
      const SK = 'budget_records_v2';
      const backup = localStorage.getItem(SK);            // ① 备份
      const results = [];
      const log = (name, pass, detail) => results.push({ name, pass, detail });

      try {
        // 确保日期选择器停在今天，并清空可能残留的编辑态
        if (typeof setToday === 'function') setToday();
        else { const dp = document.getElementById('record-date'); if (dp) dp.value = todayKey(); if (typeof loadDateEntries === 'function') loadDateEntries(); }

        const tk = todayKey();
        const mk = mKey(tk);

        // 记录“真实基线”（不依赖渲染）：本月现有支出合计 / 现有未收回代付
        const baseRec = loadRec();
        let realTotal0 = 0, realOwed0 = 0;
        Object.keys(baseRec).forEach(dk => {
          if (mKey(dk) !== mk) return;
          (baseRec[dk] || []).forEach(e => {
            if (e.type !== 'income') realTotal0 += (+e.amount || 0);
            const _bs = (typeof normSplit === 'function') ? normSplit(e.split) : (e.split || null);
            if (e.type !== 'income' && _bs && _bs.amount > 0 && !_bs.settled) realOwed0 += _bs.amount;
          });
        });

        // 在非破坏前提下塞一条测试支出（金额 50），放到今天末尾
        const all = loadRec();
        const todayArr = (all[tk] && Array.isArray(all[tk])) ? all[tk] : [];
        const testIdx = todayArr.length;                 // 测试条目将位于此索引
        const testEntry = {
          ts: Date.now(), type: 'expense', amount: 50,
          spendKey: 'dinner', bigCat: '餐饮', desc: '🔧自检-测试餐', place: '', note: ''
        };
        todayArr.push(testEntry);
        saveRec(tk, todayArr);
        if (typeof loadDateEntries === 'function') loadDateEntries();

        // ── 测试 1：编辑金额 50 → 999，统计应同步 ──
        if (typeof editEntry !== 'function') throw new Error('editEntry 不存在');
        editEntry(testIdx);
        document.getElementById('amount-input').value = '999';
        document.getElementById('add-btn').click();

        const afterEditStored = loadRec()[tk][testIdx];
        const amtOk = afterEditStored && afterEditStored.amount === 999;
        // 渲染侧：切统计页，读本月合计
        if (typeof switchPage === 'function') switchPage('stats');
        const qMonthTxt = document.getElementById('q-month') ? document.getElementById('q-month').textContent : '(无q-month)';
        const qMonthNum = _stNum(qMonthTxt);
        const renderOk = Math.abs(qMonthNum - (realTotal0 + 999)) < 0.01;
        log('① 编辑金额→统计同步', amtOk && renderOk,
          `存储金额=${afterEditStored ? afterEditStored.amount : '?'}；统计本月="${qMonthTxt}"（基线+999=${(realTotal0 + 999).toFixed(2)}）`);

        // ── 测试 2：标记 AA“别人欠我 30”，统计“别人欠我”卡片应出现 ──
        if (typeof switchPage === 'function') switchPage('record');
        if (typeof openAaSheet !== 'function') throw new Error('openAaSheet 不存在');
        openAaSheet(testIdx);
        document.getElementById('aa-owed-input').value = '30';
        if (typeof saveAaSheet === 'function') saveAaSheet();
        const splitStored = loadRec()[tk][testIdx].split;
        const splitOk = splitStored && splitStored.dir === 'owe-me' && splitStored.amount === 30;
        if (typeof switchPage === 'function') switchPage('stats');
        const owedTxt = document.getElementById('owed-sum') ? document.getElementById('owed-sum').textContent : '(无owed-sum)';
        const owedNum = _stNum(owedTxt);
        const owedRenderOk = owedNum >= 30;              // 至少含本测试的 30
        log('② AA标记→统计“别人欠我”显示', splitOk && owedRenderOk,
          `存储dir=${splitStored ? splitStored.dir : '?'} amount=${splitStored ? splitStored.amount : '?'}；卡片="${owedTxt}"`);

        // ── 测试 3（核心修复点）：再次编辑该条，split 必须保留 ──
        if (typeof switchPage === 'function') switchPage('record');
        if (typeof editEntry === 'function') editEntry(testIdx);
        document.getElementById('amount-input').value = '888';
        document.getElementById('add-btn').click();
        const afterReedit = loadRec()[tk][testIdx];
        const splitKept = !!(afterReedit.split && afterReedit.split.dir === 'owe-me' && afterReedit.split.amount === 30);
        if (typeof switchPage === 'function') switchPage('stats');
        const owedAfter = document.getElementById('owed-sum') ? document.getElementById('owed-sum').textContent : '';
        const owedKeptOk = _stNum(owedAfter) >= 30;
        log('③ 再次编辑后 split 保留（AA修复）', splitKept && owedKeptOk,
          `再次编辑后 dir=${afterReedit.split ? afterReedit.split.dir : '（丢失!）'} amount=${afterReedit.split ? afterReedit.split.amount : '?'}；卡片="${owedAfter}"`);

        // 顺带验证：金额 888 也进了统计
        if (typeof switchPage === 'function') switchPage('stats');
        const qm2 = _stNum(document.getElementById('q-month') ? document.getElementById('q-month').textContent : '');
        log('④ 再编辑金额→统计同步', Math.abs(qm2 - (realTotal0 + 888)) < 0.01,
          `统计本月="${document.getElementById('q-month') ? document.getElementById('q-month').textContent : ''}"（基线+888=${(realTotal0 + 888).toFixed(2)}）`);

        // ── 测试 5（双向 B）：标记“我欠别人 40”，统计“我应付”卡片应出现 ──
        if (typeof switchPage === 'function') switchPage('record');
        if (typeof openAaSheet === 'function') openAaSheet(testIdx);
        if (typeof setAaDir === 'function') setAaDir('i-owe');
        document.getElementById('aa-owed-input').value = '40';
        if (typeof saveAaSheet === 'function') saveAaSheet();
        const ipayStored = loadRec()[tk][testIdx].split;
        const ipayOk = ipayStored && ipayStored.dir === 'i-owe' && ipayStored.amount === 40;
        if (typeof switchPage === 'function') switchPage('stats');
        const ipayTxt = document.getElementById('ipay-sum') ? document.getElementById('ipay-sum').textContent : '';
        const ipayRenderOk = _stNum(ipayTxt) >= 40;
        log('⑤ 我欠别人→统计“我应付”显示', ipayOk && ipayRenderOk,
          `存储dir=${ipayStored ? ipayStored.dir : '?'} amount=${ipayStored ? ipayStored.amount : '?'}；卡片="${ipayTxt}"`);

        // ── 测试 6：再次编辑该条，i-owe 的 dir+amount 必须保留 ──
        if (typeof switchPage === 'function') switchPage('record');
        if (typeof editEntry === 'function') editEntry(testIdx);
        document.getElementById('amount-input').value = '777';
        document.getElementById('add-btn').click();
        const afterIPayReedit = loadRec()[tk][testIdx];
        const ipayKept = !!(afterIPayReedit.split && afterIPayReedit.split.dir === 'i-owe' && afterIPayReedit.split.amount === 40);
        if (typeof switchPage === 'function') switchPage('stats');
        const ipayAfter = document.getElementById('ipay-sum') ? document.getElementById('ipay-sum').textContent : '';
        const ipayKeptOk = _stNum(ipayAfter) >= 40;
        log('⑥ 再次编辑后 i-owe 保留（双向修复）', ipayKept && ipayKeptOk,
          `再编辑后 dir=${afterIPayReedit.split ? afterIPayReedit.split.dir : '（丢失!）'} amount=${afterIPayReedit.split ? afterIPayReedit.split.amount : '?'}；卡片="${ipayAfter}"`);

        // ── 测试 7：结清“我欠别人”→ 自动记一笔支出 ──
        if (typeof settleIPay === 'function') {
          settleIPay(tk, afterIPayReedit.ts);
          const repaid = (loadRec()[tk] || []).find(e => e.type === 'expense' && e.desc && e.desc.indexOf('还钱') >= 0 && e.amount === 40);
          const ipayCard = document.getElementById('ipay-card');
          const ipayGone = ipayCard && ipayCard.style.display === 'none';
          log('⑦ 结清我欠别人→记支出', !!repaid && ipayGone,
            `今日还款=${repaid ? '¥40（还钱）' : '未找到'}；结清后“我应付”卡片${ipayGone ? '已隐藏（结清）' : '仍显示'}`);
        }

      } catch (err) {
        log('⚠ 自检过程异常', false, String(err && err.message ? err.message : err));
      } finally {
        // ② 还原真实数据
        if (backup === null) localStorage.removeItem(SK);
        else localStorage.setItem(SK, backup);
        if (typeof closeAaSheet === 'function') closeAaSheet();
        if (typeof loadDateEntries === 'function') loadDateEntries();
        if (typeof switchPage === 'function') switchPage('record');
        if (typeof renderStats === 'function') renderStats();
      }

      _stShowPanel(results);
    }

    function _stShowPanel(results) {
      const allPass = results.every(r => r.pass);
      const panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(20,22,28,.92);color:#fff;' +
        'font:14px/1.6 -apple-system,system-ui,sans-serif;padding:22px;overflow:auto;box-sizing:border-box';
      const rows = results.map(r =>
        `<div style="margin:10px 0;padding:12px;border-radius:10px;background:${r.pass ? 'rgba(46,160,67,.18)' : 'rgba(220,53,69,.18)'};border:1px solid ${r.pass ? '#2ea043' : '#dc3545'}">
          <div style="font-weight:700">${r.pass ? '✓ PASS' : '✗ FAIL'} · ${r.name}</div>
          <div style="opacity:.9;margin-top:4px">${r.detail}</div>
        </div>`).join('');
      const summary = allPass
        ? '<div style="font-size:18px;font-weight:800;color:#5dd879;margin-bottom:6px">🎉 全部通过：当前运行的包已包含修复</div>'
        : '<div style="font-size:18px;font-weight:800;color:#ff7b7b;margin-bottom:6px">⚠ 存在未通过项：当前包可能仍是旧版</div>';
      panel.innerHTML = `
        <div style="max-width:560px;margin:0 auto">
          <div style="font-size:20px;font-weight:800;margin-bottom:2px">记账 App 自检报告</div>
          <div style="opacity:.7;margin-bottom:14px">触发：URL 带 #selftest / ?selftest=1（真实数据已自动还原）</div>
          ${summary}${rows}
          <button onclick="this.parentNode.parentNode.remove()" style="margin-top:16px;width:100%;padding:12px;border:0;border-radius:10px;background:#3b82f6;color:#fff;font-size:15px;font-weight:700">关闭</button>
        </div>`;
      document.body.appendChild(panel);
    }

    function _stMaybeRun() {
      const h = location.hash || '';
      const q = location.search || '';
      if (h.indexOf('selftest') >= 0 || /[?&]selftest=1/.test(q)) {
        setTimeout(runSelfTest, 500);   // 等 App 初始化完成
      }
    }
    window.addEventListener('load', _stMaybeRun);
