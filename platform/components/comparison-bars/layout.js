// ComparisonBars｜对比条形 — layout & measurement.
//
// Source geometry (read-only, RemotionUI `comparison-bars`, MIT, commit 802a637):
//   registry/bases/default/primitives/comparison-bars.tsx
//     width 820 / rowHeight 74 / gap 26 / labelWidth 190
//     barWidth = width − labelWidth; barHeight = (rowHeight − 8) / 2; chipSize = barHeight × 0.5
//     both bars share ONE scale: peak = max(before, after) over every row
//     grow(start) = interpolate(frame, [start, start + durationInFrames], [0, 1], EASING.enter)
//     row start = delayInFrames + index × staggerInFrames; after bar trails by pairOffsetInFrames
//     the figure inside the coloured bar waits for afterProgress > 0.55 (0.25 window) before showing
//     the delta chip lands at afterProgress > 0.86 with a −12 px slide, because it is the conclusion
//   registry/bases/default/lib/chart-utils.ts → formatCompactNumber / readDelta
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter / EASING.exit
//
// Adaptations performed here (recorded in docs/component-assets/CMP-06_DATA_CHARTS_ADAPTATION.md):
//   1. the source is a block of HTML with no size of its own (`width` prop, height implied by the
//      rows). The box is measured here so the component can be placed by the project's 0–1 safe-area
//      ratio and scaled as one object; geometry, row pitch and type scale stay the source's;
//   2. exit (`exitAtInFrames` / `exitInFrames`) is removed — this project's components hold, and the
//      edit decides the out point;
//   3. label, legend, figure and delta text are all measured against their own slots and reported
//      instead of being clipped (`overflow: hidden` + ellipsis in the source label column);
//   4. the row label is right-aligned to the same 190 px column, and the value column is checked
//      against the widest bar rather than only against the row being drawn;
//   5. `valueFormatter` (a function in the source) becomes the project's Chinese compact format plus
//      an optional content-level unit.

import {
  MIN_TEXT_FONT_SIZE, equalAreaScale, fitTextToWidth, formatCompactNumber, placeInSafeArea, readDelta,
} from "../../elements/chart-utils/chart-utils.js";
import {EASING} from "../../elements/motion-tokens/motion-tokens.js";

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, "PingFang SC", monospace';

export const SOURCE_GEOMETRY = Object.freeze({
  boxWidth: 820,
  rowHeight: 74,
  rowGap: 26,
  labelWidth: 190,
  labelPaddingRight: 20,
  barGap: 8,
  barRadiusRatio: 0.28,
  barHeightRatio: (74 - 8) / 2 / 74,
  chipSizeRatio: 0.5,
  legendFontRatio: 0.46,
  legendSwatchRatio: 0.42,
  legendSwatchRadius: 4,
  labelFontRatio: 0.5,
  valueFontRatio: 0.46,
  valuePaddingRatio: 0.32,
  valueRevealStart: 0.55,
  valueRevealWindow: 0.25,
  deltaRevealStart: 0.86,
  deltaRevealWindow: 0.14,
  deltaSlidePx: 12,
  deltaGap: 14,
  titleFontSize: 30,
  titleFontWeight: 700,
  titleMarginBottom: 16,
  captionFontSize: 16,
  captionMarginTop: 10,
  /** Text slots, so a Chinese label is measured instead of truncated. */
  valueSlotRatio: 0.55,
  deltaSlotRatio: 0.22,
});

export const SOURCE_MOTION = Object.freeze({
  /** Source: durationInFrames 30, staggerInFrames 12, pairOffsetInFrames 6 at 30 fps. */
  defaultGrowMs: 1000,
  growMsRange: {min: 300, max: 3000},
  defaultStaggerMs: 400,
  defaultPairOffsetMs: 200,
});

export const SOURCE_PALETTE = Object.freeze({
  before: "rgba(250, 250, 250, 0.22)",
  after: "#e8b86d",
  down: "#f472b6",
  barInk: "#0b0b10",
});

export const SOURCE_EASING = EASING.enter;

