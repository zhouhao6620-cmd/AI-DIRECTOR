// 统一 Player Runtime 接口（冒烟测试版）
//
// Role: Reference（冒烟测试件，不是基线）
// 依据调研指南 §8：为了未来 Remotion / HyperFrames 可插拔，播放器外壳只依赖这组业务语义，
// 不认识任何一家内核的原始 API 名字。
//
// 约定：
//   · 时间单位一律「秒」（内核若以帧为单位，由实现自己换算）。
//   · 外壳只通过这些方法驱动播放，不去 querySelector 内核内部的 DOM（指南 §7）。

// 预览倍速与底色沿用工作台预览内核的取值（src/shared/component-preview/resolve.js）。
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2];

export const PREVIEW_BACKGROUNDS = {
  checker: {id: "checker", label: "透明网格", className: "checker"},
  dark: {id: "dark", label: "黑色", className: "dark"},
  light: {id: "light", label: "浅色", className: "light"},
};

export const DEFAULT_BACKGROUND = "checker";

export function resolvePlaybackRate(value) {
  return PLAYBACK_RATES.includes(value) ? value : 1;
}

export function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${Math.floor(safe % 60).toString().padStart(2, "0")}`;
}

// 播放器外壳看到的播放状态。任何内核实现都必须能给出这一份。
export function createPlaybackState({currentTime = 0, duration = 0, playing = false, playbackRate = 1} = {}) {
  return {currentTime, duration, playing, playbackRate};
}

/**
 * RuntimePlayerAdapter 契约：
 *
 *   load(source)                  载入一个合成（顶层 Composition 的 URL）
 *   play()                        播放
 *   pause()                       暂停
 *   seek(time)                    定位到某一秒
 *   setPlaybackRate(rate)         设置倍速
 *   setMuted(muted) / setVolume()  音量
 *   getPlaybackState()            当前状态
 *   onTimeUpdate(cb) / onDurationChange(cb) / onEnded(cb) / onError(cb)
 *   destroy()                     摘掉监听，释放宿主
 *
 * 实现（冒烟测试）：hyper-player-adapter.js —— 基于 HyperFrames 官方 <hyperframes-player>。
 */
export const RUNTIME_PLAYER_ADAPTER_METHODS = [
  "load", "play", "pause", "seek", "setPlaybackRate", "setMuted", "setVolume",
  "getPlaybackState", "onTimeUpdate", "onDurationChange", "onEnded", "onError", "destroy",
];

export function assertAdapter(adapter) {
  const missing = RUNTIME_PLAYER_ADAPTER_METHODS.filter(name => typeof adapter?.[name] !== "function");
  if (missing.length) throw new Error(`播放器内核未实现统一接口：${missing.join(" / ")}`);
  return adapter;
}
