    // ══ 搜索 / 筛选 ══
    let _searchOpen = false, _searchCatFilter = null;
    function toggleSearch() {
      _searchOpen = !_searchOpen;
      document.getElementById('search-section').classList.toggle('open', _searchOpen);
      document.getElementById('search-pill').classList.toggle('srch-on', _searchOpen);
      if (_searchOpen) {
        buildSearchFilters();
        doSearch();
        setTimeout(function(){ var el=document.getElementById('search-input'); if(el) el.focus(); }, 150);
      } else {
        var inp = document.getElementById('search-input');
        if (inp) inp.value = '';
        _searchCatFilter = null;
        clearSearchSelection();
      }
    }
    function buildSearchFilters() {
      var allCats = {};
      monthEnts(curM).forEach(function(e) {
        if (e.type !== 'income' && e.bigCat) allCats[e.bigCat] = 1;
      });
      var cats = Object.keys(allCats).sort();
      var row = document.getElementById('search-filter-row');
      if (!row) return;
      row.innerHTML = ['全部'].concat(cats).map(function(c) {
        var isAll = c === '全部';
        var on = isAll ? !_searchCatFilter : _searchCatFilter === c;
        var val = isAll ? 'null' : ("'" + c + "'");
        return '<button class="search-ftag' + (on ? ' on' : '') + '" onclick="setSearchCat(' + val + ')">' + c + '</button>';
      }).join('');
    }
    function setSearchCat(cat) { _searchCatFilter = cat; buildSearchFilters(); clearSearchSelection(); doSearch(); }
    function clearSearchInput() {
      var inp = document.getElementById('search-input');
      if (inp) inp.value = '';
      clearSearchSelection();
      doSearch();
    }

    // ══ 搜索多选功能 ══
    // 用时间戳(ts)作key存储已选条目，value为金额
    var _searchSelectedMap = {};

    // 清空多选状态并隐藏统计条
    function clearSearchSelection() {
      _searchSelectedMap = {};
      updateSearchSummary();
    }

    // 切换某条目的选中状态（由条目行点击触发）
    function toggleSearchItem(ts, amount) {
      if (_searchSelectedMap.hasOwnProperty(ts)) {
        delete _searchSelectedMap[ts];
      } else {
        _searchSelectedMap[ts] = amount;
      }
      // 更新该行 DOM 的 selected 类
      var el = document.querySelector('.search-item[data-ts="' + ts + '"]');
      if (el) el.classList.toggle('selected', _searchSelectedMap.hasOwnProperty(ts));
      updateSearchSummary();
    }

    // 计算已选条目的件数和金额合计，更新并控制统计条显隐
    function updateSearchSummary() {
      var keys = Object.keys(_searchSelectedMap);
      var count = keys.length;
      var total = keys.reduce(function(s, k) { return s + _searchSelectedMap[k]; }, 0);
      var bar = document.getElementById('search-summary');
      if (!bar) return;
      if (count === 0) {
        bar.style.display = 'none';
      } else {
        bar.style.display = 'flex';
        document.getElementById('search-sel-count').textContent = count;
        document.getElementById('search-sel-total').textContent = '¥' + total.toFixed(2);
      }
    }
    function doSearch() {
      var inp = document.getElementById('search-input');
      var q = inp ? inp.value.trim().toLowerCase() : '';
      var hintEl = document.getElementById('search-hint');
      var resEl = document.getElementById('search-results');
      if (!hintEl || !resEl) return;
      if (!q && !_searchCatFilter) {
        hintEl.innerHTML = '输入关键词或选择分类来搜索';
        resEl.innerHTML = '';
        clearSearchSelection();
        return;
      }
      var ents = monthEnts(curM).filter(function(e) { return e.type !== 'income'; }).reverse();
      if (_searchCatFilter) ents = ents.filter(function(e) { return e.bigCat === _searchCatFilter; });
      if (q) {
        ents = ents.filter(function(e) {
          return [e.desc||'', e.place||'', e.shopName||'', e.bigCat||''].some(function(s){ return s.toLowerCase().indexOf(q) >= 0; });
        });
      }
      var total = ents.length, show = ents.slice(0, 40);
      if (!total) { hintEl.innerHTML = '本月没有找到匹配的记录'; resEl.innerHTML = ''; clearSearchSelection(); return; }
      hintEl.innerHTML = '本月找到 <strong>' + total + '</strong> 条' + (total > 40 ? '，显示前40条' : '') + ' · 点击条目可勾选统计';
      function hl(text) {
        if (!q || !text) return text || '';
        var idx = text.toLowerCase().indexOf(q);
        if (idx < 0) return text;
        return text.slice(0,idx) + '<span class="search-hl">' + text.slice(idx, idx+q.length) + '</span>' + text.slice(idx+q.length);
      }
      resEl.innerHTML = show.map(function(e) {
        var mo = parseInt(e.date.slice(5,7), 10);
        var dy = parseInt(e.date.slice(8,10), 10);
        var dateStr = mo + '月' + dy + '日';
        var cc = CAT_COLORS[e.bigCat] || '#6c5ce7';
        var descHl = hl(e.desc || SPEND_LBL[e.spendKey] || '消费');
        var plStr = [e.place, e.shopName].filter(Boolean).join(' · ');
        var plHl = plStr ? '📍 ' + hl(plStr) : '';
        // 使用 ts 作为唯一标识，若无 ts 则用日期+金额组合作为回退键
        var tsKey = e.ts ? String(e.ts) : (e.date + '_' + e.amount);
        var isSel = _searchSelectedMap.hasOwnProperty(tsKey);
        return '<div class="search-item' + (isSel ? ' selected' : '') + '" data-ts="' + tsKey + '" onclick="toggleSearchItem(\'' + tsKey + '\',' + e.amount + ')">'  
          + '<div class="search-check"></div>'
          + '<div style="flex-shrink:0;text-align:right;min-width:36px">'
          + '<div style="font-size:10px;color:var(--ink3)">' + dateStr + '</div>'
          + '<div style="font-size:9px;background:' + cc + '22;color:' + cc + ';border-radius:4px;padding:1px 4px;margin-top:2px;font-weight:600;white-space:nowrap">' + (e.bigCat||'其他') + '</div>'
          + '</div>'
          + '<div class="search-item-meta">'
          + '<div class="search-item-desc">' + descHl + '</div>'
          + (plHl ? '<div class="search-item-sub">' + plHl + '</div>' : '')
          + '</div>'
          + '<span class="search-item-amt">¥' + e.amount.toFixed(2) + '</span>'
          + '</div>';
      }).join('');
    }

    // ══ 年度概览 ══
    function renderYearOverview(ym) {
      var year = ym.slice(0,4), curMo = ym.slice(5,7);
      var all = loadRec(), data = {};
      Object.keys(all).forEach(function(dk) {
        if (dk.slice(0,4) === year) {
          var m = dk.slice(5,7);
          data[m] = (data[m]||0) + (all[dk]||[]).filter(function(e){ return e.type !== 'income'; }).reduce(function(s,e){ return s+e.amount; }, 0);
        }
      });
      var months = Object.keys(data).filter(function(m){ return data[m]>0; });
      var sec = document.getElementById('stats-year-overview');
      if (!sec) return;
      if (!months.length) { sec.style.display='none'; return; }
      sec.style.display = '';
      document.getElementById('year-overview-lbl').textContent = year + '年';
      var maxVal = Math.max.apply(null, Object.values(data));
      var yearTotal = Object.values(data).reduce(function(s,v){ return s+v; }, 0);
      var yearAvg = months.length > 0 ? yearTotal / months.length : 0;
      var curMoInt = parseInt(curMo, 10);
      var rows = '';
      for (var i = 1; i <= 12; i++) {
        var m = (i < 10 ? '0' : '') + i;
        var amt = data[m] || 0;
        var isCur = m === curMo;
        if (!isCur && i > curMoInt && amt === 0) continue;
        var pct = maxVal > 0 ? (amt / maxVal * 100).toFixed(1) : 0;
        var curTag = isCur ? '<span class="yr-cur-tag">本月</span>' : '';
        var amtStr = amt > 0 ? '¥' + amt.toFixed(0) : '—';
        rows += '<div class="yr-row' + (isCur?' cur':'') + '">'
          + '<div class="yr-lbl">' + i + '月</div>'
          + '<div class="yr-track"><div class="yr-fill" style="width:' + pct + '%"></div></div>'
          + '<div class="yr-amt">' + amtStr + '</div>'
          + curTag
          + '</div>';
      }
      document.getElementById('year-overview-bars').innerHTML = rows;
      document.getElementById('year-overview-footer').innerHTML =
        '<div class="ystat"><div class="ystat-val">¥' + yearTotal.toFixed(0) + '</div><div class="ystat-lbl">年度合计</div></div>'
        + '<div class="ystat"><div class="ystat-val">¥' + yearAvg.toFixed(0) + '</div><div class="ystat-lbl">月均支出</div></div>'
        + '<div class="ystat"><div class="ystat-val">' + months.length + '</div><div class="ystat-lbl">已记月数</div></div>';
    }
