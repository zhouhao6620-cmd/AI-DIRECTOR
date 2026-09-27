// LineChartDraw｜折线图描绘 — layout & measurement.
//
// Source geometry (read-only, RemotionUI `line-chart-draw`, MIT, commit 802a637):
//   registry/bases/default/primitives/line-chart-draw.tsx
//     unit = width / 960 → labelSize = scale(22), strokeWidth = scale(5) where
//     scale = value => max(1, round(value * unit))
//     gutter = showAxis ? round(longestAxisLabel.length * labelSize * 0.62) + scale(18) : scale(6)
//     plot insets = {top: scale(endLabel ? 34 : 16), right: scale(endLabel ? 44 : 12),
//                    bottom: xLabels ? labelSize + scale(20) : scale(10), left: gutter}
//     domain = niceDomain(values, {includeZero, tickCount: 4}), ticks drawn at the plot left
//     progress = interpolate(frame, [delay, delay + durationInFrames], [0, 1], EASING.enter)
//     tip = getPointAtLength(linePath, pathLength * progress) — the head rides the real curve
//     dot r = strokeWidth * 0.95 * reveal, reveal = clamp01((tip.x − point.x + window) / window)
//     area capped by a clip rect of width plot.width * progress; end label fades in at 0.88→1
//   registry/bases/default/lib/chart-utils.ts → niceDomain / getPlotArea / plotPoints /
//     buildSmoothPath / buildAreaPath (now platform/elements/chart-utils/)
//   registry/bases/default/lib/path-utils.ts  → getPathDrawStyles (now platform/elements/path-utils/)
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter (now platform/elements/motion-tokens/)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-06_DATA_CHARTS_ADAPTATION.md):
//   1. the source binds the drawing width to the composition width (`width = config.width`, default
//      height = 40% of the composition height). A library component has to be the same size in both
//      canvases, so the chart is drawn on a fixed 880 × 400 design canvas and the whole block is
//      scaled by the project's equal-area factor; the source's `width / 960` unit formula is kept,
//      which makes the type and stroke 0.917× the source's 1080-wide rendering;
//   2. the value axis gutter is measured with the real font instead of
//      `longestLabel * labelSize * 0.62` — the source's 0.62 em per character is a Latin estimate,
//      and a Chinese compact tick ("12.4万") is much wider;
//   3. every category label is measured against its own x-slot and reported as an overflow instead
//      of being drawn past the edge of the viewport (the source has `overflow: visible`, so an
//      over-long label simply escapes the chart);
//   4. the source's optional switches (axis / x labels / area / dots / head / end label) are fixed
//      on, `includeZero` is fixed on, and `variant` is fixed to the source default `smooth`;
//   5. the draw is expressed in milliseconds (`drawMs`) like the rest of this project's data
//      components, instead of the source's `durationInFrames` default of 70 frames at 30 fps;
//   6. the optional title and caption are this project's content-tree addition (the source chart is
//      a bare SVG whose headline is supplied by the scene around it).

import {
  MIN_TEXT_FONT_SIZE, buildAreaPath, buildSmoothPath, fitTextToWidth, formatAxisValue,
  getPlotArea, niceDomain, placeInSafeArea, plotPoints, scaleValue, equalAreaScale,
} from "../../elements/chart-utils/chart-utils.js";
import {EASING} from "../../elements/motion-tokens/motion-tokens.js";
import {pathLength} from "../../elements/path-utils/path-utils.js";

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, "PingFang SC", monospace';

export const SOURCE_GEOMETRY = Object.freeze({
  /** Adaptation 1: fixed design canvas instead of the composition width / 40% height. */
  chartWidth: 880,
  chartHeight: 400,
  unitReferenceWidth: 960,
  labelFontSize: 22,
  strokeWidth: 5,
  gutterGap: 18,
  topInsetWithEndLabel: 34,
  topInset: 16,
  rightInsetWithEndLabel: 44,
  rightInset: 12,
  xLabelBottomGap: 20,
  noXLabelBottom: 10,
  xLabelOffset: 14,
  endLabelFontSize: 28,
  endLabelOffset: 22,
  dotRadiusScale: 0.95,
  dotStrokeScale: 0.5,
  dotRevealWindowRatio: 0.04,
  headHaloScale: 2.6,
  headHaloOpacity: 0.18,
  headDotScale: 1.05,
  areaGradientOpacity: 0.32,
  gridStrokeWidth: 1,
  gridZeroOpacity: 1.8,
  titleFontSize: 30,
  titleFontWeight: 700,
  titleMarginBottom: 16,
  captionFontSize: 16,
  captionMarginTop: 10,
  /** Adaptation 2: the gutter is measured, and only this share of the chart may hold it. */
  maxGutterRatio: 0.34,
  slotFit: 0.98,
});

export const SOURCE_MOTION = Object.freeze({
  /** Source default is 70 frames at 30 fps (≈ 2333 ms); this project's data components use a
   *  millisecond draw window, and 1600 ms matches GrowthCurve. */
  defaultDrawMs: 1600,
  drawMsRange: {min: 600, max: 6000},
  endLabelStart: 0.88,
  headFadeInFrames: 6,
});

export const SOURCE_EASING = EASING.enter;

/** Deterministic stand-in for the browser's text measurement, used by the node-side budget. */
export function fallbackMeasure(text, fontSize) {
  return [...text].reduce((sum, character) => sum + (isWide(character) ? fontSize : fontSize * 0.6), 0);
}

export function isWide(character) {
  return /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(character);
}

export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return 3;
}

export {equalAreaScale};

/**
 * Design-space geometry for one render. Everything returned is in design units except `factor`,
 * `x`, `y`, `blockWidth` and `blockHeight`, which describe the placed block on the canvas.
 */
