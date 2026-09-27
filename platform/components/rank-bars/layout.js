// Source geometry copied from the Overlay Studio RankBars source (read-only):
//   src/effects/hud/RankBars.tsx → `.rb` rows (name + value head, track + fill), `STAGGER = 140`,
//                                  `useProgress(1400)` value ramp, `row.value / max` fill fraction
//   src/effects/hud/hud.css      → `.rb-*` rules (560 px min width, 6 px track, top row accent)
//   src/effects/hud/accent.ts    → ACCENT_VAR mapping (blue / alert / orange)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-04A_SOURCE_STYLE_ADAPTATION.md):
//   1. the value is no longer `Math.round(row.value * progress)`: integers stay integers, and up to
//      two decimals are drawn, so a decimal figure is no longer silently rounded to a whole number;
//   2. name and value are measured, so a long label shrinks to a floor and is then refused instead
//      of colliding with the value or leaving the safe area;
//   3. the card is placed by the project's 0–1 safe-area ratio instead of the fixed left anchor.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  minWidth: 560,
  rowMarginBottom: 24,
  headMarginBottom: 11,
  nameFontSize: 27,
  nameFontWeight: 500,
  valueFontSize: 32,
  valueFontWeight: 600,
  trackHeight: 6,
  trackRadius: 6,
  headGap: 16,
  lineHeight: 1.2,
  anchorX: 120,
  maxRows: 6,
});

export const SOURCE_MOTION = Object.freeze({
  staggerMs: 140,
  rowFadeMs: 560,
  rowRisePx: 12,
  fillMs: 900,
  valueRampMs: 1400,
});

export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const EASE_SOURCE = Object.freeze([0.22, 1, 0.36, 1]);
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Up to two decimals are drawn; anything finer is refused instead of silently rounded.
export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return null;
}

export function formatNumber(value, decimals = decimalsOf(value) ?? 0) {
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

// Source: the row entrance and the fill transition are both staggered by `index * 140 ms`.
export function staggerDelayMs(index) {
  return index * SOURCE_MOTION.staggerMs;
}

// The whole ramp has to finish inside the instance, otherwise the numbers freeze mid-count.
export function rampEndMs(rowCount) {
  return Math.max(staggerDelayMs(rowCount - 1) + SOURCE_MOTION.fillMs, SOURCE_MOTION.valueRampMs);
}

export function rankingOf(rows) {
  const max = Math.max(...rows.map(row => row.value), 1);
  return {max, topIds: rows.filter(row => row.value === max).map(row => row.id)};
}

export function calculateRankBarsLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const overflow = [];

  const fitText = (text, fontSize, fontWeight, maxWidth, id, kind) => {
    const natural = textWidth(measure, text, fontSize, fontWeight, 0);
    let resolved = {fontSize, width: natural};
    if (natural > maxWidth) {
      const scaled = Math.max(MIN_TEXT_FONT_SIZE * canvasScale, fontSize * (maxWidth / natural));
      resolved = {fontSize: scaled, width: textWidth(measure, text, scaled, fontWeight, 0)};
    }
    if (resolved.width > maxWidth + 0.5) overflow.push({id, kind, text, available: maxWidth, required: resolved.width});
    return resolved;
  };

  const {max, topIds} = rankingOf(content.rows);
  // The name and the value share one row (space-between), so together they must fit the card.
  const half = availableWidth / 2 - SOURCE_GEOMETRY.headGap * factor;
  const rows = content.rows.map(row => {
    const decimals = decimalsOf(row.value) ?? 0;
    // The value is measured at its final width: the ramp never exceeds the target value.
    const valueText = `${formatNumber(row.value, decimals)}${content.suffix ?? ""}`;
    const name = fitText(row.name, SOURCE_GEOMETRY.nameFontSize * factor, SOURCE_GEOMETRY.nameFontWeight, half, row.id, "名称");
    const value = fitText(valueText, SOURCE_GEOMETRY.valueFontSize * factor, SOURCE_GEOMETRY.valueFontWeight, half, row.id, "数值");
    return {
      id: row.id, name: row.name, value: row.value, decimals, valueText,
      isTop: topIds.includes(row.id), fraction: row.value / max,
      nameFontSize: name.fontSize, nameWidth: name.width,
      valueFontSize: value.fontSize, valueWidth: value.width,
      headWidth: name.width + value.width + SOURCE_GEOMETRY.headGap * factor,
    };
  });

  const rowGap = SOURCE_GEOMETRY.rowMarginBottom * factor;
  const headGap = SOURCE_GEOMETRY.headMarginBottom * factor;
  const trackHeight = SOURCE_GEOMETRY.trackHeight * factor;
  const rowHeights = rows.map(row => Math.max(row.nameFontSize, row.valueFontSize) * SOURCE_GEOMETRY.lineHeight + headGap + trackHeight);
  const headWidth = Math.max(...rows.map(row => row.headWidth));
  const cardWidth = Math.max(SOURCE_GEOMETRY.minWidth * factor, headWidth);
  const cardHeight = rowHeights.reduce((sum, value) => sum + value, 0) + rowGap * (rows.length - 1);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下文字在字号下限内仍放不进安全区域：${overflow.map(item => item.text).join("、")}。请缩短文字或调小大小。`;
  } else if (cardWidth > availableWidth + 0.5) {
    rejection = `排名条宽度 ${Math.round(cardWidth)} px 超出安全区域 ${Math.round(availableWidth)} px。请缩短名称或数值。`;
  } else if (cardHeight > availableHeight + 0.5) {
    rejection = `排名条高度 ${Math.round(cardHeight)} px 超出安全区域 ${Math.round(availableHeight)} px。请减少条目或调小大小。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection, max, topIds,
    cardWidth, cardHeight, rows, rowGap, headGap, trackHeight, trackRadius: SOURCE_GEOMETRY.trackRadius * factor,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
