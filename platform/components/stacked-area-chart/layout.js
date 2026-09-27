// StackedAreaChart｜堆叠面积图 — layout & measurement.
//
// Source geometry (read-only, RemotionUI `stacked-area-chart`, MIT, commit 802a637):
//   registry/bases/default/primitives/stacked-area-chart.tsx
//     width 880 / height 460; unit = width / 960 → labelSize = max(11, round(21 × unit))
//     plot insets = {top: legend ? labelSize × 2.6 : labelSize, right: labelSize,
//                    bottom: xLabels ? labelSize × 2.6 : labelSize, left: axis ? labelSize × 3.4 : labelSize}
//     stacks[i][p] = stacks[i − 1][p] + series[i].values[p]; the peak stack drives niceDomain()
//     x(p) = plot.left + p / (n − 1) × plot.width; y(v) = plot.bottom − scale(v) × plot.height
//     band  = smooth(top) + " L last " + smooth(reverse(bottom)).replace("M", "L") + " Z"
//     each band wipes in behind a clip rect of width plot.width × revealed, offset
//     index × bandOffsetInFrames behind the band below it, easing EASING.editorial
//     legend: swatch labelSize × 0.8, item pitch labelSize × 7, text labelSize × 1.6 right of the swatch
//   registry/bases/default/lib/chart-utils.ts → niceDomain / getPlotArea / scaleValue /
//     buildSmoothPath / buildAreaPath
//   registry/bases/default/lib/motion-tokens.ts → EASING.editorial
//
// Adaptations performed here (recorded in docs/component-assets/CMP-06_DATA_CHARTS_ADAPTATION.md):
//   1. measured block size + project safe-area placement + whole-component scaling;
//   2. the value-axis gutter is measured with the real font and never exceeds a third of the chart,
//      instead of the source's fixed `labelSize × 3.4` (a Chinese compact tick like `12.4万` is
//      wider than the source's Latin estimate);
//   3. the legend is laid out from measured item widths. The source draws every item at a fixed
//      pitch of `labelSize × 7` (= 133 px here) and lets a longer series name run into the next
//      swatch; a Chinese label of eight characters is already 152 px;
//   4. exit (`exitAtInFrames` / `exitInFrames`) is removed: this project's components hold;
//   5. `colors` (a prop array in the source) becomes the four project themes plus the source palette
//      as SOURCE, and `valueFormatter` becomes the project's Chinese compact format;
//   6. series must all be the same length as the category list, which the source silently tolerates
//      by falling back to 0 — here it is refused with a reason.

import {
  MIN_TEXT_FONT_SIZE, buildAreaPath, buildSmoothPath, equalAreaScale, fitTextToWidth, formatAxisValue,
  getPlotArea, niceDomain, placeInSafeArea, scaleValue,
} from "../../elements/chart-utils/chart-utils.js";
import {EASING} from "../../elements/motion-tokens/motion-tokens.js";

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, "PingFang SC", monospace';

export const SOURCE_GEOMETRY = Object.freeze({
  width: 880,
  height: 460,
  unitReferenceWidth: 960,
  labelFontSize: 21,
  minLabelFontSize: 11,
  legendTopFactor: 2.6,
  legendRightFactor: 1,
  legendBottomFactor: 2.6,
  legendLeftFactor: 3.4,
  legendSwatchRatio: 0.8,
  legendTextGapRatio: 1.6,
  legendItemGap: 16,
  legendRectOffsetFactor: 0.6,
  xLabelOffsetFactor: 1.3,
  bandStrokeRatio: 2.5,
  minBandStroke: 1.5,
  fillOpacity: 0.85,
  axisLabelGapFactor: 0.6,
  titleFontSize: 30,
  titleFontWeight: 700,
  captionFontSize: 16,
  titleGap: 16,
  captionGap: 10,
  maxGutterRatio: 0.34,
  slotFit: 0.98,
});

export const SOURCE_MOTION = Object.freeze({
  /** Source: durationInFrames 60, bandOffsetInFrames 8 at 30 fps. */
  defaultWipeMs: 2000,
  wipeMsRange: {min: 600, max: 6000},
  defaultBandOffsetMs: 267,
});

export const SOURCE_PALETTE = Object.freeze(["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b", "#5eead4"]);

export const SOURCE_EASING = EASING.editorial;

