// Workbench 公共骨架 · 设计规范页
//
// 目的：把「公共骨架 / 颜色 / 风格 / 布局 / 圆角 / 控件 / 状态」固化成一页，供后续页面
// （组件库、导演台复杂页面、Wiki）照着取值，避免每个页面自己发明一套。
//
// 事实源：
//   · `工作台设计基因.docx`（WORKBENCH UI Visual Specification V1.0 Candidate）
//   · 09 研发沟通协作基线 §15 Workbench Public UI Contract
//   · `workbench-v0/AGENTS.md` 中已确认的 Workbench V0 / G02 规则
//   · 已完成页面实例：导演台 · 素材准备页（G02）、内容理解页
//
// 关键约束：本页**直接引用 `src/styles.css`**，色板与控件类都取真实实现，
// 因此规范页不会与实现脱钩；新增颜色/尺寸必须先加进 `styles.css` 的 `--wb-*`。
import React from "react";
import {createRoot} from "react-dom/client";
import {BookOpen, ChevronDown, CircleHelp, Clapperboard, Film, Info, Library, Lock, PanelRightClose, Plus} from "lucide-react";
import "../styles.css";
import "./design-spec.css";

const TOKENS = [
  ["--wb-shell", "#0B0B0C", "外壳：顶栏与左导航（深色 L 型框架）"],
  ["--wb-shell-active", "#171719", "左导航当前项背景"],
  ["--wb-canvas", "#FFFFFF", "中央工作区与右 Inspector"],
  ["--wb-surface", "#F7F7F8", "面板内浅底、说明块"],
  ["--wb-border", "#E7E7E9", "1px 分隔线与控件边框"],
  ["--wb-border-strong", "#D7D7DA", "需要更强区分的边界"],
  ["--wb-text", "#171717", "正文与属性值"],
  ["--wb-text-muted", "#737373", "Label / 辅助说明"],
  ["--wb-text-soft", "#9A9A9F", "更弱的辅助信息"],
  ["--wb-text-on-dark", "#F5F5F5", "深色外壳上的文字"],
  ["--wb-primary", "#FF6A00", "主操作 / 当前项 / Focus（唯一主操作色）"],
  ["--wb-primary-hover", "#E95F00", "主操作 Hover"],
  ["--wb-info", "#2563EB", "信息 / 来源 / 系统（不做主按钮）"],
  ["--wb-ai", "#7C3AED", "AI 建议 / AI 状态（默认 Soft 或 Outline）"],
  ["--wb-success", "#16A34A", "Ready / 通过"],
  ["--wb-warning", "#D97706", "Pending / 警告（Orange 不兼任 Warning）"],
  ["--wb-error", "#DC2626", "冲突 / 错误 / 破坏性动作"],
];

const TYPE_SCALE = [
  ["Panel｜面板标题", "36px / 600", "中央工作区的页面级标题"],
  ["Column｜栏目标题", "16px / 600", "页面内分区标题"],
  ["Nav｜左导航", "一级 16px / 二级 14px", "左导航层级字号：一级章节 16px，二级条目 14px"],
  ["Drawer｜抽屉标题", "18px / 600", "抽屉或侧栏分组标题"],
  ["Function｜功能标题", "14px / 500", "右侧功能模块标题"],
  ["Body｜正文", "14px / 400", "正文、属性值、普通列表"],
  ["Label｜标签", "12px / 500", "Inspector 标签、调整项、辅助说明"],
  ["Numeric｜时间码", "14px / tabular", "时间码、帧、坐标、比例，避免数字跳动"],
  ["Minimum｜下限", "≥ 12px", "可见文字不得小于 12px"],
];

const DENSITY = [
  ["控件高度", "32px", "紧凑工具按钮可 28px；不得出现 40–48px 的后台式大控件"],
  ["Pane 内边距", "16px", "分组之间用 20–24px 间距，不用大卡片包裹"],
  ["列表行高", "32–36px", "密集但可读"],
  ["圆角", "6px / 8px / Pill", "控件 6px；浮层 8px；标签可 Pill；避免 12px 以上大圆角"],
  ["边框", "1px #E7E7E9", "用 1px 分隔线建立层级，不用阴影"],
  ["阴影", "仅浮层", "Popover / Dialog / Tooltip 才允许轻阴影"],
  ["动效", "120–180ms / 180–240ms", "只做状态反馈；禁止装饰性位移、弹跳、发光"],
];

