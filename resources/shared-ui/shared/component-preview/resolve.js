// 预览内核｜组合解析与几何（LIB-01 阶段 5）
//
// 这是**唯一**的预览解析实现：组合宽高 / fps / 时长、投影装配、表面几何（画布尺寸）、
// 底色、安全区与 QA 句柄的形状。任何页面都不得再自己写一份。
// 纯 JS（不含 JSX），Node 与浏览器都能直接导入，单测直接跑。

import {componentIdOfState} from "../../../platform/remotion/component-compositions.js";
import {projectProductionStateForRemotion} from "../../../platform/remotion/production-projection.js";

// 里层帧率的合法档位（供页面做控件，不在内核里做 UI）
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2];

// 预览底色：透明网格 / 深色 / 浅色。class 名与历史实现保持一致，避免既有截图与 QA 视觉漂移。
export const PREVIEW_BACKGROUNDS = {
  checker: {id: "checker", label: "透明网格", className: "checker"},
  dark: {id: "dark", label: "黑色", className: "dark"},
  light: {id: "light", label: "浅色", className: "light"},
};

export const DEFAULT_BACKGROUND = "checker";
export const DEFAULT_INITIAL_FRAME = 110;

// 画布几何档位：把以前散落在各页面的高度常数（230 / 420）与固定尺寸收在一处。
//   viewportOffset：实验页的「其它 UI 高度」常数
//   library：稳定舞台，画布在其中等比缩放，不由浏览器高度直接决定尺寸
//   fixedSize：离屏 / 静帧档位的固定画布尺寸
//   className：表面容器的类名（实验页沿用 .player-surface，23 项巡检脚本依赖它）
export const SURFACE_PRESETS = {
  lab: {id: "lab", className: "player-surface", viewportOffset: 230},
  library: {id: "library", className: "preview-surface", minSlotHeight: 480, maxCanvas: {width: 1280, height: 720}},
  offscreen: {id: "offscreen", className: "preview-surface", fixedSize: {width: 1280, height: 720}},
};

export function surfacePresetOf(surface) {
  if (typeof surface === "string") return SURFACE_PRESETS[surface] ?? SURFACE_PRESETS.lab;
  if (surface && typeof surface === "object") return {...SURFACE_PRESETS.library, ...surface};
  return SURFACE_PRESETS.lab;
}

// 表面容器的内联样式：响应式档位用 CSS calc（与历史实现逐字一致），固定档位直接给像素。
export function surfaceStyle(surface, aspectRatio) {
  const preset = surfacePresetOf(surface);
  if (preset.fixedSize) return {width: `${preset.fixedSize.width}px`, height: `${preset.fixedSize.height}px`};
  if (preset.id === "library") return {width: "100%"};
  const ratio = Number(aspectRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return {};
  return {width: `min(100%, calc((100vh - ${preset.viewportOffset}px) * ${ratio}))`};
}

// 组件详情页：舞台高度只由中间栏的可用宽度决定，画幅切换不改变舞台大小。
// Remotion 的 compositionWidth/Height 保持原值；这里只计算显示缩放后的盒子。
export function libraryPreviewGeometry(availableWidth, canvasWidth, canvasHeight) {
  const preset = SURFACE_PRESETS.library;
  const width = Math.max(0, Number(availableWidth) || 0);
  const slotHeight = Math.min(preset.maxCanvas.height, Math.max(preset.minSlotHeight, width * 9 / 16));
  if (!width || !canvasWidth || !canvasHeight) return {slotHeight, canvasWidth: 0, canvasHeight: 0};
  const scale = Math.min(
    width / canvasWidth,
    slotHeight / canvasHeight,
    preset.maxCanvas.width / canvasWidth,
    preset.maxCanvas.height / canvasHeight,
  );
  return {slotHeight, canvasWidth: canvasWidth * scale, canvasHeight: canvasHeight * scale};
}

export function surfaceClassName(surface, background, extra) {
  const preset = surfacePresetOf(surface);
  const backgroundClass = PREVIEW_BACKGROUNDS[background]?.className ?? PREVIEW_BACKGROUNDS[DEFAULT_BACKGROUND].className;
  return [preset.className, backgroundClass, extra].filter(Boolean).join(" ");
}

// 组合解析：一份实现，所有消费方共用。ok=false 时页面自己决定怎么提示。
export function resolveComposition(state, validate) {
  const meta = state?.technical ?? {};
  if (!state?.product) return {ok: false, error: "预览状态缺少 product。", meta: null, projection: null};
  if (!Number.isFinite(meta.width) || !Number.isFinite(meta.height) || !Number.isFinite(meta.fps) || !Number.isFinite(meta.durationInFrames)) {
    return {ok: false, error: "预览状态缺少画布或时间参数。", meta: null, projection: null};
  }
  const aspectRatio = meta.width / meta.height;
  const resolved = {
    componentId: componentIdOfState(state),
    width: meta.width,
    height: meta.height,
    fps: meta.fps,
    durationInFrames: meta.durationInFrames,
    durationSeconds: meta.durationInFrames / meta.fps,
    aspectRatio,
    aspectRatioLabel: state.product.aspectRatio ?? (meta.width > meta.height ? "16:9" : "9:16"),
  };
  // 有校验器时先按组件定义校验：状态被组件拒绝就不渲染，把组件给出的原因交给页面显示。
  if (typeof validate === "function") {
    try {
      validate(state);
    } catch (error) {
      return {ok: false, error: error.message, meta: resolved, projection: null};
    }
  }
  let projection = null;
  try {
    projection = projectProductionStateForRemotion(state);
  } catch (error) {
    return {ok: false, error: error.message, meta: resolved, projection: null};
  }
  return {ok: true, error: null, meta: resolved, projection};
}

// 初始帧规则：**唯一**一处。默认 110 帧，并且永远夹在有效范围内。
export function resolveInitialFrame(meta, initialFrame) {
  const requested = Number.isFinite(initialFrame) ? initialFrame : DEFAULT_INITIAL_FRAME;
  return Math.max(0, Math.min(requested, Math.max(0, meta.durationInFrames - 1)));
}

// 播放倍速：只接受合法档位，越界一律回 1×。
export function resolvePlaybackRate(rate) {
  const value = Number(rate);
  return PLAYBACK_RATES.includes(value) ? value : 1;
}

// 画幅回退：渲染错误时是否应该换成组件样板画幅（页面通过 onAspectFallback 落实）。
export function shouldFallbackAspect(currentRatio, fallbackRatio) {
  return Boolean(fallbackRatio) && fallbackRatio !== currentRatio;
}

// 播放器 API：既能接实例，也能接「返回实例的函数」。
// 注册 QA 钩子时播放器可能还没挂上，所以一律用惰性解析，取的时候再读当前实例。
export function previewPlayerApi(playerOrGetter) {
  const resolve = typeof playerOrGetter === "function" ? playerOrGetter : () => playerOrGetter;
  return {
    seek: frame => resolve()?.seekTo(frame),
    getFrame: () => resolve()?.getCurrentFrame(),
    play: () => resolve()?.play(),
    pause: () => resolve()?.pause(),
    isPlaying: () => resolve()?.isPlaying?.() ?? false,
  };
}

export function registerQaHandles(names, api) {
  const registered = [];
  for (const name of names ?? []) {
    if (!name || typeof window === "undefined") continue;
    window[name] = api;
    registered.push(name);
  }
  return () => {
    for (const name of registered) delete window[name];
  };
}
