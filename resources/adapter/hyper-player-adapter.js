// HyperFrames 版 RuntimePlayerAdapter（冒烟测试版）
//
// Role: Reference（冒烟测试件，不是基线）
// 把官方 <hyperframes-player> 的原生 API 收敛到 workbench 的统一播放器语义上：
//   play / pause / seek(秒) / playbackRate / timeupdate / ready(duration) / ended / error
//
// 事实源：安装在本目录的 hyperframes@0.8.46 → dist/hyperframes-player.global.js
//   · 属性：src / width / height / runtime-src / muted / volume / playback-rate / controls
//   · 方法：play() / pause() / seek(time) / setRuntimeData()
//   · 属性访问器：currentTime / duration / paused / playbackRate / muted / volume / ready / iframeElement
//   · 事件：ready {duration} / timeupdate {currentTime} / play / pause / ended / error {message} / scenes
//
// 注意：官方 player 自带的 `controls` 我们**不使用**（指南 §5：UI 是我们的，Runtime 是它的）。

import {createPlaybackState} from "./runtime-player-adapter.mjs";

export class HyperPlayerAdapter {
  #player;
  #handlers = new Map();
  #cleanups = [];

  constructor(player, {runtimeSrc, onTimeUpdate, onDurationChange, onEnded, onError, onReady} = {}) {
    if (!player) throw new Error("HyperPlayerAdapter 需要一个 <hyperframes-player> 元素。");
    this.#player = player;
    if (runtimeSrc) player.setAttribute("runtime-src", runtimeSrc);
    if (onTimeUpdate) this.onTimeUpdate(onTimeUpdate);
    if (onDurationChange ?? onReady) {
      const handleReady = event => {
        const duration = Number(event?.detail?.duration ?? player.duration ?? 0);
        onDurationChange?.(duration);
        onReady?.(duration);
      };
      this.#listen("ready", handleReady);
    }
    if (onEnded) this.onEnded(onEnded);
    if (onError) this.onError(onError);
  }

  #listen(type, handler) {
    this.#player.addEventListener(type, handler);
    this.#cleanups.push(() => this.#player.removeEventListener(type, handler));
  }

  get element() {
    return this.#player;
  }

  load(source) {
    this.#player.setAttribute("src", source);
  }

  play() {
    this.#player.play();
  }

  pause() {
    this.#player.pause();
  }

  seek(time) {
    const duration = this.getPlaybackState().duration;
    const next = Math.max(0, duration > 0 ? Math.min(time, duration) : time);
    this.#player.seek(next);
  }

  setPlaybackRate(rate) {
    this.#player.playbackRate = rate;
  }

  setMuted(muted) {
    this.#player.muted = Boolean(muted);
  }

  setVolume(volume) {
    this.#player.volume = Math.max(0, Math.min(1, Number(volume)));
  }

  getPlaybackState() {
    const player = this.#player;
    return createPlaybackState({
      currentTime: Number(player.currentTime ?? 0),
      duration: Number(player.duration ?? 0),
      playing: player.paused === false,
      playbackRate: Number(player.playbackRate ?? 1),
    });
  }

  // 合成自身的就绪状态（官方 player 在 runtime 就绪后置为 true）
  isReady() {
    return Boolean(this.#player.ready);
  }

  onTimeUpdate(callback) {
    this.#listen("timeupdate", event => {
      const currentTime = Number(event?.detail?.currentTime ?? this.#player.currentTime ?? 0);
      callback(currentTime, this.getPlaybackState().duration);
    });
    return this;
  }

  onDurationChange(callback) {
    this.#listen("ready", event => callback(Number(event?.detail?.duration ?? 0)));
    return this;
  }

  onEnded(callback) {
    this.#listen("ended", () => callback());
    return this;
  }

  onError(callback) {
    this.#listen("error", event => callback(event?.detail?.message ?? "HyperFrames 播放出错"));
    return this;
  }

  // 播放/暂停状态变化（外壳按钮要跟着内核走）
  onPlaybackChange(callback) {
    this.#listen("play", () => callback(true));
    this.#listen("pause", () => callback(false));
    return this;
  }

  destroy() {
    this.#cleanups.forEach(cleanup => cleanup());
    this.#cleanups = [];
  }
}
