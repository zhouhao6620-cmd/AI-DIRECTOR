import React, {useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {componentIdOfState} from "../../platform/remotion/component-compositions.js";
import {
  PROJECT_THEMES as THEME_OPTIONS, assertSampleState as assertNavigationSample,
  createSampleState as createNavigationSample,
} from "../../platform/components/four-point-navigation/model.js";
import {
  SURFACES, VARIANTS as CHAPTER_VARIANTS, assertSampleState as assertChapterProgressSample,
  createSampleState as createChapterProgressSample,
} from "../../platform/components/chapter-progress/model.js";
import {
  VARIANTS as SUBTITLE_VARIANTS, assertSampleState as assertSubtitleTrackSample,
  createSampleState as createSubtitleTrackSample,
} from "../../platform/components/subtitle-track/model.js";
import {buildControlPlan, groupCatalog, instanceLocus} from "./control-plan.js";
import {GenericInspector} from "./inspector.jsx";
import {generatedComponentCatalog} from "./component-catalog.generated.js";
import {ComponentPreview, PLAYBACK_RATES, PREVIEW_BACKGROUNDS, resolveComposition} from "../shared/component-preview/index.js";
import "./style.css";

const themeNames = {BLUE: "蓝", ORANGE: "橙", RED: "红", PURPLE: "紫"};
const instanceOf = state => state.product.globalPackaging[0] ?? state.product.shots[0].componentInstances[0];
// 有专用编辑器的组件：保留手写面板；其余组件由同步脚本生成的目录补齐，走通用面板。
const editorCatalog = [
  {
    componentId: "CMP-NAV-004", title: "逐项导航", name: "FourPointNavigation",
    note: "要点依次出现并保留，当前讲述项依次高亮。底色仅用于查看透明效果。",
    createState: () => createNavigationSample(), assertState: assertNavigationSample, Editor: NavigationEditor,
  },
  {
    componentId: "CMP-CHP-001", title: "章节进度条", name: "ChapterProgress",
    note: "顶部常驻章节地图：当前章按真实区间高亮，进度随时间推进。底色仅用于查看透明效果。",
    createState: () => createChapterProgressSample(), assertState: assertChapterProgressSample, Editor: ChapterProgressEditor,
  },
  {
    componentId: "CMP-SUB-001", title: "字幕轨", name: "SubtitleTrack",
    note: "字幕按真实时间轴切换，中文主行加可选英文小字；空档时间不显示字幕。",
    createState: () => createSubtitleTrackSample(), assertState: assertSubtitleTrackSample, Editor: SubtitleTrackEditor,
  },
];
const editorIds = new Set(editorCatalog.map(entry => entry.componentId));
// 专用编辑器组件没有 definition/contentSchema，从生成的目录里补齐定义，实验页才能按定义解释能力。
const generatedById = new Map(generatedComponentCatalog.map(entry => [entry.componentId, entry]));
const componentCatalog = [
  ...editorCatalog.map(entry => ({...generatedById.get(entry.componentId), ...entry})),
  ...generatedComponentCatalog.filter(entry => !editorIds.has(entry.componentId)),
];
const entryById = new Map(componentCatalog.map(entry => [entry.componentId, entry]));

function App() {
  const [activeId, setActiveId] = useState(componentCatalog[0].componentId);
  const [states, setStates] = useState(() => Object.fromEntries(componentCatalog.map(entry => [entry.componentId, entry.createState()])));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [exportError, setExportError] = useState("");
  const [background, setBackground] = useState("checker");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [safeArea, setSafeArea] = useState(false);
  const player = useRef(null);
  const nodeCounter = useRef(10);
  const activeDefinition = componentCatalog.find(entry => entry.componentId === activeId) ?? componentCatalog[0];
  const state = states[activeId];
  const instance = instanceOf(state);
  const meta = state.technical;
  const locus = instanceLocus(state);
  let error = "";
  try { activeDefinition.assertState(state); } catch (caught) { error = caught.message; }
  // 组合解析与投影由共享预览内核算，页面只读结果（巡检脚本的 QA 钩子也由内核注册）。
  const previewState = useMemo(() => resolveComposition(state), [state]);
  const projection = previewState.ok ? previewState.projection : null;
  const plan = useMemo(() => buildControlPlan({
    componentId: activeId, definition: activeDefinition.definition,
    contentSchema: activeDefinition.contentSchema, sampleState: state,
  }), [activeId, activeDefinition, state]);
  // 巡检句柄常驻：QA 脚本随时能读到最新状态，不会在状态更新的一瞬间消失。
  const latest = useRef({state, activeId});
  latest.current = {state, activeId};

  const update = fn => setStates(previous => {
    const next = structuredClone(previous);
    fn(next[activeId], instanceOf(next[activeId]), next[activeId]);
    return next;
  });
  const replaceState = nextState => setStates(previous => ({...previous, [componentIdOfState(nextState) ?? activeId]: nextState}));
  const resetComponent = componentId => setStates(previous => ({...previous, [componentId]: entryById.get(componentId).createState()}));

  useEffect(() => { setResult(null); setExportError(""); }, [state]);
  // QA 钩子：内核负责注册 / 清理，实验页只提供自己的业务方法（状态管理与组件切换）。
  const qaHandle = useMemo(() => ({
    names: ["componentLabQA", "componentSampleQA"],
    api: {
      selectComponent: componentId => setActiveId(componentId),
      getComponent: () => latest.current.activeId,
      components: () => componentCatalog.map(entry => entry.componentId),
      setState: nextState => replaceState(nextState),
      getState: () => structuredClone(latest.current.state),
      resetComponent: componentId => resetComponent(componentId),
    },
  }), []);

  async function exportMov() {
    setBusy(true); setResult(null); setExportError("");
    const snapshot = structuredClone(state);
    try {
      const response = await fetch("/api/component-sample/render", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(snapshot)});
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "导出未完成，请重试。");
      setResult(body);
    } catch (caught) { setExportError(caught.message); }
    finally { setBusy(false); }
  }

  const ComponentEditor = activeDefinition.Editor;
  return <div className="lab">
    <header><strong>{activeDefinition.title}</strong><span>{activeDefinition.name}</span>
      <em>组件样板</em></header>
    <main>
      <ComponentIndex query={query} onQuery={setQuery} activeId={activeId} onSelect={setActiveId} disabled={busy}/>
      <section className="preview">
        <div className="preview-toolbar"><span>{state.product.aspectRatio} · {meta.width} × {meta.height}</span>
          <label>播放倍速 <select aria-label="播放倍速" data-preview-rate value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))}>{PLAYBACK_RATES.map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
          <label>预览底色 <select aria-label="预览底色" value={background} onChange={event => setBackground(event.target.value)}>{Object.values(PREVIEW_BACKGROUNDS).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="preview-safe-toggle"><input type="checkbox" aria-label="安全区标识" data-preview-safe-toggle checked={safeArea} onChange={event => setSafeArea(event.target.checked)} /> 安全区标识</label></div>
        <div className="player-space">
          <ComponentPreview state={state} surface="lab" background={background} playbackRate={playbackRate} safeArea={safeArea}
            playerRef={player} qaHandle={qaHandle}
            controls={new URLSearchParams(location.search).get("pixels") !== "1"}
            validate={nextState => activeDefinition.assertState(nextState)}
            placeholder={<p className="empty-preview">请先完善右侧内容</p>}/>
        </div>
        <p className="preview-note">{activeDefinition.note}</p>
      </section>
      <aside><fieldset disabled={busy}>
        {ComponentEditor
          ? <ComponentEditor state={state} instance={instance} meta={meta} update={update} nodeCounter={nodeCounter}/>
          : <GenericInspector key={activeId} entry={activeDefinition} state={state} plan={plan} catalog={componentCatalog} update={update} nodeCounter={nodeCounter}/>}
        {error && <p role="alert" className="validation">{error}</p>}
        <button className="primary" disabled={!!error || busy} onClick={exportMov}>{busy ? "正在导出…" : "导出透明 MOV"}</button>
      </fieldset>
      {result && <p className="download"><a href={result.url} download="Motion Layer.mov">下载透明 MOV</a><span>{result.width} × {result.height} · {result.seconds} 秒</span></p>}
      {exportError && <p role="alert" className="validation">{exportError}</p>}
      <p className="lab-note">当前为独立组件样板；编辑内容仅保留在本页。</p>
      </aside>
    </main>
  </div>;
}

// 左侧组件目录：按类别分组、可搜索、可键盘切换。选中态用橙色信号。
function ComponentIndex({query, onQuery, activeId, onSelect, disabled}) {
  const pendingFocus = useRef(false);
  const normalized = query.trim().toLowerCase();
  const matched = componentCatalog.filter(entry => !normalized
    || entry.title.toLowerCase().includes(normalized)
    || entry.name.toLowerCase().includes(normalized)
    || entry.componentId.toLowerCase().includes(normalized));
  const groups = groupCatalog(matched);
  const flat = groups.flatMap(group => group.entries.map(entry => entry.componentId));

  const move = (from, delta) => {
    if (!flat.length) return;
    const index = Math.max(0, flat.indexOf(from));
    const next = flat[Math.min(flat.length - 1, Math.max(0, index + delta))];
    pendingFocus.current = true;
    onSelect(next);
  };
  // 选择在 React 提交后才落到 DOM，所以键盘切换后在这里把焦点交给新选中项。
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    document.querySelector(`[data-component-tab="${activeId}"]`)?.focus();
  }, [activeId]);
  const onKeyDown = event => {
    // 搜索框自己处理按键（Enter / ↓ 进入列表），列表按键不在这里重复处理。
    if (event.target?.dataset?.labSearch !== undefined) return;
    const from = event.target?.dataset?.componentTab ?? activeId;
    if (event.key === "ArrowDown") { event.preventDefault(); move(from, 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(from, -1); }
    else if (event.key === "Home") { event.preventDefault(); move(flat[0], 0); }
    else if (event.key === "End") { event.preventDefault(); move(flat.at(-1), 0); }
  };
  const selectFirst = () => { if (!flat.length) return; pendingFocus.current = true; onSelect(flat[0]); };
  return <nav className="lab-index" aria-label="组件目录" onKeyDown={onKeyDown}>
    <div className="lab-search">
      <input type="search" aria-label="搜索组件" data-lab-search value={query} placeholder="搜索组件名或 ID"
        onChange={event => onQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); selectFirst(); }
        }}/>
      <span>{matched.length} / {componentCatalog.length}</span>
    </div>
    <div className="lab-groups" role="listbox" aria-label="组件">
      {groups.map(group => <section key={group.category} className="lab-group">
        <h2>{group.category}<span>{group.entries.length}</span></h2>
        <ul>
          {group.entries.map(entry => <li key={entry.componentId}>
            <button type="button" role="option" data-component-tab={entry.componentId} tabIndex={entry.componentId === activeId ? 0 : -1}
              aria-selected={entry.componentId === activeId} className={entry.componentId === activeId ? "is-on" : ""} disabled={disabled}
              onClick={() => onSelect(entry.componentId)}>
              <span>{entry.title}</span><em>{entry.componentId}</em>
            </button>
          </li>)}
        </ul>
      </section>)}
    </div>
    {!matched.length && <p className="lab-empty">没有匹配的组件，换个名称或 ID 试试。</p>}
  </nav>;
}

