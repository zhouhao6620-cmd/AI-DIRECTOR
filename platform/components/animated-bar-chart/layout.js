// AnimatedBarChart｜动态柱状图 — layout & measurement.
//
// Source geometry (read-only, RemotionUI `animated-bar-chart`, MIT, commit 802a637):
//   registry/bases/default/scenes/animated-bar-chart/index.tsx
//     the source is a full-frame SCENE: `width × height` from useVideoConfig(), safe padding from
//     the video-layout guidance, type sizes from scaleFont(size) = round(size × width / 1080),
//     header/subtitle/axis/counter use DURATION.normal, STAGGER.tight/normal and one SPRING per row
//       spring({frame: frame − delay, fps, config: {damping: 20, stiffness: 110, mass: 0.9},
//              durationInFrames: DURATION.slow}), delay = STAGGER.normal + index × STAGGER.normal
//     domain = niceDomain(values, {includeZero: true, tickCount: isPortrait ? 3 : 4})
//     labelWidth = min(round(width × 0.26), round(min(longestLabel, 14) × labelSize × 0.62) + gap)
//     valueWidth = scaleFont(96); barHeight = min(scaleFont(52), height × (portrait ? 0.44 : 0.52) / bars)
//     row grid = `${labelWidth}px 1fr ${valueWidth}px`; bar fill = linear-gradient(90deg, `${fill}e6` 0%, fill 62%)
//     the counter and the bar share one spring, so the number can never claim a total the bar has not
//     reached; delta chip fades in at enter > 0.7; the highlighted row takes accentColor + a glow
//   registry/bases/default/lib/chart-utils.ts → niceDomain / readDelta / formatCompactNumber / formatAxisValue
//   registry/bases/default/lib/layout.ts       → getSafeAreaPadding / scaleFont (80 px sides, 100 px vertical at 1080)
//   registry/bases/default/lib/motion-tokens.ts → DURATION / STAGGER (EASING.exit for the scene exit)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-06_DATA_CHARTS_ADAPTATION.md):
//   1. the source is a scene that paints its own #080810 plate and fills the frame. A library component
//      has to sit inside the project's 0–1 safe area, scale as one object and stay transparent, so the
//      chart is drawn on a fixed 880 px design canvas (all type still derived from the source's
//      `size × canvasWidth / 1080` rule) and the plate is dropped for transparent output;
//   2. `barHeight` no longer shrinks to fit a tall frame (`height × 0.44 / bars`): the box grows to fit
//      the rows instead, so the same chart keeps its proportions on both canvases;
//   3. the label column and the value column are measured with the real font. The source estimates a
//      label at 0.62 em per character and hard-codes a 96 px value column — a Chinese label is 1 em and
//      a Chinese compact figure (“12.4万元”) is wider than 96 px;
//   4. `highlightLabel` (a single label prop) becomes a per-row `emphasis` flag, so the emphasis is part
//      of the content tree instead of a second place to keep in sync;
//   5. `holdSeconds` and the scene exit are removed — this project's components hold, and the edit
//      decides the out point;
//   6. `loadFont` from @remotion/google-fonts is replaced by the project's own font stack; the project
//      does not load web fonts inside a component.

import {
  MIN_TEXT_FONT_SIZE, equalAreaScale, fitTextToWidth, formatAxisValue, formatCompactNumber,
  niceDomain, placeInSafeArea, readDelta, scaleValue,
} from "../../elements/chart-utils/chart-utils.js";
import {DURATION_SECONDS, STAGGER} from "../../elements/motion-tokens/motion-tokens.js";

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, "PingFang SC", monospace';

export const SOURCE_GEOMETRY = Object.freeze({
  /** Adaptation 1: fixed design canvas instead of the composition width/height. */
  boxWidth: 880,
  typeReferenceWidth: 1080,
  gapSize: 16,
  headerGapSize: 12,
  mainGapSize: 40,
  rowGapSize: 18,
  liftSize: 14,
  glowSize: 28,
  deltaSize: 21,
  axisLabelSize: 21,
  axisHeightSize: 24,
  axisMarginTopSize: 10,
  valueWidthSize: 96,
  barHeightSize: 52,
  titleSizePortrait: 76,
  titleSizeLandscape: 64,
  subtitleSize: 30,
  labelSizePortrait: 30,
  labelSizeLandscape: 28,
  valueSizePortrait: 32,
  valueSizeLandscape: 30,
  labelWidthMaxRatio: 0.26,
  barRadiusRatio: 0.5,
  /** The figure waits until the bar is wide enough to hold it (source: enter > 0.7). */
  deltaRevealStart: 0.7,
  countFloorRatio: 0.015,
  titleFontWeight: 700,
  subtitleFontWeight: 500,
  titleLineHeight: 1.02,
  subtitleLineHeight: 1.25,
  captionFontSize: 16,
});

