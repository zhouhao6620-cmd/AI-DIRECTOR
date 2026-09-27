import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, BookOpen, CheckCircle2, ChevronDown, CircleHelp, Clapperboard,
  FileText, FileVideo, Film, Info, LayoutGrid, Library, LoaderCircle, Lock,
  PanelRightClose, PanelRightOpen, Plus, RefreshCw, UploadCloud, X, XCircle,
} from "lucide-react";
import { ComponentLibraryRoute } from "./component-library/ComponentLibraryPage.jsx";

// 头部项目名模块只有两种状态：未创建 = 灰色创建入口；已创建 = 白色项目名。
// 项目名最多显示 5 个字符（与默认「未命名项目」等宽），超出用省略号，头部宽度不随项目名变化。
const HEADER_PROJECT_FALLBACK = "未命名项目";
const HEADER_PROJECT_MAX_CHARS = HEADER_PROJECT_FALLBACK.length;
function headerProjectName(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return HEADER_PROJECT_FALLBACK;
  return trimmed.length <= HEADER_PROJECT_MAX_CHARS ? trimmed : `${trimmed.slice(0, HEADER_PROJECT_MAX_CHARS - 1)}…`;
}

const modules = [
  { id: "director", label: "导演台", icon: Clapperboard },
  { id: "library", label: "组件库", icon: Library },
  { id: "wiki", label: "Wiki", icon: BookOpen },
];
const stageDefinitions = [
  { number: "01", label: "素材准备" },
  { number: "02", label: "内容理解" },
  { number: "03", label: "导演分镜编排" },
  { number: "04", label: "智能包装生产" },
  { number: "05", label: "导出" },
];
const wikiItems = ["产品总览", "生产流程", "AI 导演系统", "资产与组件系统", "Workbench", "技术与扩展"];

function Brand() {
  return <div className="brand" aria-label="AI Director Workbench"><span className="brand-mark"><Film size={16} strokeWidth={2} /></span><span className="brand-name">AI DIRECTOR</span><span className="version-chip">V0</span></div>;
}

function Header({ activeModule, onModuleChange, projectName, projectCreated, onCreateProject, drawer, onToggleDrawer }) {
  return (
    <header className="topbar">
      <Brand />
      {/* 项目名称模块紧跟品牌区：左导航那一栏只放 Logo，项目切换放在它的右侧。 */}
      <div className="topbar-project">
        {/* 未创建：灰色「+ 创建你的新项目」，点击回到素材准备并聚焦项目名称输入框；已创建：白色项目名。 */}
        <button className={`project-switcher ${projectCreated ? "is-created" : "is-empty"}`} type="button" onClick={onCreateProject}
          aria-label={projectCreated ? projectName : "创建你的新项目"}
          title={projectCreated ? projectName : "前往素材准备填写项目名称"}>
          {projectCreated ? <span className="project-switcher-name">{headerProjectName(projectName)}</span> : <><Plus size={14} strokeWidth={2} /><span className="project-switcher-name">创建你的新项目</span></>}
          {projectCreated && <ChevronDown size={14} />}
        </button>
      </div>
      <nav className="global-nav" aria-label="全局模块">
        {modules.map(({ id, label, icon: Icon }) => <button className={`global-nav-item ${activeModule === id ? "is-active" : ""}`} key={id} onClick={() => onModuleChange(id)} type="button"><Icon size={15} strokeWidth={1.8} /><span>{label}</span></button>)}
      </nav>
      <div className="topbar-actions">
        <span className="mock-status"><span className="mock-dot is-local" /> LOCAL RUNTIME</span>
        {/* 抽屉开关只出现在真的有右侧抽屉的页面：导演台的全部阶段与组件库的组件详情。 */}
        {drawer && <button className="icon-button dark" aria-label={drawer.open ? "收起右侧抽屉" : "展开右侧抽屉"}
          aria-expanded={drawer.open} title={drawer.open ? "收起右侧抽屉" : "展开右侧抽屉"}
          onClick={onToggleDrawer} type="button">
          {drawer.open ? <PanelRightClose size={17} strokeWidth={1.8} /> : <PanelRightOpen size={17} strokeWidth={1.8} />}
        </button>}
      </div>
    </header>
  );
}

