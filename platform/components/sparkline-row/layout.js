// SparklineRow｜迷你折线组 — layout & measurement.
//
// Source geometry (read-only, RemotionUI `sparkline-row`, MIT, commit 802a637):
//   registry/bases/default/primitives/sparkline-row.tsx
//     width 720 / rowHeight 96 / sparkWidth 260; row gap = width × 0.03
//     sparkHeight = rowHeight × 0.56; strokeWidth = max(2, rowHeight × 0.038)
//     row: [label flex:1] [spark svg] [value minWidth width×0.12] [delta minWidth width×0.09]
//     1 px divider under every row except the last; label 0.24, value 0.26, delta 0.20 of rowHeight
//     EVERY ROW SCALES TO ITS OWN DOMAIN (includeZero: false) — a sparkline is read for shape;
//     progress = interpolate(frame, [start, start + duration], [0, 1], EASING.enter),
//     start = delayInFrames + index × staggerInFrames;
//     opacity = clamp01(progress × 1.8) × (1 − rowExit), translate = (1 − progress) × rowHeight × 0.22;
//     the head dot lands at progress > 0.92; the delta waits for progress > 0.8
//   registry/bases/default/lib/chart-utils.ts → getChartDomain / buildSmoothPath / buildAreaPath /
//     scaleValue / readDelta / formatCompactNumber
//   registry/bases/default/lib/path-utils.ts  → getPathDrawStyles
//
// Adaptations performed here (recorded in docs/component-assets/CMP-06_DATA_CHARTS_ADAPTATION.md):
//   1. measured block size, project safe-area placement and whole-component scaling — the source is
//      a bare flex stack with a fixed `width` prop and no position of its own;
//   2. exit (`exitAtInFrames` / `exitInFrames`) is removed: this project's components hold;
//   3. the label is measured against the column that is left over, and the value / delta columns are
//      measured too; the source lets the label run under `white-space: nowrap` with no bound;
//   4. the hairline divider keeps the source's 0.07 ink but follows the surface (light/dark);
//   5. an optional content-level unit is appended to the automatically formatted tail value (an
//      explicit `value` string stays exactly what the author typed);
//   6. `upColor` / `downColor` / `color` become the four project themes (SOURCE keeps the source
//      values: line #e8b86d, up #2dd4bf, down #f472b6).

import {
  MIN_TEXT_FONT_SIZE, buildAreaPath, buildSmoothPath, equalAreaScale, fitTextToWidth,
  formatCompactNumber, getChartDomain, placeInSafeArea, readDelta, scaleValue,
} from "../../elements/chart-utils/chart-utils.js";
import {EASING} from "../../elements/motion-tokens/motion-tokens.js";

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, "PingFang SC", monospace';

export const SOURCE_GEOMETRY = Object.freeze({
  boxWidth: 720,
  rowHeight: 96,
  sparkWidth: 260,
  rowGapRatio: 0.03,
  sparkHeightRatio: 0.56,
  strokeWidthRatio: 0.038,
  minStrokeWidth: 2,
  labelFontRatio: 0.24,
  valueFontRatio: 0.26,
  deltaFontRatio: 0.2,
  valueMinWidthRatio: 0.12,
  deltaMinWidthRatio: 0.09,
  areaGradientOpacity: 0.3,
  headDotScale: 1.5,
  headDotStart: 0.92,
  deltaStart: 0.8,
  rowOpacityGain: 1.8,
  rowLiftRatio: 0.22,
  dividerInk: "rgba(250, 250, 250, 0.07)",
  dividerInkLight: "rgba(18, 19, 26, 0.10)",
  titleFontSize: 30,
  titleFontWeight: 700,
  captionFontSize: 16,
  blockGap: 16,
  /** Text slots. */
  valueSlotGain: 1.6,
  deltaSlotGain: 1.6,
});

export const SOURCE_MOTION = Object.freeze({
  /** Source: durationInFrames 34, staggerInFrames 12, delayInFrames 0 at 30 fps. */
  defaultDrawMs: 1133,
  drawMsRange: {min: 300, max: 4000},
  defaultStaggerMs: 400,
});

export const SOURCE_PALETTE = Object.freeze({
  line: "#e8b86d",
  up: "#2dd4bf",
  down: "#f472b6",
  ink: "#fafafa",
  label: "rgba(250, 250, 250, 0.55)",
});

export const SOURCE_EASING = EASING.enter;