/** Source tokens: DURATION.fast/normal/slow (0.4/0.8/1.2 s) and STAGGER.tight/normal. */
export const SOURCE_MOTION = Object.freeze({
  headerSeconds: DURATION_SECONDS.normal,
  subtitleDelayFrames: STAGGER.tight,
  axisDelayFrames: STAGGER.normal,
  rowDelayFrames: STAGGER.normal,
  rowDelayStepFrames: STAGGER.normal,
  barSpringSeconds: DURATION_SECONDS.slow,
});

export const SOURCE_PALETTE = Object.freeze({
  bg: "#080810",
  label: "rgba(250, 250, 250, 0.62)",
  axis: "rgba(250, 250, 250, 0.42)",
  grid: "rgba(250, 250, 250, 0.08)",
  track: "rgba(250, 250, 250, 0.05)",
  ink: "#fafafa",
  bar: "#2dd4bf",
  accent: "#e8b86d",
  up: "#2dd4bf",
  down: "#f87171",
});

/** Source `spring({config: {damping: 20, stiffness: 110, mass: 0.9}})`. */
export const BAR_SPRING = Object.freeze({damping: 20, stiffness: 110, mass: 0.9});

export function scaleFont(sizeAt1080, width) {
  return Math.round(sizeAt1080 * (width / SOURCE_GEOMETRY.typeReferenceWidth));
}