const QA_GATE = [
  "Header 与左导航保持同一黑色外壳，没有多余的渐变或阴影",
  "中央工作区与 Inspector 保持白底，没有过度卡片化",
  "橙色只用于主操作 / 当前项 / Focus，没有被当作 Warning",
  "Blue / Purple 只表达系统 / AI 语义，没有变成竞争性主按钮",
  "当前项、Tab 选中、输入 Focus 的视觉语言一致",
  "控件以 32px 密度为主，没有 40–48px 的普通后台式大控件",
  "图标统一 Lucide 线性风格，没有混入填充图标或第二套图标体系",
  "没有把 Remotion 组件内部视觉误当作 Workbench 主题",
  "页面先做减法：同一信息只表达一次，不留实现说明与自造编号",
];

const PAGE_PATTERNS = [
  {
    name: "分区工作页",
    source: "导演台 · 素材准备（G02 已验证）",
    rules: [
      "不设页面级大标题；内容区只放当前任务真正需要的区块",
      "栏目标题 = 3px 橙色竖线 + 16px/600 中文标题；必要时后缀「必需」",
      "区块之间只用自然纵向留白（20–24px），不加横向分割线",
      "控件：输入框 1px 中性灰 → Hover/Focus 变橙，不叠加外层 Focus 框",
      "二选一用连体胶囊；选中 = 1px 亮橙边框 + 亮橙文字 + 浅橙底 + 上下浮出 2px",
    ],
  },
  {
    name: "流程状态页",
    source: "导演台 · 内容理解",
    rules: [
      "中央只放一个状态：图标 + 一句话标题 + 一句话说明",
      "失败时补一个「建议操作」块，给出可执行动作，不堆错误码",
      "结果候选使用待确认语义（Candidate），不直接写成正式结果",
    ],
  },
  {
    name: "右侧 Inspector",
    source: "导演台 · 素材准备 / 内容理解",
    rules: [
      "标题 + 状态徽标（如 LOCAL / CANDIDATE）；选什么改什么",
      "条件清单：勾 / 叉 + 用户语言标签 + 一行小字说明",
      "底部只保留一个主操作按钮，并配一行中性说明",
    ],
  },
  {
    name: "顶部提示",
    source: "导演台 · 素材准备（画幅冲突）",
    rules: [
      "单行圆角胶囊、居中；一句语义消息 + 时长 + 关闭按钮",
      "不加图标、不加说明段落、不加流程操作",
    ],
  },
];

function Section({index, title, note, children}) {
  return (
    <section className="spec-section">
      <header className="spec-section-head">
        <span className="spec-index">{index}</span>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      <div className="spec-section-body">{children}</div>
    </section>
  );
}

// 真实外壳实例：使用与主应用**完全相同的 DOM 结构与公共类**
// （.workbench-app / .topbar / .global-nav / .workbench-body / .sidebar / .canvas / .inspector）。
// 页面本身不定义这些类的任何尺寸与颜色 —— 改 styles.css，本页与所有页面同步变化。
function RealShell() {
  return (
    <div className="workbench-app">
      <header className="topbar">
        <div className="brand" aria-label="AI Director Workbench">
          <span className="brand-mark"><Film size={16} strokeWidth={2} /></span>
          <span className="brand-name">AI DIRECTOR</span>
          <span className="version-chip">V0</span>
        </div>
        <div className="topbar-project">
          {/* 默认落地态：未创建项目 → 灰色创建入口；已创建态为白色项目名 + 下拉箭头。 */}
          <button className="project-switcher is-empty" type="button"><Plus size={14} strokeWidth={2} /><span className="project-switcher-name">创建你的新项目</span></button>
        </div>
        <nav className="global-nav" aria-label="全局模块">
          <button className="global-nav-item is-active" type="button"><Clapperboard size={15} strokeWidth={1.8} /><span>导演台</span></button>
          <button className="global-nav-item" type="button"><Library size={15} strokeWidth={1.8} /><span>组件库</span></button>
          <button className="global-nav-item" type="button"><BookOpen size={15} strokeWidth={1.8} /><span>Wiki</span></button>
        </nav>
        <div className="topbar-actions">
          <span className="mock-status"><span className="mock-dot is-local" /> LOCAL RUNTIME</span>
          {/* 抽屉开关只出现在有关闭需求的页面；本页展示展开态图标。 */}
          <button className="icon-button dark" aria-label="收起右侧抽屉" aria-expanded type="button"><PanelRightClose size={17} strokeWidth={1.8} /></button>
        </div>
      </header>
      <div className="workbench-body">
        <aside className="sidebar">
          <div className="sidebar-heading"><span>项目生命周期</span><span className="sidebar-count">1 / 5</span></div>
          <div className="stage-list">
            <button className="stage-item is-active" type="button"><span className="stage-number">01</span><span className="stage-copy"><span className="stage-label">素材准备</span><span className="stage-subtitle">Material Preparation</span></span><span className="active-pulse" /></button>
            <button className="stage-item" disabled type="button"><span className="stage-number">02</span><span className="stage-copy"><span className="stage-label">内容理解</span><span className="stage-subtitle">Content Understanding</span></span><Lock className="stage-status" size={13} /></button>
            <button className="stage-item" disabled type="button"><span className="stage-number">03</span><span className="stage-copy"><span className="stage-label">导演分镜编排</span><span className="stage-subtitle">Director Arrangement</span></span><Lock className="stage-status" size={13} /></button>
          </div>
          <div className="sidebar-divider" />
          <div className="sidebar-note"><Info size={14} /><p>骨架尺寸只在 styles.css 定义；本页与所有页面共用。</p></div>
          <div className="sidebar-footer"><button type="button"><CircleHelp size={15} /><span>使用说明</span></button></div>
        </aside>
        <main className="canvas" id="spec-canvas">
          <div className="canvas-toolbar">
            <div>
              <div className="eyebrow">PRODUCTION CANVAS</div>
              <h1>中央工作区</h1>
              <p>白底 · 空间优先 · 与 Inspector 用 1px 分隔线</p>
            </div>
          </div>
        </main>
        <aside className="inspector">
          <div className="inspector-header"><h2>Inspector</h2><span className="badge ai-badge">CANDIDATE</span></div>
          <div className="inspector-body">
            <section className="inspector-section">
              <div className="inspector-section-title"><span>继续条件</span><span>4 / 4</span></div>
              <div className="property-list"><div><span>宽度</span><strong>320px</strong></div><div><span>背景</span><strong>白底</strong></div></div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="spec-app">
      <header className="spec-topbar">
        <div>
          <span className="eyebrow">WORKBENCH UI SPECIFICATION</span>
          <h1>公共骨架 · 设计规范</h1>
        </div>
        <p className="spec-meta">
          依据：工作台设计基因 V1.0 · 09 协作基线 §15 · AGENTS.md 已确认规则 · 已完成页面（素材准备 / 内容理解）<br />
          本页直接引用 <code>src/styles.css</code> 的真实 Token 与控件类：新增颜色请先加进 <code>--wb-*</code>。
        </p>
      </header>

      <Section index="01" title="公共骨架" note="结构稳定，视觉只服务于生产路径；中央空间永远优先。">
        <div className="spec-shell-frame" role="img" aria-label="Workbench 默认桌面骨架：真实外壳实例">
          <RealShell />
        </div>
        <ul className="spec-list">
          <li>桌面默认：<strong>48px Header + 220px 左导航 + Flex 工作区 + 320px Inspector</strong>。</li>
          <li>头部从左到右固定为<strong>品牌（220px，与左导航同宽）→ 项目名称 → 模块导航 → 运行状态 → 抽屉开关</strong>；项目名称不放在右上角，右上角不再有「…」。</li>
          <li>项目名称模块只有两种状态，且<strong>没有</strong>「当前项目」这类前置小字：<strong>未创建</strong>＝灰色「+ 创建你的新项目」（点击回到素材准备并聚焦项目名称输入框）；<strong>已创建</strong>＝白色项目名 + 下拉箭头，最多显示 5 个字符（与默认「未命名项目」等宽），超出用省略号，头部宽度不随项目名变化。</li>
          <li>头部项目名只在<strong>点「继续到内容理解」进入下一阶段</strong>时更新：素材准备里输入或修改草稿名不即时改头部。</li>
          <li>抽屉开关只出现在真的有右侧抽屉的页面（导演台全部阶段、组件库组件详情）：展开态为<strong>收起抽屉</strong>图标，收起态为展开图标；没有抽屉的页面（Wiki、组件库列表）不显示该按钮。</li>
          <li>中央与 Inspector 用 <strong>1px 分隔线</strong>建立层级，不依赖阴影；Inspector 禁止嵌套重卡片。</li>
          <li>预览舞台本身可以显示黑底 / 透明棋盘格 / 真实画面，<strong>这不改变工作区白底基线</strong>。</li>
          <li>新增功能不得持续挤压中央生产区。</li>
        </ul>
      </Section>

      <div className="spec-callout spec-callout-strong">
        <strong>共享规则（本页存在的意义）</strong>
        <ul className="spec-list">
          <li>上方骨架是<strong>真实外壳实例</strong>，用的是与主应用完全相同的 DOM 结构与公共类（<code>.topbar</code> / <code>.global-nav</code> / <code>.sidebar</code> / <code>.canvas</code> / <code>.inspector</code>），不是另画的示意图。</li>
          <li>改头部导航、改左侧宽度、改分隔线，只需改 <code>src/styles.css</code>：<strong>本页与所有页面同时变化</strong>。</li>
          <li>任何页面（包括本规范页）<strong>不得重写骨架尺寸与颜色</strong>；页面只能提供内容，不能自带一套外壳。</li>
          <li>要新增颜色或尺寸，先加进 <code>styles.css</code> 的 <code>--wb-*</code>，再回来更新本页说明。</li>
        </ul>
      </div>

      <Section index="02" title="颜色" note="95% 的界面保持黑 / 白 / 灰；彩色只负责语义。">
        <div className="spec-swatches">
          {TOKENS.map(([token, hex, use]) => (
            <article className="spec-swatch" key={token}>
              <span className="spec-chip" style={{background: hex}} />
              <div>
                <code>{token}</code>
                <strong>{hex}</strong>
                <p>{use}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="spec-callout">
          <strong>禁止项</strong>
          <ul className="spec-list">
            <li>禁止大面积橙 / 蓝 / 紫背景；禁止彩色渐变作为装饰。</li>
            <li>禁止同一层级出现多个竞争性主按钮颜色；<strong>Primary 永远是 Orange</strong>。</li>
            <li><strong>Orange 不兼任 Warning</strong>：Pending / 警告固定 Amber。</li>
            <li>页面里不得出现未进 <code>--wb-*</code> 的自造色；需要新语义色时先加 Token 再引用。</li>
          </ul>
        </div>
      </Section>

      <Section index="03" title="字体与密度" note="让它看起来像生产工具，而不是普通后台。">
        <table className="spec-table">
          <thead><tr><th>用途</th><th>规格</th><th>说明</th></tr></thead>
          <tbody>
            {TYPE_SCALE.map(([name, spec, note]) => (
              <tr key={name}><td>{name}</td><td><code>{spec}</code></td><td>{note}</td></tr>
            ))}
          </tbody>
        </table>
        <table className="spec-table">
          <tbody>
            {DENSITY.map(([name, spec, note]) => (
              <tr key={name}><td>{name}</td><td><code>{spec}</code></td><td>{note}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section index="04" title="控件" note="控件种类少，语义明确；避免“每种颜色都是按钮”。">
        <div className="spec-grid">
          <article className="spec-cell">
            <span className="field-label">按钮</span>
            <div className="button-row">
              <button className="button primary" type="button">主操作</button>
              <button className="button secondary" type="button">次要操作</button>
              <button className="button ghost" type="button">低权重</button>
              <button className="button ai" type="button">AI 动作</button>
              <button className="button secondary" type="button" disabled>禁用</button>
            </div>
            <p>Primary = Orange 实心，唯一最高权重；AI 动作用 Purple Soft，不做大面积实心。</p>
          </article>

          <article className="spec-cell">
            <span className="field-label">标签 / 徽标</span>
            <div className="badge-row">
              <span className="badge active">当前</span>
              <span className="badge source">来源</span>
              <span className="badge ai-badge">AI</span>
              <span className="badge ready">就绪</span>
              <span className="badge warning">待处理</span>
            </div>
            <p>只表达状态与来源，不作装饰；浅色 Soft 底 + 饱和文字，高度 20–24px。</p>
          </article>

          <article className="spec-cell">
            <span className="field-label">输入框</span>
            <label className="input-shell"><input defaultValue="项目名称" aria-label="示例输入" /></label>
            <p>1px 中性灰边框、6px 圆角、36px 高；Hover / Focus 使用单层 1px 橙色边框。</p>
          </article>

          <article className="spec-cell">
            <span className="field-label">位置 / 大小</span>
            <strong className="control-feature-title">调整位置和布局</strong>
            <div className="transform-control-demo">
              <label className="transform-row"><span>位置</span><input className="range-input" style={{"--range-progress": "48%"}} type="range" min="0" max="100" defaultValue="48" aria-label="位置" /><output>48%</output></label>
              <label className="transform-row"><span>大小</span><input className="range-input" style={{"--range-progress": "50%"}} type="range" min="50" max="150" defaultValue="100" aria-label="大小" /><output>100%</output></label>
              <label className="transform-row"><span>布局</span><span className="select-shell"><select defaultValue="居中" aria-label="布局"><option>居中</option><option>左对齐</option><option>右对齐</option></select><ChevronDown size={14} /></span></label>
            </div>
            <p>功能标题 14px；位置、大小等调整标签 12px 灰色；滑杆与下拉框均可选。</p>
          </article>

          <article className="spec-cell">
            <span className="field-label">连体胶囊（二选一）</span>
            <div className="segmented-control" role="group" aria-label="示例胶囊">
              <button className="is-active" type="button">横屏 16:9</button>
              <button type="button">竖屏 9:16</button>
            </div>
            <p>一个中性外框；选中项用亮橙边框与文字、浅橙底，并上下浮出 2px。</p>
          </article>

          <article className="spec-cell">
            <span className="field-label">顶部提示（单行胶囊）</span>
            <div className="toast-message">画幅冲突：项目 9:16，视频 16:9<span className="toast-duration">15秒</span></div>
            <p>居中单行；一句语义消息 + 时长 + 关闭；不加图标与说明段落。</p>
          </article>

          <article className="spec-cell">
            <span className="field-label">状态信号</span>
            <div className="spec-states">
              <span>默认：中性、低噪音</span>
              <span>Hover：中性 + 轻提亮</span>
              <span className="is-selected">当前项 / 选中：Orange</span>
              <span className="is-focus">Focus：1px 橙色边框</span>
              <span className="is-disabled">禁用：40–45% 不透明度</span>
            </div>
            <p>选什么改什么；Focus 使用 1px 橙色边框，状态不依赖装饰性动效。</p>
          </article>
        </div>
      </Section>

      <Section index="05" title="已验证页面模式" note="后续页面直接复用这四种模式，不要另起一套。">
        <div className="spec-grid">
          {PAGE_PATTERNS.map(pattern => (
            <article className="spec-cell" key={pattern.name}>
              <span className="field-label">{pattern.name}</span>
              <code className="spec-source">{pattern.source}</code>
              <ul className="spec-list">
                {pattern.rules.map(rule => <li key={rule}>{rule}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section index="06" title="交付前 QA Gate" note="新页面上线前逐条对照；出现未通过项不得标 Verified。">
        <ul className="spec-checklist">
          {QA_GATE.map(item => <li key={item}>{item}</li>)}
        </ul>
      </Section>

      <footer className="spec-footer">
        本页是设计规范的<strong>单一事实源入口</strong>。规范内容与实现发生冲突时：先改 <code>styles.css</code> 的 Token，
        再回来更新本页；不要只在某个页面里改样式。
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
