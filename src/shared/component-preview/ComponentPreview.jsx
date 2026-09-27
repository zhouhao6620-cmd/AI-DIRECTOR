// 预览内核｜单份实现（LIB-01 阶段 5）
//
// 消费方：组件实验页（src/component-lab/main.jsx）、组件库详情（src/component-library/ComponentDetail.jsx）、
// 静帧捕获（src/component-library/StillCapture.jsx）、后续导演台。
//
// 内核独家拥有：组合解析、ComponentSample + projection 装配、<Player> 全部固定参数、
// 画布几何、渲染错误兜底与画幅回退、预览底色、安全区标识叠加层、QA 钩子。
// 页面差异只能用参数表达：initialFrame / controls / surface / background / safeArea /
// onError / qaHandle / offscreen（外加播放倍速、占位内容、playerRef）。
import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {Player} from "@remotion/player";
import {Check, Maximize, Minimize, Pause, Play, Volume2, VolumeX} from "lucide-react";
import {ComponentSample} from "../../../platform/remotion/component-sample.jsx";
import {
  DEFAULT_BACKGROUND, PLAYBACK_RATES, PREVIEW_BACKGROUNDS, resolveComposition, resolveInitialFrame, resolvePlaybackRate,
  libraryPreviewGeometry, previewPlayerApi, registerQaHandles, shouldFallbackAspect, surfaceClassName, surfaceStyle,
} from "./resolve.js";
import "./component-preview.css";

const BACKGROUND_CONTROL_LABELS = {dark: "深色", checker: "透明", light: "浅色"};