export function fallbackMeasure(text, fontSize) {
  return [...text].reduce((sum, character) => sum + (/[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(character) ? fontSize : fontSize * 0.6), 0);
}

export {equalAreaScale, readDelta};

export function calculateAnimatedBarChartLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure = fallbackMeasure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const minFontSize = MIN_TEXT_FONT_SIZE / Math.max(factor, 1e-6);
  const overflow = [];
  const isPortrait = height > width;
  const canvas = SOURCE_GEOMETRY.boxWidth;
  const unit = content.unit ?? "";

  const gap = scaleFont(SOURCE_GEOMETRY.gapSize, canvas);
  const headerGap = scaleFont(SOURCE_GEOMETRY.headerGapSize, canvas);
  const mainGap = scaleFont(SOURCE_GEOMETRY.mainGapSize, canvas);
  const rowGap = scaleFont(SOURCE_GEOMETRY.rowGapSize, canvas);
  const lift = scaleFont(SOURCE_GEOMETRY.liftSize, canvas);
  const glow = scaleFont(SOURCE_GEOMETRY.glowSize, canvas);
  const deltaFontSize = scaleFont(SOURCE_GEOMETRY.deltaSize, canvas);
  const axisFontSize = scaleFont(SOURCE_GEOMETRY.axisLabelSize, canvas);
  const axisHeight = scaleFont(SOURCE_GEOMETRY.axisHeightSize, canvas);
  const axisMarginTop = scaleFont(SOURCE_GEOMETRY.axisMarginTopSize, canvas);
  const labelFontSize = scaleFont(isPortrait ? SOURCE_GEOMETRY.labelSizePortrait : SOURCE_GEOMETRY.labelSizeLandscape, canvas);
  const valueFontSize = scaleFont(isPortrait ? SOURCE_GEOMETRY.valueSizePortrait : SOURCE_GEOMETRY.valueSizeLandscape, canvas);
  const titleFontSize = scaleFont(isPortrait ? SOURCE_GEOMETRY.titleSizePortrait : SOURCE_GEOMETRY.titleSizeLandscape, canvas);
  const subtitleFontSize = scaleFont(SOURCE_GEOMETRY.subtitleSize, canvas);
  const barHeight = scaleFont(SOURCE_GEOMETRY.barHeightSize, canvas);

  // The value column holds the widest figure plus its delta chip; the label column holds the longest
  // bar name. Both are measured instead of estimated (source: 0.62 em per character + a fixed 96 px).
  const maxLabelWidth = content.bars.reduce((longest, bar) => Math.max(longest, measure(bar.label, labelFontSize, 600, 0)), 0);
  const labelWidthLimit = Math.round(canvas * SOURCE_GEOMETRY.labelWidthMaxRatio);
  const labelWidth = Math.min(labelWidthLimit, Math.ceil(maxLabelWidth) + gap);
  if (maxLabelWidth + gap > labelWidthLimit) {
    overflow.push({id: "label", kind: "条形名", text: content.bars.reduce((longest, bar) => (bar.label.length > longest.length ? bar.label : longest), ""), available: labelWidthLimit - gap, required: maxLabelWidth});
  }
  const maxValueWidth = content.bars.reduce((widest, bar) => {
    const text = `${formatCompactNumber(bar.value)}${unit}`;
    return Math.max(widest, measure(text, valueFontSize, 700, 0));
  }, 0);
  const maxDeltaWidth = content.bars.reduce((widest, bar) => {
    const {text} = readDelta(bar.delta);
    return text === "" ? widest : Math.max(widest, measure(text, deltaFontSize, 600, 0));
  }, 0);
  const valueWidth = Math.max(scaleFont(SOURCE_GEOMETRY.valueWidthSize, canvas), Math.ceil(Math.max(maxValueWidth, maxDeltaWidth)) + gap);

  const domain = niceDomain(content.bars.map(bar => bar.value), {includeZero: true, tickCount: isPortrait ? 3 : 4});
  const axisLabels = domain.ticks.map(tick => formatAxisValue(tick));
  const axisWidth = axisLabels.reduce((longest, label) => Math.max(longest, measure(label, axisFontSize, 600, 0)), 0);
  const axisSlot = canvas - labelWidth - gap - valueWidth - gap;
  if (axisWidth > axisSlot * 0.4) {
    overflow.push({id: "axis", kind: "刻度", text: axisLabels.at(-1), available: axisSlot * 0.4, required: axisWidth});
  }

  const bars = content.bars.map((bar, index) => {
    const {text: deltaText} = readDelta(bar.delta);
    const valueText = `${formatCompactNumber(bar.value)}${unit}`;
    const value = fitTextToWidth(measure, valueText, {fontSize: valueFontSize, fontWeight: 700, maxWidth: valueWidth - gap, minFontSize});
    if (!value.fits) overflow.push({id: `value-${bar.id}`, kind: "条形数值", text: valueText, available: valueWidth - gap, required: value.width});
    return {
      index, id: bar.id, label: bar.label, value: bar.value, deltaText,
      direction: readDelta(bar.delta).direction, emphasis: bar.emphasis === true,
      ratio: Math.max(0, scaleValue(bar.value, domain.min, domain.max)),
      valueFontSize: value.fontSize,
    };
  });

  const titleHeight = content.title ? titleFontSize * SOURCE_GEOMETRY.titleLineHeight : 0;
  const subtitleHeight = content.subtitle ? subtitleFontSize * SOURCE_GEOMETRY.subtitleLineHeight : 0;
  const headerHeight = titleHeight + (subtitleHeight ? headerGap + subtitleHeight : 0);
  const captionHeight = content.caption ? SOURCE_GEOMETRY.captionFontSize * 1.3 : 0;
  const rowsHeight = content.bars.length * barHeight + (content.bars.length - 1) * rowGap;
  const boxWidth = canvas;
  const boxHeight = (headerHeight ? headerHeight + mainGap : 0) + rowsHeight + axisMarginTop + axisHeight + captionHeight;

  const rejection = overflow.length
    ? `以下内容在字号下限内仍放不进动态柱状图：${overflow.map(item => item.text).join("、")}。请缩短文字或减少条目。`
    : null;
  const placed = placeInSafeArea({boxWidth: boxWidth * factor, boxHeight: boxHeight * factor, position, width, height});

  return {
    canvasScale, factor, minFontSize, overflow, rejection, isPortrait,
    designWidth: boxWidth, designHeight: boxHeight,
    boxWidth, boxHeight, blockWidth: boxWidth * factor, blockHeight: boxHeight * factor,
    headerHeight, subtitleHeight, titleHeight, captionHeight, rowsHeight,
    gap, headerGap, mainGap, rowGap, lift, glow, deltaFontSize, axisFontSize, axisHeight, axisMarginTop,
    labelWidth, labelFontSize, valueWidth, valueFontSize, titleFontSize, subtitleFontSize, barHeight,
    barRadius: barHeight * SOURCE_GEOMETRY.barRadiusRatio, domain, axisLabels, axisSlot, bars, unit,
    title: content.title ? {fontSize: titleFontSize} : null,
    subtitle: content.subtitle ? {fontSize: subtitleFontSize} : null,
    caption: content.caption ? {fontSize: SOURCE_GEOMETRY.captionFontSize, text: content.caption} : null,
    axisTicks: domain.ticks.map((tick, index) => ({
      value: tick, text: axisLabels[index],
      leftRatio: scaleValue(tick, domain.min, domain.max),
      first: index === 0, last: index === domain.ticks.length - 1,
    })),
    x: placed.x, y: placed.y, safe: placed.safe,
  };
}
