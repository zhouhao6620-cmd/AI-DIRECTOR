// 组件详情（05 §8.4 / 冻结合同第 26 条）
//
// 布局固定为「中间：预览 + 组件信息 + 操作」×「右侧：配置试填」，
// 在当前右侧工作区原位展示，不跳出产品上下文。
import React, {useEffect, useMemo, useRef, useState} from "react";
import {ArrowLeft, Copy, Info} from "lucide-react";
import {ComponentPreview} from "../shared/component-preview/index.js";
import {motionPatternLabel} from "./library-catalog.js";
import {
  boundaryState, capabilityRows, controlPlanFor, createPreviewState, fieldSchemaOf,
  readPreviewPath, withPreviewDefaults, writePreviewPath,
} from "./preview-state.js";
import {PreviewControls} from "./PreviewControls.jsx";

const ASSET_KIND_LABELS = {IMAGE: "图片", VIDEO: "视频", LOGO: "标识"};

const ratioSize = aspectRatio => (aspectRatio === "16:9" ? {width: 1920, height: 1080} : {width: 1080, height: 1920});

export function ComponentDetail({entry, catalogEntries, onBack, onRevise, onPromote, onDiscard, drawerOpen = true}) {
  // QA 模式（?qa=1）：内核会把 window.componentLibraryQA 挂上（seek / getFrame / play / pause
  // 由内核提供，这里只补业务方法）。日常使用不挂任何调试句柄。
  const qaMode = new URLSearchParams(window.location.search).get("qa") === "1";
  // 预览默认横屏 16:9 + 深色底：详情页就是一个干净的动画预览窗口。
  // rawSample 保留组件样板自己的画幅，供「16:9 被组件拒绝」时回退用。
  const rawSample = useMemo(() => createPreviewState(entry), [entry]);
  const sample = useMemo(() => withPreviewDefaults(createPreviewState(entry)), [entry]);
  const [state, setState] = useState(() => withPreviewDefaults(createPreviewState(entry)));
  const [preset, setPreset] = useState("sample");
  const [writeError, setWriteError] = useState("");
  const [aspectFallback, setAspectFallback] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [previewBackground, setPreviewBackground] = useState("dark");
  const [safeArea, setSafeArea] = useState(false);
  const qaState = useRef({entry, state: null});

  const plan = useMemo(() => controlPlanFor(entry, state), [entry, state]);
  const descriptor = useMemo(() => fieldSchemaOf(entry), [entry]);
  const props = state.product.globalPackaging[0]?.props ?? state.product.shots[0].componentInstances[0].props;
  const meta = state.technical;

  // 单次写入失败不能让整页崩掉：在提交前落到新副本上，失败就把原因留在面板上。
  const mutate = fn => {
    const next = structuredClone(state);
    try {
      fn(next);
      setState(next);
      setWriteError("");
    } catch (error) {
      setWriteError(error.message);
    }
  };
  qaState.current = {entry, state};
  const qaHandle = useMemo(() => (qaMode ? {
    names: ["componentLibraryQA"],
    api: {
      getComponent: () => qaState.current.entry.componentId,
      getState: () => structuredClone(qaState.current.state),
    },
  } : null), [qaMode]);
  const setPath = (path, value) => {
    mutate(next => writePreviewPath(next, path, value));
  };
  const applyPreset = id => {
    setPreset(id);
    if (id === "sample") { setState(structuredClone(sample)); return; }
    // 边界预览只换内容：画幅与主题保持当前值。
    const next = boundaryState(entry, id, sample);
    next.product.aspectRatio = state.product.aspectRatio;
    next.technical = {...next.technical, width: state.technical.width, height: state.technical.height};
    setState(next);
  };
  const reset = () => { setPreset("sample"); setState(structuredClone(sample)); };

  // 渲染兜底由共享内核负责：它接住组件抛错、把画幅回退请求交给这里，这里只落实画幅 + 记下原因。
  const handleRenderError = message => setAspectFallback(previous => previous ?? {
    from: state.product.aspectRatio, to: rawSample.product.aspectRatio, reason: message,
  });
  const applyAspectFallback = ratio => mutate(next => {
    next.product.aspectRatio = ratio;
    next.technical = {...next.technical, ...ratioSize(ratio)};
  });

  return <section className={`library-detail ${drawerOpen ? "" : "is-drawer-collapsed"}`} aria-label={`${entry.title} 详情`}>
    <div className="library-detail-grid">
      <div className="library-detail-main">
        {/* 组件身份放在中间区顶部：左导航 / 中介绍与预览 / 右实操，三列都从顶部开始。 */}
        <div className="library-detail-identity">
          <button className="library-back" type="button" onClick={onBack}><ArrowLeft size={13} />返回</button>
          <div className="library-detail-title">
            <h1>{entry.displayName}</h1>
            <p>
              <span>{entry.componentId}</span>
              <span>v{entry.version ?? "—"}</span>
              <span className={entry.draft ? "is-draft" : "is-registered"}>{entry.draft ? "DRAFT · 草稿通道" : entry.status}</span>
            </p>
          </div>
        </div>
        <div className="library-preview">
          <div className="library-player-space">
            {/* 预览由共享内核渲染（组合解析 / Player 参数 / 兜底 / 安全区都在内核里） */}
            <ComponentPreview state={state} surface="library" background={previewBackground} showSettings
              playbackRate={playbackRate} safeArea={safeArea} qaHandle={qaHandle}
              onAspectRatioChange={ratio => mutate(next => {
                next.product.aspectRatio = ratio;
                next.technical = {...next.technical, ...ratioSize(ratio)};
              })}
              onPlaybackRateChange={setPlaybackRate} onBackgroundChange={setPreviewBackground}
              onSafeAreaChange={setSafeArea}
              fallbackAspectRatio={rawSample.product.aspectRatio}
              onAspectFallback={applyAspectFallback} onError={handleRenderError}
              validate={nextState => entry.assertState?.(nextState)}
              placeholder={reason => <div className="library-preview-blocked" role="alert" data-library-preview-blocked>
                <Info size={16} />
                <div>
                  <strong>组件按定义拒绝了当前内容</strong>
                  <p>{reason}</p>
                  <button className="button secondary" type="button" onClick={reset}>回到组件样例</button>
                </div>
              </div>}/>
          </div>
          {/* 预览窗口保持干净：画幅、尺寸、帧率、时长都在下面一行说清楚 */}
          <div className="library-preview-footer">
            <span className="library-preview-meta" data-library-preview-meta>
              画幅 {state.product.aspectRatio} · {meta.width} × {meta.height} · {meta.fps} fps · {meta.durationInFrames} 帧 · {(meta.durationInFrames / meta.fps).toFixed(1)} 秒
            </span>
            {aspectFallback && <p className="library-preview-note is-warn" data-library-aspect-fallback>
              这段样板内容在 {aspectFallback.from} 下被组件自身的安全区校验拒绝（{aspectFallback.reason}），已按组件样板画幅
              {" "}{aspectFallback.to} 预览；需要看 {aspectFallback.from} 的边界行为，可在右侧把画幅切回去。
            </p>}
          </div>
        </div>

        <ComponentInfo entry={entry}/>

        <div className="library-detail-actions">
          <p>{entry.draft
            ? "草稿箱里的候选组件：确认入库与丢弃都由总控执行，页面只生成可复制的指令。"
            : "组件定义不在本页直接编辑。"}</p>
          <div className="library-detail-action-buttons">
            {entry.draft && <>
              <button className="button secondary" type="button" data-library-discard onClick={() => onDiscard(entry)}>丢弃</button>
              <button className="button secondary" type="button" data-library-promote onClick={() => onPromote(entry)}>确认入库</button>
            </>}
            <button className="button primary" type="button" data-library-revise onClick={() => onRevise(entry)}>
              <Copy size={15} strokeWidth={1.8} />去 Codex 中修改
            </button>
          </div>
        </div>
      </div>

      <aside className="library-detail-controls" id="library-detail-drawer" aria-label="配置试填">
        <header className="library-config-header drawer-header">
          <p className="drawer-eyebrow">组件配置</p>
          <div className="library-config-heading-row">
            <div className="drawer-title"><i className="drawer-title-marker" aria-hidden="true"/><h2>组件设置</h2></div>
            <span className="drawer-status drawer-status--success">仅做预览</span>
          </div>
        </header>
        <PreviewControls entry={entry} plan={plan} descriptor={descriptor} state={state} props={props}
          setPath={setPath} mutate={mutate} onReset={reset} preset={preset} onPreset={applyPreset}
          catalogEntries={catalogEntries} playbackRate={playbackRate} onPlaybackRate={setPlaybackRate}
          safeArea={safeArea} onSafeArea={setSafeArea}/>
        {writeError && <p className="library-control-note is-warn" role="alert">这次改动没有写入：{writeError}</p>}
      </aside>
    </div>
  </section>;
}

