// BarChartRace｜柱状竞速图 — layout, rank maths & measurement.
//
// Source geometry (read-only, RemotionUI `bar-chart-race`, MIT, commit 802a637):
//   registry/bases/default/primitives/bar-chart-race.tsx
//     width 900 / rowHeight 66 / gap 14 / labelWidth 200 / visibleRows 6 / framesPerStep 26
//     pitch = rowHeight + gap; box height = pitch × visibleRows
//     time = clamp((frame − delayInFrames) / framesPerStep, 0, lastStep)
//     valueAt(values, time) = linear interpolation between the two neighbouring keyframes
//     softness = leader × 0.022; rank(entry) = Σ 1 / (1 + e^((entry − other) / softness))
//       — a FRACTIONAL rank, so bars slide past each other instead of teleporting a row;
//     visibility = clamp01(visibleRows − rank); a row past the window fades rather than clipping
//     bar width = max(rowHeight × 0.6, (current / leader) × barWidth × (1 − exit))
//     step caption: bottom-right, fontSize rowHeight × 0.9, opacity 0.22
//   registry/bases/default/lib/chart-utils.ts → formatCompactNumber
//   registry/bases/default/lib/motion-tokens.ts → EASING.exit
//
// Adaptations performed here (recorded in docs/component-assets/CMP-06_DATA_CHARTS_ADAPTATION.md):
//   1. measured block size + project safe-area placement + whole-component scaling; the source has a
//      fixed `width` prop and its own height, with no position of its own;
//   2. `visibleRows` is fixed to the series count (this component caps series at six, which is the
//      source's visible window) and `exit` is removed — the project's components hold, and the edit
//      decides the out point;
//   3. the label column keeps the source's 200 px, but a Chinese row label is measured against it and
//      refused when it cannot fit, instead of the source's `overflow: hidden` + ellipsis;
//   4. the step caption is measured too (the source prints a year at 59 px with no bound);
//   5. `colors` becomes the four project themes plus the source palette as SOURCE, and
//      `valueFormatter` becomes the project's Chinese compact format plus an optional unit;
//   6. `framesPerStep` becomes `stepMs` so the race reads at any fps, and every series must be as
//      long as the step list (the source silently pads missing keyframes with 0).

import {
  MIN_TEXT_FONT_SIZE, equalAreaScale, fitTextToWidth, formatCompactNumber, placeInSafeArea,
} from "../../elements/chart-utils/chart-utils.js";

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, "PingFang SC", monospace';

export const SOURCE_GEOMETRY = Object.freeze({
  boxWidth: 900,
  rowHeight: 66,
  rowGap: 14,
  labelWidth: 200,
  labelFontRatio: 0.32,
  valueFontRatio: 0.3,
  stepFontRatio: 0.9,
  barRadiusRatio: 0.22,
  valuePaddingRatio: 0.28,
  minBarWidthRatio: 0.6,
  stepOpacity: 0.22,
  softnessRatio: 0.022,
  valueSlotRatio: 0.55,
  stepSlotRatio: 0.3,
  titleFontSize: 30,
  titleFontWeight: 700,
  captionFontSize: 16,
  blockGap: 16,
});

export const SOURCE_MOTION = Object.freeze({
  /** Source: framesPerStep 26 at 30 fps ≈ 867 ms per keyframe. */
  defaultStepMs: 867,
  stepMsRange: {min: 200, max: 2000},
});

export const SOURCE_PALETTE = Object.freeze(["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b", "#5eead4"]);
export const SOURCE_BAR_INK = "#0b0b10";