export function fallbackMeasure(text, fontSize) {
  return [...text].reduce((sum, character) => sum + (/[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(character) ? fontSize : fontSize * 0.6), 0);
}

export {equalAreaScale};

export function calculateStackedAreaChartLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure = fallbackMeasure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const minFontSize = MIN_TEXT_FONT_SIZE / Math.max(factor, 1e-6);
  const overflow = [];

  const unit = SOURCE_GEOMETRY.width / SOURCE_GEOMETRY.unitReferenceWidth;
  const labelSize = Math.max(SOURCE_GEOMETRY.minLabelFontSize, Math.round(SOURCE_GEOMETRY.labelFontSize * unit));
  const bandStroke = Math.max(SOURCE_GEOMETRY.minBandStroke, SOURCE_GEOMETRY.bandStrokeRatio * unit);
  const pointCount = content.categories.length;

  // Cumulative tops: each band's upper edge is the sum of every series at or below it.
  const stacks = [];
  content.series.forEach((entry, index) => {
    const below = stacks[index - 1];
    stacks.push(Array.from({length: pointCount}, (_, p) => (below?.[p] ?? 0) + (entry.values[p] ?? 0)));
  });
  const peakStack = stacks.at(-1) ?? [];
  const domain = niceDomain(peakStack, {includeZero: true, tickCount: 4});
  const axisLabels = domain.ticks.map(tick => formatAxisValue(tick));
  const axisWidth = axisLabels.reduce((longest, label) => Math.max(longest, measure(label, labelSize, 600, 0)), 0);
  const gutter = Math.max(Math.round(labelSize * SOURCE_GEOMETRY.legendLeftFactor), Math.round(axisWidth + labelSize * SOURCE_GEOMETRY.axisLabelGapFactor + 4));

  const plot = getPlotArea(SOURCE_GEOMETRY.width, SOURCE_GEOMETRY.height, {
    top: Math.round(labelSize * SOURCE_GEOMETRY.legendTopFactor),
    right: Math.round(labelSize * SOURCE_GEOMETRY.legendRightFactor),
    bottom: Math.round(labelSize * SOURCE_GEOMETRY.legendBottomFactor),
    left: gutter,
  });
  const x = p => plot.left + (p / Math.max(1, pointCount - 1)) * plot.width;
  const y = value => plot.bottom - scaleValue(value, domain.min, domain.max) * plot.height;

  const bands = content.series.map((entry, index) => {
    const top = stacks[index].map((value, p) => ({x: x(p), y: y(value)}));
    const bottom = (stacks[index - 1] ?? stacks[index].map(() => 0)).map((value, p) => ({x: x(p), y: y(value)}));
    const topPath = buildSmoothPath(top);
    const bottomPath = buildSmoothPath([...bottom].reverse());
    const areaPath = `${topPath} L ${bottom[bottom.length - 1].x} ${bottom[bottom.length - 1].y} ${bottomPath.replace(/^M/, "L")} Z`;
    return {index, id: entry.id, label: entry.label, color: entry.color, topPath, areaPath, values: [...entry.values]};
  });

  // Category labels sit in their own x-slot; first and last anchor inward so they cannot clip.
  const slotWidth = plot.width / Math.max(1, pointCount - 1);
  const slotLimit = slotWidth * SOURCE_GEOMETRY.slotFit;
  const categories = content.categories.map((label, index) => {
    const fitted = fitTextToWidth(measure, label, {fontSize: labelSize, fontWeight: 600, maxWidth: slotLimit, minFontSize});
    if (!fitted.fits) overflow.push({id: `category-${index}`, kind: "类别标签", text: label, available: slotLimit, required: fitted.width});
    return {
      index, label, fontSize: fitted.fontSize, x: x(index),
      anchor: index === 0 ? "start" : index === pointCount - 1 ? "end" : "middle",
    };
  });

  // Legend: measured item widths, laid out left to right inside the chart (source order preserved).
  const swatch = labelSize * SOURCE_GEOMETRY.legendSwatchRatio;
  const textGap = swatch * SOURCE_GEOMETRY.legendTextGapRatio;
  let legendCursor = plot.left;
  const legend = bands.map(band => {
    const fitted = fitTextToWidth(measure, band.label, {fontSize: labelSize, fontWeight: 600, maxWidth: SOURCE_GEOMETRY.width * 0.4, minFontSize});
    const item = {id: band.id, label: band.label, swatch, textGap, fontSize: fitted.fontSize, x: legendCursor};
    legendCursor += swatch + textGap + fitted.width + SOURCE_GEOMETRY.legendItemGap;
    return item;
  });
  const legendRight = legendCursor - SOURCE_GEOMETRY.legendItemGap;
  if (legendRight > SOURCE_GEOMETRY.width) {
    overflow.push({
      id: "legend", kind: "系列名", text: content.series.map(entry => entry.label).join(" / "),
      available: SOURCE_GEOMETRY.width - plot.left, required: legendRight - plot.left,
    });
  }

  const titleHeight = content.title ? SOURCE_GEOMETRY.titleFontSize * 1.2 : 0;
  const captionHeight = content.caption ? SOURCE_GEOMETRY.captionFontSize * 1.3 : 0;
  const boxWidth = SOURCE_GEOMETRY.width;
  const boxHeight = SOURCE_GEOMETRY.height + titleHeight + captionHeight
    + (content.title ? SOURCE_GEOMETRY.titleGap : 0) + (content.caption ? SOURCE_GEOMETRY.captionGap : 0);

  let rejection = null;
  if (gutter > SOURCE_GEOMETRY.width * SOURCE_GEOMETRY.maxGutterRatio) {
    rejection = `数值轴标签「${axisLabels.at(-1)}」需要的左侧刻度区 ${Math.round(gutter)} px 超过图表宽度的 ${Math.round(SOURCE_GEOMETRY.maxGutterRatio * 100)}%。请缩小数值量级或缩短单位。`;
  } else if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进堆叠面积图：${overflow.map(item => item.text).join("、")}。请缩短文字或减少系列。`;
  }
  const placed = placeInSafeArea({boxWidth: boxWidth * factor, boxHeight: boxHeight * factor, position, width, height});

  return {
    canvasScale, factor, minFontSize, overflow, rejection,
    designWidth: boxWidth, designHeight: SOURCE_GEOMETRY.height,
    boxWidth, boxHeight, blockWidth: boxWidth * factor, blockHeight: boxHeight * factor,
    titleHeight, captionHeight, labelSize, bandStroke, gutter, plot, domain, axisLabels, pointCount, stacks, bands, categories, legend,
    legendRight, swatch, textGap,
    fillOpacity: SOURCE_GEOMETRY.fillOpacity,
    axisTicks: domain.ticks.map((tick, index) => ({
      value: tick, text: axisLabels[index], y: y(tick),
    })),
    title: content.title ? {fontSize: SOURCE_GEOMETRY.titleFontSize, weight: SOURCE_GEOMETRY.titleFontWeight} : null,
    caption: content.caption ? {fontSize: SOURCE_GEOMETRY.captionFontSize, text: content.caption} : null,
    x: placed.x, y: placed.y, safe: placed.safe,
  };
}
