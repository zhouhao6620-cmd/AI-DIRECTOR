// Source geometry copied from the RemotionUI funnel-chart source (read-only):
//   registry/bases/default/primitives/funnel-chart.tsx
//     width 820 / height 420 / gap 10 / tailOpacity 0.5 / dropoffColor #f472b6
//     bandHeight = (height − gap × (count − 1)) / count；labelSize = max(12, min(bandHeight × 0.34, width × 0.028))
//     gutter = width × 0.3（左侧名称 / 数值栏）；dropoffGutter = width × 0.13（右侧变化栏）
//     每一段是从「自己的宽度」收窄到「下一段宽度」的梯形；最后一段没有下一段，画成矩形
//     标签在左栏右对齐：名称 y = top + bandHeight × 0.36，数值 y = top + bandHeight × 0.72
//     motion: durationInFrames 22 / staggerInFrames 12（30 fps）→ 733 ms / 400 ms
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter（0.16, 1, 0.3, 1）
//
// Adaptations performed here（详见 docs/component-assets/CMP-06_BATCH_B_QA_REPORT.md）：
//   1. 左栏 8 个中文名称必须真的放得下：按实测宽度收字号（12 px 下限），放不下则拒绝（来源会让文字跑出画布）；
//   2. 数值口径：≥1 万用来源的紧凑写法（124K / 1.2M），小于 1 万按内容精度原样显示，
//      避免来源的 formatCompactNumber 把 12.34 静默写成 12.3；
//   3. 右栏表头 "Drop-off" 改为中文「环比」，符号沿用来源的 + / −；
//   4. 位置改为安全区 0–1 比例；不排入退场（来源的 exitAtInFrames 由片段时序决定）。

import {formatCompactNumber} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  chartWidth: 820,
  chartHeight: 420,
  bandGap: 10,
  tailOpacity: 0.5,
  labelGutterRatio: 0.3,
  dropoffGutterRatio: 0.13,
  labelFontMaxRatio: 0.028,
  labelFontBandRatio: 0.34,
  labelFontMinSize: 12,
  labelFontWeight: 600,
  valueFontScale: 0.92,
  dropoffFontScale: 0.92,
  dropoffHeaderFontScale: 0.82,
  labelNameYRatio: 0.36,
  labelValueYRatio: 0.72,
  dropoffHeaderYRatio: 0.32,
  dropoffHeaderZh: "环比",
  compactFrom: 10000,
});