function CanvasFields({state, update}) {
  return <>
    <label>画幅<select aria-label="画幅" data-lab-field="aspectRatio" value={state.product.aspectRatio} onChange={event => update(next => {
      next.product.aspectRatio = event.target.value;
      next.technical.width = event.target.value === "9:16" ? 1080 : 1920;
      next.technical.height = event.target.value === "9:16" ? 1920 : 1080;
    })}><option>9:16</option><option>16:9</option></select></label>
    <label>项目主题<select aria-label="项目主题" data-lab-field="theme.project" value={state.product.theme} onChange={event => update(next => {next.product.theme = event.target.value;})}>{THEME_OPTIONS.map(theme => <option key={theme} value={theme}>{themeNames[theme]}</option>)}</select></label>
    <label>组件主题<select aria-label="组件主题" data-lab-field="theme.instance" value={instanceOf(state).props.theme} onChange={event => update(next => {instanceOf(next).props.theme = event.target.value;})}><option value="SOURCE">来源原色（默认）</option>{THEME_OPTIONS.map(theme => <option key={theme} value={theme}>{themeNames[theme]}</option>)}</select></label>
  </>;
}

function NavigationEditor({state, instance, meta, update, nodeCounter}) {
  return <>
    <h2>内容</h2>
    <label>标题<input aria-label="标题" data-lab-field="content.title" value={instance.props.content.title} onChange={event => update((next, nextInstance) => {nextInstance.props.content.title = event.target.value;})}/></label>
    <div className="items-heading"><span>要点 · {instance.props.content.items.length} / 5</span><button disabled={instance.props.content.items.length >= 5} onClick={() => update((next, nextInstance) => nextInstance.props.content.items.push({id: `new-${nodeCounter.current++}`, label: "新要点"}))}>添加要点</button></div>
    {instance.props.content.items.map((item, index) => <div className="item-row" key={item.id}>
      <span>{index + 1}</span><input aria-label={`要点 ${index + 1}`} data-lab-field={`content.items.${index}.label`} value={item.label} onChange={event => update((next, nextInstance) => {nextInstance.props.content.items[index].label = event.target.value;})}/>
      <button aria-label={`删除要点 ${index + 1}`} disabled={instance.props.content.items.length <= 3} onClick={() => update((next, nextInstance) => nextInstance.props.content.items.splice(index, 1))}>×</button>
    </div>)}
    <h2>画面</h2>
    <CanvasFields state={state} update={update}/>
    <label>大小 <output>{instance.props.size.toFixed(2)}×</output><input aria-label="大小" data-lab-field="size" type="range" min="0.8" max="1.2" step="0.05" value={instance.props.size} onChange={event => update((next, nextInstance) => {nextInstance.props.size = Number(event.target.value);})}/></label>
    {[["x", "水平位置"], ["y", "垂直位置"]].map(([key, label]) => <label key={key}>{label}<input aria-label={label} data-lab-field={`position.${key}`} type="range" min="0" max="1" step="0.05" value={instance.props.position[key]} onChange={event => update((next, nextInstance) => {nextInstance.props.position[key] = Number(event.target.value);})}/></label>)}
    <div className="timing"><label>出现时间（秒）<input aria-label="出现时间" type="number" min="0" step="0.1" value={instance.timing.startFrame / meta.fps} onChange={event => update((next, nextInstance) => {nextInstance.timing.startFrame = Math.round(Number(event.target.value) * meta.fps);})}/></label>
      <label>显示时长（秒）<input aria-label="显示时长" type="number" min="3" step="0.1" value={instance.timing.durationInFrames / meta.fps} onChange={event => update((next, nextInstance) => {nextInstance.timing.durationInFrames = Math.round(Number(event.target.value) * meta.fps);})}/></label></div>
  </>;
}

