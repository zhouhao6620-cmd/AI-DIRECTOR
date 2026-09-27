// HyperFrames 组件运行时工具（组件库改造共用）
//
// Role: Reference（改造工具，不是基线）
//
// 19 颗组件共用这一份「外壳 ↔ 合成」契约实现，避免每个合成重复写样板：
//   · 载入：读 HyperFrames Variables（标量选项）+ 内联样例内容（数组内容树）
//   · 补丁：{type:"hyperframes:patch", compositionId, revision, content, options} → 原地重渲染
//   · 时间线：沿用同一个 GSAP 时间线对象（clear 后重建）+ 通知运行时重新绑定
//   · 实例包装：位置（外层 translate）+ 大小（组件自身盒子上的独立 scale），与工作台
//     platform/remotion/component-sample.jsx 的实例语义一致
//   · 测量：canvas 字素级测量 + 换行（与各组件 layout.js 的测量口径一致：只算字形宽度，字距自己补）

(function () {
  const REQUIRED = "1.0.0";

  const registry = () => (window.__timelines = window.__timelines || {});
  function timelineFor(id) {
    const reg = registry();
    if (!reg[id]) reg[id] = gsap.timeline({paused: true});
    return reg[id];
  }

  function rgba(hex, alpha) {
    const value = String(hex).replace("#", "");
    const [r, g, b] = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function createMeasurer(root, cssVarName = "--font-body") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const family = () => window.getComputedStyle(root).getPropertyValue(cssVarName).trim() || "sans-serif";
    const glyph = (text, fontSize, fontWeight) => {
      ctx.font = `${fontWeight} ${fontSize}px ${family()}`;
      return ctx.measureText(text).width;
    };
    return {
      glyph,
      // Chrome 在每个字符后加字距（含最后一个），测量只算字形前进宽度 → 自己补字距
      width: (text, fontSize, fontWeight, letterSpacing = 0) => glyph(text, fontSize, fontWeight) + [...String(text)].length * letterSpacing,
      wrap(text, maxWidth, fontSize, fontWeight, letterSpacing = 0) {
        const lines = [];
        let line = "";
        const graphemes = Array.from(new Intl.Segmenter("zh", {granularity: "grapheme"}).segment(String(text)), item => item.segment);
        for (const grapheme of graphemes) {
          const next = line + grapheme;
          if (line && this.width(next, fontSize, fontWeight, letterSpacing) > maxWidth) {
            lines.push(line);
            line = grapheme;
          } else line = next;
        }
        if (line) lines.push(line);
        return lines;
      },
    };
  }

  function readInlineContent(root) {
    const node = root.querySelector("script[data-hf-content]");
    if (!node) return {};
    try { return JSON.parse(node.textContent); } catch { return {}; }
  }

  function optionNumber(variables, key, fallback) {
    const value = Number(variables[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  // 实例包装（与 platform/remotion/component-sample.jsx 的 WRAPPED_POSITION / WRAPPED_SIZE 同源）：
  //   位置：外层包装层 translate((x-0.5)*100%, (y-0.5)*100%)
  //   大小：组件自身盒子上的独立 scale（不与组件自己的 transform 入场动画互相覆盖，也不会随缩放漂移）
  function mountInstance(scope, box, variables) {
    const position = variables.position ?? {
      x: optionNumber(variables, "position-x", 0.5),
      y: optionNumber(variables, "position-y", 0.5),
    };
    const offset = variables.positionOffset ?? position;
    const size = optionNumber(variables, "size", 1);
    if (scope) scope.style.transform = `translate(${((offset.x ?? 0.5) - 0.5) * 100}%, ${((offset.y ?? 0.5) - 0.5) * 100}%)`;
    if (box) box.style.scale = String(size);
    return {position: offset, size};
  }

  /**
   * 挂载一颗组件。
   * config = {
   *   id: "cmp-xxx-001",
   *   root: 合成根元素选择器（默认 [data-composition-id="<id>"]）
   *   mount?: "instance" | "none"   —— 是否由 kit 施加实例位置/大小（默认 instance：scope=[data-scope]，box=[data-box]）
   *   tokens?: {DARK: {...}, LIGHT: {...}}  + applyTokens?(ctx) 由组件自己写 CSS 变量
   *   options?: variables => options      —— 标量选项解析（默认原样返回 variables）
   *   build: ctx => void                  —— 组件自己的 DOM + 时间线构建
   * }
   */
  function mount(config) {
    const id = config.id;
    const root = document.querySelector(config.root ?? `[data-composition-id="${id}"]`);
    if (!root) throw new Error(`找不到合成根元素：${id}`);
    const hf = window.__hyperframes || {};
    const measure = createMeasurer(root, config.fontVar ?? "--font-body");
    let revision = 0;

    function render(variables, content) {
      const timeline = timelineFor(id);
      // 重建时间线之前，先把上一条时间线留在元素上的内联动画属性清掉：
      // 否则新的 from() 会把「上次留下的终值（例如 translateY(-110%)）」当成终点，动画直接失效。
      const touched = new Set();
      timeline.getChildren(true, true, true).forEach(child => {
        const targets = typeof child.targets === "function" ? child.targets() : [];
        (Array.isArray(targets) ? targets : [targets]).forEach(node => {
          if (node && node.nodeType === 1) touched.add(node);
        });
      });
      timeline.clear();
      if (touched.size) gsap.set([...touched], {clearProps: "transform,opacity,filter"});
      const options = (config.options ? config.options(variables) : {...variables}) || {};
      const tokens = config.tokens ? (config.tokens[options.surface] ?? config.tokens.DARK) : null;
      const ctx = {
        id, root, timeline, options, content, tokens, measure, rgba, variables, revision,
        overflow: [],
        stage: {width: root.clientWidth || 1920, height: root.clientHeight || 1080},
        setAttr: (node, name, value) => node && node.setAttribute(name, String(value)),
        text: (node, value) => { if (node) node.textContent = value ?? ""; },
        reject: reason => { throw new Error(reason); },
      };
      ctx.instance = config.mount === "none"
        ? {position: {x: 0.5, y: 0.5}, size: 1}
        : mountInstance(root.querySelector("[data-scope]"), root.querySelector("[data-box]"), variables);
      if (config.applyTokens) config.applyTokens(ctx);
      config.build(ctx);
      // 通用动效速度：所有组件共用一条时间线，慢/中/快直接改时间线速度，
      // 这样即使组件定义没开放动画参数，「动画设置」里也有一个真起作用的控件。
      // 注意：读的是原始变量表（各组件的 options() 是白名单，会把通用键过滤掉）
      const speed = String(variables.motionSpeed ?? "MEDIUM").toUpperCase();
      timeline.timeScale(speed === "SLOW" ? 0.7 : speed === "FAST" ? 1.4 : 1);
      // 实例时长：合成根上的 data-duration 是运行时与播放器的时长事实源，跟着 duration 变量走
      if (Number.isFinite(Number(options.duration))) root.setAttribute("data-duration", String(Number(options.duration)));
      root.setAttribute("data-rendered-revision", String(revision));
      if (typeof window.__hfForceTimelineRebind === "function") window.__hfForceTimelineRebind();
      return ctx;
    }

    const bootVariables = typeof hf.getVariables === "function" ? hf.getVariables() : {};
    const bootContent = config.sample ?? readInlineContent(root);
    render(bootVariables, bootContent);
    root.setAttribute("data-component-ready", REQUIRED);

    // 契约 v2：数组内容走 content 补丁，标量选项走 options 补丁
    window.addEventListener("message", event => {
      const message = event.data;
      if (!message || message.type !== "hyperframes:patch" || message.compositionId !== id) return;
      revision += 1;
      let result = {ok: true};
      try {
        const applied = render({...bootVariables, ...(message.options || {})}, message.content ?? config.sample ?? readInlineContent(root));
        result = {ok: true, meta: applied.meta ?? null};
      } catch (error) {
        result = {ok: false, reason: error.message};
      }
      root.setAttribute("data-patch-revision", String(message.revision ?? revision));
      event.source?.postMessage({type: "hyperframes:patched", compositionId: id, revision: message.revision ?? revision, ...result}, "*");
    });

    return {root, render};
  }

  window.hfComponentKit = {mount, rgba, createMeasurer, readInlineContent, timelineFor, mountInstance};
})();
