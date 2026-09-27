// Source geometry copied from the RemotionUI radar-chart source (read-only):
//   registry/bases/default/primitives/radar-chart.tsx
//     size 420（多边形直径）/ ringCount 4 / DEFAULT_COLORS（琥珀 · 青 · 粉）
//     labelSize = max(11, size × 0.045)；标签锚点在 radius + labelSize × 1.3
//     point(i, d): angle = (i / axisCount) × 2π − π/2（正上方起顺时针）
//     series 起点 = delay + 8 + seriesIndex × seriesOffsetInFrames，逐轴 + staggerInFrames
//     motion: durationInFrames 18 / staggerInFrames 5 / seriesOffsetInFrames 10 / 网先淡入 12 帧（30 fps）
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter（网）/ EASING.pop（顶点伸出去）
//
// Adaptations performed here（详见 docs/component-assets/CMP-06_BATCH_B_QA_REPORT.md）：
//   1. 来源用「最长标签字数 × labelSize × 0.52」估外框留白，这个系数假设的是拉丁字宽；
//      中文一个字约 1 em，会被低估约一半 → 本组件改为按实测标签包围盒反推外框；
//   2. 标签字号下限对齐项目口径 12 px（来源 11 px）；
//   3. 来源只画多边形、不显示 series 名称 → 本组件补一条图例（色点 + 名称）；
//   4. 数值大于 maxValue 时来源会把多边形画到外圈之外 → 本组件在内容校验里拒绝；
//   5. 位置改为安全区 0–1 比例；不排入退场（来源的 exitAtInFrames 由片段时序决定）。

export const SOURCE_GEOMETRY = Object.freeze({
  webSize: 420,
  ringCount: 4,
  fillOpacity: 0.22,
  gridColor: "rgba(250, 250, 250, 0.14)",
  labelRadiusOffset: 1.3,
  labelFontRatio: 0.045,
  labelMinFontSize: 12,
  labelFontWeight: 600,
  strokeWidthRatio: 0.008,
  strokeWidthMin: 2,
  vertexRadiusRatio: 0.012,
  vertexRadiusMin: 2,
  boxPadding: 8,
  legendGapRatio: 0.06,
  legendDotRatio: 0.05,
  legendInnerGapRatio: 0.038,
  legendItemGapRatio: 0.06,
  legendFontRatio: 0.05,
  legendFontWeight: 600,
  legendLineHeight: 1.5,
});

export const SOURCE_MOTION = Object.freeze({
  // 来源 18 / 5 / 10 / 12 帧（30 fps）换算成毫秒。
  reachMs: 600,
  axisStaggerMs: 167,
  seriesOffsetMs: 333,
  seriesBaseDelayMs: 267,
  webFadeMs: 400,
  sourceReachFrames: 18,
  sourceStaggerFrames: 5,
  sourceSeriesOffsetFrames: 10,
  sourceWebFadeFrames: 12,
  sourceFps: 30,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (1920 * 1080));
}

export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return null;
}

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

export function progressAt({frame, fps, delayMs = 0, durationMs, ease = value => value}) {
  const start = (delayMs / 1000) * fps;
  const span = Math.max(1, (durationMs / 1000) * fps);
  const t = Math.min(1, Math.max(0, (frame - start) / span));
  return ease(t);
}

/** 来源 `point`：第 i 根轴、距离 d 处的方向（正上方起顺时针，单位向量）。 */
export function axisUnitVector(axisIndex, axisCount) {
  const angle = (axisIndex / Math.max(3, axisCount)) * Math.PI * 2 - Math.PI / 2;
  return {x: Math.cos(angle), y: Math.sin(angle)};
}

/** 环 / 多边形路径：来源把每一环都画成 axisCount 边形。 */
export function webPath(centre, radius, axisUnits) {
  return axisUnits
    .map((unit, axis) => `${axis === 0 ? "M" : "L"} ${(centre + unit.x * radius).toFixed(2)} ${(centre + unit.y * radius).toFixed(2)}`)
    .join(" ");
}

/** 整段动画结束时刻（毫秒）：最后一根轴最后一个 series 伸到位的时刻。 */
export function totalReachMs(seriesCount, axisCount) {
  const last = SOURCE_MOTION.seriesBaseDelayMs + Math.max(0, seriesCount - 1) * SOURCE_MOTION.seriesOffsetMs
    + Math.max(0, axisCount - 1) * SOURCE_MOTION.axisStaggerMs;
  return last + SOURCE_MOTION.reachMs;
}

