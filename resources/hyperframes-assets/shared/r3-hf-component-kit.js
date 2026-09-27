(function () {
  const PATCH_PROTOCOL = 'r3.hyperframes.patch.v1';
  const PATCH_ACK_PROTOCOL = 'r3.hyperframes.patch-ack.v1';

  const registry = () => (window.__timelines = window.__timelines || {});
  function timelineFor(id) {
    const timelines = registry();
    if (!timelines[id]) timelines[id] = gsap.timeline({ paused: true });
    return timelines[id];
  }

  function rgba(hex, alpha) {
    const value = String(hex).replace('#', '');
    const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function createMeasurer(root, cssVarName = '--font-body') {
    const context = document.createElement('canvas').getContext('2d');
    const family = () => window.getComputedStyle(root).getPropertyValue(cssVarName).trim() || 'sans-serif';
    const glyph = (text, fontSize, fontWeight) => {
      context.font = `${fontWeight} ${fontSize}px ${family()}`;
      return context.measureText(text).width;
    };
    return {
      glyph,
      width(text, fontSize, fontWeight, letterSpacing = 0) {
        return glyph(text, fontSize, fontWeight) + [...String(text)].length * letterSpacing;
      },
      wrap(text, maxWidth, fontSize, fontWeight, letterSpacing = 0) {
        const lines = [];
        let line = '';
        for (const part of Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(String(text)), (item) => item.segment)) {
          const next = line + part;
          if (line && this.width(next, fontSize, fontWeight, letterSpacing) > maxWidth) {
            lines.push(line);
            line = part;
          } else line = next;
        }
        if (line) lines.push(line);
        return lines;
      },
    };
  }

  function readInlineContent(root) {
    const node = root.querySelector('script[data-hf-content]');
    try { return node ? JSON.parse(node.textContent) : {}; } catch { return {}; }
  }

  function optionNumber(variables, key, fallback) {
    const value = Number(variables[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function mountInstance(scope, box, variables) {
    const position = variables.positionOffset ?? variables.position ?? {
      x: optionNumber(variables, 'position-x', 0.5),
      y: optionNumber(variables, 'position-y', 0.5),
    };
    const size = optionNumber(variables, 'size', 1);
    if (scope) scope.style.transform = `translate(${((position.x ?? 0.5) - 0.5) * 100}%, ${((position.y ?? 0.5) - 0.5) * 100}%)`;
    if (box) box.style.scale = String(size);
    return { position, size };
  }

  function mount(config) {
    const root = document.querySelector(config.root ?? `[data-composition-id="${config.id}"]`);
    if (!root) throw new Error(`Composition root is missing: ${config.id}`);
    const measure = createMeasurer(root, config.fontVar ?? '--font-body');
    const bootVariables = typeof window.__hyperframes?.getVariables === 'function' ? window.__hyperframes.getVariables() : {};
    let revision = 0;

    function render(variables, content) {
      const timeline = timelineFor(config.id);
      const touched = new Set();
      timeline.getChildren(true, true, true).forEach((child) => {
        for (const node of child.targets?.() ?? []) if (node?.nodeType === 1) touched.add(node);
      });
      timeline.clear();
      if (touched.size) gsap.set([...touched], { clearProps: 'transform,opacity,filter' });
      const options = config.options ? config.options(variables) : { ...variables };
      const tokens = config.tokens ? (config.tokens[options.surface] ?? config.tokens.DARK) : null;
      const context = {
        id: config.id, root, timeline, options, content, tokens, measure, rgba, variables, revision,
        overflow: [], stage: { width: root.clientWidth || 1920, height: root.clientHeight || 1080 },
        setAttr: (node, name, value) => node?.setAttribute(name, String(value)),
        text: (node, value) => { if (node) node.textContent = value ?? ''; },
        reject: (reason) => { throw new Error(reason); },
      };
      context.instance = config.mount === 'none' ? { position: { x: 0.5, y: 0.5 }, size: 1 } : mountInstance(root.querySelector('[data-scope]'), root.querySelector('[data-box]'), variables);
      config.applyTokens?.(context);
      config.build(context);
      const speed = String(variables.motionSpeed ?? 'MEDIUM').toUpperCase();
      timeline.timeScale(speed === 'SLOW' ? 0.7 : speed === 'FAST' ? 1.4 : 1);
      if (Number.isFinite(Number(options.duration))) root.setAttribute('data-duration', String(Number(options.duration)));
      root.setAttribute('data-rendered-revision', String(revision));
      window.__hfForceTimelineRebind?.();
      return context;
    }

    render(bootVariables, config.sample ?? readInlineContent(root));
    root.setAttribute('data-component-ready', 'r3');
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.protocol !== PATCH_PROTOCOL || !message.requestId || !message.variables || typeof message.variables !== 'object') return;
      revision += 1;
      let result;
      try {
        render({ ...bootVariables, ...message.variables }, config.sample ?? readInlineContent(root));
        result = { ok: true };
      } catch (error) {
        result = { ok: false, errorCode: 'PATCH_REJECTED', detail: error instanceof Error ? error.message : String(error) };
      }
      root.setAttribute('data-patch-revision', String(revision));
      event.source.postMessage({ protocol: PATCH_ACK_PROTOCOL, requestId: message.requestId, ...result }, event.origin);
    });
    return { root, render };
  }

  window.r3HfComponentKit = { mount, rgba, createMeasurer, readInlineContent, timelineFor, mountInstance };
  window.hfComponentKit = window.r3HfComponentKit;
})();