function ChapterProgressEditor({state, instance, update}) {
  const chapters = instance.props.content.chapters;
  const seconds = ms => Number((ms / 1000).toFixed(2));
  const durationMs = meta => (meta.durationInFrames / meta.fps) * 1000;
  return <>
    <h2>章节</h2>
    <div className="items-heading"><span>章节 · {chapters.length} / 8</span><button disabled={chapters.length >= 8} onClick={() => update(next => {
      const nextInstance = instanceOf(next);
      const list = nextInstance.props.content.chapters;
      const last = list.at(-1);
      const total = durationMs(next.technical);
      const originalEnd = last.endMs;
      let startMs;
      // A new chapter must stay inside the real timeline: extend after the last
      // chapter when there is room, otherwise split the last interval in half.
      if (originalEnd + 1000 <= total) startMs = originalEnd;
      else {
        startMs = Math.floor((last.startMs + originalEnd) / 2);
        last.endMs = startMs;
      }
      list.push({id: `chapter-${list.length + 1}-${Date.now().toString(36).slice(-4)}`, label: "新章节", startMs, endMs: originalEnd});
    })}>添加章节</button></div>
    {chapters.map((chapter, index) => <div className="chapter-row" key={chapter.id}>
      <div className="item-row"><span>{index + 1}</span>
        <input aria-label={`章节名称 ${index + 1}`} data-lab-field={`content.chapters.${index}.label`} value={chapter.label} onChange={event => update((next, nextInstance) => {nextInstance.props.content.chapters[index].label = event.target.value;})}/>
        <button aria-label={`删除章节 ${index + 1}`} onClick={() => update((next, nextInstance) => nextInstance.props.content.chapters.splice(index, 1))}>×</button></div>
      <div className="cue-time">
        <label>开始（秒）<input aria-label={`章节 ${index + 1} 开始`} type="number" min="0" step="0.1" value={seconds(chapter.startMs)} onChange={event => update((next, nextInstance) => {nextInstance.props.content.chapters[index].startMs = Math.round(Number(event.target.value) * 1000);})}/></label>
        <label>结束（秒）<input aria-label={`章节 ${index + 1} 结束`} type="number" min="0.1" step="0.1" value={seconds(chapter.endMs)} onChange={event => update((next, nextInstance) => {nextInstance.props.content.chapters[index].endMs = Math.round(Number(event.target.value) * 1000);})}/></label>
      </div>
    </div>)}
    <p className="field-note" data-chapter-capacity>名称上限 12 字；9:16 放 8 个章节时有效容量约 7 字，放不下会明确拒绝，不裁切文字。</p>
    <h2>样式</h2>
    <label>进度形态<select aria-label="进度形态" data-lab-field="variant" value={instance.props.variant} onChange={event => update((next, nextInstance) => {nextInstance.props.variant = event.target.value;})}>{CHAPTER_VARIANTS.map(variant => <option key={variant} value={variant}>{variant === "FILL" ? "整条上色 · 往前推" : "细线 · 只在当前章底部"}</option>)}</select></label>
    <label className="inline"><input aria-label="显示进度" type="checkbox" checked={instance.props.showProgress} onChange={event => update((next, nextInstance) => {nextInstance.props.showProgress = event.target.checked;})}/> 显示进度</label>
    <label>底色<select aria-label="底色" value={instance.props.surface} onChange={event => update((next, nextInstance) => {nextInstance.props.surface = event.target.value;})}>{SURFACES.map(surface => <option key={surface} value={surface}>{surface === "DARK" ? "暗底" : "亮底"}</option>)}</select></label>
    {[["x", "水平位置"], ["y", "垂直位置"]].map(([key, label]) => <label key={key}>{label}<input aria-label={label} data-lab-field={`position.${key}`} type="range" min="0" max="1" step="0.01" value={instance.props.position[key]} onChange={event => update((next, nextInstance) => {nextInstance.props.position[key] = Number(event.target.value);})}/></label>)}
    <label>大小 <output>{instance.props.size.toFixed(2)}×</output><input aria-label="大小" data-lab-field="size" type="range" min="0.5" max="2" step="0.01" value={instance.props.size} onChange={event => update((next, nextInstance) => {nextInstance.props.size = Number(event.target.value);})}/></label>
    <h2>画面</h2>
    <CanvasFields state={state} update={update}/>
  </>;
}

