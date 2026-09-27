// RemotionUI 来源库 · 本地预览台（最小实现）
//
// 用途：把 RemotionGit 里 vendor 进来的上游组件**真实渲染**一遍，让用户确认这些
// 抓到本地的资产到底长什么样、哪些能直接用。
//
// 边界：这是**预览沙箱**，不是正式组件注册——不写 platform/**，不进能力索引，
// 也不代表已适配（中文排版 / 双画幅 / 四套主题 / 透明输出都还没做）。
import React from "react";
import {createRoot} from "react-dom/client";
import {ComponentPreview, PLAYBACK_RATES, PREVIEW_BACKGROUNDS} from "../shared/component-preview/index.js";
import {previewModules, skippedEntries} from "./vendor/index.js";
import manifest from "./vendor/manifest.json";
import "../styles.css";
import "./preview.css";

// 少量条目的示例参数（取自官方文档示例）：没有参数的组件用内部默认值。
const SAMPLE_PROPS = {
  "bubble-chart-pack": {bubbles: [{label: "Atoms", value: 42}, {label: "Blocks", value: 31}, {label: "Signals", value: 26}, {label: "Cuts", value: 18}]},
  "donut-chart": {data: [{label: "Atoms", value: 42}, {label: "Blocks", value: 31}, {label: "Signals", value: 26}]},
  "connector-lines": {},
  "stat-card": {value: "42", label: "本机样例"},
  "quote-card": {quote: "关系清晰，外观可变。"},
  "timeline-steps": {steps: [{title: "确认目标"}, {title: "拆分步骤"}, {title: "逐项执行"}]},
};

// 入场 / 转场 / 文字类原子动效本身只负责"怎么出现"，没有内容就是黑的。
// 预览时统一塞一个示例内容，才能看出动效效果。
const SAMPLE_CHILD = (
  <div style={{
    width: 520, padding: "28px 32px", borderRadius: 12,
    background: "linear-gradient(135deg,#26334F,#101728)",
    border: "1px solid rgba(255,255,255,0.12)", color: "#E6E9F2",
    font: '600 34px/1.4 "PingFang SC", Inter, sans-serif', textAlign: "center",
  }}>
    示例内容
    <div style={{marginTop: 10, fontSize: 18, fontWeight: 400, opacity: 0.7}}>用来观察动效</div>
  </div>
);

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {error: null};
  }
  static getDerivedStateFromError(error) {
    return {error};
  }
  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({error: null});
  }
  render() {
    if (this.state.error) {
      return <div className="preview-error" role="alert">渲染失败：{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

function App() {
  // 只列可渲染的组件；工具/片段依赖单列计数（它们是组件的依赖，不是给人看的组件）
  const entries = manifest.vendored.filter(entry => entry.previewable);
  const toolCount = manifest.vendored.length - entries.length;
  const FEATURED = ["counter", "typewriter", "progress-bar", "bubble-chart-pack", "donut-chart", "timeline-steps", "stat-card", "quote-card"];
  const [query, setQuery] = React.useState("");
  const [activeName, setActiveName] = React.useState(entries[0]?.name ?? null);
  const [module, setModule] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [showSkipped, setShowSkipped] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState("16:9");
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [background, setBackground] = React.useState("dark");
  const [safeArea, setSafeArea] = React.useState(false);

  const active = entries.find(entry => entry.name === activeName) ?? null;

  React.useEffect(() => {
    let cancelled = false;
    setModule(null);
    setLoadError(null);
    const loader = previewModules[activeName];
    if (!loader) return undefined;
    loader()
      .then(loaded => { if (!cancelled) setModule(loaded); })
      .catch(error => { if (!cancelled) setLoadError(error.message); });
    return () => { cancelled = true; };
  }, [activeName]);

  const Component = module
    ? module[active?.exportName] ?? Object.values(module).find(value => typeof value === "function") ?? null
    : null;

  const filtered = entries.filter(entry =>
    !query || `${entry.name} ${entry.description} ${entry.category}`.toLowerCase().includes(query.toLowerCase()));
  const grouped = filtered.reduce((map, entry) => {
    const key = entry.category ?? "other";
    map[key] = map[key] ?? [];
    map[key].push(entry);
    return map;
  }, {});

  // 一律带上示例内容：只吃 children 的动效类才看得见；不吃 children 的组件会忽略它。
  const props = {children: SAMPLE_CHILD, ...(SAMPLE_PROPS[activeName] ?? {})};

  return (
    <div className="preview-app">
      <header className="preview-top">
        <div>
          <span className="eyebrow">REMOTIONUI SOURCE LIBRARY</span>
          <h1>本地预览台</h1>
        </div>
        <p>
          Raw 阶段 · 共 {manifest.counts.total} 项 · 可本地渲染 <strong>{entries.length}</strong> 个组件
          （另有 {toolCount} 个工具/片段依赖已一并 vendor）· 暂不可渲染 {manifest.counts.skipped} 项
          <br />
          这是预览沙箱，<strong>不是正式组件</strong>：未做中文排版、双画幅、主题与透明输出适配，也未进能力索引。
        </p>
      </header>

      <div className="preview-body">
        <aside className="preview-nav">
          <label className="preview-search">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索条目" aria-label="搜索条目" />
          </label>
          <div className="preview-featured">
            <span className="preview-nav-group">推荐先看</span>
            <div className="preview-featured-row">
              {FEATURED.filter(name => entries.some(entry => entry.name === name)).map(name => (
                <button className={`preview-chip ${name === activeName ? "is-active" : ""}`} key={name}
                  type="button" onClick={() => setActiveName(name)}>
                  {entries.find(entry => entry.name === name)?.label ?? name}
                </button>
              ))}
            </div>
          </div>
          <div className="preview-nav-list">
            {Object.entries(grouped).map(([category, list]) => (
              <section key={category}>
                <div className="preview-nav-group">{category} · {list.length}</div>
                {list.map(entry => (
                  <button className={`preview-nav-item ${entry.name === activeName ? "is-active" : ""}`}
                    key={entry.name} type="button" onClick={() => setActiveName(entry.name)}>
                    <span>{entry.label ?? entry.name}<small className="preview-nav-en">{entry.name}</small></span>
                    <small>{entry.dependencyCount} 文件</small>
                  </button>
                ))}
              </section>
            ))}
          </div>
          <button className="preview-skipped-toggle" type="button" onClick={() => setShowSkipped(value => !value)}>
            {showSkipped ? "收起" : "查看"}暂不可渲染的 {manifest.counts.skipped} 项
          </button>
          {showSkipped && (
            <ul className="preview-skipped">
              {skippedEntries.slice(0, 40).map(entry => (
                <li key={entry.name}><strong>{entry.label ?? entry.name}<small className="preview-nav-en">{entry.name}</small></strong><span>{entry.reason}</span></li>
              ))}
              {skippedEntries.length > 40 && <li>…还有 {skippedEntries.length - 40} 项</li>}
            </ul>
          )}
        </aside>

        <main className="preview-main">
          {active ? (
            <>
              <div className="preview-head">
                <h2>{active.label ?? active.name}<small className="preview-head-en">{active.name}</small></h2>
                <span className="tag">{active.category}</span>
                <span className="tag">依赖 {active.dependencyCount} 个文件</span>
              </div>
              <p className="preview-desc">{active.description}</p>
              <div className="raw-preview-tools" aria-label="预览工具">
                <label>画幅 <select aria-label="画幅" value={aspectRatio} onChange={event => setAspectRatio(event.target.value)}><option value="16:9">16:9</option><option value="9:16">9:16</option></select></label>
                <label>播放倍速 <select aria-label="播放倍速" value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))}>{PLAYBACK_RATES.map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
                <label>预览底色 <select aria-label="预览底色" value={background} onChange={event => setBackground(event.target.value)}>{Object.values(PREVIEW_BACKGROUNDS).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label><input type="checkbox" aria-label="安全区标识" checked={safeArea} onChange={event => setSafeArea(event.target.checked)}/> 安全区标识</label>
              </div>
              <div className="preview-stage">
                {loadError && <div className="preview-error" role="alert">模块加载失败：{loadError}</div>}
                {!loadError && !Component && <div className="preview-loading">正在加载组件…</div>}
                {Component && (
                  <Boundary resetKey={activeName}>
                    <ComponentPreview
                      rawComponent={Component}
                      rawInputProps={props}
                      rawMeta={{key: activeName, width: aspectRatio === "16:9" ? 960 : 540, height: aspectRatio === "16:9" ? 540 : 960, fps: 30, durationInFrames: 120}}
                      surface={{className: "preview-surface", viewportOffset: 300}}
                      background={background}
                      playbackRate={playbackRate}
                      safeArea={safeArea}
                      initialFrame={60}
                      controls
                      loop
                    />
                  </Boundary>
                )}
              </div>
              <div className="preview-meta">
                <a href={active.docsUrl} target="_blank" rel="noopener">看官方效果 ↗</a>
                <code>{active.entryFile}</code>
                <code>npx remotion-ui@latest add {active.name}</code>
              </div>
            </>
          ) : <p className="preview-loading">左侧选择一个条目。</p>}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
