// 来源与适配说明（COMP-02 方向修正后的最终目标：竖向阶段流程）
//
// 来源：RemotionUI 官方 registry 的 `connector-lines` primitive（复制式来源，MIT；
// npm `remotion-ui@0.9.1`，仓库 github.com/riaz37/remotion-ui @ f929be76…）。
// 原件留档：docs/component-assets/references/COMP-02_remotionui_connector-lines.registry.json
// （sha256 e6a4b075fb3a02ea421415e7f23228604dee5ce7c4f932870203d4456e31aae2）
//
// 从来源保留的做法（本项目重写，不是逐字拷贝）：
//   - 每条连接用 `pathLength={1}` + `strokeDashoffset` 描画，长边短边同速；
//   - 描画进度驱动「方向标记」的出现（来源是到达圆点，这里是下行箭头）；
//   - 端点几何由版式表统一给出，画幅变化时连接关系不错位。
//
// 与来源的差异：
//   1. 本组件只有一条竖向主脊（阶段 1→2→3→4…），不是一对多的分叉，所以线形收敛为
//      「竖直脊线 + 下行箭头」，不再需要 curve / elbow / straight 三种线形；
//   2. 叙事换成：标题 → 阶段 i → 阶段 i 的右侧展开 → 竖线生长 → 阶段 i+1；
//   3. 来源 easing 来自它的 motion-tokens helper，本项目沿用自己既有的缓动。
//
// 版式要点：
//   - 左侧一列阶段节点（编号 + 可选图标 + 标题），竖向等距排列；
//   - 阶段之间的竖线连接「上一条底边中点」与「下一条顶边中点」，带下行箭头；
//   - 只有当前阶段在右侧展开详情面板，面板按行垂直居中；标题在整块上方。

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  title: {
    fontSize: 44, fontWeight: 700, lineHeight: 1.2, letterSpacingEm: -0.01, marginBottom: 32,
  },
  node: {
    // 节点只做一行：图标 + 名称（用户 2026-09-15：不要两行、不要复杂）。
    width: 360, paddingX: 22, paddingY: 20, radius: 18, borderWidth: 1.5, accentBar: 0,
    indexFontSize: 28, indexFontWeight: 700, indexGap: 12,
    iconSize: 26, iconGap: 10,
    titleFontSize: 32, titleFontWeight: 600, titleLineHeight: 1.22,
  },
  // 横向模式一行要排 2–5 个节点，节点按行宽收窄；字号同步降一档，
  // 保证与纵向模式共用同一套内容上限（14 字两行）。
  nodeHorizontal: {
    width: 330, paddingX: 20, paddingY: 18, radius: 16, borderWidth: 1.5, accentBar: 0,
    indexFontSize: 26, indexFontWeight: 700, indexGap: 12,
    iconSize: 24, iconGap: 10,
    titleFontSize: 30, titleFontWeight: 600, titleLineHeight: 1.22,
  },
  /** 横向模式的节点间距：竖屏里要更省横向空间。 */
  stageGapHorizontal: 44,
  panel: {
    width: 430, paddingX: 20, paddingY: 18, radius: 16, borderWidth: 1.5,
    fontSize: 24, fontWeight: 400, lineHeight: 1.5,
  },
  laneGap: 90,
  stageGap: 52,
  /** 横向模式下，展开面板与节点行之间的竖向间距。 */
  panelGap: 18,
  connectorStrokeWidth: 2.2,
  connectorActiveStrokeWidth: 2.8,
  // 方向色统一（用户 2026-09-15 两次校正后的口径）：竖线与箭头是**一体**的，
  // 都用方向色黄，描边宽度接近（箭头只略粗一点点），靠不透明度区分当前与已走过。
  arrowWidth: 22,
  arrowHeight: 15,
  arrowStrokeScale: 1.15,
  arrowHaloScale: 1.6,
  // 三档明暗：指向当前阶段的那条最亮，正在生长的中等，走过的收暗。
  lineOpacity: {active: 1, growing: 0.75, traversed: 0.45},
  titleEnterMs: 420,
  nodeEnterMs: 380,
  panelRevealMs: 420,
  panelDelayRatio: 0.6,
  stepMsRange: [160, 1200],
  defaultStepMs: 420,
  holdMs: 800,
  inactiveOpacity: 0.5,
  safeSideRatio: 0.0625,
  safeVerticalRatio: 0.08,
  minScale: 0.62,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

