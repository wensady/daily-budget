    // ══ Toast ══
    let toastTimer = null;
    function showToast(msg, duration) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), duration || 1800);
    }

    // ══ 备份状态 ══
    const BK = 'budget_last_backup';
