    // ══ 日历明细 ══
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth(); // 0-indexed
    let calSelected = null;

    function calPrev(){
      calMonth--;
      if(calMonth<0){calMonth=11;calYear--;}
      calSelected=null;
      curM=calYear+'-'+String(calMonth+1).padStart(2,'0');
      document.querySelectorAll('.mtab').forEach(t=>t.classList.toggle('active',t.textContent===fmtMonth(curM)));
      buildCalendar();
      buildMonthList();
      renderMS(curM,allMonths());
    }

    function calNext(){
      calMonth++;
      if(calMonth>11){calMonth=0;calYear++;}
      calSelected=null;
      curM=calYear+'-'+String(calMonth+1).padStart(2,'0');
      document.querySelectorAll('.mtab').forEach(t=>t.classList.toggle('active',t.textContent===fmtMonth(curM)));
      buildCalendar();
      buildMonthList();
      renderMS(curM,allMonths());
    }

    function buildCalendar(){
      const all=loadRec();
      const now=new Date();
      const tk=todayKey();
      const ym=calYear+'-'+String(calMonth+1).padStart(2,'0');

      // 月份标题
      document.getElementById('cal-month-lbl').textContent=calYear+'年'+(calMonth+1)+'月';

      // 本月合计（仅支出）
      const monthTotal=Object.keys(all)
        .filter(k=>k.startsWith(ym+'-'))
        .reduce((s,k)=>(all[k]||[]).filter(e=>e.type!=='income').reduce((s2,e)=>s2+e.amount,s),0);
      document.getElementById('cal-month-total').innerHTML=
        monthTotal>0?'本月支出 <strong>¥'+monthTotal.toFixed(0)+'</strong>':'本月暂无记录';

      // 该月第一天是周几（转成周一=0）
      const firstDay=new Date(calYear,calMonth,1).getDay();
      const offset=firstDay===0?6:firstDay-1;
      const daysInMonth=new Date(calYear,calMonth+1,0).getDate();

      const grid=document.getElementById('cal-grid');
      grid.innerHTML='';

      // 空格
      for(let i=0;i<offset;i++){
        const el=document.createElement('div');
        el.className='cal-cell empty';
        grid.appendChild(el);
      }

      // 日期格子
      for(let d=1;d<=daysInMonth;d++){
        const dk=ym+'-'+String(d).padStart(2,'0');
        const ents=all[dk]||[];
        const expOnly=ents.filter(e=>e.type!=='income');
        const hasInc=ents.some(e=>e.type==='income');
        const dayTotal=expOnly.reduce((s,e)=>s+e.amount,0);
        const isToday=dk===tk;
        const isSel=dk===calSelected;
        const hasData=expOnly.length>0||hasInc;

        const el=document.createElement('div');
        el.className='cal-cell'+(hasData?' has-data':'')+(isToday?' today':'')+(isSel?' selected':'');
        el.innerHTML=`<div class="cal-dn">${d}</div>`+
          (expOnly.length>0?`<div class="cal-amt">¥${dayTotal.toFixed(0)}</div>`:'')+
          (hasInc&&expOnly.length===0?`<div class="cal-amt" style="color:#27ae60">收入</div>`:'');
        if(isToday&&!hasData) el.innerHTML+=`<div class="cal-dot"></div>`;
        el.onclick=()=>selectCalDay(dk);
        grid.appendChild(el);
      }
    }

    const COLLAPSE_DAYS = 7; // 默认显示最近 N 天
    function buildMonthList(showAll){
      const ym=calYear+'-'+String(calMonth+1).padStart(2,'0');
      const all=loadRec();
      const tk=todayKey();
      const days=Object.keys(all).filter(k=>k.startsWith(ym+'-')&&(all[k]||[]).length>0).sort().reverse();
      const wrap=document.getElementById('month-list-wrap');
      if(!days.length){
        wrap.innerHTML='<div style="text-align:center;padding:2rem 0;font-size:13px;color:var(--ink3)">本月暂无记录</div>';
        return;
      }
      const WD=['日','一','二','三','四','五','六'];
      const visibleDays = showAll ? days : days.slice(0, COLLAPSE_DAYS);
      const hiddenCount = days.length - visibleDays.length;

      function renderDay(dk){
        const ents=all[dk]||[];
        const expEnts=ents.filter(e=>e.type!=='income');
        const incEnts=ents.filter(e=>e.type==='income');
        const expTot=expEnts.reduce((s,e)=>s+e.amount,0);
        const incTot=incEnts.reduce((s,e)=>s+e.amount,0);
        const d=new Date(dk+'T00:00:00');
        const wd=WD[d.getDay()];
        const isToday=dk===tk;
        const isSel=dk===calSelected;
        const incBadge=incTot>0?`<span style="font-size:11px;color:#27ae60;font-weight:600;margin-left:8px">＋¥${incTot.toFixed(0)} 收入</span>`:'';
        return `<div class="day-group" id="dg-${dk}">
          <div class="dg-header" style="${isSel?'background:var(--pl);outline:2px solid var(--purple)':''}">
            <span class="dg-date" style="${isToday?'color:var(--purple);font-weight:600':''}">${isToday?'今天 · ':''}${dk.slice(5).replace('-','月')}日 周${wd}${incBadge}</span>
            <span class="dg-total">¥${expTot.toFixed(2)}</span>
          </div>
          ${ents.map((e,ei)=>{
            const isInc=e.type==='income';
            if(isInc){
              return `<div class="dg-entry dg-income">
                <span class="dg-cat">收入</span>
                <div class="dg-meta">
                  <div class="dg-desc">${e.desc||INCOME_LBL[e.srcKey]||'收入'}</div>
                </div>
                <div class="dg-right">
                  <span class="dg-amt" style="color:#27ae60">＋¥${e.amount.toFixed(2)}</span>
                  <span class="dg-del" onclick="event.stopPropagation();delEntryFromStats('${dk}',${ei})">×</span>
                </div>
              </div>`;
            }
            const shop=e.shopName?'·'+e.shopName:'';
            const pl=e.place?(e.place+shop):'';
            const rt=e.reasonText||(e.reasonKey?REASON_LBL[e.reasonKey]:'');
            const cc=CAT_COLORS[e.bigCat]||'#6c5ce7';
            return `<div class="dg-entry dg-entry-tap" onclick="jumpToEdit('${dk}',${ei})" title="点击修改">
              <span class="dg-cat" style="background:${cc}18;color:${cc}">${e.bigCat||'其他'}</span>
              <div class="dg-meta">
                <div class="dg-desc">${e.desc||SPEND_LBL[e.spendKey]||'消费'}</div>
                ${pl?`<div class="dg-place">📍 ${pl}</div>`:''}
                ${rt?`<div class="dg-reason">${rt}</div>`:''}
              </div>
              <div class="dg-right">
                <span class="dg-amt">¥${e.amount.toFixed(2)}</span>
                <span class="dg-del" onclick="event.stopPropagation();delEntryFromStats('${dk}',${ei})">×</span>
              </div>
            </div>`;
          }).join('')}
          <button class="dg-add" onclick="jumpToRecord('${dk}')">＋ 补记一笔</button>
        </div>`;
      }

      const expandBtn = hiddenCount > 0
        ? `<button onclick="buildMonthList(true)" style="width:100%;padding:12px;margin-bottom:.875rem;border:1.5px dashed #e0ddd8;border-radius:12px;background:transparent;font-size:13px;color:var(--ink3);cursor:pointer;font-family:inherit">
            展开更早的 ${hiddenCount} 天 ▾
          </button>` : '';

      wrap.innerHTML = visibleDays.map(renderDay).join('') + expandBtn;
    }

    function selectCalDay(dk){
      // 始终留在统计页，在日历下方显示当天详情
      calSelected = dk;
      buildCalendar();

      // 填充详情面板
      const all = loadRec();
      const ents = all[dk] || [];
      const tot = ents.reduce((s, e) => s + e.amount, 0);
      const WD = ['日','一','二','三','四','五','六'];
      const d = new Date(dk + 'T00:00:00');
      const isToday = dk === todayKey();
      const dateStr = (isToday ? '今天 ' : '') + dk.slice(5).replace('-','月') + '日 周' + WD[d.getDay()];

      document.getElementById('cal-detail-date').textContent = dateStr;
      document.getElementById('cal-detail-total').textContent = ents.length ? '¥' + tot.toFixed(2) : '';

      const body = document.getElementById('cal-detail-body');
      const expEntsDay = ents.filter(e => e.type !== 'income');
      const expTotDay  = expEntsDay.reduce((s, e) => s + e.amount, 0);
      document.getElementById('cal-detail-total').textContent =
        ents.length ? '¥' + expTotDay.toFixed(2) : '';

      if (!ents.length) {
        body.innerHTML = '<div class="cal-detail-empty">这天还没有记录</div>';
      } else {
        body.innerHTML = ents.map((e, ei) => {
          const isInc = e.type === 'income';
          if (isInc) {
            return `<div class="cal-entry" style="background:rgba(39,174,96,0.05)">
              <span class="cal-entry-cat" style="background:#d4efdf;color:#1e8449">收入</span>
              <div class="cal-entry-meta">
                <div class="cal-entry-desc">${e.desc || INCOME_LBL[e.srcKey] || '收入'}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                <span class="cal-entry-amt" style="color:#27ae60">＋¥${e.amount.toFixed(2)}</span>
                <span class="dg-del" onclick="calDelEntry('${dk}',${ei})">×</span>
              </div>
            </div>`;
          }
          const shop = e.shopName ? '·' + e.shopName : '';
          const pl = e.place ? (e.place + shop) : '';
          const rt = e.reasonText || (e.reasonKey ? REASON_LBL[e.reasonKey] : '');
          const cc = CAT_COLORS[e.bigCat] || '#6c5ce7';
          return `<div class="cal-entry dg-entry-tap" onclick="jumpToEdit('${dk}',${ei})" title="点击修改">
            <span class="cal-entry-cat" style="background:${cc}18;color:${cc}">${e.bigCat||'其他'}</span>
            <div class="cal-entry-meta">
              <div class="cal-entry-desc">${e.desc||SPEND_LBL[e.spendKey]||'消费'}</div>
              ${pl ? `<div class="cal-entry-place">📍 ${pl}</div>` : ''}
              ${rt ? `<div class="cal-entry-reason">${rt}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
              <span class="cal-entry-amt">¥${e.amount.toFixed(2)}</span>
              <span class="dg-del" onclick="event.stopPropagation();calDelEntry('${dk}',${ei})">×</span>
            </div>
          </div>`;
        }).join('');
      }

      // 更新补记按钮
      document.getElementById('cal-add-btn').onclick = () => jumpToRecord(dk);

      // 显示详情面板并滚动到它
      const panel = document.getElementById('cal-detail');
      panel.style.display = 'block';
      setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);

      // 如果月度列表中有该天，额外高亮
      const dgEl = document.getElementById('dg-' + dk);
      if (dgEl) {
        dgEl.querySelector('.dg-header').style.outline = '2px solid var(--purple)';
        setTimeout(() => { dgEl.querySelector('.dg-header').style.outline = ''; }, 1200);
      }
    }

    function jumpToRecord(dk){
      document.getElementById('record-date').value=dk;
      loadDateEntries();
      switchPage('record');
    }

    // 日历弹窗删除某条记录（删后刷新弹窗）
    function calDelEntry(dk, idx) {
      const all = loadRec();
      const ents = all[dk] || [];
      if (!ents[idx]) return;
      ents.splice(idx, 1);
      if (ents.length) { all[dk] = ents; } else { delete all[dk]; }
      localStorage.setItem(SK, JSON.stringify(all));
      selectCalDay(dk);   // 刷新弹窗
      renderStats();      // 刷新统计数据
      showToast('已删除');
    }

    // 统计页直接删除某条记录
    function delEntryFromStats(dk, idx) {
      const all = loadRec();
      const ents = all[dk] || [];
      if (!ents[idx]) return;
      ents.splice(idx, 1);
      if (ents.length) { all[dk] = ents; } else { delete all[dk]; }
      localStorage.setItem(SK, JSON.stringify(all));
      renderStats();
      showToast('已删除');
    }

    // 统计页条目点击 → 跳记账页 + 自动进入编辑该条
    function jumpToEdit(dk, idx){
      document.getElementById('record-date').value = dk;
      loadDateEntries();          // 先加载当天条目到 entries[]
      switchPage('record');
      // 等页面切换动画结束后再激活编辑（loadDateEntries 是同步的，无需延迟）
      editEntry(idx);
      // 滚动到编辑提示条
      setTimeout(() => {
        document.getElementById('edit-hint-bar').scrollIntoView({behavior:'smooth', block:'center'});
      }, 120);
    }

    // ══ 统计页锚点跳转 ══
    function statsScrollTo(id) {
      const el = document.getElementById(id);
      if (!el) return;
      // 减去顶部两层 sticky 高度（主导航 + 锚点栏约 96px）
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