// 图标白名单与 DRAFT-two-level-branch-flow 保持一致，避免同一套图标在两个组件里出现两套口径。
export const ICON_IDS = [
  "", "shield", "activity", "heart-pulse", "brain", "layers", "target",
  "trending-up", "zap", "droplet", "atom", "pill", "flame", "leaf",
];

export const MIN_STAGES = 2;
export const MAX_STAGES = 5;

// 一个组件两个方向（用户 2026-09-15 确认）：与章节进度条 FILL / LINE 同一个变体机制，
// 语义、内容树、时间轴、高亮与展开逻辑完全共用，只有「舞台怎么摆」不同。
export const DIRECTIONS = ["VERTICAL", "HORIZONTAL"];
export const DEFAULT_DIRECTION = "VERTICAL";

export const MAX_TITLE_LINES = 1;
export const MAX_STAGE_TITLE_LINES = 2;
export const MAX_DETAIL_LINES = 2;

const round = value => Number(value.toFixed(3));

export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/** 某个方向下的节点规格与间距（两个方向共用同一套内容上限）。 */
export function nodeConfigFor(orientation = DEFAULT_DIRECTION) {
  return orientation === "HORIZONTAL"
    ? {...SOURCE_GEOMETRY.node, ...SOURCE_GEOMETRY.nodeHorizontal}
    : SOURCE_GEOMETRY.node;
}

export function stageGapFor(orientation = DEFAULT_DIRECTION) {
  return orientation === "HORIZONTAL" ? SOURCE_GEOMETRY.stageGapHorizontal : SOURCE_GEOMETRY.stageGap;
}

export function wrapText(text, maxWidth, fontSize, fontWeight, letterSpacing, measure) {
  const lines = [];
  let line = "";
  const graphemes = [...new Intl.Segmenter("zh", {granularity: "grapheme"}).segment(text)].map(item => item.segment);
  for (const grapheme of graphemes) {
    if (line && measure(line + grapheme, fontSize, fontWeight, letterSpacing) > maxWidth) {
      lines.push(line);
      line = grapheme;
    } else line += grapheme;
  }
  if (line) lines.push(line);
  return lines;
}

export const stageNumberOf = index => String(index + 1).padStart(2, "0");

/** 阶段节点内文可用宽度：扣掉左右内边距、描边，以及行首的图标与编号占位。 */
export function nodeTextWidth(measure, {withIcon = true, orientation = DEFAULT_DIRECTION} = {}) {
  const node = nodeConfigFor(orientation);
  const numberWidth = Math.max(
    measure(stageNumberOf(0), node.indexFontSize, node.indexFontWeight, 0),
    measure(stageNumberOf(9), node.indexFontSize, node.indexFontWeight, 0),
  );
  const iconBlock = withIcon ? node.iconSize + node.iconGap : 0;
  return node.width - node.paddingX * 2 - node.borderWidth * 2 - numberWidth - node.indexGap - iconBlock;
}

export function panelTextWidth() {
  const panel = SOURCE_GEOMETRY.panel;
  return panel.width - panel.paddingX * 2 - panel.borderWidth * 2;
}

export function measureTitle({title}, measure, titleScale = 1) {
  const geometry = SOURCE_GEOMETRY.title;
  const fontSize = geometry.fontSize * titleScale;
  const text = typeof title === "string" ? title.trim() : "";
  if (!text) return {lines: [], height: 0, letterSpacing: 0, text: ""};
  const letterSpacing = fontSize * geometry.letterSpacingEm;
  const blockWidth = SOURCE_GEOMETRY.node.width + SOURCE_GEOMETRY.laneGap + SOURCE_GEOMETRY.panel.width;
  const lines = wrapText(text, blockWidth, fontSize, geometry.fontWeight, letterSpacing, measure);
  return {
    lines, text, letterSpacing,
    height: lines.length * fontSize * geometry.lineHeight + geometry.marginBottom,
    reasons: lines.length > MAX_TITLE_LINES ? ["标题过长"] : [],
  };
}

export function measureStage(stage, measure, orientation = DEFAULT_DIRECTION, stageLabelScale = 1) {
  const base = nodeConfigFor(orientation);
  const node = stageLabelScale === 1 ? base : {...base, titleFontSize: base.titleFontSize * stageLabelScale};
  const textWidth = nodeTextWidth(measure, {orientation});
  const titleLines = wrapText(stage.title, textWidth, node.titleFontSize, node.titleFontWeight, 0, measure);
  const detailText = typeof stage.detail === "string" ? stage.detail.trim() : "";
  const detailLines = detailText
    ? wrapText(detailText, panelTextWidth(), SOURCE_GEOMETRY.panel.fontSize, SOURCE_GEOMETRY.panel.fontWeight, 0, measure)
    : [];
  const reasons = [];
  if (titleLines.length > MAX_STAGE_TITLE_LINES) reasons.push("阶段标题过长");
  if (detailLines.length > MAX_DETAIL_LINES) reasons.push("展开说明过长");

  // 单行节点：行高取「图标」与「标题整体」的较大者；图标与编号对齐到首行。
  const titleBlock = titleLines.length * node.titleFontSize * node.titleLineHeight;
  const rowHeight = Math.max(stage.icon ? node.iconSize : 0, titleBlock);
  return {
    title: stage.title, titleLines, detailLines, detailText,
    icon: stage.icon ?? "",
    hasIcon: Boolean(stage.icon),
    height: node.paddingY * 2 + node.borderWidth * 2 + rowHeight,
    panelHeight: detailLines.length
      ? SOURCE_GEOMETRY.panel.paddingY * 2 + SOURCE_GEOMETRY.panel.borderWidth * 2 + detailLines.length * SOURCE_GEOMETRY.panel.fontSize * SOURCE_GEOMETRY.panel.lineHeight
      : 0,
    reasons,
  };
}

/**
 * 叙事时间轴：标题 → 阶段 i 落地 → 阶段 i 的右侧展开 → 竖线生长 → 阶段 i+1。
 * 竖线 i 的生长恰好收在阶段 i+1 落地那一刻（end = stepMs × (2i + 3)）。
 */
export function resolveSequence({stageCount, stepMs = SOURCE_GEOMETRY.defaultStepMs}) {
  const geometry = SOURCE_GEOMETRY;
  const panelDelayMs = Math.round(stepMs * geometry.panelDelayRatio);
  const stageStartMs = index => stepMs * (2 * index + 1);
  const connectorStartMs = index => stepMs * (2 * index + 2);
  const panelStartMs = index => stageStartMs(index) + panelDelayMs;
  const lastBeatEndMs = stageStartMs(stageCount - 1) + panelDelayMs + geometry.panelRevealMs;
  return {
    stepMs, panelDelayMs,
    titleEnterMs: Math.min(geometry.titleEnterMs, stepMs),
    nodeEnterMs: geometry.nodeEnterMs,
    panelRevealMs: geometry.panelRevealMs,
    stageStartMs, connectorStartMs, panelStartMs,
    connectorDurationMs: stepMs,
    sequenceEndMs: lastBeatEndMs,
    minimumDurationMs: lastBeatEndMs + geometry.holdMs,
    /** 自动档：已经落地的最后一个阶段就是当前讲解项；还没有阶段时返回 -1。 */
    activeIndexAt: timeMs => {
      let active = -1;
      for (let index = 0; index < stageCount; index += 1) if (timeMs >= stageStartMs(index)) active = index;
      return active;
    },
  };
}

/** activeStageIndex = -1 是「自动跟随」，>= 0 时锁定该阶段。 */
export function resolveActiveStageIndex({activeStageIndex = -1, timeMs = 0, sequence, stageCount}) {
  if (Number.isInteger(activeStageIndex) && activeStageIndex >= 0) return Math.min(activeStageIndex, stageCount - 1);
  return sequence.activeIndexAt(timeMs);
}

/**
 * 展开面板的开合窗口（JSX 与 QA / 单测共用同一份判据）：
 *   - 自动档：本阶段落地后展开，下一条阶段落地时收起（手风琴，同一时刻只有一块展开）；
 *   - 锁定档：只有被锁定的阶段展开，且不收起。
 */
