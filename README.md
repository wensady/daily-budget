# 记账本 · 工程化版

把原来的单文件 `daily_budget.html`（3500+ 行）拆成可维护的模块，并新增 **AA 代付 / 多人记账** 功能。

## 目录结构

```
daily-budget/
├── dist/                ← 构建产物，可直接用的单文件 PWA
│   ├── index.html       ← 双击即可打开 / 部署
│   ├── manifest.json
│   └── sw.js
├── src/                 ← 源码，平时改这里
│   ├── head.html / styles.css / body.html / tail.html
│   ├── manifest.json / sw.js
│   └── js/              ← JS 按功能拆成 11 个模块，按文件名数字顺序拼接
│       ├── 00-constants.js   映射表
│       ├── 01-core.js        存储、页面切换、日期、折叠
│       ├── 02-record.js      记账主流程
│       ├── 03-stats.js       统计 / 图表
│       ├── 04-search.js      搜索 / 年度概览
│       ├── 05-calendar.js    日历明细
│       ├── 06-ui.js          Toast / 备份状态
│       ├── 07-wallpaper.js   壁纸
│       ├── 08-backup.js      导入导出 / 备份
│       ├── 09-pwa.js         Service Worker 注册
│       └── 10-aa.js          ★ AA 代付 / 多人记账
├── build.mjs            ← 构建：src/ → dist/index.html（并同步回 ../daily_budget.html）
├── preview-aa.html      ← AA 设计预览页（三方案对比，可删）
└── tools/
    ├── extract.mjs      ← 一次性拆分脚本（已用过）
    └── test-aa.mjs      ← AA 逻辑离线测试
```

## 日常怎么用

1. 改代码 → 只动 `src/` 里对应模块。
2. 构建：

   ```
   node build.mjs
   ```

   它会做两件事：
   - 生成 `dist/index.html`（手机端/部署用的就是这个）；
   - **同步**一份到 `../daily_budget.html`（原位置也能独立运行）。
     首次构建会把改造前的原文件备份为 `daily_budget.prerefactor.bak.html`。

3. 跑 AA 逻辑测试：`node tools/test-aa.mjs`

> `dist/index.html` 和 `../daily_budget.html` 都是**自动生成**的，别手改，改了下次构建会被覆盖。要改就改 `src/`。

## 新增功能：AA 代付 / 多人记账（事后标记式）

**解决的问题**：你垫付了一笔钱，但一部分是帮别人出的，别人之后要还你。
账面上「花了很多」，但你**实际**没花那么多。

### 怎么用（记账表单保持干净，不受干扰）
1. 像平时一样正常记这笔账。
2. 在「今日明细」里，点那条账右边的 **🧮** 按钮。
3. 弹窗里填「我自己实际该出多少」，自动算出「别人应还我」，可填备注。保存。
4. 想取消标记，再点 🧮 → 「取消代付」。

### 首页「别人欠我」横幅
- 记账页顶部会出现一条橙色横幅「💰 别人还欠你 ¥X」，**只在真有未收回的垫付时显示**，平时不出现。
- 点它跳到统计页的欠款清单，对方还钱后点「已收回」即移除。

### 两种统计视角（统计页顶部开关）
- **实际支出**（默认）：AA 的钱只算你自己承担的那部分 → 「其实没花那么多」。
- **垫付总额**：按你实际垫出去的总额算。
- 开关即时联动整页统计（圆环图、趋势、洞察、月对比、日历）。

### 数据兼容性
- 给支出条目新增**可选**字段：
  ```js
  e.split = { mine: 100, owedToMe: 200, note: '和老王平摊', settled: false }
  ```
- 没有 `split` 的旧记录 = 普通消费，**完全不受影响**，两种视角金额一样。收入不参与 AA。

## 放到手机上用

`dist/` 已是手机优先的 PWA。推荐：把 `dist/` 托管到静态服务（如 GitHub Pages），
手机浏览器打开网址 → 菜单「添加到主屏幕」→ 像 App 一样离线使用。详见与我的对话说明。