export function ComponentPreview({
  state,
  // Raw sources have no production state or registry identity. They use the same Player
  // assembly, but never pass through ComponentSample or production projection.
  rawComponent,
  rawInputProps,
  rawMeta,
  surface = "lab",
  background = DEFAULT_BACKGROUND,
  showSettings = false,
  onAspectRatioChange,
  onPlaybackRateChange,
  onBackgroundChange,
  onSafeAreaChange,
  initialFrame,
  controls = true,
  loop = true,
  playbackRate = 1,
  safeArea = false,
  offscreen = false,
  onError,
  onAspectFallback,
  fallbackAspectRatio,
  onReady,
  qaHandle,
  playerRef,
  validate,
  placeholder = null,
  className,
  style,
}) {
  const innerPlayer = useRef(null);
  const surfaceRef = useRef(null);
  const errorTimer = useRef(null);
  const [mountedFlag, setMountedFlag] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [localRate, setLocalRate] = useState(playbackRate);
  const [rateSelected, setRateSelected] = useState(false);
  const [backgroundSelected, setBackgroundSelected] = useState(false);
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  // 只有真正提交（effect 跑过）之后才算挂载：渲染期就被触发的错误回调不能提前改状态。
  const mounted = useRef(false);

  const resolved = useMemo(() => rawComponent
    ? {ok: true, meta: {
      componentId: null, width: rawMeta?.width ?? 960, height: rawMeta?.height ?? 540,
      fps: rawMeta?.fps ?? 30, durationInFrames: rawMeta?.durationInFrames ?? 120,
      aspectRatio: (rawMeta?.width ?? 960) / (rawMeta?.height ?? 540),
      aspectRatioLabel: (rawMeta?.width ?? 960) > (rawMeta?.height ?? 540) ? "16:9" : "9:16",
    }, projection: null}
    : resolveComposition(state, validate), [state, validate, rawComponent, rawMeta]);
  const meta = resolved.meta;
  const libraryGeometry = surface === "library" && meta
    ? libraryPreviewGeometry(surfaceWidth, meta.width, meta.height) : null;
  const rate = resolvePlaybackRate(onPlaybackRateChange ? playbackRate : localRate);
  const rateLabel = rateSelected || rate !== 1 ? `${rate}x` : "倍速";
  const backgroundLabel = backgroundSelected || background !== "dark" ? BACKGROUND_CONTROL_LABELS[background] ?? "背景" : "背景";
  const currentFrame = Math.max(0, Math.min(frame, meta?.durationInFrames ?? 0));
  const totalSeconds = meta ? meta.durationInFrames / meta.fps : 0;
  const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

  useEffect(() => setLocalRate(playbackRate), [playbackRate]);
  useLayoutEffect(() => {
    if (surface !== "library" || !resolved.ok || !surfaceRef.current) return undefined;
    const node = surfaceRef.current;
    const measure = () => setSurfaceWidth(Math.round(node.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [surface, resolved.ok]);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === surfaceRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  useEffect(() => {
    if (!openMenu) return undefined;
    const closeOnEscape = event => { if (event.key === "Escape") setOpenMenu(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [openMenu]);

  useEffect(() => {
    // StrictMode 下 effect 会「挂载 → 清理 → 再挂载」，所以必须显式置回 true。
    mounted.current = true;
    setMountedFlag(true);
    return () => {
      mounted.current = false;
      setMountedFlag(false);
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, []);

  // QA 钩子由内核注册与清理；页面只给名字与自己的业务方法。
  // 播放器实例用惰性解析：注册时播放器可能还没挂上。
  const playerApi = useMemo(() => previewPlayerApi(() => innerPlayer.current), []);
  useEffect(() => {
    const player = innerPlayer.current;
    if (!player || !resolved.ok || offscreen) return undefined;
    const syncPlayback = () => {
      setFrame(player.getCurrentFrame());
      setPlaying(player.isPlaying());
      setVolume(player.getVolume?.() ?? 1);
      setMuted(player.isMuted?.() ?? true);
    };
    const syncRate = event => {
      const next = event?.detail?.playbackRate;
      if (PLAYBACK_RATES.includes(next)) onPlaybackRateChange?.(next);
    };
    syncPlayback();
    for (const event of ["frameupdate", "play", "pause", "volumechange", "mutechange"]) player.addEventListener(event, syncPlayback);
    player.addEventListener("ratechange", syncRate);
    return () => {
      for (const event of ["frameupdate", "play", "pause", "volumechange", "mutechange"]) player.removeEventListener(event, syncPlayback);
      player.removeEventListener("ratechange", syncRate);
    };
  }, [onPlaybackRateChange, resolved.ok, offscreen, meta?.componentId, meta?.width, meta?.height]);
  useEffect(() => {
    if (!qaHandle?.names?.length) return undefined;
    return registerQaHandles(qaHandle.names, {...qaHandle.api, ...playerApi});
  }, [qaHandle, playerApi]);

  // 把内部播放器交给页面（详情页的播放按钮用它）
  useEffect(() => {
    if (!playerRef) return;
    playerRef.current = innerPlayer.current;
    return () => { playerRef.current = null; };
  });

  useEffect(() => {
    if (!resolved.ok || offscreen) return undefined;
    const timer = window.setTimeout(() => onReady?.(playerApi), 0);
    return () => window.clearTimeout(timer);
  }, [resolved.ok, offscreen, onReady, playerApi]);

  // 渲染错误兜底：Remotion 播放器会自己接住渲染错误（errorFallback 在**渲染期**被调用），
  // 所以所有回调都排到下一个宏任务——渲染期改状态会触发 React 警告，卸载后也不该再动状态。
  const scheduleErrorHandling = message => {
    // 错误回调是在**渲染期**被播放器调用的：这里只排一个「等挂载完成再执行」的定时器，
    // 挂载前重试、卸载后放弃，既不会在渲染期改状态，也不会丢事件。
    if (errorTimer.current) return;
    let attempts = 0;
    const run = () => {
      if (!mounted.current) {
        if (attempts++ < 20) errorTimer.current = window.setTimeout(run, 16);
        return;
      }
      errorTimer.current = null;
      onError?.(message);
      if (shouldFallbackAspect(meta?.aspectRatioLabel, fallbackAspectRatio)) onAspectFallback?.(fallbackAspectRatio);
    };
    errorTimer.current = window.setTimeout(run, 0);
  };

  if (!resolved.ok) {
    // placeholder 支持两种写法：直接给节点，或给 (error) => 节点，让页面把组件给出的原因说清楚。
    if (typeof placeholder === "function") return placeholder(resolved.error);
    return placeholder ?? <p className="preview-empty" data-preview-invalid>{resolved.error}</p>;
  }

  // 换组件或换画布时重建播放器：上一次的渲染错误不会粘到新内容上。
  const resetKey = `${meta.componentId ?? rawMeta?.key ?? "component"}|${meta.width}x${meta.height}`;
  const seek = value => {
    const next = Math.round(Number(value));
    innerPlayer.current?.seekTo(next);
    setFrame(next);
  };
  const changeRate = next => {
    if (onPlaybackRateChange) onPlaybackRateChange(next);
    else setLocalRate(next);
    setRateSelected(true);
    setOpenMenu(null);
  };
  const changeVolume = value => {
    const next = Number(value);
    innerPlayer.current?.setVolume(next);
    if (next > 0) innerPlayer.current?.unmute();
    else innerPlayer.current?.mute();
    setVolume(next);
    setMuted(next === 0);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement === surfaceRef.current) await document.exitFullscreen();
    else await surfaceRef.current?.requestFullscreen?.();
  };
  return <div className={surfaceClassName(surface, background, className)} data-preview-surface
    ref={surfaceRef}
    data-preview-component={meta.componentId ?? ""} data-preview-aspect={meta.aspectRatioLabel}
    data-preview-mounted={mountedFlag ? "1" : "0"}
    style={{...surfaceStyle(surface, meta.aspectRatio), ...(libraryGeometry ? {height: libraryGeometry.slotHeight} : {}), ...style}}>
    <div className="preview-stage" style={libraryGeometry ? {width: libraryGeometry.canvasWidth, height: libraryGeometry.canvasHeight} : undefined}>
    <Player
      key={resetKey}
      ref={node => {
        innerPlayer.current = node;
        if (typeof playerRef === "function") playerRef(node);
        else if (playerRef) playerRef.current = node;
      }}
      component={rawComponent ?? ComponentSample}
      inputProps={rawComponent ? rawInputProps ?? {} : {projection: resolved.projection}}
      compositionWidth={meta.width}
      compositionHeight={meta.height}
      fps={meta.fps}
      durationInFrames={meta.durationInFrames}
      initialFrame={resolveInitialFrame(meta, initialFrame)}
      initiallyMuted
      showVolumeControls={false}
      controls={false}
      loop={loop}
      playbackRate={rate}
      spaceKeyToPlayOrPause={false}
      style={{width: "100%", height: offscreen ? "100%" : undefined}}
      errorFallback={({error}) => {
        scheduleErrorHandling(error.message);
        return <div role="alert" className="preview-render-error" data-preview-error>{error.message}</div>;
      }}
    />
    {safeArea && <SafeAreaOverlay />}
    </div>
    {controls && !offscreen && <div className="preview-chrome" data-preview-controls>
      <div className="preview-progress" style={{"--preview-progress": `${currentFrame / Math.max(1, meta.durationInFrames - 1) * 100}%`}}>
        <input type="range" min="0" max={Math.max(0, meta.durationInFrames - 1)} value={currentFrame}
          aria-label="播放进度" onChange={event => seek(event.target.value)} />
      </div>
      <div className="preview-controls-row">
        <div className="preview-primary-controls">
          <button type="button" className="preview-play-button" data-library-play aria-label={playing ? "暂停" : "播放"}
            onClick={() => playing ? innerPlayer.current?.pause() : innerPlayer.current?.play()}>
            {playing ? <Pause size={30} fill="currentColor" strokeWidth={1.8} aria-hidden="true" /> : <Play size={30} fill="currentColor" strokeWidth={1.8} aria-hidden="true" />}
            <span className="preview-sr-only">{playing ? "暂停" : "播放"}</span>
          </button>
          <span className="preview-time" aria-label={`播放时间 ${formatTime(currentFrame / meta.fps)} / ${formatTime(totalSeconds)}`}>
            <strong>{formatTime(currentFrame / meta.fps)}</strong><span>/</span>{formatTime(totalSeconds)}
          </span>
        </div>
        <div className="preview-secondary-controls">
          {showSettings && <>
            <label className="preview-safe-toggle"><span>安全区</span><input type="checkbox" checked={safeArea}
              aria-label="播放器安全区" onChange={event => onSafeAreaChange?.(event.target.checked)} /><i aria-hidden="true" /></label>
            <div className="preview-menu-anchor"><button type="button" className="preview-text-button" aria-label={`倍速 ${rate} 倍`}
              aria-expanded={openMenu === "speed"} onClick={() => setOpenMenu(openMenu === "speed" ? null : "speed")}>{rateLabel}</button>
              {openMenu === "speed" && <div className="preview-popover" role="menu" aria-label="播放倍速">
                {PLAYBACK_RATES.map(value => <button type="button" role="menuitemradio" aria-checked={rate === value} key={value}
                  onClick={() => changeRate(value)}>{value.toFixed(1)} 倍{value === 1 ? " · 正常" : ""}{rate === value && <Check size={15} />}</button>)}
              </div>}
            </div>
            <div className="preview-menu-anchor"><button type="button" className="preview-text-button" data-preview-aspect-toggle
              aria-label={`画幅 ${meta.aspectRatioLabel}`} aria-expanded={openMenu === "aspect"}
              onClick={() => setOpenMenu(openMenu === "aspect" ? null : "aspect")}>{meta.aspectRatioLabel}</button>
              {openMenu === "aspect" && <div className="preview-popover" role="menu" aria-label="画幅比例">
                {["16:9", "9:16"].map(value => <button type="button" role="menuitemradio" aria-checked={meta.aspectRatioLabel === value} key={value}
                  onClick={() => {onAspectRatioChange?.(value); setOpenMenu(null);}}>{value}{meta.aspectRatioLabel === value && <Check size={15} />}</button>)}
              </div>}
            </div>
            <div className="preview-menu-anchor"><button type="button" className="preview-text-button preview-background-button"
              aria-label={`背景 ${BACKGROUND_CONTROL_LABELS[background] ?? "深色"}`} aria-expanded={openMenu === "background"}
              onClick={() => setOpenMenu(openMenu === "background" ? null : "background")}>{backgroundLabel}</button>
              {openMenu === "background" && <div className="preview-popover" role="menu" aria-label="预览背景">
                {["dark", "checker", "light"].map(key => PREVIEW_BACKGROUNDS[key]).map(item => <button type="button" role="menuitemradio" aria-checked={background === item.id} key={item.id}
                  onClick={() => {onBackgroundChange?.(item.id); setBackgroundSelected(true); setOpenMenu(null);}}>{BACKGROUND_CONTROL_LABELS[item.id]}{background === item.id && <Check size={15} />}</button>)}
              </div>}
            </div>
          </>}
          <div className="preview-menu-anchor"><button type="button" className="preview-icon-button" aria-label="音量" aria-expanded={openMenu === "volume"}
            onClick={() => setOpenMenu(openMenu === "volume" ? null : "volume")}>
            {muted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
            {openMenu === "volume" && <div className="preview-volume-popover" aria-label="音量设置">
              <span>{muted ? 0 : Math.round(volume * 100)}</span>
              <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} aria-label="调整音量"
                onChange={event => changeVolume(event.target.value)} />
              <button type="button" aria-label={muted ? "取消静音" : "静音"} onClick={() => {
                if (muted) { innerPlayer.current?.unmute(); setMuted(false); }
                else { innerPlayer.current?.mute(); setMuted(true); }
              }}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
            </div>}
          </div>
          <button type="button" className="preview-icon-button" aria-label={fullscreen ? "退出全屏" : "全屏"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={22} /> : <Maximize size={22} />}</button>
        </div>
      </div>
    </div>}
  </div>;
}

// 安全区标识叠加层：标题安全区 / 动作安全区 / 中心十字 / 边距标注。
// 所有消费方共用这一份；是否显示由 safeArea 参数决定。
export function SafeAreaOverlay() {
  return <div className="preview-safe-area" data-preview-safe-area aria-hidden="true">
    <span className="preview-safe-box is-title" />
    <span className="preview-safe-box is-action" />
    <span className="preview-safe-cross" />
    <span className="preview-safe-label is-title">标题安全区 90%</span>
    <span className="preview-safe-label is-action">动作安全区 80%</span>
  </div>;
}
