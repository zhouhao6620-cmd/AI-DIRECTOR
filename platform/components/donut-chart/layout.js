// Source geometry copied from the RemotionUI donut-chart source (read-only):
//   registry/bases/default/primitives/donut-chart.tsx
//     size 360 / thickness 46 / DEFAULT_COLORS（琥珀 · 青 · 粉 · 靛）
//     legend: gap = size × 0.16, dot = size × 0.05, 行内 gap = size × 0.045,
//             名称槽 minWidth = size × 0.42, 行距 = size × 0.055, 字号 = size × 0.062
//     hole:  合计 字号 = size × 0.17，标签字号 = size × 0.065，标签上边距 = size × 0.03
//     ring:  radius = (size − thickness) / 2，段间 gap = min(周长 × 0.012, thickness × 0.22)
//     motion: durationInFrames 26 / staggerInFrames 9（30 fps）→ 867 ms / 300 ms
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter（0.16, 1, 0.3, 1）
//
// Adaptations performed here（详见 docs/component-assets/CMP-06_BATCH_B_QA_REPORT.md）：
//   1. 来源画布 360 变成「以源单位为基准的 SVG viewBox」，整组件按画布等比缩放（factor = canvasScale × size），
//      来源几何数值一个不改，缩放只发生在视图层；
//   2. 图例与环内文字按「全中文最宽字形」实测：放不进各自槽位时先缩到 12 px 下限，
//      仍放不下则明确拒绝，不让文案互相压住（来源直接叠字）；
//   3. 来源的 offsetX / offsetY 像素微调改成安全区 0–1 比例定位；
//   4. 不排入退场：来源的 exitAtInFrames 由片段时序决定，本组件落定后保持不变。

import {formatCompactNumber} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  ringSize: 360,
  thickness: 46,
  legendGapRatio: 0.16,
  legendDotRatio: 0.05,
  legendInnerGapRatio: 0.045,
  legendLabelBoxRatio: 0.42,
  legendValueBoxRatio: 0.5,
  legendRowGapRatio: 0.055,
  legendFontRatio: 0.062,
  legendLineHeight: 1.6,
  totalFontRatio: 0.17,
  totalLabelFontRatio: 0.065,
  totalLabelMarginRatio: 0.03,
  totalLabelLetterSpacingEm: 0.06,
  holeBoxRatio: 0.86,
  gapCircumferenceRatio: 0.012,
  gapThicknessRatio: 0.22,
});

export const SOURCE_MOTION = Object.freeze({
  // 来源 26 帧（30 fps）一段的扫过时长；stagger 9 帧。
  sweepMs: 867,
  staggerMs: 300,
  sourceSweepFrames: 26,
  sourceStaggerFrames: 9,
  sourceFps: 30,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';
export const EASE_SOURCE = Object.freeze([0.16, 1, 0.3, 1]);
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

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

/** 归一化入场进度：delayMs / durationMs 都按 fps 换算成帧，来源曲线直接作用在 t 上。 */
export function progressAt({frame, fps, delayMs = 0, durationMs, ease = value => value}) {
  const start = (delayMs / 1000) * fps;
  const span = Math.max(1, (durationMs / 1000) * fps);
  const t = Math.min(1, Math.max(0, (frame - start) / span));
  return ease(t);
}

/** 来源整段动画窗口：最后一段扫过结束的时刻（毫秒）。 */
export function totalSweepMs(segmentCount) {
  return Math.max(0, segmentCount - 1) * SOURCE_MOTION.staggerMs + SOURCE_MOTION.sweepMs;
}

export function calculateDonutChartLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
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
      // 真实字体度量不是严格线性的（hinting / 字距微调），一次线性反解可能还差一点点：
      // 按残差再收一次，避免「算出来刚好放得下、真渲染时溢出半像素」。
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

  const ringSize = SOURCE_GEOMETRY.ringSize * factor;
  const thickness = SOURCE_GEOMETRY.thickness * factor;
  const radiusSource = (SOURCE_GEOMETRY.ringSize - SOURCE_GEOMETRY.thickness) / 2;
  const circumferenceSource = 2 * Math.PI * radiusSource;
  const gapSource = Math.min(
    circumferenceSource * SOURCE_GEOMETRY.gapCircumferenceRatio,
    SOURCE_GEOMETRY.thickness * SOURCE_GEOMETRY.gapThicknessRatio,
  );

  const total = content.segments.reduce((sum, segment) => sum + segment.value, 0);
  const holeBox = (SOURCE_GEOMETRY.ringSize - SOURCE_GEOMETRY.thickness * 2) * SOURCE_GEOMETRY.holeBoxRatio * factor;
  const totalText = `${formatCompactNumber(total)}${content.unit ?? ""}`;
  const holeValue = fitText(totalText, ringSize * SOURCE_GEOMETRY.totalFontRatio, 700, 0, holeBox, "total", "环内合计");
  const holeLabel = content.totalLabel
    ? fitText(
      content.totalLabel,
      ringSize * SOURCE_GEOMETRY.totalLabelFontRatio,
      600,
      ringSize * SOURCE_GEOMETRY.totalLabelFontRatio * SOURCE_GEOMETRY.totalLabelLetterSpacingEm,
      holeBox,
      "totalLabel",
      "环内标签",
    )
    : null;

  const legendGap = ringSize * SOURCE_GEOMETRY.legendGapRatio;
  const legendDot = ringSize * SOURCE_GEOMETRY.legendDotRatio;
  const legendInnerGap = ringSize * SOURCE_GEOMETRY.legendInnerGapRatio;
  const legendRowGap = ringSize * SOURCE_GEOMETRY.legendRowGapRatio;
  const legendFont = ringSize * SOURCE_GEOMETRY.legendFontRatio;
  const labelBox = ringSize * SOURCE_GEOMETRY.legendLabelBoxRatio;
  const valueBox = ringSize * SOURCE_GEOMETRY.legendValueBoxRatio;

  const segments = content.segments.map((segment, index) => {
    const label = fitText(segment.label, legendFont, 600, 0, labelBox, `label-${index}`, "图例名称");
    // 图例右侧与来源一致：显示这一段自己的占比，随扫过进度计数。
    const percent = fitText("100%", legendFont, 600, 0, valueBox, `value-${index}`, "图例占比");
    return {
      id: segment.id,
      label: segment.label,
      value: segment.value,
      color: segment.color ?? null,
      labelFontSize: label.fontSize,
      valueFontSize: percent.fontSize,
    };
  });

  const showLegend = content.showLegend !== false && segments.length > 0;
  const showTotal = content.showTotal !== false;
  const legendWidth = showLegend ? legendDot + legendInnerGap + labelBox + legendInnerGap + valueBox : 0;
  const legendHeight = showLegend
    ? segments.length * legendFont * SOURCE_GEOMETRY.legendLineHeight + Math.max(0, segments.length - 1) * legendRowGap
    : 0;
  const cardWidth = ringSize + (showLegend ? legendGap + legendWidth : 0);
  const cardHeight = Math.max(ringSize, legendHeight);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进各自的版面槽位：${overflow.map(item => item.text).join("、")}。请缩短文字或减少分段。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    ringSize, thickness, radiusSource, circumferenceSource, gapSource,
    holeBox, holeValue, holeLabel, showTotal, showLegend,
    legendGap, legendDot, legendInnerGap, legendRowGap, legendFont, legendLineHeight: SOURCE_GEOMETRY.legendLineHeight,
    labelBox, valueBox, segments, total,
    cardWidth, cardHeight,
    // 位置：安全区比例（0–1），不是来源的像素微调。
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