export function panelTimeline({sequence, stageCount, index, activeIndex, autoMode}) {
  return {
    canOpen: autoMode || index === activeIndex,
    openAt: sequence.panelStartMs(index),
    closeAt: autoMode && index < stageCount - 1 ? sequence.stageStartMs(index + 1) : Infinity,
  };
}

/** 某个时刻处于展开状态的阶段编号（用于断言「同一时刻只有一块展开」）。 */
export function openPanelIndexes({sequence, stageCount, timeMs, activeIndex, autoMode}) {
  const open = [];
  for (let index = 0; index < stageCount; index += 1) {
    const window = panelTimeline({sequence, stageCount, index, activeIndex, autoMode});
    if (window.canOpen && timeMs >= window.openAt && timeMs < window.closeAt) open.push(index);
  }
  return open;
}

/**
 * 某条脊线在某个时刻是否处于 Active：指向当前阶段的那条线（index = activeIndex - 1）。
 * 对应「连线与当前讲解项同步」，且任意时刻最多只有一条被点亮；
 * 正在向下一条生长的线由 spineOpacityAt 用中等明暗表示，不算点亮。
 */
export function spineIsActive({index, activeIndex, timeMs, sequence, stageCount}) {
  void timeMs; void sequence; void stageCount;
  return index === activeIndex - 1;
}

/** 脊线的明暗：当前 1.0 / 正在生长 0.75 / 已走过 0.45。竖线与箭头共用同一个值。 */
export function spineOpacityAt({index, activeIndex, timeMs, sequence, stageCount}) {
  const opacity = SOURCE_GEOMETRY.lineOpacity;
  if (index === activeIndex - 1) return opacity.active;
  const growing = index === activeIndex && index < stageCount - 1 && timeMs < sequence.stageStartMs(index + 1);
  return growing ? opacity.growing : opacity.traversed;
}

function scaledMetrics(scale, orientation = DEFAULT_DIRECTION, textSizeScales = {}) {
  const geometry = SOURCE_GEOMETRY;
  const scaleBlock = source => Object.fromEntries(Object.entries(source).map(([key, value]) => [
    key,
    typeof value === "number" && !/(Ratio|Weight|Em)$/.test(key) ? round(value * scale) : value,
  ]));
  const nodeSource = nodeConfigFor(orientation);
  const titleScale = textSizeScales.title ?? 1;
  const stageLabelScale = textSizeScales.stageLabel ?? 1;
  const title = scaleBlock(geometry.title);
  if (titleScale !== 1) title.fontSize = round(title.fontSize * titleScale);
  const node = scaleBlock(nodeSource);
  if (stageLabelScale !== 1) node.titleFontSize = round(node.titleFontSize * stageLabelScale);
  // 图标在单行节点里对齐到首行的光学中心（跟随阶段字号一起缩放）。
  node.iconOffset = round(Math.max(0, (nodeSource.titleFontSize * stageLabelScale * nodeSource.titleLineHeight - nodeSource.iconSize) / 2) * scale);
  return {
    scale: round(scale),
    title,
    node,
    panel: scaleBlock(geometry.panel),
    laneGap: round(geometry.laneGap * scale),
    stageGap: round(stageGapFor(orientation) * scale),
    connectorStrokeWidth: round(geometry.connectorStrokeWidth * scale),
    connectorActiveStrokeWidth: round(geometry.connectorActiveStrokeWidth * scale),
    arrowWidth: round(geometry.arrowWidth * scale),
    arrowHeight: round(geometry.arrowHeight * scale),
  };
}

/**
 * 阶段 i 与 i+1 之间的连线几何：
 *   - VERTICAL：竖线 + **向下**箭头（终点在下一条阶段顶边）；
 *   - HORIZONTAL：横线 + **向右**箭头（终点在下一条阶段左边）。
 * 两种方向共用同一套「一体」规则：线与箭头同色、宽度接近、箭头叠深色描边。
 */