export const SOURCE_MOTION = Object.freeze({
  // 来源 22 / 12 帧（30 fps）。
  wipeMs: 733,
  staggerMs: 400,
  dropoffExtraRatio: 0.6,
  dropoffFadeMs: 400,
  sourceWipeFrames: 22,
  sourceStaggerFrames: 12,
  sourceFps: 30,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';
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

export function formatNumber(value, decimals = decimalsOf(value) ?? 0) {
  return value.toLocaleString("en-US", {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

/** 数值口径：≥1 万走来源的紧凑写法，小于 1 万按内容精度原样显示（不静默丢精度）。 */
export function formatStageValue(value) {
  return Math.abs(value) >= SOURCE_GEOMETRY.compactFrom ? formatCompactNumber(value) : formatNumber(value, decimalsOf(value) ?? 0);
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

/** 来源：该段到下一段的百分比变化（四舍五入到整数）。 */
export function dropoffOf(stage, next) {
  if (!next || !stage.value) return 0;
  return Math.round(((next.value - stage.value) / stage.value) * 100);
}

/** 来源：该段相对首段的留存比例（四舍五入到整数）。 */
export function conversionOf(stage, first) {
  return Math.round((stage.value / (first.value || 1)) * 100);
}

/** 整段动画窗口：最后一段的梯形擦除结束 + 最后一片环比淡入。 */
export function totalWipeMs(stageCount) {
  const lastStart = Math.max(0, stageCount - 1) * SOURCE_MOTION.staggerMs;
  const tail = Math.max(SOURCE_MOTION.wipeMs, SOURCE_MOTION.wipeMs * SOURCE_MOTION.dropoffExtraRatio + SOURCE_MOTION.dropoffFadeMs);
  return lastStart + tail;
}

export function calculateFunnelChartLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
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
    }
    if (resolved.width > maxWidth + 0.5) overflow.push({id, kind, text, available: maxWidth, required: resolved.width});
    return resolved;
  };

  const chartWidth = SOURCE_GEOMETRY.chartWidth * factor;
  const chartHeight = SOURCE_GEOMETRY.chartHeight * factor;
  const gap = SOURCE_GEOMETRY.bandGap * factor;
  const stageCount = content.stages.length;
  const peak = Math.max(...content.stages.map(stage => stage.value), 1);
  const bandHeight = (chartHeight - gap * (stageCount - 1)) / stageCount;
  const labelFont = Math.max(
    SOURCE_GEOMETRY.labelFontMinSize * canvasScale,
    Math.min(bandHeight * SOURCE_GEOMETRY.labelFontBandRatio, chartWidth * SOURCE_GEOMETRY.labelFontMaxRatio),
  );
  const showDropoff = content.showDropoff !== false;
  const showConversion = content.showConversion === true;
  const gutter = chartWidth * SOURCE_GEOMETRY.labelGutterRatio;
  const dropoffGutter = showDropoff ? chartWidth * SOURCE_GEOMETRY.dropoffGutterRatio : 0;
  const funnelWidth = chartWidth - gutter - dropoffGutter;
  const centre = gutter + funnelWidth / 2;
  const labelBox = gutter - labelFont;
  const valueBox = labelBox;
  const dropoffBox = Math.max(0, dropoffGutter - labelFont * 1.5);

  const stages = content.stages.map((stage, index) => {
    const next = content.stages[index + 1];
    const valueText = `${formatStageValue(stage.value)}${content.unit ?? ""}${showConversion ? ` · ${conversionOf(stage, content.stages[0])}%` : ""}`;
    const name = fitText(stage.label, labelFont, SOURCE_GEOMETRY.labelFontWeight, 0, labelBox, `stage-name-${index}`, "阶段名称");
    const value = fitText(valueText, labelFont * SOURCE_GEOMETRY.valueFontScale, SOURCE_GEOMETRY.labelFontWeight, 0, valueBox, `stage-value-${index}`, "阶段数值");
    const dropoff = dropoffOf(stage, next);
    const dropoffText = next ? `${dropoff >= 0 ? "+" : "−"}${Math.abs(dropoff)}%` : "";
    const dropoffMetrics = next
      ? fitText(dropoffText, labelFont * SOURCE_GEOMETRY.dropoffFontScale, 700, 0, dropoffBox, `stage-dropoff-${index}`, "环比")
      : null;
    return {
      id: stage.id, label: stage.label, value: stage.value, color: stage.color ?? null,
      index, fraction: stage.value / peak, dropoff, dropoffText,
      nameFontSize: name.fontSize, valueFontSize: value.fontSize,
      dropoffFontSize: dropoffMetrics?.fontSize ?? null,
      // 渲染用的文案就是这里量过的文案，测量与实际绘制不会出现两套口径。
      valueText,
      startMs: index * SOURCE_MOTION.staggerMs,
    };
  });

  const dropoffHeader = showDropoff ? fitText(
    SOURCE_GEOMETRY.dropoffHeaderZh, labelFont * SOURCE_GEOMETRY.dropoffHeaderFontScale,
    SOURCE_GEOMETRY.labelFontWeight, 0, dropoffBox, "dropoff-header", "环比表头",
  ) : null;

  const cardWidth = chartWidth;
  const cardHeight = chartHeight;
  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进各自的版面槽位：${overflow.map(item => item.text).join("、")}。请缩短文字或减少阶段。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    chartWidth, chartHeight, boxWidth: chartWidth, boxHeight: chartHeight,
    gap, bandHeight, peak, stageCount, labelFont, gutter, dropoffGutter, funnelWidth, centre,
    labelBox, valueBox, dropoffBox, showDropoff, showConversion, stages, dropoffHeader,
    tailOpacity: SOURCE_GEOMETRY.tailOpacity,
    valueFontScale: SOURCE_GEOMETRY.valueFontScale,
    labelNameYRatio: SOURCE_GEOMETRY.labelNameYRatio,
    labelValueYRatio: SOURCE_GEOMETRY.labelValueYRatio,
    dropoffHeaderYRatio: SOURCE_GEOMETRY.dropoffHeaderYRatio,
    cardWidth, cardHeight,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