export function fallbackMeasure(text, fontSize) {
  return [...text].reduce((sum, character) => sum + (/[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(character) ? fontSize : fontSize * 0.6), 0);
}

export {equalAreaScale};

// Source `valueAt`: linear interpolation between the two neighbouring keyframes.
export function valueAt(values, time) {
  if (values.length === 0) return 0;
  const clamped = Math.min(values.length - 1, Math.max(0, time));
  const lower = Math.floor(clamped);
  const upper = Math.min(values.length - 1, lower + 1);
  const t = clamped - lower;
  return values[lower] + (values[upper] - values[lower]) * t;
}

// Source `time`: how far the race has travelled, in keyframes.
export function timeAt({frame, fps, stepMs, stepCount}) {
  const stepFrames = Math.max(1, (stepMs / 1000) * fps);
  return Math.min(Math.max(0, stepCount - 1), Math.max(0, frame / stepFrames));
}

// Soft-rank race state at one instant: each series counts how far above it every other series sits,
// softened by a sigmoid whose width is a share of the leader's value. An integer sort position would
// make bars teleport a whole row the instant two values cross; the soft rank slides them past.
export function raceStateAt({content, time, valueText}) {
  const current = content.series.map((entry, index) => ({
    id: entry.id, label: entry.label, color: entry.color, index,
    current: valueAt(entry.values, time),
  }));
  const leader = current.reduce((highest, entry) => Math.max(highest, entry.current), 0) || 1;
  const softness = leader * SOURCE_GEOMETRY.softnessRatio;
  const ranks = current.map(entry => current.reduce((sum, other) => {
    if (other.id === entry.id) return sum;
    return sum + 1 / (1 + Math.exp((entry.current - other.current) / softness));
  }, 0));
  return {
    leader,
    rows: current.map((entry, index) => ({
      ...entry,
      rank: ranks[index],
      visibility: Math.max(0, Math.min(1, content.series.length - ranks[index])),
      ratio: entry.current / leader,
      valueText: valueText(entry.current, index),
    })),
  };
}

export function calculateBarChartRaceLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure = fallbackMeasure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const minFontSize = MIN_TEXT_FONT_SIZE / Math.max(factor, 1e-6);
  const overflow = [];

  const pitch = SOURCE_GEOMETRY.rowHeight + SOURCE_GEOMETRY.rowGap;
  const barWidth = SOURCE_GEOMETRY.boxWidth - SOURCE_GEOMETRY.labelWidth;
  const labelSlot = SOURCE_GEOMETRY.labelWidth - SOURCE_GEOMETRY.rowGap;
  const valueSlot = barWidth * SOURCE_GEOMETRY.valueSlotRatio;
  const stepSlot = SOURCE_GEOMETRY.boxWidth * SOURCE_GEOMETRY.stepSlotRatio;
  const labelFontSize = SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.labelFontRatio;
  const valueFontSize = SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.valueFontRatio;
  const stepFontSize = SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.stepFontRatio;
  const unit = content.unit ?? "";

  const series = content.series.map(entry => {
    const label = fitTextToWidth(measure, entry.label, {fontSize: labelFontSize, fontWeight: 600, maxWidth: labelSlot, minFontSize});
    if (!label.fits) overflow.push({id: `label-${entry.id}`, kind: "系列名", text: entry.label, available: labelSlot, required: label.width});
    return {id: entry.id, label: entry.label, values: [...entry.values], color: entry.color, labelFontSize: label.fontSize};
  });

  // The figure sits inside a bar, so the widest value is checked once against the bar track rather
  // than per frame.
  const maxValueText = content.series.reduce((widest, entry) => {
    const text = `${formatCompactNumber(Math.max(...entry.values))}${unit}`;
    return text.length > widest.length ? text : widest;
  }, "");
  const value = fitTextToWidth(measure, maxValueText, {fontSize: valueFontSize, fontWeight: 700, maxWidth: valueSlot, minFontSize});
  if (!value.fits) overflow.push({id: "value", kind: "数值", text: maxValueText, available: valueSlot, required: value.width});

  const steps = content.steps.map((step, index) => {
    const fitted = fitTextToWidth(measure, step, {fontSize: stepFontSize, fontWeight: 700, maxWidth: stepSlot, minFontSize});
    if (!fitted.fits) overflow.push({id: `step-${index}`, kind: "关键帧标签", text: step, available: stepSlot, required: fitted.width});
    return {index, label: step, fontSize: fitted.fontSize};
  });

  const titleHeight = content.title ? SOURCE_GEOMETRY.titleFontSize * 1.2 : 0;
  const captionHeight = content.caption ? SOURCE_GEOMETRY.captionFontSize * 1.3 : 0;
  const boardHeight = pitch * content.series.length;
  const boxWidth = SOURCE_GEOMETRY.boxWidth;
  const boxHeight = titleHeight + captionHeight + boardHeight
    + SOURCE_GEOMETRY.blockGap * ((content.title ? 1 : 0) + (content.caption ? 1 : 0));

  const rejection = overflow.length
    ? `以下内容在字号下限内仍放不进柱状竞速图：${overflow.map(item => item.text).join("、")}。请缩短文字或减少系列。`
    : null;
  const placed = placeInSafeArea({boxWidth: boxWidth * factor, boxHeight: boxHeight * factor, position, width, height});

  return {
    canvasScale, factor, minFontSize, overflow, rejection,
    designWidth: boxWidth, designHeight: boxHeight,
    boxWidth, boxHeight, blockWidth: boxWidth * factor, blockHeight: boxHeight * factor,
    titleHeight, captionHeight, boardHeight, pitch,
    rowHeight: SOURCE_GEOMETRY.rowHeight, rowGap: SOURCE_GEOMETRY.rowGap, labelWidth: SOURCE_GEOMETRY.labelWidth,
    barWidth, labelSlot, labelFontSize, valueFontSize, stepFontSize,
    barRadius: SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.barRadiusRatio,
    valuePadding: SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.valuePaddingRatio,
    minBarWidth: SOURCE_GEOMETRY.rowHeight * SOURCE_GEOMETRY.minBarWidthRatio,
    stepOpacity: SOURCE_GEOMETRY.stepOpacity,
    series, steps, unit, maxValueText,
    title: content.title ? {fontSize: SOURCE_GEOMETRY.titleFontSize, weight: SOURCE_GEOMETRY.titleFontWeight} : null,
    caption: content.caption ? {fontSize: SOURCE_GEOMETRY.captionFontSize, text: content.caption} : null,
    x: placed.x, y: placed.y, safe: placed.safe,
  };
}