export function calculateRadarChartLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const overflow = [];

  const fitText = (text, fontSize, fontWeight, letterSpacing, maxWidth, id, kind) => {
    const natural = textWidth(measure, text, fontSize, fontWeight, letterSpacing);
    let resolved = {fontSize, letterSpacing, width: natural};
    if (maxWidth !== null && natural > maxWidth) {
      const scaled = Math.max(MIN_TEXT_FONT_SIZE * canvasScale, fontSize * (maxWidth / natural));
      const ratio = scaled / fontSize;
      resolved = {
        fontSize: scaled,
        letterSpacing: letterSpacing * ratio,
        width: textWidth(measure, text, scaled, fontWeight, letterSpacing * ratio),
      };
      // 真实字体度量不是严格线性的，按残差再收一次（见同批其它组件）。
      if (resolved.width > maxWidth) {
        const corrected = Math.max(MIN_TEXT_FONT_SIZE * canvasScale, scaled * (maxWidth / resolved.width));
        const correctedRatio = corrected / fontSize;
        resolved = {
          fontSize: corrected,
          letterSpacing: letterSpacing * correctedRatio,
          width: textWidth(measure, text, corrected, fontWeight, letterSpacing * correctedRatio),
        };
      }
      if (resolved.width > maxWidth + 0.5) overflow.push({id, kind, text, available: maxWidth, required: resolved.width});
    }
    return resolved;
  };

  const axisCount = Math.max(3, content.axes.length);
  const axisUnits = Array.from({length: axisCount}, (_, axis) => axisUnitVector(axis, axisCount));
  const radius = (SOURCE_GEOMETRY.webSize / 2) * factor;
  const labelSize = Math.max(SOURCE_GEOMETRY.labelMinFontSize * canvasScale, SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.labelFontRatio * factor);
  const showLabels = content.showLabels !== false;
  const labelRadius = radius + labelSize * SOURCE_GEOMETRY.labelRadiusOffset;

  // 外框不再用「字数 × 系数」估算：逐轴量出标签真实包围盒，反推需要多大的方框。
  let halfExtent = radius;
  const axes = content.axes.map((label, axis) => {
    const measured = showLabels ? fitText(label, labelSize, SOURCE_GEOMETRY.labelFontWeight, 0, null, `axis-${axis}`, "轴标签") : null;
    const unit = axisUnits[axis];
    const anchor = {x: unit.x * labelRadius, y: unit.y * labelRadius};
    const horizontal = anchor.x;
    const textAnchor = Math.abs(horizontal) < 1 ? "middle" : horizontal > 0 ? "start" : "end";
    let reach = radius;
    if (measured) {
      // 标签在锚点外侧展开：左/右轴按整段宽度算，上/下轴按半个字高算。
      const horizontalReach = textAnchor === "middle" ? Math.abs(anchor.x) + measured.width / 2 : Math.abs(anchor.x) + measured.width;
      reach = Math.max(horizontalReach, Math.abs(anchor.y) + measured.fontSize / 2);
    }
    halfExtent = Math.max(halfExtent, reach);
    return {
      axis, label, textAnchor, anchorX: anchor.x, anchorY: anchor.y,
      fontSize: measured?.fontSize ?? labelSize, width: measured?.width ?? 0,
    };
  });

  const webSize = radius * 2;
  const boxSize = halfExtent * 2 + SOURCE_GEOMETRY.boxPadding * 2 * factor;
  const centre = boxSize / 2;

  const values = content.series.flatMap(entry => entry.values);
  const peak = content.maxValue ?? Math.max(1, ...values);
  const series = content.series.map((entry, index) => {
    const label = fitText(
      entry.label, SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.legendFontRatio * factor,
      SOURCE_GEOMETRY.legendFontWeight, 0, null, `series-${index}`, "图例名称",
    );
    return {
      id: entry.id, label: entry.label, color: entry.color ?? null,
      values: entry.values.map(value => value / peak), rawValues: [...entry.values],
      baseDelayMs: SOURCE_MOTION.seriesBaseDelayMs + index * SOURCE_MOTION.seriesOffsetMs,
      labelFontSize: label.fontSize, labelWidth: label.width,
    };
  });

  const showLegend = content.showLegend !== false;
  const legendDot = SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.legendDotRatio * factor;
  const legendInnerGap = SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.legendInnerGapRatio * factor;
  const legendItemGap = SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.legendItemGapRatio * factor;
  const legendGap = SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.legendGapRatio * factor;
  const legendFont = SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.legendFontRatio * factor;
  const legendWidth = showLegend
    ? series.reduce((sum, entry) => sum + legendDot + legendInnerGap + entry.labelWidth, 0) + Math.max(0, series.length - 1) * legendItemGap
    : 0;
  const legendHeight = showLegend ? legendFont * SOURCE_GEOMETRY.legendLineHeight : 0;
  const cardWidth = Math.max(boxSize, legendWidth);
  const cardHeight = boxSize + (showLegend ? legendGap + legendHeight : 0);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进各自的版面槽位：${overflow.map(item => item.text).join("、")}。请缩短文字或减少轴数。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    axisCount, axisUnits, radius, webSize, labelSize, labelRadius, boxSize, centre, peak,
    axes, series, showLabels, showVertices: content.showVertices !== false, showLegend,
    legendDot, legendInnerGap, legendItemGap, legendGap, legendFont, legendHeight, legendWidth,
    ringCount: SOURCE_GEOMETRY.ringCount, fillOpacity: SOURCE_GEOMETRY.fillOpacity,
    strokeWidth: Math.max(SOURCE_GEOMETRY.strokeWidthMin, SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.strokeWidthRatio * factor),
    vertexRadius: Math.max(SOURCE_GEOMETRY.vertexRadiusMin, SOURCE_GEOMETRY.webSize * SOURCE_GEOMETRY.vertexRadiusRatio * factor),
    cardWidth, cardHeight,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
