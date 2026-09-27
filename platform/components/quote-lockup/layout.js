// Source geometry is copied from the Overlay Studio QuoteLockup source:
//   src/effects/QuoteLockup.tsx → `.ql` markup, the `|` line split into `.ql-line`
//     masks, the `“` mark, the accent rule and the optional signature
//   src/effects/hud/hud.css    → .ql-card (42 / 52 / 44 px padding, max-width 640,
//     20 px glass radius), .ql-mark (mono 110 px), .ql-body (48 px / 700,
//     1.32 line height), .ql-rule (92 × 4 px accent bar) and .ql-author
//   src/effects/hud/accent.ts  → ACCENT_VAR + OFFSET_DEFAULTS
// Adaptation inside layout.js: the quote arrives as a line array instead of a
// `|`-separated string, and each line is measured so a long line wraps inside the
// 640 px column without breaking the per-line mask reveal. The fixed left / right
// anchors become a 0–1 ratio position inside the safe area.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  cardContentWidth: 640,
  paddingX: 52,
  paddingTop: 42,
  paddingBottom: 44,
  radius: 20,
  markFontSize: 110,
  markHeight: 52,
  bodyFontSize: 48,
  bodyFontWeight: 700,
  bodyLineHeight: 1.32,
  bodyLetterSpacingEm: -0.01,
  ruleWidth: 92,
  ruleHeight: 4,
  ruleRadius: 3,
  ruleMarginTop: 30,
  authorFontSize: 23,
  authorFontWeight: 400,
  authorLetterSpacingEm: 0.14,
  authorMarginTop: 18,
  // `.hud-fade`: opacity 640 ms + translateY(14 px) on the same transition, used by
  // the quote mark and the signature.
  fadeMs: 640,
  fadeOffsetY: 14,
  lineRevealMs: 760,
  lineDelayBaseMs: 140,
  lineDelayStepMs: 150,
  ruleRevealMs: 700,
  ruleDelayMs: 260,
  authorDelayMs: 320,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const MONO_FAMILY = '"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export const SAFE_SIDE_RATIO = 0.0625;
export const SAFE_VERTICAL_RATIO = 0.08;
export const MIN_SCALE = 0.62;
export const MAX_LINES_PER_ENTRY = 3;
export const MAX_AUTHOR_LINES = 2;

const round = value => Number(value.toFixed(3));

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

export function naturalCardWidth() {
  const g = SOURCE_GEOMETRY;
  return g.cardContentWidth + g.paddingX * 2;
}

// One entry of the content tree is one `.ql-line` mask. A long entry wraps inside
// its own mask, so the reveal still moves the whole entry as one block.
export function measureQuote(content, measure) {
  const g = SOURCE_GEOMETRY;
  const letterSpacing = g.bodyFontSize * g.bodyLetterSpacingEm;
  const lines = content.lines.map(text => ({text, wrapped: wrapText(text, g.cardContentWidth, g.bodyFontSize, g.bodyFontWeight, letterSpacing, measure)}));
  const authorLetterSpacing = g.authorFontSize * g.authorLetterSpacingEm;
  const author = content.author ? wrapText(content.author, g.cardContentWidth, g.authorFontSize, g.authorFontWeight, authorLetterSpacing, measure) : [];
  const reasons = [];
  if (lines.some(line => line.wrapped.length > MAX_LINES_PER_ENTRY)) reasons.push("金句某一行过长");
  if (author.length > MAX_AUTHOR_LINES) reasons.push("署名过长");
  const bodyHeight = lines.reduce((sum, line) => sum + line.wrapped.length * g.bodyFontSize * g.bodyLineHeight, 0);
  const authorBlock = author.length ? g.authorMarginTop + author.length * g.authorFontSize * 1.2 : 0;
  return {
    lines, author,
    bodyFontSize: g.bodyFontSize, authorFontSize: g.authorFontSize,
    letterSpacing, authorLetterSpacing,
    height: g.paddingTop + g.paddingBottom + g.markHeight + bodyHeight + g.ruleMarginTop + g.ruleHeight + authorBlock,
    reasons,
  };
}

export function calculateQuoteLockupLayout({content, position, size, width, height}, measure) {
  const g = SOURCE_GEOMETRY;
  const quote = measureQuote(content, measure);
  if (quote.reasons.length) return {overflow: true, reason: `${quote.reasons.join("、")}：超过来源卡片的可读行数，请缩短文字。`};

  const safeX = width * SAFE_SIDE_RATIO;
  const safeY = height * SAFE_VERTICAL_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const scale = Math.min(size, availableWidth / naturalCardWidth(), availableHeight / quote.height);
  if (scale < MIN_SCALE) return {
    overflow: true,
    reason: `内容超出安全区：需要缩到 ${(scale * 100).toFixed(0)}%，低于 ${(MIN_SCALE * 100).toFixed(0)}% 可读下限。请减少行数或缩短金句。`,
  };

  const blockWidth = round(naturalCardWidth() * scale);
  const blockHeight = round(quote.height * scale);
  return {
    overflow: false,
    scale: round(scale),
    quote: {...quote,
      bodyFontSize: round(quote.bodyFontSize * scale),
      authorFontSize: round(quote.authorFontSize * scale),
      letterSpacing: round(quote.letterSpacing * scale),
      authorLetterSpacing: round(quote.authorLetterSpacing * scale),
    },
    paddingX: round(g.paddingX * scale),
    paddingTop: round(g.paddingTop * scale),
    paddingBottom: round(g.paddingBottom * scale),
    radius: round(g.radius * scale),
    markFontSize: round(g.markFontSize * scale),
    markHeight: round(g.markHeight * scale),
    ruleWidth: round(g.ruleWidth * scale),
    ruleHeight: round(g.ruleHeight * scale),
    ruleRadius: round(g.ruleRadius * scale),
    ruleMarginTop: round(g.ruleMarginTop * scale),
    authorMarginTop: round(g.authorMarginTop * scale),
    contentWidth: round(g.cardContentWidth * scale),
    blockWidth,
    blockHeight,
    x: round(safeX + (availableWidth - blockWidth) * position.x),
    y: round(safeY + (availableHeight - blockHeight) * position.y),
  };
}
