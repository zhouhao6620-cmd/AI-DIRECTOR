// Source geometry is copied from the Overlay Studio HUD PunchPill source:
//   src/effects/hud/PunchPill.tsx → `.pp` / `.pp-pill` / `.pp-dot` markup and the
//     bottom / top-left / top-right anchors
//   src/effects/hud/hud.css       → .pp-pill (15 / 32 px padding, 100 px radius,
//     2 px accent border, `color-mix(accent 14%, transparent)` fill, 30 px / 700
//     type, 13 px dot, 14 px gap) and the 420 ms / 460 ms scale-in entry
//   src/effects/hud/accent.ts     → ACCENT_VAR (blue / alert / orange)
// Adaptation inside layout.js: the pill is a single content field instead of a
// flat parameter, and its width is measured so a long line scales uniformly (or is
// refused with a reason) instead of running off the canvas. The three fixed source
// anchors become one 0–1 ratio position inside the safe area.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  fontSize: 30,
  fontWeight: 700,
  lineHeight: 1.2,
  paddingX: 32,
  paddingY: 15,
  border: 2,
  radius: 100,
  dotSize: 13,
  gap: 14,
  fillAlpha: 0.14,
  enterOpacityMs: 420,
  enterScaleMs: 460,
  enterScaleFrom: 0.9,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const SAFE_SIDE_RATIO = 0.0625;
export const SAFE_VERTICAL_RATIO = 0.08;
// Below this the pill would be smaller than the source's own scale-down floor and
// the punch line stops reading as a headline.
export const MIN_SCALE = 0.7;

const round = value => Number(value.toFixed(3));

// Source `color-mix(in srgb, <token> 14%, transparent)`: mixing an sRGB colour with
// transparent black keeps the colour and scales alpha, so an explicit rgba() value
// reproduces it and stays comparable in QA.
export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
}

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, letterSpacing) + [...text].length * letterSpacing;
}

export function calculatePunchPillLayout({content, position, size, width, height}, measure) {
  const g = SOURCE_GEOMETRY;
  const text = content.text;
  const naturalWidth = g.paddingX * 2 + g.border * 2 + g.dotSize + g.gap + textWidth(measure, text, g.fontSize, g.fontWeight);
  const naturalHeight = g.paddingY * 2 + g.border * 2 + g.fontSize * g.lineHeight;
  const safeX = width * SAFE_SIDE_RATIO;
  const safeY = height * SAFE_VERTICAL_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const scale = Math.min(size, availableWidth / naturalWidth, availableHeight / naturalHeight);
  if (scale < MIN_SCALE) return {
    overflow: true,
    reason: `短观点超出安全区：需要缩到 ${(scale * 100).toFixed(0)}%，低于 ${(MIN_SCALE * 100).toFixed(0)}% 可读下限。请把短句缩短到 ${Math.max(1, Math.floor([...text].length * scale / MIN_SCALE))} 字以内。`,
  };
  const blockWidth = round(naturalWidth * scale);
  const blockHeight = round(naturalHeight * scale);
  return {
    overflow: false,
    scale: round(scale),
    text,
    fontSize: round(g.fontSize * scale),
    paddingX: round(g.paddingX * scale),
    paddingY: round(g.paddingY * scale),
    border: round(g.border * scale),
    radius: round(g.radius * scale),
    dotSize: round(g.dotSize * scale),
    gap: round(g.gap * scale),
    textWidth: round(textWidth(measure, text, g.fontSize, g.fontWeight) * scale),
    blockWidth,
    blockHeight,
    x: round(safeX + (availableWidth - blockWidth) * position.x),
    y: round(safeY + (availableHeight - blockHeight) * position.y),
  };
}
