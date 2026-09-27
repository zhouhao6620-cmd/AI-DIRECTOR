// 预览播放器外壳（HyperFrames 版）· 一份实现，两个页面共用
//
// Role: Reference（冒烟测试件，不是基线）
//
// 消费方：独立播放器页（player/index.html）与组件库内壳页（library/index.html）。
// 分工与调研指南一致：
//   · 外壳拥有：画布几何、预览底色、安全区叠加层、控制条（进度/播放/时间/倍速/画幅/背景/音量/全屏）
//   · 内核只做：载入 Composition、Seek、播放、时间事件（<hyperframes-player>，不使用它的 controls）
// 外壳不 querySelector 内核内部 DOM：改值走「变量补丁」协议（见 patch()）。

import {HyperPlayerAdapter} from "../adapter/hyper-player-adapter.js";
import {
  DEFAULT_BACKGROUND, PLAYBACK_RATES, PREVIEW_BACKGROUNDS, assertAdapter, formatTime, resolvePlaybackRate,
} from "../adapter/runtime-player-adapter.mjs";

// 组件详情页的舞台几何（与 shared/component-preview/resolve.js libraryPreviewGeometry 同源）
const LIBRARY_PRESET = {minSlotHeight: 480, maxCanvas: {width: 1280, height: 720}};

const CHROME_MARKUP = `
  <div class="preview-stage" data-preview-stage id="stage">
    <hyperframes-player id="player" data-hyper-player width="1920" height="1080" muted></hyperframes-player>
    <div class="preview-safe-area" id="safeArea" hidden aria-hidden="true">
      <span class="preview-safe-box is-title"></span>
      <span class="preview-safe-box is-action"></span>
      <span class="preview-safe-cross"></span>
      <span class="preview-safe-label is-title">标题安全区 90%</span>
      <span class="preview-safe-label is-action">动作安全区 80%</span>
    </div>
  </div>
  <div class="preview-chrome" data-preview-controls>
    <div class="preview-progress" id="progressWrap" style="--preview-progress:0%">
      <input type="range" id="progress" min="0" max="12" step="0.01" value="0" aria-label="播放进度">
    </div>
    <div class="preview-controls-row">
      <div class="preview-primary-controls">
        <button type="button" class="preview-play-button" id="playButton" aria-label="播放">
          <svg id="playIcon" viewBox="0 0 24 24" width="30" height="30" fill="currentColor" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          <svg id="pauseIcon" viewBox="0 0 24 24" width="30" height="30" fill="currentColor" stroke="currentColor" stroke-width="1.8" aria-hidden="true" hidden><rect x="5" y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>
          <span class="preview-sr-only" id="playLabel">播放</span>
        </button>
        <span class="preview-time" aria-label="播放时间">
          <strong id="currentTime">00:00</strong><span>/</span><span id="totalTime">00:00</span>
        </span>
      </div>
      <div class="preview-secondary-controls">
        <label class="preview-safe-toggle">
          <span>安全区</span>
          <input type="checkbox" id="safeToggle" aria-label="播放器安全区">
          <i aria-hidden="true"></i>
        </label>
        <div class="preview-menu-anchor">
          <button type="button" class="preview-text-button" id="rateButton" aria-label="倍速" aria-expanded="false">倍速</button>
          <div class="preview-popover" id="rateMenu" role="menu" aria-label="播放倍速" hidden></div>
        </div>
        <div class="preview-menu-anchor">
          <button type="button" class="preview-text-button" id="aspectButton" aria-label="画幅 16:9" aria-expanded="false">16:9</button>
          <div class="preview-popover" id="aspectMenu" role="menu" aria-label="画幅比例" hidden>
            <button type="button" role="menuitemradio" aria-checked="true" data-aspect="16:9">16:9</button>
            <button type="button" role="menuitemradio" aria-checked="false" data-aspect="9:16" disabled>9:16 · 冒烟版未覆盖</button>
          </div>
        </div>
        <div class="preview-menu-anchor">
          <button type="button" class="preview-text-button" id="backgroundButton" aria-label="背景" aria-expanded="false">背景</button>
          <div class="preview-popover" id="backgroundMenu" role="menu" aria-label="预览背景" hidden></div>
        </div>
        <div class="preview-menu-anchor">
          <button type="button" class="preview-icon-button" id="volumeButton" aria-label="音量" aria-expanded="false">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>
          </button>
          <div class="preview-volume-popover" id="volumeMenu" aria-label="音量设置" hidden>
            <span id="volumeLabel">0</span>
            <input type="range" id="volumeRange" min="0" max="1" step="0.01" value="1" aria-label="调整音量">
            <span class="preview-sr-only">冒烟版合成没有音轨，音量控件保留以保持外壳一致</span>
          </div>
        </div>
        <button type="button" class="preview-icon-button" id="fullscreenButton" aria-label="全屏">
          <svg id="maximizeIcon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          <svg id="minimizeIcon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
        </button>
      </div>
    </div>
  </div>`;