function Sidebar({ activeModule, currentStage }) {
  return (
    <aside className="sidebar">
      {activeModule === "director" && <>
        <div className="sidebar-heading"><span>项目生命周期</span><span className="sidebar-count">{currentStage} / 5</span></div>
        <div className="stage-list">{stageDefinitions.map((stage) => {
          const stageNumber = Number(stage.number);
          const isActive = stageNumber === currentStage;
          const complete = stageNumber < currentStage;
          const locked = stageNumber > currentStage;
          return <button className={`stage-item ${isActive ? "is-active" : ""} ${complete ? "is-complete" : ""}`} disabled={!isActive} key={stage.number} type="button"><span className="stage-number">{stage.number}</span><span className="stage-copy"><span className="stage-label">{stage.label}</span></span>{locked ? <Lock className="stage-status" size={13} /> : complete ? <CheckCircle2 className="stage-complete" size={14} /> : <span className="active-pulse" />}</button>;
        })}</div>
        <div className="sidebar-divider" />
        <div className="sidebar-note"><Info size={14} /><p>源文件仅进入本机运行目录；AI 结果保持 Candidate。</p></div>
      </>}
      {activeModule === "wiki" && <SimpleSidebar title="知识目录" items={wikiItems} wiki />}
      <div className="sidebar-footer"><button type="button"><CircleHelp size={15} /><span>使用说明</span></button></div>
    </aside>
  );
}

function SimpleSidebar({ title, items, wiki = false }) {
  return <><div className="sidebar-heading"><span>{title}</span><span className="skeleton-label">骨架</span></div><div className={`plain-nav-list ${wiki ? "wiki-list" : ""}`}>{items.map((item, index) => <button className={index === 0 ? "is-active" : ""} key={item} type="button">{wiki && <span className="nav-index">0{index + 1}</span>}<span>{item}</span>{!wiki && <span className="nav-index">0{index + 1}</span>}</button>)}</div></>;
}

function MaterialFileCard({ file, kind, onSelect, onReplace }) {
  const inputRef = useRef(null);
  const isVideo = kind === "video";
  const Icon = isVideo ? FileVideo : FileText;
  const title = isVideo ? "上传视频" : "上传 SRT 字幕";
  const format = isVideo ? "MP4 / MOV" : "SRT";
  const chooseFile = () => inputRef.current?.click();
  const input = <input className="visually-hidden" ref={inputRef} type="file" accept={isVideo ? ".mp4,.mov,.m4v,video/mp4,video/quicktime" : ".srt,application/x-subrip,text/plain"} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onSelect(selected); event.target.value = ""; }} />;
  if (!file) return <article className="material-file-card is-empty" aria-label={title}>{input}<div className="upload-empty-body"><span className="upload-icon"><UploadCloud size={22} /></span><span className="format-note">支持 {format}</span><button className="button secondary" onClick={chooseFile} type="button">{title}</button></div></article>;
  return (
    <article className="material-file-card is-success" aria-label={title}>{input}<div className="file-summary"><span className="file-type-icon"><Icon size={21} /></span><div><strong title={file.name}>{file.name}</strong><span>{isVideo ? "视频素材" : "SRT 字幕"}</span></div></div><div className="file-meta-grid">{file.meta.map((item) => <span key={item}>{item}</span>)}</div><div className="file-card-footer"><span>{isVideo ? `检测方向 ${file.orientation}` : "字幕将在本机读取"}</span><button className="replace-button" onClick={onReplace ?? chooseFile} type="button"><RefreshCw size={13} /> 替换</button></div></article>
  );
}