function ComponentInfo({entry}) {
  const definition = entry.definition;
  const semantic = definition.semantic ?? {};
  const content = definition.content ?? {};
  const runtime = definition.runtime ?? {};
  const workbench = definition.workbench ?? {};
  const identity = definition.identity ?? {};
  const rows = [
    {zh: "名称", en: "Name", value: identity.name ?? entry.displayName},
    {zh: "编号", en: "ID", value: entry.componentId},
    {zh: "版本", en: "Version", value: `${entry.version ?? "—"} · ${entry.status ?? "—"}`},
    {zh: "用途", en: "Purpose", value: entry.note},
    {zh: "标签", en: "Tags", value: (entry.tags ?? []).join(" · ")},
    {zh: "语义能力", en: "Semantic", value: [
      `类型 ${semantic.type ?? "—"}`,
      `信息关系 ${semantic.pattern ?? "—"}`,
      `适用场景 ${(semantic.useCases ?? []).join("；") || "—"}`,
    ]},
    {zh: "内容能力", en: "Content Capability", value: [
      `必填 ${(content.requiredFields ?? []).join(" / ") || "—"}`,
      `可选 ${(content.optionalFields ?? []).join(" / ") || "—"}`,
      content.nodeShape ? `节点 ${content.nodeShape}` : null,
      `一级节点增删 ${content.optionalNodes ? "支持" : "不支持"}`,
      `二级节点 ${content.secondaryNodes ? "支持" : "不支持"}`,
      `动态重排 ${content.dynamicReflow ? "支持" : "不支持"}`,
      content.outOfBounds ? `越界处理 ${content.outOfBounds}` : null,
    ]},
    {zh: "工作台可编辑能力", en: "Workbench Capability", value: capabilityRows(entry).map(row =>
      `${row.label} ${row.supported ? `✓${row.detail ? `（${row.detail}）` : ""}` : "✕（定义未声明）"}`)},
    {zh: "动画表现", en: "Motion Behavior", value: [
      (runtime.motionBehavior?.patterns ?? []).map(motionPatternLabel).join(" · ") || "—",
      runtime.motionBehavior?.description ?? null,
    ]},
    {zh: "条目 · 深度 · 密度", en: "Cardinality / Depth / Density", value: [
      `条目数 ${semantic.minCardinality ?? "—"}–${semantic.maxCardinality ?? "—"}`,
      `层级深度 ${semantic.depth ?? "—"}`,
      `信息密度 ${semantic.density ?? "—"}`,
    ]},
    {zh: "主题支持", en: "Theme Support", value: [
      workbench.theme ? `四套主题 ${(workbench.themes ?? []).join(" / ")}` : "不支持主题覆盖",
    ]},
    {zh: "变体与素材替换", en: "Variant / Asset Replace", value: [
      workbench.variant ? `变体 ${(workbench.variants ?? []).map(id => workbench.variantLabels?.[id] ?? id).join(" / ") || "—"}` : "无变体",
      workbench.assetReplace ? `素材替换 ${(workbench.assetKinds ?? []).map(kind => ASSET_KIND_LABELS[kind] ?? kind).join(" / ")}` : "不支持素材替换",
    ]},
    {zh: "时长", en: "Duration", value: [
      `最短 ${runtime.minimumDurationSeconds ?? "—"} 秒`,
      `透明输出 ${runtime.transparent ? "支持" : "不支持"}`,
    ]},
    {zh: "案例展示", en: "Example", value: [
      (semantic.useCases ?? []).length ? `适用场景：${(semantic.useCases ?? []).join("；")}` : null,
      "组件定义未提供案例素材；本页不编造 Example。",
    ]},
  ];
  return <section className="library-info" aria-label="组件信息">
    <h2>组件信息</h2>
    <dl>
      {rows.map(row => {const key = row.zh ?? row.label; return <div key={key}>
        <dt><span className="library-info-zh">{row.zh ?? row.label}</span><span className="library-info-en">{row.en}</span></dt>
        <dd>{[].concat(row.value ?? []).filter(Boolean).map((line, index) => <span key={`${key}-${index}`}>{line}</span>)}</dd>
      </div>;})}
    </dl>
  </section>;
}
