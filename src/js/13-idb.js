// ════════════════════════════════════════════════════════════════
// 13-idb.js —— IndexedDB 持久化层（双写 + 自动恢复 + 首次确认迁移）
//
// 解决的问题：localStorage 在 iOS Safari 上会被自动清理，导致数据丢失。
// 本模块用 IndexedDB 做"持久化兜底"，localStorage 做"高速缓存"：
//   - 写：每次 saveRec → localStorage（同步，不变）+ IndexedDB（异步双写）
//   - 读：照旧从 localStorage 读（同步，不变）
//   - 恢复：localStorage 空了 → 从 IndexedDB 静默恢复 → 用户无感
//   - 迁移：首次升级的老用户 → 弹窗确认 → 自动迁移到 IndexedDB
//
// 不改 01-core.js / 08-backup.js，通过 hook localStorage.setItem 实现双写。
// IndexedDB 不可用时（隐私模式/极旧浏览器）自动降级，不影响使用。
// ════════════════════════════════════════════════════════════════
(function() {
    // SK 必须和 01-core.js 里的 'budget_records_v2' 保持一致
    const SK = 'budget_records_v2';
    const IDB_NAME = 'daily-budget-db';
    const IDB_STORE = 'kv';
    const IDB_KEY = 'records';
    const MIGRATED_FLAG = 'idb_migrated_v1'; // 标记已迁移，避免重复弹窗

    let _idbReady = false;
    let _idbDB = null;

    // ── IndexedDB 打开（带容错）──
    function openIDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB 不支持'));
                return;
            }
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e.target.error);
        });
    }

    function idbSet(db, key, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(value, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbGet(db, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // ── hook localStorage.setItem 实现双写 ──
    // 只 hook SK 这个 key，其他 key 走原路径，零影响
    const _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        _origSetItem(key, value);
        if (key === SK && _idbReady && _idbDB) {
            try {
                const parsed = JSON.parse(value);
                idbSet(_idbDB, IDB_KEY, parsed).then(() => {
                    // 双写成功后设置 migrated 标记，避免新用户第一次记账后刷新触发迁移弹窗
                    // 只有真正的"老用户升级"（localStorage 有数据但从未双写过）才会弹窗
                    if (!localStorage.getItem(MIGRATED_FLAG)) {
                        _origSetItem(MIGRATED_FLAG, '1');
                    }
                }).catch(err => {
                    console.warn('[IDB] 双写失败（不影响使用）:', err);
                });
            } catch (e) {
                // value 不是合法 JSON，跳过双写
            }
        }
    };

    // ── 启动时检测四种情况 ──
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            _idbDB = await openIDB();
            _idbReady = true;
        } catch (err) {
            console.warn('[IDB] 不可用，降级为纯 localStorage:', err);
            return; // 降级，不影响使用
        }

        const lsRaw = localStorage.getItem(SK);
        const idbData = await idbGet(_idbDB, IDB_KEY).catch(() => null);
        const migrated = localStorage.getItem(MIGRATED_FLAG);

        if (lsRaw && !idbData && !migrated) {
            // 情况A：localStorage 有，IndexedDB 空，未迁移过 → 弹窗确认迁移
            showMigrateModal(lsRaw);
        } else if (!lsRaw && idbData) {
            // 情况B：localStorage 空（被 iOS 清了），IndexedDB 有 → 静默恢复
            _origSetItem(SK, JSON.stringify(idbData));
            localStorage.setItem(MIGRATED_FLAG, '1');
            // 触发页面重新加载数据
            if (typeof loadDateEntries === 'function') loadDateEntries();
            if (typeof renderStats === 'function' && document.getElementById('page-stats')?.classList.contains('active')) {
                renderStats();
            }
            console.log('[IDB] 从 IndexedDB 恢复数据成功');
        } else if (lsRaw && idbData && !migrated) {
            // 情况C：两个都有，但没标记迁移过 → 标记一下，开始正常双写
            localStorage.setItem(MIGRATED_FLAG, '1');
        }
        // 情况D：两个都空 / 已迁移 → 不处理
    });

    // ── 迁移弹窗（动态创建 DOM + 样式，不改 body.html / styles.css）──
    function showMigrateModal(lsRaw) {
        let count = 0;
        try {
            const parsed = JSON.parse(lsRaw);
            count = Object.values(parsed).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
        } catch (e) {}

        // 注入样式（只注入一次）
        if (!document.getElementById('idb-migrate-style')) {
            const style = document.createElement('style');
            style.id = 'idb-migrate-style';
            style.textContent = [
                '.idb-mask{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}',
                '.idb-modal{background:#fff;border-radius:16px;max-width:380px;width:100%;padding:24px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.2);font-family:inherit;box-sizing:border-box}',
                '.idb-title{font-size:18px;font-weight:600;margin:0 0 12px;text-align:center}',
                '.idb-desc{font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;text-align:center}',
                '.idb-desc strong{color:#e67e22}',
                '.idb-btns{display:flex;gap:10px}',
                '.idb-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit}',
                '.idb-btn-later{background:#f0f0f0;color:#666}',
                '.idb-btn-go{background:#e67e22;color:#fff}',
                '.idb-btn:disabled{opacity:0.6;cursor:not-allowed}',
                '.idb-loading{text-align:center;padding:20px 0;font-size:14px;color:#666}',
                '.idb-spinner{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#e67e22;border-radius:50%;animation:idb-spin 0.8s linear infinite;margin:0 auto 12px}',
                '@keyframes idb-spin{to{transform:rotate(360deg)}}',
                '.idb-done{text-align:center;font-size:16px;color:#27ae60;padding:10px 0}',
                '.idb-err{text-align:center;color:#e74c3c;padding:10px 0;font-size:14px}'
            ].join('\n');
            document.head.appendChild(style);
        }

        const mask = document.createElement('div');
        mask.className = 'idb-mask';
        mask.innerHTML =
            '<div class="idb-modal">' +
              '<h3 class="idb-title">💾 升级数据存储</h3>' +
              '<p class="idb-desc">检测到你有 <strong>' + count + '</strong> 条记账记录，<br>目前存在"旧存储"里（容易被手机系统清理）。</p>' +
              '<p class="idb-desc">建议升级到"新存储"，避免数据丢失。<br>升级后所有记录会保留，记账功能完全不变。</p>' +
              '<div class="idb-btns">' +
                '<button class="idb-btn idb-btn-later" id="idb-later">以后再说</button>' +
                '<button class="idb-btn idb-btn-go" id="idb-go">立即升级（推荐）</button>' +
              '</div>' +
            '</div>';
        document.body.appendChild(mask);

        // 关闭弹窗的通用方法
        function closeModal() {
            mask.remove();
        }

        document.getElementById('idb-later').onclick = closeModal;

        document.getElementById('idb-go').onclick = async function() {
            const modal = mask.querySelector('.idb-modal');
            modal.innerHTML =
                '<div class="idb-loading">' +
                  '<div class="idb-spinner"></div>' +
                  '<p>正在升级...</p>' +
                '</div>';
            try {
                const parsed = JSON.parse(lsRaw);
                await idbSet(_idbDB, IDB_KEY, parsed);
                localStorage.setItem(MIGRATED_FLAG, '1');
                modal.innerHTML = '<div class="idb-done">✓<br><br>升级完成<br>你的数据更安全了</div>';
                setTimeout(closeModal, 1500);
            } catch (err) {
                console.error('[IDB] 迁移失败:', err);
                modal.innerHTML =
                    '<div class="idb-err">❌ 升级失败<br><small>已保留旧存储，不影响使用</small></div>' +
                    '<div class="idb-btns" style="margin-top:16px">' +
                      '<button class="idb-btn idb-btn-later" id="idb-close-err">关闭</button>' +
                    '</div>';
                document.getElementById('idb-close-err').onclick = closeModal;
            }
        };
    }
})();
