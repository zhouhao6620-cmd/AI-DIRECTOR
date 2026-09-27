// Source geometry copied from the RemotionUI pie-slice-reveal source (read-only):
//   registry/bases/default/primitives/pie-slice-reveal.tsx
//     size 380 / DEFAULT_COLORS（琥珀 · 青 · 粉 · 靛 · 橙）
//     radius = (size / 2) × (1 − explode × 1.6)，explode 0.04，gapInDegrees 1.4
//     label: 位于 0.66 × radius 的角平分线上，字号 = size × 0.058，progress > 0.7 才出现
//     wedge: 从十二点钟起顺时针，`wedgePath` 用 A 命令画弧（整圆拆两段半弧）
//     motion: durationInFrames 24 / staggerInFrames 14（30 fps）→ 800 ms / 467 ms
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter（0.16, 1, 0.3, 1）
//
// Adaptations performed here（详见 docs/component-assets/CMP-06_BATCH_B_QA_REPORT.md）：
//   1. 来源只在扇区内画百分比，观众无法把扇区对应到数据 → 本组件补一条图例（色点 + 名称 + 数值）；
//   2. 扇区太窄时来源会把百分比画到扇区外面：本组件按「标签出现那一帧的真实弦长」实测，
//      放不下就缩到 12 px 下限，仍放不下则拒绝，并把最小占比写进内容校验（≥6%）；
//   3. 圆周/角度数学（polar / wedgePath）与来源逐行一致，缩放只发生在视图层；
//   4. 不排入退场：来源的 exitAtInFrames 由片段时序决定，本组件落定后保持不变。

import {formatCompactNumber} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  pieSize: 380,
  explode: 0.04,
  gapInDegrees: 1.4,
  labelRadiusRatio: 0.66,
  labelFontRatio: 0.058,
  labelFontWeight: 700,
  legendGapRatio: 0.06,
  legendDotRatio: 0.05,
  legendInnerGapRatio: 0.045,
  legendLabelBoxRatio: 0.42,
  legendValueBoxRatio: 0.36,
  legendRowGapRatio: 0.055,
  legendFontRatio: 0.062,
  legendLineHeight: 1.6,
  labelOnColor: "#0b0b10",
});

export const SOURCE_MOTION = Object.freeze({
  // 来源 24 帧一段的扫过时长；stagger 14 帧。
  sweepMs: 800,
  staggerMs: 467,
  labelFadeStart: 0.7,
  labelFadeWindow: 0.3,
  sourceSweepFrames: 24,
  sourceStaggerFrames: 14,
  sourceFps: 30,
});

// 实测出来的内容下限：低于这个占比，扇区在「标签刚出现」的那一帧放不下自己的百分比。
export const MIN_SLICE_SHARE = 0.06;

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

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

export function progressAt({frame, fps, delayMs = 0, durationMs, ease = value => value}) {
  const start = (delayMs / 1000) * fps;
  const span = Math.max(1, (durationMs / 1000) * fps);
  const t = Math.min(1, Math.max(0, (frame - start) / span));
  return ease(t);
}

/** 来源整段动画窗口：最后一片扫过结束的时刻（毫秒）。 */
export function totalSweepMs(sliceCount) {
  return Math.max(0, sliceCount - 1) * SOURCE_MOTION.staggerMs + SOURCE_MOTION.sweepMs;
}

/** 来源 `polar`：从十二点钟起顺时针的角度 → 直角坐标。 */
export function polar(cx, cy, radius, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians)};
}