function MaterialCanvas({ projectName, setProjectName, projectRatio, setProjectRatio, videoFile, subtitleFile, setVideoFile, setSubtitleFile, projectNameInputRef }) {
  const hasConflict = Boolean(videoFile && videoFile.ratio !== "unknown" && videoFile.ratio !== projectRatio);
  const [showConflictToast, setShowConflictToast] = useState(false);
  useEffect(() => {
    if (!hasConflict) { setShowConflictToast(false); return undefined; }
    setShowConflictToast(true);
    const timer = window.setTimeout(() => setShowConflictToast(false), 15000);
    return () => window.clearTimeout(timer);
  }, [hasConflict, projectRatio, videoFile?.ratio]);
  return (
    <main className="canvas material-canvas" id="main-content">
      {hasConflict && showConflictToast && <div className="status-toast status-toast--warning" role="status" aria-live="polite"><strong className="toast-message">画幅冲突：项目 {projectRatio}，视频 {videoFile.ratio}</strong><span className="toast-duration">15秒</span><button className="toast-close" aria-label="关闭画幅冲突提示" onClick={() => setShowConflictToast(false)} type="button"><X size={15} /></button></div>}
      <div className="material-page">
        <section className="workflow-section" aria-labelledby="project-name-title"><h2 className="workflow-section-title" id="project-name-title">项目名称</h2><label className="project-name-control"><input ref={projectNameInputRef} aria-label="项目名称" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="输入项目名称" /></label></section>
        <section className="workflow-section materials-section" aria-labelledby="upload-material-title"><h2 className="workflow-section-title" id="upload-material-title">上传素材 <span className="section-required">必需</span></h2><div className="material-upload-grid"><MaterialFileCard file={videoFile} kind="video" onSelect={async (file) => setVideoFile(await inspectVideoFile(file))} onReplace={() => setVideoFile(null)} /><MaterialFileCard file={subtitleFile} kind="subtitle" onSelect={async (file) => setSubtitleFile(await inspectSubtitleFile(file))} onReplace={() => setSubtitleFile(null)} /></div></section>
        <section className="workflow-section ratio-section" aria-labelledby="project-ratio-title"><h2 className="workflow-section-title" id="project-ratio-title">画幅比例</h2><div className="segmented-control material-ratio" aria-label="项目画幅">{[{ value: "9:16", label: "竖屏" }, { value: "16:9", label: "横屏" }].map((item) => <button aria-label={`${item.label} ${item.value}`} aria-pressed={projectRatio === item.value} className={projectRatio === item.value ? "is-active" : ""} key={item.value} onClick={() => setProjectRatio(item.value)} type="button"><span className="ratio-option-label">{item.label}</span><span className="ratio-option-value">{item.value}</span></button>)}</div></section>
      </div>
    </main>
  );
}

function ContentUnderstandingCanvas({ run }) {
  const failed = run?.uiStatus === "FAILED";
  const issue = readableIssue(run?.issues?.[0], run?.uiError);
  return <main className="canvas process-canvas" id="main-content"><div className={`process-state ${failed ? "is-failed" : ""}`} role="status" aria-live="polite"><span className="process-icon">{failed ? <XCircle size={28} /> : <LoaderCircle className="spin" size={28} />}</span><h1>{failed ? "内容理解未完成" : "正在理解内容"}</h1><p>{failed ? issue.reason : "正在读取基础视频与最终字幕，完成后将自动进入导演分镜编排。"}</p>{failed && <div className="recommended-action"><strong>建议操作</strong><span>{issue.action}</span></div>}</div></main>;
}

function DirectorSkeleton({ artifact }) {
  const facts = artifact?.product?.keyFacts ?? [];
  return <main className="canvas director-skeleton" id="main-content"><section className="evidence-section"><h2 className="workflow-section-title">内容摘要</h2><p className="artifact-summary">{artifact?.product?.summary || "内容理解结果未提供摘要。"}</p></section><section className="evidence-section"><h2 className="workflow-section-title">关键事实</h2><div className="fact-list">{facts.length ? facts.map((item, index) => <article className="fact-card" key={`${item.fact}-${index}`}><strong>{item.fact}</strong><small>来源片段：{item.sourceSegmentIds.join("、")}</small></article>) : <p className="artifact-summary">当前结果没有提取关键事实。</p>}</div></section><div className="scope-note"><Info size={15} /><span>当前只展示内容理解结果，尚未生成导演计划。</span></div></main>;
}

function SkeletonCanvas({ type }) {
  const isLibrary = type === "library";
  return <main className="canvas skeleton-canvas" id="main-content"><div className="canvas-toolbar"><div><div className="eyebrow">SKELETON ONLY · V0</div><h1>{isLibrary ? "组件库" : "Wiki"}</h1><p>{isLibrary ? "组件资产体系入口" : "团队知识展示入口"}</p></div><span className="badge warning">尚未建设内容</span></div><div className="skeleton-empty"><div className="empty-icon">{isLibrary ? <LayoutGrid size={24} /> : <BookOpen size={24} />}</div><span className="section-kicker">V0 SCOPE</span><h2>{isLibrary ? "组件库当前只保留导航骨架" : "Wiki 当前只保留知识目录骨架"}</h2><p>待公共外壳确认后，再按单个页面或明确 Delta 逐步建设。</p><button className="button secondary" disabled type="button">后续阶段开放</button></div></main>;
}

