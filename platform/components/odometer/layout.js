// Source geometry copied from the Overlay Studio Odometer source (read-only):
//   src/effects/hud/Odometer.tsx → `.od` markup, `String(Math.max(0, Math.round(value)))` digits,
//                                  per-digit `transitionDelay: (chars.length - i) * 110` ms
//   src/effects/hud/hud.css     → `.od-*` rules (150 px mono slot, 1.15 em reel, accent unit)
//   src/effects/hud/accent.ts   → ACCENT_VAR mapping (blue / alert / orange)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-04A_SOURCE_STYLE_ADAPTATION.md):
//   1. the value must already be a non-negative integer — the source calls `Math.round(value)`, which
//      would silently change 12.5 into 13;
//   2. the digit row is measured, so a long number shrinks to a floor and is refused below it,
//      instead of running out of the safe area;
//   3. the card is placed by the project's 0–1 safe-area ratio instead of the fixed anchor.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  gap: 16,
  kickerFontSize: 20,
  kickerFontWeight: 600,
  kickerLetterSpacingEm: 0.22,
  slotHeightEm: 1.15,
  slotFontSize: 150,
  slotFontWeight: 300,
  rowGap: 6,
  unitFontSize: 56,
  unitFontWeight: 600,
  unitMarginLeft: 8,
  labelFontSize: 26,
  lineHeight: 1.2,
  anchorX: 120,
  maxValue: 99999,
});

export const SOURCE_MOTION = Object.freeze({
  reelMs: 900,
  digitDelayMs: 110,
});

export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

// `.od-reel { transition: transform 900ms cubic-bezier(0.2, 0.85, 0.25, 1) }`.
export const EASE_REEL = Object.freeze([0.2, 0.85, 0.25, 1]);
export const MIN_SLOT_FONT_SIZE = 24;
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export const DIGITS = Object.freeze("0123456789".split(""));

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

// Source: `String(Math.max(0, Math.round(value)))`.
export function digitStringOf(value) {
  return String(Math.max(0, Math.round(value)));
}

// Source: `transitionDelay: (chars.length - i) * 110` — the most significant digit settles last.
export function digitDelayMs(index, length) {
  return (length - index) * SOURCE_MOTION.digitDelayMs;
}

// The whole reel has to finish inside the instance, otherwise the odometer freezes on a wrong digit.
export function lastDigitSettleMs(length) {
  return digitDelayMs(0, length) + SOURCE_MOTION.reelMs;
}

export function calculateOdometerLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure, minSlotFontSize = MIN_SLOT_FONT_SIZE}) {
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

  const digits = digitStringOf(content.value).split("");
  const kicker = content.kicker
    ? fitText(content.kicker, SOURCE_GEOMETRY.kickerFontSize * factor, SOURCE_GEOMETRY.kickerFontWeight,
      SOURCE_GEOMETRY.kickerFontSize * factor * SOURCE_GEOMETRY.kickerLetterSpacingEm, availableWidth, "kicker", "小标签")
    : null;
  const unit = content.unit
    ? fitText(content.unit, SOURCE_GEOMETRY.unitFontSize * factor, SOURCE_GEOMETRY.unitFontWeight, 0, availableWidth, "unit", "单位")
    : null;
  const label = content.label
    ? fitText(content.label, SOURCE_GEOMETRY.labelFontSize * factor, 400, 0, availableWidth, "label", "说明文字")
    : null;

  // The digit row shrinks as a whole: slot advance, gaps and the accent unit are one measured line.
  const slotFontSize = SOURCE_GEOMETRY.slotFontSize * factor;
  const rowGap = SOURCE_GEOMETRY.rowGap * factor;
  const unitMarginLeft = unit ? SOURCE_GEOMETRY.unitMarginLeft * factor : 0;
  const gapWidth = rowGap * Math.max(0, digits.length - 1);
  const unitBlock = unit ? unitMarginLeft + unit.width : 0;
  const naturalDigitWidth = digits.length * textWidth(measure, "0", slotFontSize, SOURCE_GEOMETRY.slotFontWeight, 0);
  // Only the digit slots scale down — the unit keeps its own source size.
  const availableForDigits = availableWidth - gapWidth - unitBlock;
  const ratio = availableForDigits <= 0 || naturalDigitWidth <= availableForDigits
    ? (availableForDigits <= 0 ? minSlotFontSize * canvasScale / slotFontSize : 1)
    : Math.max(minSlotFontSize * canvasScale / slotFontSize, availableForDigits / naturalDigitWidth);
  const resolvedSlotFontSize = slotFontSize * ratio;
  const slotWidth = textWidth(measure, "0", resolvedSlotFontSize, SOURCE_GEOMETRY.slotFontWeight, 0);
  const rowWidth = digits.length * slotWidth + gapWidth + unitBlock;
  if (rowWidth > availableWidth + 0.5) {
    overflow.push({id: "value", kind: "数字行", text: digitStringOf(content.value), available: availableWidth, required: rowWidth});
  }

  const slotHeight = SOURCE_GEOMETRY.slotHeightEm * resolvedSlotFontSize;
  const rows = [
    kicker && {kind: "kicker", height: kicker.fontSize * SOURCE_GEOMETRY.lineHeight, width: kicker.width},
    {kind: "row", height: slotHeight, width: rowWidth},
    label && {kind: "label", height: label.fontSize * SOURCE_GEOMETRY.lineHeight, width: label.width},
  ].filter(Boolean);
  const cardWidth = Math.max(...rows.map(row => row.width));
  const cardHeight = rows.reduce((sum, row) => sum + row.height, 0) + gap * (rows.length - 1);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进安全区域：${overflow.map(item => item.text).join("、")}。请缩短文字或调小大小。`;
  } else if (cardHeight > availableHeight + 0.5) {
    rejection = `整数计数卡高度 ${Math.round(cardHeight)} px 超出安全区域 ${Math.round(availableHeight)} px。请减少说明文字或调小大小。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    cardWidth, cardHeight, gap, rowGap, rows, kicker, unit, label, digits,
    slotFontSize: resolvedSlotFontSize, slotWidth, slotHeight, unitMarginLeft,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
