    // ══ 统计 ══
    let curM = mKey(todayKey());
    function allMonths() { const s = new Set(); Object.keys(loadRec()).forEach(k => s.add(mKey(k))); return Array.from(s).sort().reverse(); }
    function monthEnts(ym) { const a = loadRec(), r = []; Object.keys(a).filter(k => mKey(k) === ym).sort().forEach(k => (a[k] || []).forEach(e => r.push({ ...e, date: k }))); return r; }

    function renderStats() {
      updateBackupStatus();
      const months = allMonths();
      const tw = document.getElementById('month-tabs-wrap');
      if (!months.length) {
        tw.innerHTML = '';
        document.getElementById('cat-wrap').innerHTML = '<div class="sempty">还没有记录，快去记第一笔吧</div>';
        document.getElementById('trend-card').style.display = 'none';
        document.getElementById('month-list-wrap').innerHTML = '';
        document.getElementById('q-today').textContent = '¥0';
        document.getElementById('q-month').textContent = '¥0';
        document.getElementById('q-avg').textContent = '¥0';
        document.getElementById('q-days').textContent = '';
        buildCalendar();
        return;
      }
      if (!months.includes(curM)) curM = months[0];
      tw.innerHTML = months.map(m => `<button class="mtab ${m === curM ? 'active' : ''}" onclick="selM('${m}')">${fmtMonth(m)}</button>`).join('');
      renderMS(curM, months);
    }
    function selM(ym) {
      curM = ym;
      calSelected = null;
      if (_searchOpen) {
        _searchOpen = false;
        document.getElementById('search-section').classList.remove('open');
        document.getElementById('search-pill').classList.remove('srch-on');
        var inp = document.getElementById('search-input');
        if (inp) inp.value = '';
        _searchCatFilter = null;
      }
      document.querySelectorAll('.mtab').forEach(t => t.classList.toggle('active', t.textContent === fmtMonth(ym)));
      renderMS(ym, allMonths());
    }

    function renderMS(ym, months) {
      const ents = monthEnts(ym);
      // 收入/支出分离（旧数据 type 为空视为支出）
      const expEnts = ents.filter(e => e.type !== 'income');
      _statExpEnts = expEnts;
      renderOwed();
      const incEnts = ents.filter(e => e.type === 'income');
      const tot    = expEnts.reduce((s, e) => s + e.amount, 0);
      const incTot = incEnts.reduce((s, e) => s + e.amount, 0);
      const dayKeys = [...new Set(expEnts.map(e => e.date))].sort();
      const daysRecorded = dayKeys.length;

      // ── 封面 + 快速概览 ──
      const tk = todayKey();
      const todayAll = loadRec()[tk] || [];
      const todayTot = todayAll.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
      document.getElementById('q-today').textContent = '¥' + todayTot.toFixed(0);
      document.getElementById('q-month').textContent = '¥' + tot.toFixed(0);
      const avg = daysRecorded > 0 ? tot / daysRecorded : 0;
      document.getElementById('q-avg').textContent = '¥' + avg.toFixed(0);
      document.getElementById('q-days').textContent = daysRecorded + '天';
      // 封面收入（有才显示）
      const ci = document.getElementById('cover-income');
      const qi = document.getElementById('q-income');
      if (ci && qi) {
        ci.style.display = incTot > 0 ? '' : 'none';
        qi.textContent = '¥' + incTot.toFixed(0);
      }
      // 封面副标题
      const coverSub = document.getElementById('cover-sub');
      if (coverSub) coverSub.textContent = daysRecorded > 0 ? fmtMonth(ym) + ' · 已记 ' + daysRecorded + ' 天' : fmtMonth(ym);
      const coverLbl = document.getElementById('q-month-lbl');
      if (coverLbl) coverLbl.textContent = '本月支出';

      // ── 同步日历到当前选中月 ──
      calYear = parseInt(ym.split('-')[0]);
      calMonth = parseInt(ym.split('-')[1]) - 1;
      buildCalendar();
      buildMonthList();
      if (calSelected && typeof selectCalDay === 'function') {
        selectCalDay(calSelected);
      } else {
        const detailEl = document.getElementById('cal-detail');
        if (detailEl) detailEl.style.display = 'none';
      }

      // ── 圆环图（仅支出构成）──
      const catT = {}; expEnts.forEach(e => { catT[e.bigCat] = (catT[e.bigCat] || 0) + e.amount; });
      if (!tot) { document.getElementById('cat-wrap').innerHTML = '<div class="sempty">本月暂无数据</div>'; }
      else { drawDonut(Object.entries(catT).sort((a, b) => b[1] - a[1]), tot); }

      // ── 趋势折线（≥2天才显示）──
      const tc = document.getElementById('trend-card');
      if (daysRecorded >= 2) {
        tc.style.display = 'block';
        document.getElementById('trend-area').innerHTML = '<div class="cwrap"><canvas id="daily-chart"></canvas></div>';
        document.getElementById('ctip').textContent = '';
        setTimeout(() => drawCurve(ym), 30);
      } else {
        tc.style.display = 'none';
      }

      // ── 消费洞察 ──
      const insightCard = document.getElementById('insight-card');
      if (tot > 0) {
        insightCard.style.display = 'block';
        // 最高类别
        const catSorted = Object.entries(catT).sort((a,b)=>b[1]-a[1]);
        const topCat = catSorted[0];
        const topCatPct = Math.round(topCat[1]/tot*100);
        // 最高单笔（仅支出）
        const topEntry = expEnts.reduce((a,b)=>a.amount>b.amount?a:b, expEnts[0]);
        // 最常去地点（仅支出）
        const placeCnt = {};
        expEnts.forEach(e=>{ if(e.place){ placeCnt[e.place]=(placeCnt[e.place]||0)+1; } });
        const topPlace = Object.entries(placeCnt).sort((a,b)=>b[1]-a[1])[0];
        // 日均
        const avgPerDay = daysRecorded>0 ? (tot/daysRecorded) : 0;
        _statTopCat = topCat[0];
        _statTopEntryDate = topEntry.date;
        _statTopPlace = topPlace ? topPlace[0] : null;
        document.getElementById('insight-grid').innerHTML = `
          <div class="insight-box" onclick="showCatDetail('${topCat[0]}')" style="cursor:pointer">
            <div class="insight-lbl">🏆 最多消费类别</div>
            <div class="insight-val">${topCat[0]}</div>
            <div class="insight-sub">占 ${topCatPct}%，¥${topCat[1].toFixed(0)}</div>
          </div>
          <div class="insight-box" onclick="showDayDetail('${topEntry.date}')" style="cursor:pointer">
            <div class="insight-lbl">💸 最高单笔</div>
            <div class="insight-val">¥${topEntry.amount.toFixed(2)}</div>
            <div class="insight-sub">${topEntry.desc||topEntry.bigCat||'消费'}</div>
          </div>
          <div class="insight-box" ${topPlace ? 'onclick="if(_statTopPlace)showPlaceDetail(_statTopPlace)" style="cursor:pointer"' : ''}>
            <div class="insight-lbl">📍 最常去地点</div>
            <div class="insight-val">${topPlace?topPlace[0]:'—'}</div>
            <div class="insight-sub">${topPlace?topPlace[1]+'次':''}</div>
          </div>
          <div class="insight-box">
            <div class="insight-lbl">📅 日均支出</div>
            <div class="insight-val">¥${avgPerDay.toFixed(0)}</div>
            <div class="insight-sub">共记 ${daysRecorded} 天</div>
          </div>`;
      } else {
        insightCard.style.display = 'none';
      }

      // ── 月度对比 ──
      const prev = months[months.indexOf(ym) + 1];
      const cmp = document.getElementById('month-cmp');
      if (!prev) { cmp.innerHTML = '<div style="font-size:13px;color:var(--ink3)">暂无上月数据</div>'; renderYearOverview(ym); return; }
      const prevEnts = monthEnts(prev);
      const prevTot = prevEnts.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
      const prevInc = prevEnts.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const diff = tot - prevTot;
      const color = diff > 0 ? '#e74c3c' : '#27ae60';
      const pct = prevTot > 0 ? Math.round(Math.abs(diff) / prevTot * 100) : 0;
      const incRow = (incTot > 0 || prevInc > 0) ? `
        <div class="cmp-income-row">
          <div class="cmp-income-box"><div class="cmp-income-lbl">${fmtMonth(ym)} 收入</div><div class="cmp-income-val">¥${incTot.toFixed(0)}</div></div>
          <div class="cmp-income-box"><div class="cmp-income-lbl">${fmtMonth(prev)} 收入</div><div class="cmp-income-val">¥${prevInc.toFixed(0)}</div></div>
        </div>` : '';
      cmp.innerHTML = `<div class="cmp-row">
    <div class="cmp-box"><div class="cmp-lbl">${fmtMonth(ym)} 支出</div><div class="cmp-val">¥${tot.toFixed(0)}</div></div>
    <div class="cmp-box"><div class="cmp-lbl">${fmtMonth(prev)} 支出</div><div class="cmp-val">¥${prevTot.toFixed(0)}</div></div>
  </div>
  <div class="cmp-diff" style="color:${color}">${diff > 0 ? '↑' : '↓'} 比上月${diff > 0 ? '多' : '少'}花了 ¥${Math.abs(diff).toFixed(0)}${pct > 0 ? '（' + pct + '%）' : ''}</div>
  ${incRow}`;
      renderYearOverview(ym);
    }

    function drawCurve(ym) {
      const all = loadRec();
      const days = Object.keys(all).filter(k => mKey(k) === ym).sort();
      const cv = document.getElementById('daily-chart'); if (!cv) return;
      const W = cv.parentElement.offsetWidth || 320, H = 140;
      const dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
      const vals = days.map(k => (all[k] || []).filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0));
      const maxV = Math.max(...vals, 1);
      const pad = { l: 42, r: 14, t: 14, b: 30 };
      const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
      const xP = i => days.length < 2 ? pad.l + cW / 2 : pad.l + (i / (vals.length - 1)) * cW;
      const yP = v => pad.t + (1 - v / maxV) * cH;
      // 网格
      ctx.strokeStyle = '#f0ede8'; ctx.lineWidth = 1;
      [.25, .5, .75, 1].forEach(f => {
        const y = pad.t + (1 - f) * cH;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.fillStyle = '#c0bcb8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('¥' + (maxV * f).toFixed(0), pad.l - 4, y + 3);
      });
      if (vals.length >= 2) {
        // 渐变填充
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
        grad.addColorStop(0, 'rgba(108,92,231,.18)'); grad.addColorStop(1, 'rgba(108,92,231,0)');
        ctx.beginPath(); ctx.moveTo(xP(0), yP(vals[0]));
        for (let i = 1; i < vals.length; i++) {
          const x0 = xP(i - 1), y0 = yP(vals[i - 1]), x1 = xP(i), y1 = yP(vals[i]);
          ctx.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1);
        }
        ctx.lineTo(xP(vals.length - 1), pad.t + cH); ctx.lineTo(xP(0), pad.t + cH);
        ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
        // 曲线
        ctx.beginPath(); ctx.moveTo(xP(0), yP(vals[0]));
        for (let i = 1; i < vals.length; i++) {
          const x0 = xP(i - 1), y0 = yP(vals[i - 1]), x1 = xP(i), y1 = yP(vals[i]);
          ctx.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1);
        }
        ctx.strokeStyle = '#6c5ce7'; ctx.lineWidth = 2.5; ctx.stroke();
      }
      // 点
      vals.forEach((v, i) => {
        ctx.beginPath(); ctx.arc(xP(i), yP(v), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#6c5ce7'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#b0acaa'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(days[i].slice(8), xP(i), H - pad.b + 12);
      });
      // 点击检测
      _trendPoints = vals.map((v, i) => ({ x: xP(i), y: yP(v), dk: days[i] }));
      cv.style.cursor = 'pointer';
      cv.onclick = evt => {
        const rect = cv.getBoundingClientRect();
        const mx = evt.clientX - rect.left;
        const my = evt.clientY - rect.top;
        let near = null, minD = 9999;
        _trendPoints.forEach(p => {
          const d = Math.hypot(p.x - mx, p.y - my);
          if (d < minD) { minD = d; near = p; }
        });
        if (near && minD < 40) showDayDetail(near.dk);
      };
    }

    function drawDonut(sorted, total) {
      const r = 50, sw = 20, cx = 68, cy = 68, sz = 136;
      const circ = 2 * Math.PI * r;
      let off = 0;
      const arcs = sorted.map(([cat, amt]) => {
        const frac = amt / total;
        const dash = frac * circ;
        const a = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${CAT_COLORS[cat]||'#b2bec3'}" stroke-width="${sw}"
          stroke-dasharray="${dash.toFixed(2)} ${(circ-dash).toFixed(2)}"
          stroke-dashoffset="${(-off).toFixed(2)}"
          transform="rotate(-90 ${cx} ${cy})"/>`;
        off += dash;
        return a;
      });
      const leg = sorted.map(([cat, amt]) => {
        const pct = Math.round(amt/total*100);
        return `<div class="donut-row" onclick="showCatDetail('${cat}')" style="cursor:pointer">
          <div class="donut-dot" style="background:${CAT_COLORS[cat]||'#b2bec3'}"></div>
          <div class="donut-name">${cat}</div>
          <div class="donut-pct">${pct}%</div>
          <div class="donut-amt">¥${amt.toFixed(0)}</div>
        </div>`;
      }).join('');
      document.getElementById('cat-wrap').innerHTML =
        `<div class="donut-wrap">
          <svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}" style="flex-shrink:0">
            ${arcs.join('')}
            <text x="${cx}" y="${cy-7}" text-anchor="middle" font-size="10" fill="#a09890">合计</text>
            <text x="${cx}" y="${cy+11}" text-anchor="middle" font-size="17" font-weight="700" fill="#2d2416">¥${total.toFixed(0)}</text>
          </svg>
          <div class="donut-leg">${leg}</div>
        </div>`;
    }

    function showCatDetail(cat) {
      const ents = _statExpEnts.filter(e => e.bigCat === cat);
      const total = ents.reduce((s, e) => s + e.amount, 0);
      showDetailModal(cat + ' · 本月明细', ents, '¥' + total.toFixed(0));
    }

    function showDayDetail(dk) {
      const all = loadRec();
      const WD = ['日','一','二','三','四','五','六'];
      const d = new Date(dk + 'T00:00:00');
      const title = dk.slice(5).replace('-','月') + '日 周' + WD[d.getDay()];
      const ents = (all[dk] || []).filter(e => e.type !== 'income').map(e => ({...e, date: dk}));
      const total = ents.reduce((s, e) => s + e.amount, 0);
      showDetailModal(title, ents, '¥' + total.toFixed(0));
    }

    function showPlaceDetail(place) {
      const ents = _statExpEnts.filter(e => e.place === place);
      const total = ents.reduce((s, e) => s + e.amount, 0);
      showDetailModal('📍 ' + place, ents, '¥' + total.toFixed(0));
    }

    function showDetailModal(title, entries, totalStr) {
      document.getElementById('detail-modal-title').textContent = title;
      document.getElementById('detail-modal-ttl').textContent = totalStr || '';
      const body = document.getElementById('detail-modal-body');
      const sorted = [...entries].sort((a, b) => b.amount - a.amount);
      if (!sorted.length) {
        body.innerHTML = '<div style="padding:2rem;text-align:center;font-size:13px;color:var(--ink3)">暂无记录</div>';
      } else {
        body.innerHTML = sorted.map(e => {
          const dateStr = e.date ? e.date.slice(5).replace('-','月') + '日' : '';
          const pl = e.place ? `<div style="font-size:11px;color:var(--ink3);margin-top:2px">📍 ${e.place}${e.shopName ? '·' + e.shopName : ''}</div>` : '';
          const rt = e.reasonText || (e.reasonKey ? REASON_LBL[e.reasonKey] : '');
          const reason = rt ? `<div style="font-size:11px;color:var(--purple);font-style:italic;margin-top:1px">${rt}</div>` : '';
          const cc = CAT_COLORS[e.bigCat] || '#6c5ce7';
          const aa = (e.split && e.split.owedToMe) ? `<div style="font-size:11px;color:#e8820c;margin-top:2px">🧮 别人欠我¥${e.split.owedToMe.toFixed(2)}${e.split.settled ? '（已收回）' : ''}</div>` : '';
          return `<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 18px;border-bottom:1px solid #f7f5f2">
            <div style="flex-shrink:0;text-align:right;min-width:40px">
              <div style="font-size:11px;color:var(--ink3);line-height:1.4">${dateStr}</div>
              <div style="font-size:10px;background:${cc}22;color:${cc};border-radius:5px;padding:1px 5px;margin-top:3px;font-weight:600;white-space:nowrap">${e.bigCat||'其他'}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;color:var(--ink2)">${e.desc||SPEND_LBL[e.spendKey]||'消费'}</div>
              ${pl}${reason}${aa}
            </div>
            <span style="font-size:14px;font-weight:600;color:var(--warm);flex-shrink:0;margin-top:1px">¥${e.amount.toFixed(2)}</span>
          </div>`;
        }).join('');
      }
      document.getElementById('detail-modal').classList.add('open');
    }

    function closeDetailModal() {
      document.getElementById('detail-modal').classList.remove('open');
    }