export function calculateLineChartDrawLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure = fallbackMeasure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  // Readability floor is about the rendered canvas, so it is converted into design units.
  const minFontSize = MIN_TEXT_FONT_SIZE / Math.max(factor, 1e-6);
  const overflow = [];

  const unit = SOURCE_GEOMETRY.chartWidth / SOURCE_GEOMETRY.unitReferenceWidth;
  const scale = value => Math.max(1, Math.round(value * unit));
  const labelSize = scale(SOURCE_GEOMETRY.labelFontSize);
  const strokeWidth = scale(SOURCE_GEOMETRY.strokeWidth);

  const domain = niceDomain(content.points.map(point => point.value), {includeZero: true, tickCount: 4});
  const axisLabels = domain.ticks.map(tick => formatAxisValue(tick));
  // Adaptation 2: measure the real tick text instead of estimating 0.62 em per character.
  const axisWidth = axisLabels.reduce(
    (longest, label) => Math.max(longest, measure(label, labelSize, 600, 0)), 0);
  const gutter = Math.round(axisWidth + scale(SOURCE_GEOMETRY.gutterGap));

  const plot = getPlotArea(SOURCE_GEOMETRY.chartWidth, SOURCE_GEOMETRY.chartHeight, {
    top: scale(SOURCE_GEOMETRY.topInsetWithEndLabel),
    right: scale(SOURCE_GEOMETRY.rightInsetWithEndLabel),
    bottom: labelSize + scale(SOURCE_GEOMETRY.xLabelBottomGap),
    left: gutter,
  });

  const chartPoints = content.points.map((point, index) => ({x: index, y: point.value, label: point.label}));
  const plotted = plotPoints(chartPoints, plot, domain);
  const linePath = buildSmoothPath(plotted);
  const areaPath = buildAreaPath(linePath, plotted, plot.bottom);

  // Each category label has to stay inside its own x-slot at the 12 px (rendered) floor.
  const slotWidth = plot.width / Math.max(content.points.length - 1, 1);
  const slotLimit = slotWidth * SOURCE_GEOMETRY.slotFit;
  const points = content.points.map((point, index) => {
    const label = fitTextToWidth(measure, point.label, {
      fontSize: labelSize, fontWeight: 600, maxWidth: slotLimit, minFontSize,
    });
    if (!label.fits) overflow.push({id: `label-${point.id}`, kind: "类别标签", text: point.label, available: slotLimit, required: label.width});
    return {
      id: point.id, label: point.label, value: point.value,
      node: plotted[index], labelFontSize: label.fontSize,
      axisAnchor: index === 0 ? "start" : index === content.points.length - 1 ? "end" : "middle",
    };
  });

  const endPoint = plotted.at(-1);
  const unitSuffix = content.unit ?? "";
  const endLabelText = `${formatAxisValue(endPoint.value)}${unitSuffix}`;
  const endLabel = fitTextToWidth(measure, endLabelText, {
    fontSize: scale(SOURCE_GEOMETRY.endLabelFontSize), fontWeight: 700,
    maxWidth: plot.width * 0.42, minFontSize,
  });
  if (!endLabel.fits) overflow.push({id: "end-label", kind: "末点数值", text: endLabelText, available: plot.width * 0.42, required: endLabel.width});

  const headerHeight = content.title
    ? SOURCE_GEOMETRY.titleFontSize * 1.2 + SOURCE_GEOMETRY.titleMarginBottom
    : 0;
  const captionHeight = content.caption ? SOURCE_GEOMETRY.captionFontSize * 1.3 + SOURCE_GEOMETRY.captionMarginTop : 0;
  const boxWidth = SOURCE_GEOMETRY.chartWidth;
  const boxHeight = headerHeight + SOURCE_GEOMETRY.chartHeight + captionHeight;

  let rejection = null;
  if (gutter > SOURCE_GEOMETRY.chartWidth * SOURCE_GEOMETRY.maxGutterRatio) {
    rejection = `数值轴标签「${axisLabels.at(-1)}」需要的左侧刻度区 ${Math.round(gutter)} px 超过图表宽度的 ${Math.round(SOURCE_GEOMETRY.maxGutterRatio * 100)}%。请缩小数值量级或缩短单位。`;
  } else if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进图表：${overflow.map(item => item.text).join("、")}。请缩短文字或减少数据点。`;
  }

  const placed = placeInSafeArea({boxWidth: boxWidth * factor, boxHeight: boxHeight * factor, position, width, height});

  return {
    canvasScale, factor, minFontSize, overflow, rejection,
    designWidth: SOURCE_GEOMETRY.chartWidth, designHeight: SOURCE_GEOMETRY.chartHeight,
    boxWidth, boxHeight, blockWidth: boxWidth * factor, blockHeight: boxHeight * factor,
    headerHeight, captionHeight, labelSize, strokeWidth, unit, gutter, plot, domain, axisLabels,
    linePath, areaPath, pathLength: pathLength(linePath),
    points, endPoint, endLabelText,
    endLabel: {...endLabel, offsetY: scale(SOURCE_GEOMETRY.endLabelOffset)},
    title: content.title ? {fontSize: SOURCE_GEOMETRY.titleFontSize, weight: SOURCE_GEOMETRY.titleFontWeight} : null,
    caption: content.caption ? {fontSize: SOURCE_GEOMETRY.captionFontSize, text: content.caption} : null,
    axisTicks: domain.ticks.map((tick, index) => ({
      value: tick, text: axisLabels[index],
      y: plot.bottom - scaleValue(tick, domain.min, domain.max) * plot.height,
      zero: index === 0,
    })),
    x: placed.x, y: placed.y, safe: placed.safe,
  };
}