/** 来源 `wedgePath`：`startAngle → endAngle` 的实心扇形，整圆拆成两段半弧。 */
export function wedgePath(cx, cy, radius, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return "";
  if (sweep >= 359.999) {
    const top = polar(cx, cy, radius, 0);
    const bottom = polar(cx, cy, radius, 180);
    return `M ${top.x} ${top.y} A ${radius} ${radius} 0 1 1 ${bottom.x} ${bottom.y} A ${radius} ${radius} 0 1 1 ${top.x} ${top.y} Z`;
  }
  const start = polar(cx, cy, radius, startAngle);
  const end = polar(cx, cy, radius, endAngle);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/** 扇区在某个半径处、某个扫过角度下的弦长——文字能不能放进去就看它。 */
export function chordAt(labelRadius, sweepDegrees) {
  if (sweepDegrees <= 0) return 0;
  const half = Math.min(180, sweepDegrees / 2);
  return 2 * labelRadius * Math.sin((half * Math.PI) / 180);
}

export function calculatePieSliceRevealLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
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

  const pieSize = SOURCE_GEOMETRY.pieSize * factor;
  const radius = (pieSize / 2) * (1 - SOURCE_GEOMETRY.explode * 1.6);
  const centre = pieSize / 2;
  const labelRadius = radius * SOURCE_GEOMETRY.labelRadiusRatio;
  const labelFont = pieSize * SOURCE_GEOMETRY.labelFontRatio;
  const total = content.slices.reduce((sum, slice) => sum + slice.value, 0);

  let cumulative = 0;
  const slices = content.slices.map((slice, index) => {
    const fraction = total > 0 ? slice.value / total : 0;
    const startAngle = cumulative * 360;
    const span = fraction * 360;
    cumulative += fraction;
    const percentText = `${Math.round(fraction * 100)}%`;
    // 标签在 progress > 0.7 时出现，那一帧的扇区最窄，是真正的容量边界。
    const sweptAtLabel = Math.max(0, span * SOURCE_MOTION.labelFadeStart - SOURCE_GEOMETRY.gapInDegrees);
    const label = fitText(
      percentText, labelFont, SOURCE_GEOMETRY.labelFontWeight, 0,
      chordAt(labelRadius, sweptAtLabel), `slice-${index}`, "扇区内百分比",
    );
    return {
      id: slice.id, label: slice.label, value: slice.value, color: slice.color ?? null,
      fraction, startAngle, span, percentText,
      labelFontSize: label.fontSize,
      labelRadius,
    };
  });

  const showLegend = content.showLegend !== false;
  const legendGap = pieSize * SOURCE_GEOMETRY.legendGapRatio;
  const legendDot = pieSize * SOURCE_GEOMETRY.legendDotRatio;
  const legendInnerGap = pieSize * SOURCE_GEOMETRY.legendInnerGapRatio;
  const legendRowGap = pieSize * SOURCE_GEOMETRY.legendRowGapRatio;
  const legendFont = pieSize * SOURCE_GEOMETRY.legendFontRatio;
  const labelBox = pieSize * SOURCE_GEOMETRY.legendLabelBoxRatio;
  const valueBox = pieSize * SOURCE_GEOMETRY.legendValueBoxRatio;
  const legendRows = slices.map((slice, index) => {
    const name = fitText(slice.label, legendFont, 600, 0, labelBox, `legend-${index}`, "图例名称");
    const valueText = formatCompactNumber(slice.value);
    const value = fitText(valueText, legendFont, 600, 0, valueBox, `legend-value-${index}`, "图例数值");
    return {...slice, valueText, nameFontSize: name.fontSize, valueFontSize: value.fontSize};
  });

  const legendWidth = showLegend ? legendDot + legendInnerGap + labelBox + legendInnerGap + valueBox : 0;
  const legendHeight = showLegend
    ? slices.length * legendFont * SOURCE_GEOMETRY.legendLineHeight + Math.max(0, slices.length - 1) * legendRowGap
    : 0;
  const cardWidth = Math.max(pieSize, legendWidth);
  const cardHeight = pieSize + (showLegend ? legendGap + legendHeight : 0);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进各自的版面槽位：${overflow.map(item => item.text).join("、")}。请缩短文字、减少分片或加大分片占比。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    pieSize, radius, centre, labelRadius, labelFont, gapInDegrees: SOURCE_GEOMETRY.gapInDegrees,
    explode: SOURCE_GEOMETRY.explode, showLabels: content.showLabels !== false, showLegend,
    slices, legendRows, legendGap, legendDot, legendInnerGap, legendRowGap, legendFont,
    legendLineHeight: SOURCE_GEOMETRY.legendLineHeight, labelBox, valueBox, total,
    cardWidth, cardHeight,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
