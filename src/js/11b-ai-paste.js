// ════════════════════════════════════════════════════════════════
// 11b-ai-paste.js —— 「粘贴 AI 结果」通道
//
// 为什么有这条通道：识别原本只依赖阿里云百炼（要付费，欠费就整个用不了）。
// 这条通道让你用任意免费 AI（豆包 / 元宝 / Kimi / 通义 App）读图，
// 把它吐出来的 JSON 复制、粘回这里解析即可，不花钱、不限厂商。
//
// 关键复用：回填直接调用 window.__fillOcrForm
//（= 11-screenshot-ocr.js 里的 fillDataToForm），
// 所以「粘贴」和「直接识别」两条通道填出来的表单完全一致，不维护两套逻辑。
// ════════════════════════════════════════════════════════════════
(function () {

    // ── 从页面里取提问模板 ──
    function getPrompt() {
        const el = document.getElementById('ai-prompt-tpl');
        return el ? el.textContent.trim() : '';
    }

    // ── 弹窗开关 ──
    window.openAiPaste = function () {
        const m = document.getElementById('ai-mask');
        if (m) m.classList.add('open');
    };
    window.closeAiPaste = function () {
        const m = document.getElementById('ai-mask');
        if (m) m.classList.remove('open');
    };

    // ── 提示条（只作用于弹窗内部）──
    function aiTip(kind, msg) {
        const t = document.getElementById('ai-tip');
        if (!t) return;
        t.className = 'ai-tip show ' + kind;
        t.textContent = msg;
    }

    // ── 复制文本：优先剪贴板 API，不行退回 execCommand ──
    // （微信内置浏览器、file:// 打开时前者常常不可用，必须留后路）
    function copyText(text, onDone, onFail) {
        const fallback = function () {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            if (ok) onDone(); else onFail();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onDone).catch(fallback);
        } else {
            fallback();
        }
    }

    // ── 复制提问模板 ──
    window.copyAiPrompt = function () {
        const txt = getPrompt();
        if (!txt) { aiTip('bad', '模板没加载出来，刷新页面再试'); return; }
        const btn = document.getElementById('ai-copy-btn');
        const done = function () {
            if (!btn) return;
            btn.textContent = '✓ 已复制，去发给 AI';
            btn.classList.add('done');
            setTimeout(function () {
                btn.textContent = '📋 复制提问模板';
                btn.classList.remove('done');
            }, 2400);
        };
        copyText(txt, done, function () {
            aiTip('bad', '自动复制失败，请长按下面的框手动复制');
            const ta = document.getElementById('ai-paste-ta');
            if (ta) { ta.value = txt; ta.select(); }
        });
    };

    // ── 一键读剪贴板 ──
    window.readClipboard = function () {
        const ta = document.getElementById('ai-paste-ta');
        if (!ta) return;
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText().then(function (t) {
                if (t && t.trim()) {
                    ta.value = t;
                    aiTip('good', '已读到剪贴板内容，点下面的「解析并填入」');
                } else {
                    aiTip('bad', '剪贴板是空的，请先复制 AI 的回复');
                }
            }).catch(function () {
                aiTip('bad', '浏览器不给读剪贴板，请长按下面的框手动粘贴');
            });
        } else {
            aiTip('bad', '当前浏览器不支持一键读取，请长按下面的框手动粘贴');
        }
    };

    // ── 从一堆文本里把 JSON 挖出来 ──
    // 各家 AI 的输出习惯不一样：有的直接给 JSON，有的套 ```json 代码块，
    // 有的前面写「好的，我帮你识别了」、后面写「希望有帮助」。
    // 这里把这些噪音都剥掉，只留花括号那一段。
    function extractJson(text) {
        let s = String(text || '');
        s = s.replace(/```json/gi, '').replace(/```/g, '').trim();
        const a = s.indexOf('{'), b = s.lastIndexOf('}');
        if (a >= 0 && b > a) s = s.slice(a, b + 1);
        s = s.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");  // 中文引号
        s = s.replace(/,\s*([}\]])/g, '$1');                                      // 多余尾逗号
        return JSON.parse(s);
    }

    // ── 解析并回填 ──
    window.parseAiPaste = function () {
        const ta = document.getElementById('ai-paste-ta');
        const raw = ((ta && ta.value) || '').trim();
        if (!raw) { aiTip('bad', '还没粘东西呢——把 AI 的回复粘进来再点解析'); return; }

        let data;
        try {
            data = extractJson(raw);
        } catch (e) {
            aiTip('bad', '没找到可读的 JSON。请确认你复制的是 AI 回复里那段带花括号的内容');
            return;
        }
        if (!data || typeof data !== 'object') {
            aiTip('bad', '解析出来了，但不是一个 JSON 对象，请检查 AI 的回复格式');
            return;
        }
        if (!(parseFloat(data.amount) > 0)) {
            aiTip('bad', '解析到内容了，但没有金额（amount）。请把 AI 的回复完整复制过来');
            return;
        }

        // 共用回填函数在校验通过后退出编辑态，失败时保留原表单。
        if (typeof window.__fillOcrForm !== 'function') {
            aiTip('bad', '回填模块没就绪，刷新页面再试一次');
            return;
        }

        let st;
        try {
            st = window.__fillOcrForm(data);
        } catch (e) {
            aiTip('bad', e.message || '明细格式无法读取，请用最新模板重新整理');
            return;
        }

        const parts = ['金额 ¥' + data.amount];
        const n = st ? st.itemCount : 0;
        if (n) parts.push(n + ' 条明细');
        if (st && st.dateInfo && st.dateInfo.isToday === false) {
            const d = st.dateInfo.date;
            parts.push('日期用了 ' + (typeof fmtDay === 'function' ? fmtDay(d) : d) + '（不是今天）');
        }
        aiTip('good', '已填入：' + parts.join('、'));
        setTimeout(window.closeAiPaste, 900);
    };

    // 回车提交：在文本框里按 Ctrl/⌘ + Enter 直接解析
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const m = document.getElementById('ai-mask');
            if (m && m.classList.contains('open')) window.parseAiPaste();
        }
    });
})();
