// Source geometry copied from the Overlay Studio StatProof source (read-only):
//   src/effects/hud/StatProof.tsx → .spf-box anatomy (kicker + bar / 中文小注 / 巨号数字 / 双语注脚)
//   src/effects/hud/hud.css      → `.spf-*` rules, `.hud-anchor--*` placement, `.spf-num` breathing
//   src/effects/hud/accent.ts    → ACCENT_VAR mapping (blue / alert / orange)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-04A_SOURCE_STYLE_ADAPTATION.md):
//   1. every row is measured, so no row can overflow the safe area; the source lets the browser
//      lay the column out freely,
//   2. the card is placed by the project's 0–1 safe-area ratio instead of the fixed
//      120 px anchor,
//   3. the 150 px number shrinks to a readable floor when the value is long instead of pushing
//      outside the safe area, and is refused when it still does not fit,
//   4. the source formats integers with 0 decimals and everything else with 1 decimal, which
//      silently rounds 3-decimal data; here that case is refused instead.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  gap: 6,
  barWidth: 5,
  barHeight: 20,
  kickerGap: 10,
  kickerFontSize: 19,
  kickerFontWeight: 600,
  kickerLetterSpacingEm: 0.14,
  kickerZhFontSize: 20,
  kickerZhLetterSpacingEm: 0.06,
  numFontSize: 150,
  numFontWeight: 900,
  numLineHeight: 1.02,
  numLetterSpacingEm: 0.01,
  suffixScale: 0.62,
  suffixRaiseEm: 0.28,
  footEnFontSize: 18,
  footEnFontWeight: 600,
  footEnLetterSpacingEm: 0.16,
  footEnMarginTop: 4,
  footZhFontSize: 20,
  footZhLetterSpacingEm: 0.05,
  lineHeight: 1.2,
  anchorX: 120,
});

export const SOURCE_MOTION = Object.freeze({
  boxOpacityMs: 600,
  boxTransformMs: 700,
  boxRisePx: 24,
  defaultCountMs: 1600,
  countMsRange: {min: 400, max: 5000},
  breathDelayMs: 1400,
  breathPeriodMs: 2800,
  breathMaxBrightness: 1.12,
  breathShadowPx: 9,
});

export const MONO_FONT_FAMILY = '"IBM Plex Mono", ui-monospace, "SF Mono", monospace';
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

export const MIN_NUM_FONT_SIZE = 14;
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

// `.hud { --ease: cubic-bezier(0.22, 1, 0.36, 1) }` and CSS `ease`, replayed frame by frame.
export const EASE_SOURCE = Object.freeze([0.22, 1, 0.36, 1]);
export const EASE_CSS_EASE = Object.freeze([0.25, 0.1, 0.25, 1]);

// `useCountUp` in the source is an ease-out-expo ramp: 1 - 2^(-10t).
export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Source: `const decimals = Number.isInteger(target) ? 0 : 1` + toLocaleString("en-US").
export function decimalsOf(value) {
  return Number.isInteger(value) ? 0 : 1;
}