export function createPreviewChrome({
  container,
  composition,
  runtimeSrc = "/engine/hyperframes/hyperframe.runtime.iife.js",
  canvas = {width: 1920, height: 1080},
  layout = "library",
  background = DEFAULT_BACKGROUND,
  rate = 1,
  safeArea = false,
  initialTime = 0,
  loop = false,
  onPatchError,
}) {
  if (!container) throw new Error("createPreviewChrome 需要一个承载预览的容器。");
  const aspect = canvas.width / canvas.height;
  const surface = document.createElement("div");
  surface.className = `preview-surface ${PREVIEW_BACKGROUNDS[background]?.className ?? "checker"}`;
  surface.id = "surface";
  surface.setAttribute("data-preview-surface", "");
  surface.setAttribute("data-preview-aspect", canvas.width >= canvas.height ? "16:9" : "9:16");
  surface.innerHTML = CHROME_MARKUP;
  container.appendChild(surface);

  const $ = id => surface.querySelector(`#${id}`);
  const stage = $("stage");
  const playerElement = $("player");
  const safeAreaBox = $("safeArea");
  const progressWrap = $("progressWrap");
  const progress = $("progress");
  const playButton = $("playButton");
  const playIcon = $("playIcon");
  const pauseIcon = $("pauseIcon");
  const playLabel = $("playLabel");
  const currentTimeLabel = $("currentTime");
  const totalTimeLabel = $("totalTime");
  const safeToggle = $("safeToggle");
  const rateButton = $("rateButton");
  const rateMenu = $("rateMenu");
  const aspectMenu = $("aspectMenu");
  const backgroundButton = $("backgroundButton");
  const backgroundMenu = $("backgroundMenu");
  const volumeButton = $("volumeButton");
  const volumeMenu = $("volumeMenu");
  const volumeRange = $("volumeRange");
  const volumeLabel = $("volumeLabel");
  const fullscreenButton = $("fullscreenButton");
  const maximizeIcon = $("maximizeIcon");
  const minimizeIcon = $("minimizeIcon");

  playerElement.setAttribute("width", String(canvas.width));
  playerElement.setAttribute("height", String(canvas.height));
  playerElement.setAttribute("runtime-src", runtimeSrc);

  let duration = 0;
  let currentTime = 0;
  let playing = false;
  let muted = true;
  let volume = 1;
  let playbackRate = resolvePlaybackRate(rate);
  let backgroundId = background;
  let selectedRate = playbackRate !== 1;
  let selectedBackground = backgroundId !== DEFAULT_BACKGROUND;
  let pendingRestore = null;
  let revision = 0;
  const pendingPatches = new Map();

  /* ── 几何：画布在外壳里等比缩放（library 与 fill 两种档位） ─────────────────── */
  function fitStage() {
    const box = surface.getBoundingClientRect();
    if (layout === "library") {
      const width = Math.max(0, box.width);
      const slotHeight = Math.min(LIBRARY_PRESET.maxCanvas.height, Math.max(LIBRARY_PRESET.minSlotHeight, (width * 9) / 16));
      const scale = Math.min(width / canvas.width, slotHeight / canvas.height,
        LIBRARY_PRESET.maxCanvas.width / canvas.width, LIBRARY_PRESET.maxCanvas.height / canvas.height);
      surface.style.height = `${Math.round(slotHeight)}px`;
      stage.style.width = `${Math.round(canvas.width * scale)}px`;
      stage.style.height = `${Math.round(canvas.height * scale)}px`;
      stage.setAttribute("data-stage-size", `${Math.round(canvas.width * scale)}x${Math.round(canvas.height * scale)}`);
      return;
    }
    const availableWidth = Math.max(160, box.width - 48);
    // 控制条叠在画布下沿，这里额外留出它的视觉高度。
    const availableHeight = Math.max(90, box.height - 120);
    const width = Math.min(availableWidth, availableHeight * aspect);
    stage.style.width = `${Math.round(width)}px`;
    stage.style.height = `${Math.round(width / aspect)}px`;
    stage.setAttribute("data-stage-size", `${Math.round(width)}x${Math.round(width / aspect)}`);
  }
  const resizeObserver = new ResizeObserver(fitStage);
  resizeObserver.observe(surface);
  fitStage();

  /* ── 内核：统一接口驱动 ───────────────────────────────────────────────────── */
  let readyResolve;
  const readyPromise = new Promise(resolve => { readyResolve = resolve; });

  const adapter = assertAdapter(new HyperPlayerAdapter(playerElement, {
    runtimeSrc,
    onTimeUpdate: (time, total) => {
      currentTime = time;
      if (total) duration = total;
      renderTime();
    },
    onReady: total => {
      duration = total;
      progress.max = String(duration || 0);
      renderTime();
      document.documentElement.setAttribute("data-player-ready", "1");
      readyResolve({duration, adapter});
      if (pendingRestore) {
        const {time, playing: wasPlaying} = pendingRestore;
        pendingRestore = null;
        adapter.seek(Math.min(time, duration));
        if (wasPlaying) adapter.play();
      } else if (initialTime > 0) {
        // 首帧落在英雄帧上（t=0 时卡片还没入场，预览会是一块空画面）
        adapter.seek(Math.min(initialTime, duration));
      }
    },
    onEnded: () => setPlaying(false),
    onError: message => {
      document.documentElement.setAttribute("data-player-error", String(message));
      readyResolve({duration: 0, adapter, error: message});
    },
  }));
  adapter.onPlaybackChange(next => setPlaying(next));
  adapter.setPlaybackRate(playbackRate);

  function renderTime() {
    currentTimeLabel.textContent = formatTime(currentTime);
    totalTimeLabel.textContent = formatTime(duration);
    progress.value = String(Math.min(currentTime, duration || 0));
    progressWrap.style.setProperty("--preview-progress", `${duration > 0 ? (currentTime / duration) * 100 : 0}%`);
    document.documentElement.setAttribute("data-player-time", currentTime.toFixed(3));
  }

  function setPlaying(next) {
    playing = next;
    playIcon.hidden = next;
    pauseIcon.hidden = !next;
    playLabel.textContent = next ? "暂停" : "播放";
    playButton.setAttribute("aria-label", next ? "暂停" : "播放");
    document.documentElement.setAttribute("data-player-playing", next ? "1" : "0");
  }

  /* ── 控制条 ──────────────────────────────────────────────────────────────── */
  playButton.addEventListener("click", () => (playing ? adapter.pause() : adapter.play()));
  progress.addEventListener("input", event => { adapter.seek(Number(event.target.value)); });

  PLAYBACK_RATES.forEach(value => {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitemradio");
    item.dataset.rate = String(value);
    item.innerHTML = `<span>${value.toFixed(1)} 倍${value === 1 ? " · 正常" : ""}</span>`;
    item.addEventListener("click", () => {
      playbackRate = value;
      selectedRate = true;
      adapter.setPlaybackRate(playbackRate);
      renderRateMenu();
      closeMenus();
    });
    rateMenu.appendChild(item);
  });
  function renderRateMenu() {
    Array.from(rateMenu.children).forEach(item => item.setAttribute("aria-checked", String(Number(item.dataset.rate) === playbackRate)));
    rateButton.textContent = selectedRate || playbackRate !== 1 ? `${playbackRate}x` : "倍速";
  }

  Object.values(PREVIEW_BACKGROUNDS).forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitemradio");
    button.dataset.background = item.id;
    button.innerHTML = `<span>${item.label}</span>`;
    button.addEventListener("click", () => {
      selectedBackground = true;
      setBackground(item.id);
      closeMenus();
    });
    backgroundMenu.appendChild(button);
  });

  /* 画布底色：把外壳当前底色写成合成的载入参数（canvas-backdrop.js 读它并铺到 <html> 上）。
     为什么不在载入后实时改：hyperframes 0.8.46 的运行时数据通道同一通道只有首次投递生效，
     实时切换不可靠；换参数重新挂载是确定性的，而且和渲染路径（--variables）同一条。 */
  function applyBackgroundVisuals() {
    Object.values(PREVIEW_BACKGROUNDS).forEach(item => surface.classList.toggle(item.className, item.id === backgroundId));
    Array.from(backgroundMenu.children).forEach(item => item.setAttribute("aria-checked", String(item.dataset.background === backgroundId)));
    backgroundButton.textContent = selectedBackground ? PREVIEW_BACKGROUNDS[backgroundId].label : "背景";
    document.documentElement.setAttribute("data-player-background", backgroundId);
  }

  function compositionUrl() {
    const url = new URL(composition, window.location.origin);
    url.searchParams.set("canvas", backgroundId.toUpperCase());
    return url;
  }

  // 只在底色真的变了时重新挂载：初始那一次直接把参数写进 src，避免加载两次。
  function setBackground(id) {
    const next = PREVIEW_BACKGROUNDS[id] ? id : DEFAULT_BACKGROUND;
    const changed = next !== backgroundId;
    backgroundId = next;
    applyBackgroundVisuals();
    if (changed) remountComposition();
  }

  function remountComposition() {
    const url = compositionUrl();
    if (document.documentElement.getAttribute("data-player-ready") === "1") {
      const state = adapter.getPlaybackState();
      pendingRestore = {time: state.currentTime, playing: state.playing};
      document.documentElement.setAttribute("data-player-ready", "0");
    }
    playerElement.setAttribute("src", url.pathname + url.search);
  }

  aspectMenu.addEventListener("click", event => {
    const button = event.target.closest("button[data-aspect]");
    if (!button || button.disabled) return;
    closeMenus();
  });

  safeToggle.addEventListener("change", () => {
    safeAreaBox.hidden = !safeToggle.checked;
    document.documentElement.setAttribute("data-player-safe-area", safeToggle.checked ? "1" : "0");
  });
  if (safeArea) {
    safeToggle.checked = true;
    safeAreaBox.hidden = false;
  }
  // 组件库详情页要看到入场动画：循环播放（播完自动从头再来）
  if (loop) playerElement.loop = true;

  volumeRange.addEventListener("input", event => {
    volume = Number(event.target.value);
    muted = volume === 0;
    adapter.setVolume(volume);
    adapter.setMuted(muted);
    volumeLabel.textContent = String(muted ? 0 : Math.round(volume * 100));
  });

  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement === surface) await document.exitFullscreen();
    else await surface.requestFullscreen?.();
  });
  const onFullscreenChange = () => {
    const isFullscreen = document.fullscreenElement === surface;
    maximizeIcon.hidden = isFullscreen;
    minimizeIcon.hidden = !isFullscreen;
    fullscreenButton.setAttribute("aria-label", isFullscreen ? "退出全屏" : "全屏");
    fitStage();
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);

  const menus = [
    {button: rateButton, menu: rateMenu},
    {button: aspectButton, menu: aspectMenu},
    {button: backgroundButton, menu: backgroundMenu},
    {button: volumeButton, menu: volumeMenu},
  ];
  function closeMenus(except) {
    menus.forEach(({button, menu}) => {
      if (menu === except) return;
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    });
  }
  menus.forEach(({button, menu}) => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const nextHidden = !menu.hidden;
      closeMenus(menu);
      menu.hidden = nextHidden;
      button.setAttribute("aria-expanded", String(!nextHidden));
    });
  });
  const onDocumentClick = () => closeMenus();
  const onKeydown = event => {
    if (event.key === "Escape") closeMenus();
    if (event.code === "Space" && event.target === document.body) {
      event.preventDefault();
      playing ? adapter.pause() : adapter.play();
    }
  };
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);

  /* ── 变量补丁：外壳 → 合成（官方 player 的 setRuntimeData 0.8.46 只能投递一次） ─────
     发的是与 data-variable-values 完全同构的变量表；合成回应 hyperframes:patched。 */
  function onMessage(event) {
    const message = event.data;
    if (!message || message.type !== "hyperframes:patched") return;
    const pending = pendingPatches.get(message.revision);
    if (!pending) return;
    pendingPatches.delete(message.revision);
    if (message.ok === false) onPatchError?.(message.reason);
    pending.resolve(message);
  }
  window.addEventListener("message", onMessage);

  // payload: {compositionId?, variables?, content?, options?}
  //   variables —— 技能卡的标量变量表；content + options —— 契约 v2（数组内容 + 标量选项）
  function patch(payload) {
    revision += 1;
    const target = playerElement.iframeElement?.contentWindow;
    if (!target) return Promise.resolve({ok: false, reason: "内核尚未就绪"});
    const request = new Promise(resolve => {
      const timer = window.setTimeout(() => {
        pendingPatches.delete(revision);
        resolve({ok: false, reason: "补丁超时"});
      }, 2000);
      pendingPatches.set(revision, {resolve: result => { window.clearTimeout(timer); resolve(result); }});
    });
    target.postMessage({
      type: "hyperframes:patch",
      compositionId: payload.compositionId ?? "cmp-skl-001",
      revision,
      variables: payload.variables,
      content: payload.content,
      options: payload.options,
    }, "*");
    // 补丁改的是同一帧上的动画与版式。postMessage 是异步的，所以必须在**合成应用完补丁之后**
    // 再 nudge 一次时间，运行时才会按当前时间重画（否则会停在被改写前的状态，看起来像卡住）。
    return request.then(result => {
      const time = adapter.getPlaybackState().currentTime;
      adapter.seek(Math.max(0, time - 0.001));
      adapter.seek(time);
      return result;
    });
  }

  renderRateMenu();
  applyBackgroundVisuals();
  playerElement.setAttribute("src", (() => {
    const url = compositionUrl();
    return url.pathname + url.search;
  })());

  const api = {
    adapter,
    ready: readyPromise,
    surface,
    stage,
    player: playerElement,
    composition,
    runtime: runtimeSrc,
    patch,
    revision: () => revision,
    setBackground,
    getBackground: () => backgroundId,
    setSafeArea: next => { safeToggle.checked = Boolean(next); safeToggle.dispatchEvent(new Event("change")); },
    seek: time => adapter.seek(time),
    play: () => adapter.play(),
    pause: () => adapter.pause(),
    state: () => adapter.getPlaybackState(),
    stageSize: () => stage.getAttribute("data-stage-size"),
    fitStage,
    destroy() {
      resizeObserver.disconnect();
      adapter.destroy();
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("message", onMessage);
      surface.remove();
    },
  };
  window.__playerSmoke = api;
  return api;
}
