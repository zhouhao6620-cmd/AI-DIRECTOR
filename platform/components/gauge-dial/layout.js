// Source geometry copied from the RemotionUI gauge-dial source (read-only):
//   registry/bases/default/primitives/gauge-dial.tsx
//     size 360 / thickness 26 / sweepInDegrees 250（以十二点钟为中心，两侧各 125°）
//     radius = (size − thickness) / 2 = 167；指针 tip = radius − thickness × 0.55，tail = thickness × 0.5
//     ticks: tickCount 9，刻度线从 radius − thickness × 0.72 到 radius − thickness × 1.05；越过的刻度更亮（0.85 / 0.35）
//     hub: 外圈 r = size × 0.038（墨色）、内圈 r = size × 0.016（强调色）
//     readout: top = size × 0.62 居中，字号 = size × 0.14，单位同字号；标签字号 = size × 0.055，
//              字距 0.06 em，上边距 = size × 0.028
//     motion: durationInFrames 44（30 fps）→ 1467 ms；弧用 EASING.enter，指针用 EASING.pop（带过冲）
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter（0.16, 1, 0.3, 1）/ EASING.pop（0.34, 1.56, 0.64, 1）
//
// Adaptations performed here（详见 docs/component-assets/CMP-06_BATCH_B_QA_REPORT.md）：
//   1. 来源把读数一律取整（Math.round），会静默改数——本组件按内容自己的精度显示（最多 2 位小数）；
//   2. 来源把超出量程的数值裁到 0 / max（clamp01），会掩盖错误——本组件明确拒绝；
//   3. 来源 tickCount = 1 时 `index / (tickCount − 1)` 是除零（NaN 坐标）——本组件把 1 列为非法值；
//   4. 读数与标签按可读宽度实测（先缩到 12 px 下限，仍放不下则拒绝），中文标签不做大写变换；
//   5. 位置改为安全区 0–1 比例；不排入退场（来源的 exitAtInFrames 由片段时序决定）。

export const SOURCE_GEOMETRY = Object.freeze({
  dialSize: 360,
  thickness: 26,
  sweepDegrees: 250,
  defaultTickCount: 9,
  maxTickCount: 12,
  tickOuterInset: 0.72,
  tickInnerInset: 1.05,
  tickWidthRatio: 0.007,
  tickPassedOpacity: 0.85,
  tickIdleOpacity: 0.35,
  needleTipInset: 0.55,
  needleTailRatio: 0.5,
  needleWidthRatio: 0.018,
  hubOuterRatio: 0.038,
  hubInnerRatio: 0.016,
  readoutTopRatio: 0.62,
  readoutFontRatio: 0.14,
  readoutFontWeight: 700,
  readoutBoxRatio: 0.94,
  labelFontRatio: 0.055,
  labelFontWeight: 600,
  labelLetterSpacingEm: 0.06,
  labelMarginRatio: 0.028,
});

export const SOURCE_MOTION = Object.freeze({
  // 来源 durationInFrames 44（30 fps）。
  sweepMs: 1467,
  sourceSweepFrames: 44,
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

// 数值口径（与同批其它数据组件一致）：最多 2 位小数，超出即拒绝，不静默取整。
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

export function progressAt({frame, fps, delayMs = 0, durationMs, ease = value => value}) {
  const start = (delayMs / 1000) * fps;
  const span = Math.max(1, (durationMs / 1000) * fps);
  const t = Math.min(1, Math.max(0, (frame - start) / span));
  return ease(t);
}

/** 来源 `polar`：从十二点钟起顺时针的角度 → 直角坐标。 */
export function polar(cx, cy, radius, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians)};
}

/** 来源 `arcPath`：开放圆弧（描边用），不是扇形。 */
export function arcPath(cx, cy, radius, startAngle, endAngle) {
  if (endAngle - startAngle <= 0.001) return "";
  const start = polar(cx, cy, radius, startAngle);
  const end = polar(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** 量程比例：来源用 clamp01 静默裁剪；这里只做数学，越界由内容校验拒绝。 */
export function targetRatio(value, min, max) {
  const span = max - min || 1;
  return clamp01((value - min) / span);
}

export function calculateGaugeDialLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
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

  const min = content.min ?? 0;
  const max = content.max ?? 100;
  const decimals = Math.max(decimalsOf(min) ?? 0, decimalsOf(max) ?? 0, decimalsOf(content.value) ?? 0);
  const dialSize = SOURCE_GEOMETRY.dialSize * factor;
  const thickness = SOURCE_GEOMETRY.thickness * factor;
  const radius = (dialSize - thickness) / 2;
  const startAngle = -SOURCE_GEOMETRY.sweepDegrees / 2;
  const readoutBox = dialSize * SOURCE_GEOMETRY.readoutBoxRatio;
  // 读数会一路计数到目标值，所以按「最终文案」实测宽度，整段动画共用一个字号。
  const valueText = `${formatNumber(content.value, decimals)}${content.unit ?? ""}`;
  const readout = fitText(valueText, dialSize * SOURCE_GEOMETRY.readoutFontRatio, SOURCE_GEOMETRY.readoutFontWeight, 0, readoutBox, "readout", "仪表读数");
  const label = content.label
    ? fitText(
      content.label, dialSize * SOURCE_GEOMETRY.labelFontRatio, SOURCE_GEOMETRY.labelFontWeight,
      dialSize * SOURCE_GEOMETRY.labelFontRatio * SOURCE_GEOMETRY.labelLetterSpacingEm, readoutBox, "label", "仪表标签",
    )
    : null;

  const cardWidth = dialSize;
  const cardHeight = dialSize;
  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进读数区：${overflow.map(item => item.text).join("、")}。请缩短数值、单位或标签。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    dialSize, thickness, radius, startAngle, endAngle: SOURCE_GEOMETRY.sweepDegrees / 2,
    sweepDegrees: SOURCE_GEOMETRY.sweepDegrees,
    target: targetRatio(content.value, min, max), min, max, decimals, valueText,
    readout, label, readoutBox,
    tickCount: content.tickCount ?? SOURCE_GEOMETRY.defaultTickCount,
    tickOuter: radius - thickness * SOURCE_GEOMETRY.tickOuterInset,
    tickInner: radius - thickness * SOURCE_GEOMETRY.tickInnerInset,
    tickWidth: dialSize * SOURCE_GEOMETRY.tickWidthRatio,
    needleTip: radius - thickness * SOURCE_GEOMETRY.needleTipInset,
    needleTail: thickness * SOURCE_GEOMETRY.needleTailRatio,
    needleWidth: dialSize * SOURCE_GEOMETRY.needleWidthRatio,
    hubOuter: dialSize * SOURCE_GEOMETRY.hubOuterRatio,
    hubInner: dialSize * SOURCE_GEOMETRY.hubInnerRatio,
    readoutTop: dialSize * SOURCE_GEOMETRY.readoutTopRatio,
    labelMarginTop: dialSize * SOURCE_GEOMETRY.labelMarginRatio,
    cardWidth, cardHeight,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