export function fallbackMeasure(text, fontSize) {
  return [...text].reduce((sum, character) => sum + (/[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(character) ? fontSize : fontSize * 0.6), 0);
}

export {equalAreaScale, readDelta};

/** Source tail value: an explicit `value` wins, otherwise the last series value, compact-formatted. */
export function valueTextOf(row, unit = "") {
  if (row.value !== undefined && row.value !== "") return row.value;
  return `${formatCompactNumber(row.values[row.values.length - 1] ?? 0)}${unit}`;
}

export function calculateSparklineRowLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure = fallbackMeasure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const minFontSize = MIN_TEXT_FONT_SIZE / Math.max(factor, 1e-6);
  const overflow = [];

  const rowGap = SOURCE_GEOMETRY.boxWidth * SOURCE_GEOMETRY.rowGapRatio;
  const sparkHeight = SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.sparkHeightRatio;
  const strokeWidth = Math.max(SOURCE_GEOMETRY.minStrokeWidth, SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.strokeWidthRatio);
  const labelFontSize = SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.labelFontRatio;
  const valueFontSize = SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.valueFontRatio;
  const deltaFontSize = SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.deltaFontRatio;
  const valueMinWidth = SOURCE_GEOMETRY.boxWidth * SOURCE_GEOMETRY.valueMinWidthRatio;
  const deltaMinWidth = SOURCE_GEOMETRY.boxWidth * SOURCE_GEOMETRY.deltaMinWidthRatio;
  // The source row is `[label flex:1] [spark] [value minWidth] [delta minWidth]`: the fixed columns
  // take what they need and the label absorbs the rest, so the label's real budget depends on how
  // wide the two figures actually are. Both figures are measured first, then the label gets the
  // remainder — that is the joint constraint the browser solves.
  const valueSlot = SOURCE_GEOMETRY.boxWidth * 0.3;
  const deltaSlot = SOURCE_GEOMETRY.boxWidth * 0.2;
  const unit = content.unit ?? "";

  const rows = content.rows.map((row, index) => {
    const text = valueTextOf(row, unit);
    const {direction, text: deltaText} = readDelta(row.delta);
    const value = fitTextToWidth(measure, text, {fontSize: valueFontSize, fontWeight: 700, maxWidth: valueSlot, minFontSize});
    const delta = deltaText === ""
      ? null
      : fitTextToWidth(measure, deltaText, {fontSize: deltaFontSize, fontWeight: 600, maxWidth: deltaSlot, minFontSize});
    const valueReserve = Math.max(valueMinWidth, value.width);
    const deltaReserve = delta ? Math.max(deltaMinWidth, delta.width) : 0;
    const labelSlot = SOURCE_GEOMETRY.boxWidth - rowGap * 3 - SOURCE_GEOMETRY.sparkWidth - valueReserve - deltaReserve;
    const label = fitTextToWidth(measure, row.label, {fontSize: labelFontSize, fontWeight: 600, maxWidth: labelSlot, minFontSize});
    if (!label.fits) overflow.push({id: `label-${row.id}`, kind: "指标名", text: row.label, available: labelSlot, required: label.width});
    if (!value.fits) overflow.push({id: `value-${row.id}`, kind: "当前值", text, available: valueSlot, required: value.width});
    if (delta && !delta.fits) overflow.push({id: `delta-${row.id}`, kind: "变化幅度", text: deltaText, available: deltaSlot, required: delta.width});
    if (labelSlot < MIN_TEXT_FONT_SIZE) overflow.push({id: `row-${row.id}`, kind: "整行宽度", text: row.label, available: labelSlot, required: MIN_TEXT_FONT_SIZE});

    // Every row keeps its own domain — the source's rule, and the reason a sparkline reads as shape.
    const domain = getChartDomain(row.values, {includeZero: false});
    const points = row.values.map((value2, pointIndex) => ({
      x: (pointIndex / Math.max(1, row.values.length - 1)) * (SOURCE_GEOMETRY.sparkWidth - strokeWidth * 2) + strokeWidth,
      y: sparkHeight - strokeWidth - scaleValue(value2, domain.min, domain.max) * (sparkHeight - strokeWidth * 2),
    }));
    const linePath = buildSmoothPath(points);
    return {
      index, id: row.id, label: row.label, valueText: text, deltaText, direction,
      labelSlot, valueReserve, deltaReserve,
      labelFontSize: label.fontSize, valueFontSize: value.fontSize, deltaFontSize: delta ? delta.fontSize : deltaFontSize,
      domain, points, linePath, areaPath: buildAreaPath(linePath, points, sparkHeight),
      last: points[points.length - 1],
      divider: index === content.rows.length - 1 ? "none" : `1px solid ${SOURCE_GEOMETRY.dividerInk}`,
    };
  });

  const titleHeight = content.title ? SOURCE_GEOMETRY.titleFontSize * 1.2 : 0;
  const captionHeight = content.caption ? SOURCE_GEOMETRY.captionFontSize * 1.3 : 0;
  const rowsHeight = content.rows.length * SOURCE_GEOMETRY.rowHeight;
  const boxWidth = SOURCE_GEOMETRY.boxWidth;
  const boxHeight = titleHeight + captionHeight + rowsHeight
    + SOURCE_GEOMETRY.blockGap * ((content.title ? 1 : 0) + (content.caption ? 1 : 0));

  const rejection = overflow.length
    ? `以下内容在字号下限内仍放不进迷你折线：${overflow.map(item => item.text).join("、")}。请缩短文字或减少一行指标。`
    : null;
  const placed = placeInSafeArea({boxWidth: boxWidth * factor, boxHeight: boxHeight * factor, position, width, height});

  return {
    canvasScale, factor, minFontSize, overflow, rejection,
    designWidth: boxWidth, designHeight: boxHeight,
    boxWidth, boxHeight, blockWidth: boxWidth * factor, blockHeight: boxHeight * factor,
    titleHeight, captionHeight, rowsHeight, rowGap, rowHeight: SOURCE_GEOMETRY.rowHeight,
    sparkWidth: SOURCE_GEOMETRY.sparkWidth, sparkHeight, strokeWidth,
    labelFontSize, valueFontSize, deltaFontSize, valueMinWidth, deltaMinWidth, valueSlot, deltaSlot, rows,
    title: content.title ? {fontSize: SOURCE_GEOMETRY.titleFontSize, weight: SOURCE_GEOMETRY.titleFontWeight} : null,
    caption: content.caption ? {fontSize: SOURCE_GEOMETRY.captionFontSize, text: content.caption} : null,
    x: placed.x, y: placed.y, safe: placed.safe,
  };
}
