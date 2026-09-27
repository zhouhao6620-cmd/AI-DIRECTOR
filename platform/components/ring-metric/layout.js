// Source geometry copied from the Overlay Studio RingMetric source (read-only):
//   src/effects/hud/RingMetric.tsx → `.rm` markup, `R = 140`, `C = 2πR`, `strokeWidth 14`,
//                                    `useProgress(1100)` ring + number ramp, ratio = value / max
//   src/effects/hud/hud.css        → `.rm-*` rules (320 px ring, 92 px mono number, accent stroke)
//   src/effects/hud/accent.ts      → ACCENT_VAR mapping (blue / alert / orange)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-04A_SOURCE_STYLE_ADAPTATION.md):
//   1. the number inside the ring is measured against the ring's inner width and shrinks to a floor,
//      then is refused — the source would simply let it run over the ring;
//   2. the card is placed by the project's 0–1 safe-area ratio instead of the fixed right anchor;
//   3. `value` must not exceed `max`, so the ring can never silently clamp a wrong ratio.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  ringSize: 320,
  ringRadius: 140,
  strokeWidth: 14,
  gap: 26,
  kickerFontSize: 20,
  kickerFontWeight: 600,
  kickerLetterSpacingEm: 0.2,
  numFontSize: 92,
  numFontWeight: 300,
  numLetterSpacingEm: -0.02,
  unitFontSize: 40,
  unitMarginLeft: 4,
  labelFontSize: 26,
  lineHeight: 1.2,
  anchorX: 120,
  maxValue: 1000,
});

export const SOURCE_MOTION = Object.freeze({
  progressMs: 1100,
});

export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const EASE_SOURCE = Object.freeze([0.22, 1, 0.36, 1]);
export const MIN_NUM_FONT_SIZE = 20;
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export const RING_CIRCUMFERENCE = 2 * Math.PI * SOURCE_GEOMETRY.ringRadius;

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function formatNumber(value, decimals = 0) {
  return value.toLocaleString("en-US", {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
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

// Source: `ratio = Math.max(0, Math.min(1, value / (max || 1)))`.
export function ratioOf(value, max) {
  return Math.max(0, Math.min(1, value / (max || 1)));
}

// Source: `strokeDashoffset={C * (1 - ratio)}` from a full circumference at rest.
export function dashOffsetOf(ratio, progress = 1) {
  return RING_CIRCUMFERENCE * (1 - ratio * progress);
}

export function calculateRingMetricLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const gap = SOURCE_GEOMETRY.gap * factor;
  const overflow = [];

  const fitText = (text, fontSize, fontWeight, letterSpacing, maxWidth, id, kind, floor = MIN_TEXT_FONT_SIZE) => {
    const natural = textWidth(measure, text, fontSize, fontWeight, letterSpacing);
    let resolved = {fontSize, letterSpacing, width: natural};
    if (natural > maxWidth) {
      const scaled = Math.max(floor * canvasScale, fontSize * (maxWidth / natural));
      const ratio = scaled / fontSize;
      resolved = {fontSize: scaled, letterSpacing: letterSpacing * ratio, width: textWidth(measure, text, scaled, fontWeight, letterSpacing * ratio)};
    }
    if (resolved.width > maxWidth + 0.5) overflow.push({id, kind, text, available: maxWidth, required: resolved.width});
    return resolved;
  };

  const ringSize = SOURCE_GEOMETRY.ringSize * factor;
  const strokeWidth = SOURCE_GEOMETRY.strokeWidth * factor;
  const unitMarginLeft = content.unit ? SOURCE_GEOMETRY.unitMarginLeft * factor : 0;
  const kicker = content.kicker
    ? fitText(content.kicker, SOURCE_GEOMETRY.kickerFontSize * factor, SOURCE_GEOMETRY.kickerFontWeight,
      SOURCE_GEOMETRY.kickerFontSize * factor * SOURCE_GEOMETRY.kickerLetterSpacingEm, availableWidth, "kicker", "小标签")
    : null;
  const label = content.label
    ? fitText(content.label, SOURCE_GEOMETRY.labelFontSize * factor, 400, 0, availableWidth, "label", "说明文字")
    : null;
  const unit = content.unit
    ? fitText(content.unit, SOURCE_GEOMETRY.unitFontSize * factor, 400, 0, ringSize - strokeWidth * 2, "unit", "单位")
    : null;

  // The number lives inside the ring, so it has to fit the ring's inner width, not the card.
  // Only the number scales down — the unit keeps its own source size — so the shrink is computed
  // against the width that is actually left for the digits.
  const decimals = content.decimals ?? (Number.isInteger(content.value) ? 0 : 1);
  const numberText = formatNumber(content.value, decimals);
  const innerWidth = ringSize - strokeWidth * 2;
  const numFontSize = SOURCE_GEOMETRY.numFontSize * factor;
  const numLetterSpacing = numFontSize * SOURCE_GEOMETRY.numLetterSpacingEm;
  const unitBlock = unit ? unitMarginLeft + unit.width : 0;
  const naturalNumWidth = textWidth(measure, numberText, numFontSize, SOURCE_GEOMETRY.numFontWeight, numLetterSpacing);
  const availableForNumber = innerWidth - unitBlock;
  const ratio = availableForNumber <= 0 || naturalNumWidth <= availableForNumber
    ? (availableForNumber <= 0 ? MIN_NUM_FONT_SIZE * canvasScale / numFontSize : 1)
    : Math.max(MIN_NUM_FONT_SIZE * canvasScale / numFontSize, availableForNumber / naturalNumWidth);
  const resolvedNumFontSize = numFontSize * ratio;
  const numberWidth = textWidth(measure, numberText, resolvedNumFontSize, SOURCE_GEOMETRY.numFontWeight,
    resolvedNumFontSize * SOURCE_GEOMETRY.numLetterSpacingEm) + unitBlock;
  if (numberWidth > innerWidth + 0.5) {
    overflow.push({id: "value", kind: "环内数字", text: `${numberText}${content.unit ?? ""}`, available: innerWidth, required: numberWidth});
  }

  const rows = [
    kicker && {kind: "kicker", height: kicker.fontSize * SOURCE_GEOMETRY.lineHeight, width: kicker.width},
    {kind: "ring", height: ringSize, width: ringSize},
    label && {kind: "label", height: label.fontSize * SOURCE_GEOMETRY.lineHeight, width: label.width},
  ].filter(Boolean);
  const cardWidth = Math.max(...rows.map(row => row.width));
  const cardHeight = rows.reduce((sum, row) => sum + row.height, 0) + gap * (rows.length - 1);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进安全区域：${overflow.map(item => item.text).join("、")}。请缩短文字或调小大小。`;
  } else if (cardHeight > availableHeight + 0.5) {
    rejection = `环形指标卡高度 ${Math.round(cardHeight)} px 超出安全区域 ${Math.round(availableHeight)} px。请减少说明文字或调小大小。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    cardWidth, cardHeight, gap, rows, kicker, label, unit, decimals, numberText,
    ratio: ratioOf(content.value, content.max),
    ringSize, strokeWidth, ringRadius: SOURCE_GEOMETRY.ringRadius * factor, innerWidth,
    numFontSize: resolvedNumFontSize, unitMarginLeft,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