export function fallbackMeasure(text, fontSize) {
  return [...text].reduce((sum, character) => sum + (/[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(character) ? fontSize : fontSize * 0.6), 0);
}

/**
 * Source delta text: `+18%` / `−12%` (which is why `readDelta` accepts U+2212 as a minus sign).
 * Only a non-empty `delta` overrides the computed percentage — same rule as the source.
 */
export function deltaOf(row) {
  if (row.delta !== undefined && row.delta !== "") return row.delta;
  const change = row.before === 0 ? 0 : ((row.after - row.before) / row.before) * 100;
  return `${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change))}%`;
}

export function formatValue(value, unit = "") {
  return `${formatCompactNumber(value)}${unit}`;
}

export {equalAreaScale, readDelta};

export function calculateComparisonBarsLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure = fallbackMeasure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const minFontSize = MIN_TEXT_FONT_SIZE / Math.max(factor, 1e-6);
  const overflow = [];

  const barHeight = Math.round(SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.barHeightRatio);
  const chipSize = barHeight * SOURCE_GEOMETRY.chipSizeRatio;
  const barWidth = SOURCE_GEOMETRY.boxWidth - SOURCE_GEOMETRY.labelWidth;
  const labelFontSize = barHeight * SOURCE_GEOMETRY.labelFontRatio;
  const valueFontSize = barHeight * SOURCE_GEOMETRY.valueFontRatio;
  const legendFontSize = barHeight * SOURCE_GEOMETRY.legendFontRatio;
  const valueUnit = content.unit ?? "";

  const fitOrReport = ({text, fontSize, fontWeight, maxWidth, id, kind}) => {
    const fitted = fitTextToWidth(measure, text, {fontSize, fontWeight, maxWidth, minFontSize});
    if (!fitted.fits) overflow.push({id, kind, text, available: maxWidth, required: fitted.width});
    return fitted;
  };

  const peak = content.rows.reduce((highest, row) => Math.max(highest, row.before, row.after), 0) || 1;
  const labelSlot = SOURCE_GEOMETRY.labelWidth - SOURCE_GEOMETRY.labelPaddingRight;
  const rows = content.rows.map((row, index) => {
    const delta = deltaOf(row);
    const label = fitOrReport({text: row.label, fontSize: labelFontSize, fontWeight: 600, maxWidth: labelSlot, id: `label-${row.id}`, kind: "对比项标签"});
    const value = fitOrReport({
      text: formatValue(row.after, valueUnit), fontSize: valueFontSize, fontWeight: 700,
      maxWidth: barWidth * SOURCE_GEOMETRY.valueSlotRatio, id: `value-${row.id}`, kind: "条形数值",
    });
    const chip = fitOrReport({
      text: delta, fontSize: chipSize, fontWeight: 700,
      maxWidth: SOURCE_GEOMETRY.boxWidth * SOURCE_GEOMETRY.deltaSlotRatio, id: `delta-${row.id}`, kind: "变化幅度",
    });
    return {
      index, id: row.id, label: row.label, before: row.before, after: row.after,
      valueText: formatValue(row.after, valueUnit),
      // The source multiplies the raw value by the bar width; a negative value would therefore
      // produce a negative width. This project floors it at 0 (a negative bar has no meaning here).
      ratioBefore: Math.max(0, row.before) / peak, ratioAfter: Math.max(0, row.after) / peak,
      direction: readDelta(delta).direction, delta,
      labelFontSize: label.fontSize, valueFontSize: value.fontSize, chipFontSize: chip.fontSize,
    };
  });

  const legend = content.beforeLabel || content.afterLabel
    ? {
      fontSize: legendFontSize,
      before: content.beforeLabel ?? "", after: content.afterLabel ?? "",
      swatch: barHeight * SOURCE_GEOMETRY.legendSwatchRatio,
    }
    : null;
  if (legend) {
    const legendWidth = measure(legend.before, legend.fontSize, 600, 0) + measure(legend.after, legend.fontSize, 600, 0);
    if (legendWidth + legend.swatch * 4 + SOURCE_GEOMETRY.rowGap * 2 > SOURCE_GEOMETRY.boxWidth) {
      overflow.push({id: "legend", kind: "两列名称", text: `${legend.before} / ${legend.after}`, available: SOURCE_GEOMETRY.boxWidth, required: legendWidth});
    }
  }

  // The block is one flex column with the source's 26 px row gap between every child, so the
  // measured height is the sum of the children plus (children − 1) gaps — same rhythm as the
  // source's `display: grid; gap: 26` block, only measured instead of implied.
  const legendHeight = legend ? Math.max(legend.fontSize * 1.3, legend.swatch) : 0;
  const headerHeight = content.title ? SOURCE_GEOMETRY.titleFontSize * 1.2 : 0;
  const captionHeight = content.caption ? SOURCE_GEOMETRY.captionFontSize * 1.3 : 0;
  const rowsHeight = content.rows.length * SOURCE_GEOMETRY.rowHeight;
  const children = (headerHeight ? 1 : 0) + (legendHeight ? 1 : 0) + content.rows.length + (captionHeight ? 1 : 0);
  const boxWidth = SOURCE_GEOMETRY.boxWidth;
  const boxHeight = headerHeight + legendHeight + rowsHeight + captionHeight
    + SOURCE_GEOMETRY.rowGap * Math.max(0, children - 1);

  const rejection = overflow.length
    ? `以下内容在字号下限内仍放不进对比条形：${overflow.map(item => item.text).join("、")}。请缩短文字或减少对比项。`
    : null;
  const placed = placeInSafeArea({boxWidth: boxWidth * factor, boxHeight: boxHeight * factor, position, width, height});

  return {
    canvasScale, factor, minFontSize, overflow, rejection,
    designWidth: boxWidth, designHeight: boxHeight,
    boxWidth, boxHeight, blockWidth: boxWidth * factor, blockHeight: boxHeight * factor,
    headerHeight, legendHeight, rowsHeight, legend,
    rowHeight: SOURCE_GEOMETRY.rowHeight, rowGap: SOURCE_GEOMETRY.rowGap, labelWidth: SOURCE_GEOMETRY.labelWidth,
    barWidth, barHeight, chipSize, barRadius: barHeight * SOURCE_GEOMETRY.barRadiusRatio,
    valuePadding: barHeight * SOURCE_GEOMETRY.valuePaddingRatio,
    labelFontSize, valueFontSize, peak, rows,
    title: content.title ? {fontSize: SOURCE_GEOMETRY.titleFontSize, weight: SOURCE_GEOMETRY.titleFontWeight} : null,
    caption: content.caption ? {fontSize: SOURCE_GEOMETRY.captionFontSize, text: content.caption} : null,
    x: placed.x, y: placed.y, safe: placed.safe,
  };
}