function ConditionRow({ complete, label, detail }) {
  return <div className={`condition-row ${complete ? "is-complete" : ""}`}>{complete ? <CheckCircle2 size={15} /> : <XCircle size={15} />}<div><span>{label}</span><small>{detail}</small></div></div>;
}

function Inspector({ flow, projectName, projectRatio, videoFile, subtitleFile, run, onStart, onRetry, onBack }) {
  const ratioMatches = Boolean(videoFile && (videoFile.ratio === "unknown" || videoFile.ratio === projectRatio));
  const isReady = Boolean(projectName.trim() && videoFile && subtitleFile && ratioMatches);
  const failed = run?.uiStatus === "FAILED";
  const drawer = flow === "material"
    ? {eyebrow: "素材准备", title: "等待上传", status: "待核验", tone: "info"}
    : flow === "understanding"
      ? {eyebrow: "内容理解", title: "本次运行", status: failed ? "需要处理" : "运行完成", tone: failed ? "warning" : "success"}
      : {eyebrow: "导演编排", title: "内容理解结果", status: "CANDIDATE", tone: "ai"};
  return (
    <aside className={`inspector is-${flow} ${flow === "director" ? "without-footer" : ""}`}><div className="inspector-header drawer-header"><div><p className="drawer-eyebrow">{drawer.eyebrow}</p><div className="drawer-title"><i className="drawer-title-marker" aria-hidden="true"/><h2>{drawer.title}</h2></div></div><span className={`drawer-status drawer-status--${drawer.tone}`}>{drawer.status}</span></div><div className="inspector-body">
      {flow === "material" && <section className="inspector-section"><div className="inspector-section-title"><span>继续条件</span><span>{isReady ? "4 / 4" : "检查中"}</span></div><div className="condition-list"><ConditionRow complete={Boolean(projectName.trim())} label="项目名称" detail={projectName.trim() ? "已填写" : "尚未填写"} /><ConditionRow complete={Boolean(videoFile)} label="基础视频" detail={videoFile ? videoFile.name : "尚未添加"} /><ConditionRow complete={Boolean(subtitleFile)} label="最终字幕" detail={subtitleFile ? subtitleFile.name : "尚未添加"} /><ConditionRow complete={ratioMatches} label="方向一致" detail={!videoFile ? "等待基础视频" : ratioMatches ? `${projectRatio} · ${videoFile.orientation}素材` : `${projectRatio} / ${videoFile.orientation}素材 · 不一致`} /></div></section>}
      {flow === "understanding" && <section className="inspector-section"><div className="property-list"><div><span>尝试次数</span><strong>{run?.attempt ?? 1} / 2</strong></div></div></section>}
      {flow === "director" && <section className="inspector-section"><div className="inspector-section-title"><span>源文件</span></div><div className="property-list source-property-list"><div><span>基础视频</span><strong title={videoFile?.name}>{videoFile?.name}</strong></div><div><span>最终字幕</span><strong title={subtitleFile?.name}>{subtitleFile?.name}</strong></div></div></section>}
    </div>{flow !== "director" && <div className="inspector-footer">
      {flow === "material" && <><div className={`autosave ${isReady ? "" : "is-pending"}`}><Info size={13} /><span>{isReady ? "材料完整，可以继续" : "完成全部条件后即可继续"}</span></div><button className="button primary full" disabled={!isReady} onClick={onStart} type="button"><ArrowRight size={16} />继续到内容理解</button><p>通过本地 Node 服务调用 M01</p></>}
      {flow === "understanding" && failed && <><div className="failure-actions"><button className="button secondary full" onClick={onBack} type="button">返回素材准备</button><button className="button primary full" disabled={!run?.retry?.retryable} onClick={onRetry} type="button"><RefreshCw size={16} />{run?.retry?.retryable ? `重试（剩余 ${run.retry.remainingAttempts} 次）` : "已达到重试上限"}</button></div><p>最多尝试两次；不会无限自动重试</p></>}
      {flow === "understanding" && !failed && <p className="process-help">此过程无需操作</p>}
    </div>}</aside>
  );
}