export function formatNumber(value, decimals = decimalsOf(value)) {
  return value.toLocaleString("en-US", {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

// The source's format only has 0 or 1 decimal place, so anything finer would be silently rounded.
export function hasTooManyDecimals(value) {
  return Math.abs(value * 10 - Math.round(value * 10)) > 1e-9;
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

// CSS `animation: … 2.8s ease-in-out 1.4s infinite alternate` → a 0→1→0 triangle wave that
// starts after the delay. Returned as a phase, so the caller can drive brightness and glow.
export function breathePhase({frame, fps, delayMs = SOURCE_MOTION.breathDelayMs, periodMs = SOURCE_MOTION.breathPeriodMs}) {
  const elapsed = (frame / fps) * 1000 - delayMs;
  if (elapsed <= 0) return 0;
  const cycle = periodMs * 2;
  const position = elapsed % cycle;
  return position < periodMs ? position / periodMs : (cycle - position) / periodMs;
}

// How many digits the safe area holds at the source's 150 px size (`designCapacity`), and how many
// it holds once the number has been shrunk to the readable floor (`floorCapacity`).
export function numberCapacityFor({width, height, size = 1, measure, probe = "0", minFontSize = MIN_NUM_FONT_SIZE}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const available = width - width * SAFE_X_RATIO * 2;
  const unitWidth = fontSize => textWidth(measure, probe, fontSize, SOURCE_GEOMETRY.numFontWeight,
    [...probe].length * fontSize * SOURCE_GEOMETRY.numLetterSpacingEm);
  const designUnit = unitWidth(SOURCE_GEOMETRY.numFontSize * factor);
  const floorUnit = unitWidth(minFontSize * canvasScale);
  return {
    available, factor,
    designUnit, designCapacity: Math.max(1, Math.floor(available / designUnit)),
    floorUnit, floorCapacity: Math.max(1, Math.floor(available / floorUnit)),
  };
}

export function calculateStatProofLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const gap = SOURCE_GEOMETRY.gap * factor;
  const overflow = [];

  const fitText = (text, fontSize, fontWeight, letterSpacing, maxWidth, id, kind, floor) => {
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

  const kicker = fitText(content.kicker, SOURCE_GEOMETRY.kickerFontSize * factor, SOURCE_GEOMETRY.kickerFontWeight,
    SOURCE_GEOMETRY.kickerFontSize * factor * SOURCE_GEOMETRY.kickerLetterSpacingEm,
    availableWidth - (SOURCE_GEOMETRY.barWidth + SOURCE_GEOMETRY.kickerGap) * factor, "kicker", "kicker", MIN_TEXT_FONT_SIZE);
  const kickerZh = content.kickerZh
    ? fitText(content.kickerZh, SOURCE_GEOMETRY.kickerZhFontSize * factor, 400,
      SOURCE_GEOMETRY.kickerZhFontSize * factor * SOURCE_GEOMETRY.kickerZhLetterSpacingEm, availableWidth, "kickerZh", "中文小注", MIN_TEXT_FONT_SIZE)
    : null;
  const footEn = content.footEn
    ? fitText(content.footEn, SOURCE_GEOMETRY.footEnFontSize * factor, SOURCE_GEOMETRY.footEnFontWeight,
      SOURCE_GEOMETRY.footEnFontSize * factor * SOURCE_GEOMETRY.footEnLetterSpacingEm, availableWidth, "footEn", "注脚", MIN_TEXT_FONT_SIZE)
    : null;
  const footZh = content.footZh
    ? fitText(content.footZh, SOURCE_GEOMETRY.footZhFontSize * factor, 400,
      SOURCE_GEOMETRY.footZhFontSize * factor * SOURCE_GEOMETRY.footZhLetterSpacingEm, availableWidth, "footZh", "中文注脚", MIN_TEXT_FONT_SIZE)
    : null;

  // The giant number is one line: prefix + grouped digits + suffix. It shrinks to the 14 px floor
  // and is refused below that, never clipped and never wrapped.
  const decimals = decimalsOf(content.value);
  const numberText = formatNumber(content.value, decimals);
  const numFontSize = SOURCE_GEOMETRY.numFontSize * factor;
  const letterSpacing = numFontSize * SOURCE_GEOMETRY.numLetterSpacingEm;
  const parts = [
    {kind: "prefix", text: content.prefix ?? "", scale: 1},
    {kind: "number", text: numberText, scale: 1},
    {kind: "suffix", text: content.suffix ?? "", scale: SOURCE_GEOMETRY.suffixScale},
  ].filter(part => part.text);
  const naturalWidth = parts.reduce((sum, part) => sum + textWidth(measure, part.text, numFontSize * part.scale, SOURCE_GEOMETRY.numFontWeight, letterSpacing * part.scale), 0);
  const ratio = naturalWidth > availableWidth ? Math.max(MIN_NUM_FONT_SIZE * canvasScale / numFontSize, availableWidth / naturalWidth) : 1;
  const resolvedNumFontSize = numFontSize * ratio;
  const numberWidth = parts.reduce((sum, part) => sum + textWidth(measure, part.text, resolvedNumFontSize * part.scale, SOURCE_GEOMETRY.numFontWeight, resolvedNumFontSize * SOURCE_GEOMETRY.numLetterSpacingEm * part.scale), 0);
  if (numberWidth > availableWidth + 0.5) {
    overflow.push({id: "value", kind: "核心数字", text: `${content.prefix ?? ""}${numberText}${content.suffix ?? ""}`, available: availableWidth, required: numberWidth});
  }

  const kickerBarWidth = SOURCE_GEOMETRY.barWidth * factor;
  const kickerBarHeight = SOURCE_GEOMETRY.barHeight * factor;
  const rows = [
    {kind: "kicker", height: Math.max(kickerBarHeight, kicker.fontSize * SOURCE_GEOMETRY.lineHeight), width: kickerBarWidth + SOURCE_GEOMETRY.kickerGap * factor + kicker.width},
    kickerZh && {kind: "kickerZh", height: kickerZh.fontSize * SOURCE_GEOMETRY.lineHeight, width: kickerZh.width},
    {kind: "number", height: resolvedNumFontSize * SOURCE_GEOMETRY.numLineHeight, width: numberWidth},
    footEn && {kind: "footEn", height: footEn.fontSize * SOURCE_GEOMETRY.lineHeight, width: footEn.width, marginTop: SOURCE_GEOMETRY.footEnMarginTop * factor},
    footZh && {kind: "footZh", height: footZh.fontSize * SOURCE_GEOMETRY.lineHeight, width: footZh.width},
  ].filter(Boolean);

  const cardWidth = Math.max(...rows.map(row => row.width));
  const cardHeight = rows.reduce((sum, row) => sum + row.height + (row.marginTop ?? 0), 0) + gap * (rows.length - 1);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进安全区域：${overflow.map(item => item.text).join("、")}。请缩短文字或调小大小。`;
  } else if (cardHeight > availableHeight + 0.5) {
    rejection = `数据实证卡高度 ${Math.round(cardHeight)} px 超出安全区域 ${Math.round(availableHeight)} px。请减少注脚或调小大小。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    cardWidth, cardHeight, gap, rows, kicker, kickerZh, footEn, footZh, decimals, numberText,
    kickerBarWidth, kickerBarHeight, kickerGap: SOURCE_GEOMETRY.kickerGap * factor,
    numFontSize: resolvedNumFontSize, numLetterSpacing: resolvedNumFontSize * SOURCE_GEOMETRY.numLetterSpacingEm,
    suffixFontSize: resolvedNumFontSize * SOURCE_GEOMETRY.suffixScale,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
