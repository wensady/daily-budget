    // ══ 存储（兼容旧key）══
    const SK = 'budget_records_v2';
    let _statExpEnts = [], _statTopCat = null, _statTopEntryDate = null, _statTopPlace = null, _trendPoints = [];
    function loadRec() { try { return JSON.parse(localStorage.getItem(SK)) || {}; } catch (e) { return {}; } }
    function saveRec(dk, entries) { const a = loadRec(); a[dk] = entries; localStorage.setItem(SK, JSON.stringify(a)); }
    function todayKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function mKey(s) { return s.slice(0, 7); }
    function fmtDay(k) { const p = k.split('-'); return p[1] + '月' + p[2] + '日'; }
    function fmtMonth(ym) { const p = ym.split('-'); return p[0] + '年' + p[1] + '月'; }

    // ══ 页面切换 ══
    function switchPage(name) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
      document.getElementById('page-' + name).classList.add('active');
      document.querySelectorAll('.nb')[{record:0,stats:1}[name]].classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (name === 'stats') renderStats();
    }

    // ══ 日期 ══
    const dp = document.getElementById('record-date');
    dp.value = todayKey();
    function setToday() { dp.value = todayKey(); loadDateEntries(); }
    function getDate() { return dp.value || todayKey(); }
    dp.addEventListener('change', loadDateEntries);

    // ══ 折叠 ══
    function toggleMore(btn, id) {
      const el = document.getElementById(id);
      const open = el.classList.toggle('open');
      btn.textContent = open ? '收起 ▴' : '更多 ▾';
    }