export function App() {
  const [activeModule, setActiveModule] = useState("director");
  const [drawerOpen, setDrawerOpen] = useState(true);
  // 组件库只在打开组件详情时才有右侧抽屉；由页面回传，头部据此决定是否显示开关。
  const [libraryDrawer, setLibraryDrawer] = useState(false);
  const [flow, setFlow] = useState("material");
  const [projectName, setProjectName] = useState("");
  // 头部项目名只跟随「已创建」的项目：素材准备里输入 / 修改草稿名不会即时改头部，
  // 只有点「继续到内容理解」进入下一阶段时才提交一次。
  const [committedProjectName, setCommittedProjectName] = useState("");
  const [focusNameRequest, setFocusNameRequest] = useState(0);
  const projectNameInputRef = useRef(null);
  const [projectRatio, setProjectRatio] = useState("9:16");
  const [videoFile, setVideoFile] = useState(null);
  const [subtitleFile, setSubtitleFile] = useState(null);
  const [run, setRun] = useState(null);

  useEffect(() => {
    if (focusNameRequest && activeModule === "director" && flow === "material") projectNameInputRef.current?.focus();
  }, [focusNameRequest, activeModule, flow]);

  useEffect(() => {
    if (!run?.runId || !new Set(["PENDING", "RUNNING"]).has(run.uiStatus)) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/content-understanding/runs/${run.runId}`, { headers: { accept: "application/json" } });
        const next = await response.json();
        if (!cancelled) { setRun(next); if (next.uiStatus === "SUCCESS") setFlow("director"); }
      } catch { if (!cancelled) setRun(localBridgeFailure(run)); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [run]);

  const start = async () => {
    setFlow("understanding"); setRun({ uiStatus: "PENDING", attempt: 1 }); setCommittedProjectName(projectName.trim());
    const form = new FormData();
    form.set("projectName", projectName.trim()); form.set("aspectRatio", projectRatio);
    form.set("baseVideo", videoFile.raw, videoFile.name); form.set("finalSrt", subtitleFile.raw, subtitleFile.name);
    try {
      const response = await fetch("/api/content-understanding/runs", { method: "POST", body: form, headers: { accept: "application/json" } });
      const next = await response.json();
      if (!response.ok) throw new Error(next.message || "本地内容理解服务未接受素材。");
      setRun(next);
    } catch (error) { setRun(localBridgeFailure({ attempt: 1 }, error)); }
  };

  const retry = async () => {
    if (!run?.sessionId || !run?.retry?.retryable) return;
    setRun({ ...run, uiStatus: "PENDING" });
    try {
      const response = await fetch(`/api/content-understanding/sessions/${run.sessionId}/retry`, { method: "POST", headers: { accept: "application/json" } });
      const next = await response.json();
      if (!response.ok) throw new Error(next.message || "本次重试未能启动。");
      setRun(next);
    } catch (error) { setRun(localBridgeFailure(run, error)); }
  };

  const currentStage = flow === "material" ? 1 : flow === "understanding" ? 2 : 3;
  const drawerAvailable = activeModule === "director" || (activeModule === "library" && libraryDrawer);
  // 头部项目名入口：未创建时回到素材准备聚焦项目名称；已创建时只在素材准备阶段聚焦，不打断后续阶段。
  const handleProjectNameEntry = () => {
    if (committedProjectName && !(activeModule === "director" && flow === "material")) return;
    setActiveModule("director");
    setFocusNameRequest(request => request + 1);
  };
  // 截图模式：`/?still=<componentId>` 只渲染一块干净的深色画布，不套外壳，
  // 供 tests/ui/capture-landscape-previews.mjs 取图。
  if (new URLSearchParams(window.location.search).has("still")) return <div className="still-app"><ComponentLibraryRoute /></div>;
  return <div className="workbench-app">
    <Header activeModule={activeModule} onModuleChange={setActiveModule} projectName={committedProjectName}
      projectCreated={Boolean(committedProjectName)} onCreateProject={handleProjectNameEntry}
      drawer={drawerAvailable ? {open: drawerOpen} : null} onToggleDrawer={() => setDrawerOpen(open => !open)} />
    <div className={`workbench-body ${activeModule === "director" && drawerOpen ? "" : "without-inspector"}`}>{activeModule === "library" ? <ComponentLibraryRoute drawerOpen={drawerOpen} onDrawerAvailabilityChange={setLibraryDrawer} /> : <><Sidebar activeModule={activeModule} currentStage={currentStage} />{activeModule !== "director" ? <SkeletonCanvas type={activeModule} /> : flow === "material" ? <MaterialCanvas projectName={projectName} setProjectName={setProjectName} projectRatio={projectRatio} setProjectRatio={setProjectRatio} videoFile={videoFile} subtitleFile={subtitleFile} setVideoFile={setVideoFile} setSubtitleFile={setSubtitleFile} projectNameInputRef={projectNameInputRef} /> : flow === "understanding" ? <ContentUnderstandingCanvas run={run} /> : <DirectorSkeleton artifact={run?.artifact} />}{activeModule === "director" && drawerOpen && <Inspector flow={flow} projectName={projectName} projectRatio={projectRatio} videoFile={videoFile} subtitleFile={subtitleFile} run={run} onStart={start} onRetry={retry} onBack={() => { setFlow("material"); setRun(null); }} />}</>}</div>
  </div>;
}

async function inspectVideoFile(raw) {
  const fallback = { raw, name: raw.name, ratio: "unknown", orientation: "待校验", meta: [formatBytes(raw.size), "本地文件", "待校验", "未转码"] };
  const url = URL.createObjectURL(raw);
  try {
    const metadata = await new Promise((resolve, reject) => { const video = document.createElement("video"); video.preload = "metadata"; video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration }); video.onerror = reject; video.src = url; });
    const ratio = metadata.width >= metadata.height ? "16:9" : "9:16";
    const orientation = metadata.width >= metadata.height ? "横屏" : "竖屏";
    return { raw, name: raw.name, ratio, orientation, meta: [`${metadata.width} × ${metadata.height}`, formatDuration(metadata.duration), formatBytes(raw.size), raw.type || "视频文件"] };
  } catch { return fallback; } finally { URL.revokeObjectURL(url); }
}

async function inspectSubtitleFile(raw) {
  let cues = "待校验";
  try { const text = await raw.text(); const count = (text.match(/-->/g) ?? []).length; if (count) cues = `${count} 条字幕`; } catch { /* M01 provides authoritative validation. */ }
  return { raw, name: raw.name, meta: [cues, "UTF-8 待校验", formatBytes(raw.size), "本地文件"] };
}

function readableIssue(issue = {}, uiError = null) {
  const messages = {
    ASPECT_RATIO_MISMATCH: [uiError?.description || "项目画幅与基础视频不一致，系统没有裁切、拉伸或转换视频。", "返回素材准备并替换符合项目画幅的基础视频。"],
    FINAL_SRT_PARSE_FAILED: ["最终字幕的时间轴格式无效，内容理解无法继续。", "替换为已经确认的 UTF-8 SRT 文件后重试。"],
    FINAL_SRT_ENCODING_INVALID: ["最终字幕不是有效的 UTF-8 文本。", "将字幕另存为 UTF-8 SRT 后重新提交。"],
    FINAL_SRT_NOT_USABLE: ["最终字幕为空、过大或不是可读取文件。", "替换为有效的最终 SRT 后重试。"],
    ADAPTER_EXECUTION_FAILED: ["本地 AI 执行没有成功返回结果。", "确认本地 Codex 可用后重试；若再次失败，请检查运行环境。"],
    LOCAL_RUNTIME_FAILED: ["本地内容理解未能完成。", "确认本地运行服务可用后重试。"],
  };
  const fallback = [issue.reason || "内容理解未能完成。", issue.recommendedAction || "检查素材与本地运行环境后重试。"];
  const [reason, action] = messages[issue.type] ?? fallback;
  return { reason, action };
}

function localBridgeFailure(previous = {}, error) {
  const attempt = previous.attempt ?? 1;
  return { ...previous, uiStatus: "FAILED", issues: [{ type: "LOCAL_RUNTIME_FAILED", reason: error?.message || "本地内容理解服务暂时不可用。", recommendedAction: "确认本地服务已启动后重试。" }], retry: { retryable: Boolean(previous.sessionId) && attempt < 2, attempt, maxAttempts: 2, remainingAttempts: previous.sessionId ? Math.max(0, 2 - attempt) : 0 } };
}

function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function formatDuration(seconds) { if (!Number.isFinite(seconds)) return "时长待校验"; return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }
