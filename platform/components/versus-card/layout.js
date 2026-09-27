// Source geometry is copied from the Overlay Studio HUD VersusCard source:
//   src/effects/hud/VersusCard.tsx → `.vs` markup, the a/b sides, the VS badge and
//     the `winner` dim rule (the losing side is greyed, the winning side keeps the
//     accent border and accent kicker)
//   src/effects/hud/hud.css        → .vs / .vs-side / .vs-kicker / .vs-title /
//     .vs-sub / .vs-badge rules, including the 520 px columns, the −42 px badge
//     overlap, the ±48 px side entry and the 140 / 500 ms stagger
//   src/effects/hud/accent.ts      → ACCENT_VAR (blue / alert / orange)
// Adaptation inside layout.js: the two sides arrive as a content tree instead of
// nine flat parameters, and every text field is measured and wrapped so a long
// value stays inside its 520 px column instead of being clipped by the fixed
// source column. Uniform scaling replaces the source `--hud-scale`, and the fixed
// 1920×1080 centre anchor becomes a 0–1 ratio position inside the safe area.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  cardWidth: 520,
  cardPaddingX: 40,
  cardPaddingY: 44,
  cardRadius: 24,
  cardBorder: 2,
  cardGap: 18,
  badgeSize: 84,
  badgeOverlap: 42,
  badgeBorder: 5,
  badgeFontSize: 28,
  badgeFontWeight: 800,
  badgeLetterSpacingEm: 0.04,
  kickerFontSize: 19,
  kickerFontWeight: 700,
  kickerLetterSpacingEm: 0.16,
  kickerLineHeight: 1.2,
  titleFontSize: 48,
  titleFontWeight: 800,
  titleLetterSpacingEm: -0.01,
  titleLineHeight: 1.2,
  subFontSize: 24,
  subFontWeight: 400,
  subLineHeight: 1.5,
  sideEnterOffset: 48,
  sideEnterMs: 560,
  secondSideDelayMs: 140,
  badgeOpacityMs: 420,
  badgeScaleMs: 460,
  badgeDelayMs: 500,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
// Source `.vs-kicker` / `.vs-badge` use the monospace stack for the VS lockup.
export const MONO_FAMILY = '"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export const SAFE_SIDE_RATIO = 0.0625;
export const SAFE_VERTICAL_RATIO = 0.08;

// Uniform scale floor. Below this the card text would stop being readable, so the
// component refuses to render and reports a boundary result instead of shrinking
// further or clipping.
export const MIN_SCALE = 0.62;
export const MAX_KICKER_LINES = 1;
// Content maxima (16 / 24 / 40 characters) always render inside the source 520 px
// column; these line budgets are the read limits that protect the card from longer
// values that bypass the schema.
export const MAX_TITLE_LINES = 3;
export const MAX_SUB_LINES = 3;

const round = value => Number(value.toFixed(3));

// Chrome adds letter-spacing after every character (including the last one), while
// the measuring helper reports glyph advances only when asked for the advance
// width. Every source text run is measured with its own letter-spacing so a fitted
// line can never overflow its column.
export function wrapText(text, maxWidth, fontSize, fontWeight, letterSpacing, measure) {
  const lines = [];
  let line = "";
  const graphemes = [...new Intl.Segmenter("zh", {granularity: "grapheme"}).segment(text)].map(item => item.segment);
  for (const grapheme of graphemes) {
    if (line && measure(line + grapheme, fontSize, fontWeight, letterSpacing) > maxWidth) {
      lines.push(line);
      line = grapheme;
    } else line += grapheme;
  }
  if (line) lines.push(line);
  return lines;
}

// The source has no `overflow: hidden` on the text, so a long value simply leaves
// the card. The registered component measures instead and refuses out-of-bounds
// content with a reason.
export function measureSide(side, measure) {
  const g = SOURCE_GEOMETRY;
  const contentWidth = g.cardWidth - g.cardPaddingX * 2 - g.cardBorder * 2;
  const kickerFontSize = g.kickerFontSize;
  const titleFontSize = g.titleFontSize;
  const subFontSize = g.subFontSize;
  const kickerLetterSpacing = kickerFontSize * g.kickerLetterSpacingEm;
  const titleLetterSpacing = titleFontSize * g.titleLetterSpacingEm;
  const kicker = wrapText(side.kicker, contentWidth, kickerFontSize, g.kickerFontWeight, kickerLetterSpacing, measure);
  const title = wrapText(side.title, contentWidth, titleFontSize, g.titleFontWeight, titleLetterSpacing, measure);
  const sub = wrapText(side.sub, contentWidth, subFontSize, g.subFontWeight, 0, measure);
  const reasons = [];
  if (kicker.length > MAX_KICKER_LINES) reasons.push("小标过长");
  if (title.length > MAX_TITLE_LINES) reasons.push("标题过长");
  if (sub.length > MAX_SUB_LINES) reasons.push("说明过长");
  const height = g.cardBorder * 2 + g.cardPaddingY * 2
    + kicker.length * kickerFontSize * g.kickerLineHeight
    + g.cardGap + title.length * titleFontSize * g.titleLineHeight
    + g.cardGap + sub.length * subFontSize * g.subLineHeight;
  return {kicker, title, sub, kickerFontSize, titleFontSize, subFontSize, kickerLetterSpacing, titleLetterSpacing, height, reasons};
}

// Natural footprint of the source lockup: two 520 px columns that share the
// 84 px badge (the badge overlaps each column by 42 px, so it adds no width).
export function naturalBlockWidth(scale = 1) {
  const g = SOURCE_GEOMETRY;
  return (g.cardWidth * 2 + g.badgeSize - g.badgeOverlap * 2) * scale;
}

export function calculateVersusCardLayout({content, position, size, width, height}, measure) {
  const g = SOURCE_GEOMETRY;
  const a = measureSide(content.a, measure);
  const b = measureSide(content.b, measure);
  const reasons = [...new Set([...a.reasons, ...b.reasons])];
  if (reasons.length) return {overflow: true, reason: `${reasons.join("、")}：单个区块在来源卡片宽度内超过允许行数，请缩短文字。`};

  const safeX = width * SAFE_SIDE_RATIO;
  const safeY = height * SAFE_VERTICAL_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const naturalHeight = Math.max(a.height, b.height, g.badgeSize);
  const scale = Math.min(size, availableWidth / naturalBlockWidth(1), availableHeight / naturalHeight);
  if (scale < MIN_SCALE) return {
    overflow: true,
    reason: `内容超出安全区：需要缩到 ${(scale * 100).toFixed(0)}%，低于 ${(MIN_SCALE * 100).toFixed(0)}% 可读下限。请缩短文字或减少字号。`,
  };

  const scaled = side => ({
    ...side,
    fontSize: round(side.kickerFontSize * scale),
    titleSize: round(side.titleFontSize * scale),
    subSize: round(side.subFontSize * scale),
    kickerSpacing: round(side.kickerLetterSpacing * scale),
    titleSpacing: round(side.titleLetterSpacing * scale),
    height: round(side.height * scale),
  });
  const cardA = scaled(a);
  const cardB = scaled(b);
  const blockWidth = round(naturalBlockWidth(scale));
  const blockHeight = round(Math.max(cardA.height, cardB.height, g.badgeSize * scale));

  return {
    scale: round(scale),
    overflow: false,
    cards: {a: cardA, b: cardB},
    cardWidth: round(g.cardWidth * scale),
    cardPaddingX: round(g.cardPaddingX * scale),
    cardPaddingY: round(g.cardPaddingY * scale),
    cardRadius: round(g.cardRadius * scale),
    cardBorder: round(g.cardBorder * scale),
    cardGap: round(g.cardGap * scale),
    badgeSize: round(g.badgeSize * scale),
    badgeBorder: round(g.badgeBorder * scale),
    badgeFontSize: round(g.badgeFontSize * scale),
    badgeLetterSpacing: round(g.badgeFontSize * g.badgeLetterSpacingEm * scale),
    blockWidth,
    blockHeight,
    x: round(safeX + (availableWidth - blockWidth) * position.x),
    y: round(safeY + (availableHeight - blockHeight) * position.y),
  };
}
