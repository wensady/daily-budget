    // ══ 壁纸 ══
    const WALLPAPER_KEY = 'budget_wallpaper';
    const WALLPAPER_POS_KEY = 'budget_wallpaper_pos';

    function loadWallpaper() {
      const src = localStorage.getItem(WALLPAPER_KEY);
      const pos = localStorage.getItem(WALLPAPER_POS_KEY) || 'center 50%';
      const bg = document.getElementById('bg-layer');
      if (src) {
        bg.style.backgroundImage = `url(${src})`;
        bg.style.backgroundPosition = pos;
        const rb = document.getElementById('wallpaper-reset-btn');
        if (rb) rb.style.display = '';
      }
    }

    function wallpaperPick(input) {
      const file = input.files[0];
      if (!file) return;

      // 用 createImageBitmap 代替 FileReader→img：
      //   ① 原生支持 EXIF 旋转修正（解决安卓相机照片旋转问题）
      //   ② 从 File 直接解码，不先转 base64，内存消耗更低
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(file).then(bitmap => {
          input.value = '';
          _compressAndCrop(bitmap, bitmap.width, bitmap.height);
          bitmap.close && bitmap.close();
        }).catch(() => {
          // createImageBitmap 失败时降级到旧方法
          _wallpaperFallback(file, input);
        });
      } else {
        _wallpaperFallback(file, input);
      }
    }

    function _compressAndCrop(source, srcW, srcH) {
      // 最长边压缩到 900px（降低内存，相比原来的 1200px 更安全）
      const maxS = 900;
      let w = srcW, h = srcH;
      if (w > maxS || h > maxS) {
        if (w > h) { h = Math.round(h * maxS / w); w = maxS; }
        else       { w = Math.round(w * maxS / h); h = maxS; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      try {
        canvas.getContext('2d').drawImage(source, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        if (!compressed || compressed === 'data:,') throw new Error('canvas empty');
        localStorage.setItem(WALLPAPER_KEY, compressed);
        cropOpen(compressed);
      } catch (err) {
        showToast('图片处理失败，请换一张试试');
      }
    }

    function _wallpaperFallback(file, input) {
      const reader = new FileReader();
      reader.onerror = () => showToast('图片读取失败，请重试');
      reader.onload = e => {
        input.value = '';   // 移入回调内，确保读取完成后再清空
        const img = new Image();
        img.onerror = () => showToast('图片格式不支持，请换一张');
        img.onload  = () => _compressAndCrop(img, img.naturalWidth, img.naturalHeight);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    function wallpaperReset() {
      localStorage.removeItem(WALLPAPER_KEY);
      localStorage.removeItem(WALLPAPER_POS_KEY);
      const bg = document.getElementById('bg-layer');
      bg.style.backgroundImage = '';
      bg.style.backgroundPosition = '';
      const rb = document.getElementById('wallpaper-reset-btn');
      if (rb) rb.style.display = 'none';
      showToast('已还原默认背景');
    }

    // ── 裁剪弹窗 ──
    let _cropSrc = '', _cropOffY = 0, _cropMode = 'full', _cropDragging = false, _cropStartY = 0, _cropStartOff = 0;

    // 视口高度：全页模拟手机比例，头图固定
    function _vpH() { return _cropMode === 'full' ? Math.min(500, window.innerHeight * 0.72) : 160; }

    function cropOpen(src) {
      _cropSrc = src; _cropOffY = 0;
      const modal = document.getElementById('crop-modal');
      const img = document.getElementById('crop-img');
      img.src = src;
      img.onload = () => { cropSetMode('full'); };
      modal.classList.add('open');
    }

    function cropClose() {
      document.getElementById('crop-modal').classList.remove('open');
    }

    function cropSetMode(mode) {
      _cropMode = mode;
      document.getElementById('crop-mode-full').classList.toggle('active', mode === 'full');
      document.getElementById('crop-mode-header').classList.toggle('active', mode === 'header');
      const vp = document.getElementById('crop-vp');
      vp.style.height = _vpH() + 'px';
      _cropClamp(); _cropApply();
    }

    function _cropClamp() {
      const img = document.getElementById('crop-img');
      const vp = document.getElementById('crop-vp');
      const vpW = vp.offsetWidth;
      if (!img.naturalWidth) return;
      const imgH = (img.naturalHeight / img.naturalWidth) * vpW;
      const minOff = -(imgH - _vpH());
      _cropOffY = Math.min(0, Math.max(minOff, _cropOffY));
    }

    function _cropApply() {
      document.getElementById('crop-img').style.top = _cropOffY + 'px';
    }

    function cropConfirm() {
      const img = document.getElementById('crop-img');
      const vp = document.getElementById('crop-vp');
      const vpW = vp.offsetWidth;
      const imgH = (img.naturalHeight / img.naturalWidth) * vpW;
      const maxScroll = imgH - _vpH();
      const pct = maxScroll > 0 ? Math.round((-_cropOffY / maxScroll) * 100) : 50;
      const pos = `center ${pct}%`;
      localStorage.setItem(WALLPAPER_POS_KEY, pos);
      const bg = document.getElementById('bg-layer');
      bg.style.backgroundImage = `url(${_cropSrc})`;
      bg.style.backgroundPosition = pos;
      const rb = document.getElementById('wallpaper-reset-btn');
      if (rb) rb.style.display = '';
      cropClose();
      showToast('壁纸已更新 ✓');
    }

    // 拖动事件（鼠标 + 触摸）
    (function() {
      const vp = document.getElementById('crop-vp');
      vp.addEventListener('mousedown', e => {
        _cropDragging = true; _cropStartY = e.clientY; _cropStartOff = _cropOffY; e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!_cropDragging) return;
        _cropOffY = _cropStartOff + (e.clientY - _cropStartY);
        _cropClamp(); _cropApply();
      });
      document.addEventListener('mouseup', () => { _cropDragging = false; });
      vp.addEventListener('touchstart', e => {
        _cropDragging = true; _cropStartY = e.touches[0].clientY; _cropStartOff = _cropOffY; e.preventDefault();
      }, { passive: false });
      document.addEventListener('touchmove', e => {
        if (!_cropDragging) return;
        _cropOffY = _cropStartOff + (e.touches[0].clientY - _cropStartY);
        _cropClamp(); _cropApply();
      }, { passive: false });
      document.addEventListener('touchend', () => { _cropDragging = false; });
    })();

    loadWallpaper();
