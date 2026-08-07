    // ══ 备份区：手机/PC 切换 ══
    (function() {
      const mobile = 'ontouchstart' in window;
      document.getElementById('backup-mobile').style.display = mobile ? '' : 'none';
      document.getElementById('backup-desktop').style.display = mobile ? 'none' : '';
    })();

    // ══ 字体大小 ══
    const FZ_KEY = 'budget_fz';
    function setFz(val) {
      document.documentElement.dataset.fz = val;
      if (val) localStorage.setItem(FZ_KEY, val);
      else     localStorage.removeItem(FZ_KEY);
      ['sm','','lg'].forEach(v => {
        const id = 'fz-' + (v || 'md');
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('active', v === val);
      });
    }
    // 初始化：读取偏好
    setFz(localStorage.getItem(FZ_KEY) || '');

    function updateBackupStatus() {
      const el = document.getElementById('backup-status');
      if (!el) return;
      const last = parseInt(localStorage.getItem(BK) || '0');
      if (!last) { el.className = 'backup-status backup-warn'; el.textContent = '⚠️ 尚未备份过，建议导出一次'; return; }
      const days = Math.floor((Date.now() - last) / 86400000);
      if (days === 0) { el.className = 'backup-status backup-ok'; el.textContent = '✓ 今天已备份'; }
      else if (days <= 7) { el.className = 'backup-status backup-ok'; el.textContent = `✓ ${days} 天前已备份`; }
      else { el.className = 'backup-status backup-warn'; el.textContent = `⚠️ 已 ${days} 天未备份，建议导出`; }
    }

    // ══ 复制弹窗 ══
    let _copyText = '';
    function showCopyModal(text, title) {
      _copyText = text;
      if (title) document.getElementById('copy-modal-title').textContent = title;
      document.getElementById('copy-modal-text').value = text;
      document.getElementById('copy-modal').classList.add('open');
    }
    function closeCopyModal() {
      document.getElementById('copy-modal').classList.remove('open');
    }
    function doCopyModal() {
      const done = () => { showToast('✓ 已复制！打开备忘录粘贴保存'); setTimeout(closeCopyModal, 400); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(_copyText).then(done).catch(() => execCopyFallback(done));
      } else {
        execCopyFallback(done);
      }
    }
    function execCopyFallback(done) {
      const ta = document.getElementById('copy-modal-text');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0.01';
      ta.select(); ta.setSelectionRange(0, 99999);
      try { document.execCommand('copy'); done(); }
      catch(e) { showToast('复制失败，请截图或换用电脑导出'); }
      finally { ta.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden'; }
    }

    // ══ 导出 JSON 备份 ══
    async function exportJSON() {
      const recs = loadRec();
      const total = Object.values(recs).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
      const data = { version: 2, exported: new Date().toISOString(), records: recs };
      const jsonStr = JSON.stringify(data, null, 2);
      const filename = '记账备份_' + todayKey() + '.json';
      localStorage.setItem(BK, Date.now().toString());
      setTimeout(updateBackupStatus, 300);
      if ('ontouchstart' in window) {
        // Step1: 系统原生分享菜单（iOS最可靠，可选任意App或存文件）
        if (navigator.share) {
          try {
            const shareFile = new File([jsonStr], filename, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
              await navigator.share({ files: [shareFile], title: '记账备份' });
            } else {
              await navigator.share({ title: '记账备份', text: jsonStr });
            }
            return; // 用户操作完毕（含取消），不继续降级
          } catch(e) {
            if (e.name === 'AbortError') return; // 用户主动取消，不降级
          }
        }
        // Step2: 复制到剪贴板（navigator.share 完全不可用时）
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(jsonStr)
            .then(() => showToast(`✓ 已复制（共 ${total} 条记录）\n粘贴到备忘录保存`))
            .catch(() => showCopyModal(jsonStr, `📋 备份数据（共 ${total} 条）`));
        } else {
          // Step3: 兜底弹窗（长按手动复制）
          showCopyModal(jsonStr, `📋 备份数据（共 ${total} 条）`);
        }
      } else {
        const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`备份已导出（共 ${total} 条记录）`);
      }
    }

    // ══ 从剪贴板恢复（手机端专用）══
    function mergeRecords(incoming) {
      const current = loadRec();
      let added = 0;
      Object.keys(incoming).forEach(dk => {
        if (!current[dk]) {
          current[dk] = incoming[dk];
          added += (incoming[dk] || []).length;
        } else {
          const existTs = new Set(current[dk].map(e => e.ts));
          const newEnts = (incoming[dk] || []).filter(e => !existTs.has(e.ts));
          current[dk] = [...current[dk], ...newEnts];
          added += newEnts.length;
        }
      });
      localStorage.setItem(SK, JSON.stringify(current));
      loadDateEntries();
      if (document.getElementById('page-stats').classList.contains('active')) renderStats();
      return added;
    }

    // ══ 粘贴恢复弹窗 ══
    function showPasteModal() {
      const ta = document.getElementById('paste-modal-ta');
      ta.value = '';
      document.getElementById('paste-modal').classList.add('open');
      setTimeout(() => ta.focus(), 100);
    }
    function closePasteModal() {
      document.getElementById('paste-modal').classList.remove('open');
      document.getElementById('paste-modal-ta').value = '';
    }
    function doPasteImport() {
      const ta = document.getElementById('paste-modal-ta');
      const text = ta.value.trim();
      if (!text) { showToast('请先粘贴备份内容'); return; }
      let raw;
      try { raw = JSON.parse(text); }
      catch(e) { showToast('内容格式有误，请重新复制备份'); return; }
      const incoming = raw.records || raw;
      if (typeof incoming !== 'object' || Array.isArray(incoming)) {
        showToast('备份格式不正确，请重新导出再试');
        return;
      }
      const days = Object.keys(incoming).length;
      const total = Object.values(incoming).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
      if (!confirm(`检测到 ${days} 天、共 ${total} 条记录\n确认合并？（不覆盖现有数据）`)) return;
      const added = mergeRecords(incoming);
      showToast(`✓ 恢复完成，新增 ${added} 条`);
      closePasteModal();
    }

    // ══ 导入 JSON 文件（PC端，智能合并）══
    function importJSON(input) {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const raw = JSON.parse(ev.target.result);
          const incoming = raw.records || raw;
          const added = mergeRecords(incoming);
          showToast(`✓ 导入完成，新增 ${added} 条记录`);
        } catch (err) {
          alert('文件格式有误，请选择正确的备份文件（.json）');
        }
        input.value = '';
      };
      reader.readAsText(file);
    }

    // ══ 导出 CSV / Excel ══
    function buildCSVStr() {
      const all = loadRec();
      const keys = Object.keys(all).sort();
      if (!keys.length) return null;
      const rows = [['日期', '类型', '大类', '花了什么/收入来源', '说明', '金额', '地点', '店家', '为什么花', '备注']];
      keys.forEach(k => (all[k] || []).forEach(e => {
        if (e.type === 'income') {
          rows.push([k, '收入', '收入', INCOME_LBL[e.srcKey] || '其他收入', e.desc || '', e.amount.toFixed(2), '', '', '', '']);
        } else {
          rows.push([k, '支出', e.bigCat || '其他', SPEND_LBL[e.spendKey] || '', e.desc || '',
            e.amount.toFixed(2), e.place || '', e.shopName || '',
            e.reasonText || (e.reasonKey ? REASON_LBL[e.reasonKey] : '') || '', e.note || '']);
        }
      }));
      return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    }

    async function exportCSV() {
      const csv = buildCSVStr();
      if (!csv) { alert('暂无数据'); return; }
      const csvWithBom = '﻿' + csv;
      const filename = '记账_' + todayKey() + '.csv';
      if ('ontouchstart' in window) {
        if (navigator.share) {
          try {
            const shareFile = new File([csvWithBom], filename, { type: 'text/csv;charset=utf-8' });
            if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
              await navigator.share({ files: [shareFile], title: '记账数据（Excel）' });
            } else {
              await navigator.share({ title: '记账数据', text: csvWithBom });
            }
            return;
          } catch(e) {
            if (e.name === 'AbortError') return;
          }
        }
        showCopyModal(csvWithBom, '📊 CSV / Excel 数据');
      } else {
        const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Excel/CSV 已导出');
      }
    }