export function spineGeometryFor({orientation = DEFAULT_DIRECTION, from, to, arrowWidth, arrowHeight}) {
  const x = round(from.x);
  const y = round(from.y);
  const toX = round(to.x);
  const toY = round(to.y);
  if (orientation === "HORIZONTAL") {
    return {
      from: {x, y}, to: {x: toX, y: toY},
      d: `M ${x} ${y} L ${toX} ${y}`,
      arrow: `M ${round(toX - arrowHeight)} ${round(y - arrowWidth / 2)} L ${toX} ${y} L ${round(toX - arrowHeight)} ${round(y + arrowWidth / 2)}`,
    };
  }
  return {
    from: {x, y}, to: {x: toX, y: toY},
    d: `M ${x} ${y} L ${x} ${toY}`,
    arrow: `M ${round(x - arrowWidth / 2)} ${round(toY - arrowHeight)} L ${x} ${toY} L ${round(x + arrowWidth / 2)} ${round(toY - arrowHeight)}`,
  };
}

export function calculateStageFlowLayout(
  {content, variant = DEFAULT_DIRECTION, position, size = 1, width, height, durationInFrames, fps = 30, textSizeScales = {}}, measure,
) {
  const geometry = SOURCE_GEOMETRY;
  const orientation = DIRECTIONS.includes(variant) ? variant : DEFAULT_DIRECTION;
  const nodeConfig = nodeConfigFor(orientation);
  const stageGap = stageGapFor(orientation);
  const title = measureTitle(content, measure, textSizeScales.title ?? 1);
  const stages = content.stages.map(stage => measureStage(stage, measure, orientation, textSizeScales.stageLabel ?? 1));

  const reasons = [
    ...(title.reasons ?? []).map(reason => `标题：${reason}`),
    ...stages.flatMap((stage, index) => stage.reasons.map(reason => `第 ${index + 1} 个阶段：${reason}`)),
  ];
  if (reasons.length) return {overflow: true, reason: `${reasons.join("；")}：超过可读行数，请缩短文字。`};

  const stepMs = Number.isFinite(content.stepMs) ? content.stepMs : geometry.defaultStepMs;
  const [minStep, maxStep] = geometry.stepMsRange;
  if (stepMs < minStep || stepMs > maxStep) return {
    overflow: true,
    reason: `每步节奏 ${Math.round(stepMs)} 毫秒超出可读范围（${minStep}–${maxStep} 毫秒）。`,
  };

  const sequence = resolveSequence({stageCount: stages.length, stepMs});
  const durationMs = (durationInFrames / fps) * 1000;
  if (durationMs < sequence.minimumDurationMs) return {
    overflow: true,
    reason: `${stages.length} 个阶段按 ${Math.round(stepMs)} 毫秒一步需要 ${(sequence.minimumDurationMs / 1000).toFixed(1)} 秒（含收尾停留），当前只有 ${(durationMs / 1000).toFixed(1)} 秒；请延长片段或调小节奏。`,
  };

  // 两个方向共用同一份测量结果，只有排列方式不同：
  //   VERTICAL   阶段纵列 + 当前阶段向右展开；
  //   HORIZONTAL 阶段横排 + 当前阶段向下展开。
  const columnHeight = stages.reduce((sum, stage) => sum + stage.height, 0) + stageGap * (stages.length - 1);
  const rowHeight = Math.max(...stages.map(stage => stage.height));
  const rowWidth = stages.length * nodeConfig.width + stageGap * (stages.length - 1);
  const maxPanelHeight = Math.max(0, ...stages.map(stage => stage.panelHeight));
  const blockWidth = orientation === "VERTICAL"
    ? nodeConfig.width + geometry.laneGap + geometry.panel.width
    : rowWidth;
  const blockHeight = orientation === "VERTICAL"
    ? title.height + columnHeight
    : title.height + rowHeight + (maxPanelHeight ? geometry.panelGap + maxPanelHeight : 0);

  const safeX = width * geometry.safeSideRatio;
  const safeY = height * geometry.safeVerticalRatio;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const scale = Math.min(size, availableWidth / blockWidth, availableHeight / blockHeight);
  if (scale < geometry.minScale) return {
    overflow: true,
    reason: `${orientation === "HORIZONTAL" ? "横向模式" : "纵向模式"}下 ${stages.length} 个阶段在 ${Math.round(width)}×${Math.round(height)} 里需要缩到 ${(scale * 100).toFixed(0)}%，低于 ${(geometry.minScale * 100).toFixed(0)}% 可读下限。请减少阶段、缩短文字，或改用另一个方向模式。`,
  };

  const metrics = scaledMetrics(scale, orientation, textSizeScales);
  const blockPixelWidth = round(blockWidth * scale);
  const blockPixelHeight = round(blockHeight * scale);
  const blockX = round(safeX + (availableWidth - blockPixelWidth) * position.x);
  const blockY = round(safeY + (availableHeight - blockPixelHeight) * position.y);

  // 块内坐标：标题在上，阶段列 / 行在下；连线端点与节点盒同源。
  const nodes = [];
  if (orientation === "VERTICAL") {
    let cursor = title.height;
    stages.forEach((stage, index) => {
      nodes.push({
        index, x: 0, y: round(cursor), width: nodeConfig.width, height: stage.height,
        panel: {
          x: round(nodeConfig.width + geometry.laneGap),
          y: round(cursor + stage.height / 2 - stage.panelHeight / 2),
          width: geometry.panel.width, height: stage.panelHeight,
        },
      });
      cursor += stage.height + geometry.stageGap;
    });
  } else {
    let cursor = 0;
    stages.forEach((stage, index) => {
      nodes.push({
        index, x: round(cursor), y: round(title.height), width: nodeConfig.width, height: rowHeight,
        panel: {
          // 面板默认在所属节点下方居中；贴着行首 / 行尾时收进来，保证不超出整块。
          x: round(Math.min(
            Math.max(cursor + (nodeConfig.width - geometry.panel.width) / 2, 0),
            Math.max(0, rowWidth - geometry.panel.width),
          )),
          y: round(title.height + rowHeight + geometry.panelGap),
          width: geometry.panel.width, height: stage.panelHeight,
        },
      });
      cursor += nodeConfig.width + stageGap;
    });
  }
  const connectors = nodes.slice(0, -1).map((node, index) => {
    const next = nodes[index + 1];
    const from = orientation === "VERTICAL"
      ? {x: nodeConfig.width / 2, y: node.y + node.height}
      : {x: node.x + node.width, y: node.y + node.height / 2};
    const to = orientation === "VERTICAL"
      ? {x: nodeConfig.width / 2, y: next.y}
      : {x: next.x, y: next.y + next.height / 2};
    return {
      index, orientation, from, to,
      ...spineGeometryFor({orientation, from, to, arrowWidth: geometry.arrowWidth, arrowHeight: geometry.arrowHeight}),
      startMs: sequence.connectorStartMs(index),
      durationMs: sequence.connectorDurationMs,
      strokeWidth: geometry.connectorStrokeWidth,
      activeStrokeWidth: geometry.connectorActiveStrokeWidth,
    };
  });

  return {
    overflow: false,
    orientation,
    scale: metrics.scale,
    titleMetrics: metrics.title,
    nodeMetrics: metrics.node,
    panelMetrics: metrics.panel,
    laneGap: metrics.laneGap,
    stageGap: metrics.stageGap,
    connectorStrokeWidth: metrics.connectorStrokeWidth,
    connectorActiveStrokeWidth: metrics.connectorActiveStrokeWidth,
    arrowWidth: metrics.arrowWidth,
    arrowHeight: metrics.arrowHeight,
    block: {x: blockX, y: blockY, width: blockPixelWidth, height: blockPixelHeight},
    blockSource: {width: blockWidth, height: blockHeight},
    title: {y: 0, height: title.height, lines: title.lines, letterSpacing: title.letterSpacing},
    nodes: nodes.map((node, index) => ({
      ...node,
      number: stageNumberOf(index),
      titleLines: stages[index].titleLines,
      detailLines: stages[index].detailLines,
      detailText: stages[index].detailText,
      icon: stages[index].icon,
      hasIcon: stages[index].hasIcon,
      panelHeight: stages[index].panelHeight,
    })),
    nodesColumn: {height: orientation === "VERTICAL" ? columnHeight : rowHeight, top: title.height},
    panelWidth: geometry.panel.width,
    panelGap: geometry.panelGap,
    connectors,
    sequence,
    durationMs,
    minDurationMs: sequence.minimumDurationMs,
  };
}
