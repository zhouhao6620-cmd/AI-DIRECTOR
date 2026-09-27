// Source geometry copied from the Overlay Studio GrowthCurve source (read-only):
//   src/effects/hud/GrowthCurve.tsx → `.gcv` box, `smoothPath` (Catmull-Rom → cubic bezier),
//                                     `W = 640 / H = 310`, padL 40 / padR 96 / padT 30 / padB 52,
//                                     `yMax = max(values,1) × 1.14`, `yMin = min(values,0) × 0.82`,
//                                     `useProgress(max(400, drawMs))`, per-point light-up thresholds
//   src/effects/hud/hud.css         → `.gcv-*` rules (glass box, 5 px line, 7 px dot, 62 px peak)
//   src/effects/hud/accent.ts       → ACCENT_VAR mapping (blue / alert / orange)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-04A_SOURCE_STYLE_ADAPTATION.md):
//   1. every point label and value is measured against its own slot on the x-axis, and the card is
//      refused when they would overlap — the source draws them and lets them collide;
//   2. the card is placed by the project's 0–1 safe-area ratio instead of the fixed anchor;
//   3. point values keep up to two decimals instead of being printed raw.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  boxWidth: 640,
  boxPadTop: 26,
  boxPadX: 30,
  boxPadBottom: 20,
  boxRadius: 22,
  boxGap: 4,
  svgWidth: 640,
  svgHeight: 310,
  padLeft: 40,
  padRight: 96,
  padTop: 30,
  padBottom: 52,
  lineWidth: 5,
  dotRadius: 7,
  dotStroke: 2,
  kickerFontSize: 18,
  kickerFontWeight: 600,
  kickerLetterSpacingEm: 0.14,
  kickerBarWidth: 22,
  kickerBarHeight: 4,
  kickerZhFontSize: 27,
  kickerZhFontWeight: 800,
  kickerZhMarginTop: 6,
  peakFontSize: 62,
  peakFontWeight: 900,
  peakUnitFontSize: 26,
  peakUnitFontWeight: 700,
  peakUnitMarginLeft: 4,
  valueFontSize: 25,
  valueFontWeight: 800,
  labelFontSize: 21,
  labelFontWeight: 600,
  captionFontSize: 21,
  areaOpacity: 0.38,
  lineHeight: 1.2,
  anchorX: 120,
  yMaxFactor: 1.14,
  yMinFactor: 0.82,
});

export const SOURCE_MOTION = Object.freeze({
  defaultDrawMs: 1600,
  drawMsRange: {min: 600, max: 5000},
  peakCountExtraMs: 300,
  pointLightWindow: 0.15,
  pointAtMax: 0.9,
  breathDelayMs: 1400,
  breathPeriodMs: 2800,
  breathMaxBrightness: 1.12,
  breathShadowPx: 9,
});

export const MONO_FONT_FAMILY = '"IBM Plex Mono", ui-monospace, monospace';
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const EASE_SOURCE = Object.freeze([0.22, 1, 0.36, 1]);
export const EASE_CSS_EASE = Object.freeze([0.25, 0.1, 0.25, 1]);
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;
export const POINT_SLOT_FIT = 0.98;

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return null;
}

