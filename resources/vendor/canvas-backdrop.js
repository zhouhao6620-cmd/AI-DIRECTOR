// 画布底色桥（冒烟测试版）
//
// Role: Reference（冒烟测试件，不是基线）
//
// 为什么需要它：CMP-SKL-001 在 Remotion 里是 transparent = true —— 组件不铺底，底色由工作台的
// 预览底色提供。换成 HyperFrames 后，合成跑在 <iframe> 里，而 Chromium 给 iframe 铺的是白底，
// 「透明合成」会直接露出这层白（官方 player 用 :host{background:#000} 顶掉的就是它）。
// iframe 自身的 CSS 背景也盖不住这层基底，唯一能真正控制它的是合成自己的 <html> 背景。
//
// 取色优先级（都是「载入时确定」，与渲染路径一致）：
//   1. URL 查询参数 ?canvas=DARK|LIGHT|CHECKER —— 外壳（播放器）切换预览底色时用
//   2. data-composition-variables 里的 canvas 变量 —— 渲染时用 `--variables '{"canvas":"LIGHT"}'`
//   3. 默认 DARK
//
// 另外仍注册官方数据通道：宿主可以用 player.setRuntimeData("canvas", {background}) 一次性给定底色。
// 注意 hyperframes 0.8.46 的实测行为：同一通道只有**首次**投递会落地（见 SMOKE_TEST_REPORT 的发现清单），
// 所以实时切换不依赖它，走查询参数重新挂载。

(function () {
  const hf = window.__hyperframes || {};

  // 与工作台预览底色同源的三档（src/shared/component-preview/resolve.js）
  const PRESETS = {
    DARK: {backgroundColor: "#000000"},
    LIGHT: {backgroundColor: "#ebe8e1"},
    CHECKER: {
      backgroundColor: "#252936",
      backgroundImage: "linear-gradient(45deg, #323847 25%, transparent 25%), linear-gradient(-45deg, #323847 25%, transparent 25%), "
        + "linear-gradient(45deg, transparent 75%, #323847 75%), linear-gradient(-45deg, transparent 75%, #323847 75%)",
      backgroundSize: "24px 24px",
      backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
    },
  };

  function paint(payload) {
    const root = document.documentElement;
    const preset = typeof payload === "string" ? PRESETS[payload.toUpperCase()] : payload;
    if (!preset) return;
    root.style.backgroundColor = preset.backgroundColor || "transparent";
    root.style.backgroundImage = preset.backgroundImage || "none";
    root.style.backgroundSize = preset.backgroundSize || "";
    root.style.backgroundPosition = preset.backgroundPosition || "";
    root.setAttribute("data-canvas-backdrop", preset.backgroundColor || "transparent");
  }

  const fromQuery = new URLSearchParams(window.location.search).get("canvas");
  const declared = String(fromQuery || (typeof hf.getVariables === "function" ? hf.getVariables().canvas : "") || "DARK").toUpperCase();
  paint(PRESETS[declared] ?? PRESETS.DARK);

  // 播放器外壳通过官方数据通道覆盖（实现见 player/player-host.js）
  if (typeof hf.registerRuntimeDataHandler === "function") {
    hf.registerRuntimeDataHandler("canvas", payload => paint(payload?.background ?? payload));
  }
})();