function SubtitleTrackEditor({state, instance, update}) {
  const cues = instance.props.content.cues;
  const seconds = ms => Number((ms / 1000).toFixed(2));
  return <>
    <h2>字幕</h2>
    <div className="items-heading"><span>字幕 · {cues.length} / 500</span><button disabled={cues.length >= 500} onClick={() => update(next => {
      const nextInstance = instanceOf(next);
      const list = nextInstance.props.content.cues;
      const last = list.at(-1);
      const total = (next.technical.durationInFrames / next.technical.fps) * 1000;
      const originalEnd = last.endMs;
      let startMs;
      // Same rule as the chapter editor: keep the real timeline valid, either by
      // extending after the last cue or by splitting it in half.
      if (originalEnd + 1000 <= total) startMs = originalEnd;
      else {
        startMs = Math.floor((last.startMs + originalEnd) / 2);
        last.endMs = startMs;
      }
      list.push({id: `cue-${String(list.length + 1).padStart(4, "0")}-${Date.now().toString(36).slice(-4)}`, startMs, endMs: originalEnd, text: "新字幕", translation: "New cue"});
    })}>添加字幕</button></div>
    {cues.map((cue, index) => <div className="cue-row" key={cue.id}>
      <div className="item-row"><span>{index + 1}</span>
        <input aria-label={`字幕 ${index + 1} 中文`} data-lab-field={`content.cues.${index}.text`} value={cue.text} onChange={event => update((next, nextInstance) => {nextInstance.props.content.cues[index].text = event.target.value;})}/>
        <button aria-label={`删除字幕 ${index + 1}`} onClick={() => update((next, nextInstance) => nextInstance.props.content.cues.splice(index, 1))}>×</button></div>
      <input aria-label={`字幕 ${index + 1} 英文`} data-lab-field={`content.cues.${index}.translation`} value={cue.translation ?? ""} onChange={event => update((next, nextInstance) => {
        if (event.target.value) nextInstance.props.content.cues[index].translation = event.target.value;
        else delete nextInstance.props.content.cues[index].translation;
      })}/>
      <div className="cue-time">
        <label>开始（秒）<input aria-label={`字幕 ${index + 1} 开始`} type="number" min="0" step="0.1" value={seconds(cue.startMs)} onChange={event => update((next, nextInstance) => {nextInstance.props.content.cues[index].startMs = Math.round(Number(event.target.value) * 1000);})}/></label>
        <label>结束（秒）<input aria-label={`字幕 ${index + 1} 结束`} type="number" min="0.1" step="0.1" value={seconds(cue.endMs)} onChange={event => update((next, nextInstance) => {nextInstance.props.content.cues[index].endMs = Math.round(Number(event.target.value) * 1000);})}/></label>
      </div>
    </div>)}
    <p className="field-note" data-keyword-hint>中文主行支持来源的 *关键词* 标记，关键词用强调色点亮。</p>
    <h2>样式</h2>
    <label>字幕变体<select aria-label="字幕变体" data-lab-field="variant" value={instance.props.variant} onChange={event => update((next, nextInstance) => {nextInstance.props.variant = event.target.value;})}>{SUBTITLE_VARIANTS.map(variant => <option key={variant} value={variant}>{variant === "BILINGUAL" ? "中文主行 + 英文小字" : "只显示中文主行"}</option>)}</select></label>
    <label className="inline"><input aria-label="描边" type="checkbox" checked={instance.props.stroke} onChange={event => update((next, nextInstance) => {nextInstance.props.stroke = event.target.checked;})}/> 描边（来源默认关闭）</label>
    {[["x", "水平位置"], ["y", "垂直位置"]].map(([key, label]) => <label key={key}>{label}<input aria-label={label} data-lab-field={`position.${key}`} type="range" min="0" max="1" step="0.05" value={instance.props.position[key]} onChange={event => update((next, nextInstance) => {nextInstance.props.position[key] = Number(event.target.value);})}/></label>)}
    <label>大小 <output>{instance.props.size.toFixed(2)}×</output><input aria-label="大小" data-lab-field="size" type="range" min="0.5" max="2" step="0.01" value={instance.props.size} onChange={event => update((next, nextInstance) => {nextInstance.props.size = Number(event.target.value);})}/></label>
    <h2>画面</h2>
    <CanvasFields state={state} update={update}/>
  </>;
}

createRoot(document.getElementById("root")).render(<App/>);