export function formatNumber(value, decimals = decimalsOf(value) ?? 0) {
  return value.toLocaleString("en-US", {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
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

export function breathePhase({frame, fps, delayMs = SOURCE_MOTION.breathDelayMs, periodMs = SOURCE_MOTION.breathPeriodMs}) {
  const elapsed = (frame / fps) * 1000 - delayMs;
  if (elapsed <= 0) return 0;
  const cycle = periodMs * 2;
  const position = elapsed % cycle;
  return position < periodMs ? position / periodMs : (cycle - position) / periodMs;
}

// Source `smoothPath`: a Catmull-Rom spline converted to cubic beziers, so the curve passes through
// every data point instead of being a polyline.
export function smoothPath(nodes) {
  if (nodes.length < 2) return "";
  let path = `M ${nodes[0].x} ${nodes[0].y}`;
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const p0 = nodes[index - 1] ?? nodes[index];
    const p1 = nodes[index];
    const p2 = nodes[index + 1];
    const p3 = nodes[index + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return path;
}

// Maps real values onto the source's SVG canvas and returns the curve, the filled area and the
// per-point light-up thresholds.
export function projectPoints({points, svgWidth = SOURCE_GEOMETRY.svgWidth, svgHeight = SOURCE_GEOMETRY.svgHeight}) {
  const {padLeft, padRight, padTop, padBottom} = SOURCE_GEOMETRY;
  const values = points.map(point => point.value);
  const yMax = Math.max(...values, 1) * SOURCE_GEOMETRY.yMaxFactor;
  const yMin = Math.min(...values, 0) * SOURCE_GEOMETRY.yMinFactor;
  const span = (yMax - yMin) || 1;
  const xOf = index => padLeft + (index / Math.max(points.length - 1, 1)) * (svgWidth - padLeft - padRight);
  const yOf = value => padTop + (1 - (value - yMin) / span) * (svgHeight - padTop - padBottom);
  const nodes = points.map((point, index) => ({x: xOf(index), y: yOf(point.value)}));
  const baseY = svgHeight - padBottom;
  const line = smoothPath(nodes);
  const area = nodes.length > 1 ? `${line} L ${nodes.at(-1).x} ${baseY} L ${nodes[0].x} ${baseY} Z` : "";
  const peak = values.length ? Math.max(...values) : 0;
  return {
    nodes, line, area, peak, yMax, yMin, baseY,
    // Source: `at = (i / (n - 1)) * 0.9` then `on = clamp((draw - at) / 0.15)`.
    thresholds: points.map((_, index) => (points.length > 1 ? index / (points.length - 1) : 0) * SOURCE_MOTION.pointAtMax),
    slotWidth: (svgWidth - padLeft - padRight) / Math.max(points.length - 1, 1),
  };
}

export function calculateGrowthCurveLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
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
    if (natural > maxWidth) {
      const scaled = Math.max(MIN_TEXT_FONT_SIZE * canvasScale, fontSize * (maxWidth / natural));
      const ratio = scaled / fontSize;
      resolved = {fontSize: scaled, letterSpacing: letterSpacing * ratio, width: textWidth(measure, text, scaled, fontWeight, letterSpacing * ratio)};
    }
    if (resolved.width > maxWidth + 0.5) overflow.push({id, kind, text, available: maxWidth, required: resolved.width});
    return resolved;
  };

  const geometry = projectPoints({points: content.points});
  const boxInnerWidth = SOURCE_GEOMETRY.boxWidth * factor;
  const boxWidth = boxInnerWidth + SOURCE_GEOMETRY.boxPadX * 2 * factor;
  const kickerBarWidth = SOURCE_GEOMETRY.kickerBarWidth * factor;
  const kicker = content.kicker
    ? fitText(content.kicker, SOURCE_GEOMETRY.kickerFontSize * factor, SOURCE_GEOMETRY.kickerFontWeight,
      SOURCE_GEOMETRY.kickerFontSize * factor * SOURCE_GEOMETRY.kickerLetterSpacingEm, boxInnerWidth * 0.5 - kickerBarWidth, "kicker", "kicker")
    : null;
  const kickerZh = content.kickerZh
    ? fitText(content.kickerZh, SOURCE_GEOMETRY.kickerZhFontSize * factor, SOURCE_GEOMETRY.kickerZhFontWeight, 0,
      boxInnerWidth * 0.62, "kickerZh", "中文小注")
    : null;
  const unit = content.unit
    ? fitText(content.unit, SOURCE_GEOMETRY.peakUnitFontSize * factor, SOURCE_GEOMETRY.peakUnitFontWeight, 0,
      boxInnerWidth * 0.4, "unit", "峰值单位")
    : null;
  const caption = content.caption
    ? fitText(content.caption, SOURCE_GEOMETRY.captionFontSize * factor, 400, 0, boxInnerWidth, "caption", "小注")
    : null;

  // Each point label and value has to stay inside its own x-slot on the curve.
  const slotWidth = (SOURCE_GEOMETRY.svgWidth - SOURCE_GEOMETRY.padLeft - SOURCE_GEOMETRY.padRight) / Math.max(content.points.length - 1, 1) * factor;
  const pointLimit = slotWidth * POINT_SLOT_FIT;
  const points = content.points.map((point, index) => {
    const decimals = decimalsOf(point.value) ?? 0;
    const valueText = formatNumber(point.value, decimals);
    const label = fitText(point.label, SOURCE_GEOMETRY.labelFontSize * factor, SOURCE_GEOMETRY.labelFontWeight, 0, pointLimit, `label-${index}`, "数据点标签");
    const value = fitText(valueText, SOURCE_GEOMETRY.valueFontSize * factor, SOURCE_GEOMETRY.valueFontWeight, 0, pointLimit, `value-${index}`, "数据点数值");
    return {
      id: point.id, label: point.label, value: point.value, decimals, valueText,
      node: geometry.nodes[index], threshold: geometry.thresholds[index],
      labelFontSize: label.fontSize, valueFontSize: value.fontSize,
    };
  });

  const headHeight = Math.max(
    kicker ? kicker.fontSize * SOURCE_GEOMETRY.lineHeight + SOURCE_GEOMETRY.kickerBarHeight * factor : 0,
    SOURCE_GEOMETRY.peakFontSize * factor,
  ) + (kickerZh ? SOURCE_GEOMETRY.kickerZhMarginTop * factor + kickerZh.fontSize * SOURCE_GEOMETRY.lineHeight : 0);
  const boxHeight = SOURCE_GEOMETRY.boxPadTop * factor + headHeight + SOURCE_GEOMETRY.boxGap * factor
    + SOURCE_GEOMETRY.svgHeight * factor + SOURCE_GEOMETRY.boxPadBottom * factor
    + (caption ? caption.fontSize * SOURCE_GEOMETRY.lineHeight : 0);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进安全区域：${overflow.map(item => item.text).join("、")}。请缩短文字、减少数据点或调小大小。`;
  } else if (boxWidth > availableWidth + 0.5) {
    rejection = `增长曲线卡宽度 ${Math.round(boxWidth)} px 超出安全区域 ${Math.round(availableWidth)} px。请调小大小。`;
  } else if (boxHeight > availableHeight + 0.5) {
    rejection = `增长曲线卡高度 ${Math.round(boxHeight)} px 超出安全区域 ${Math.round(availableHeight)} px。请调小大小。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    boxWidth, boxHeight, boxInnerWidth, boxRadius: SOURCE_GEOMETRY.boxRadius * factor,
    padTop: SOURCE_GEOMETRY.boxPadTop * factor, padX: SOURCE_GEOMETRY.boxPadX * factor, padBottom: SOURCE_GEOMETRY.boxPadBottom * factor,
    kicker, kickerZh, unit, caption, points, slotWidth, pointLimit,
    svgWidth: SOURCE_GEOMETRY.svgWidth * factor, svgHeight: SOURCE_GEOMETRY.svgHeight * factor,
    lineWidth: SOURCE_GEOMETRY.lineWidth * factor, dotRadius: SOURCE_GEOMETRY.dotRadius * factor, dotStroke: SOURCE_GEOMETRY.dotStroke * factor,
    geometry, peak: geometry.peak,
    x: safeX + (availableWidth - boxWidth) * position.x,
    y: safeY + (availableHeight - boxHeight) * position.y,
  };
}
