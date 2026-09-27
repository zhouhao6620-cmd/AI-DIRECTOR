// Source geometry is copied from the Overlay Studio HUD TermCard source:
//   src/effects/hud/TermCard.tsx → `.tc-card` / `.tc-en` / `.tc-term` / `.tc-def`
//     markup and the left / right anchors
//   src/effects/hud/hud.css      → .tc-card (max-width 620, 34 / 38 px padding,
//     22 px radius, 5 px accent left border, glass fill + card shadow),
//     .tc-en (mono 20 px, 0.14 em tracking, uppercase, muted),
//     .tc-term (52 px / 800, accent) and .tc-def (30 px, 1.45 line height)
//   src/effects/hud/accent.ts    → ACCENT_VAR (blue / alert / orange)
// Adaptation inside layout.js: the term, the optional original-language line and
// the definition form a content tree, and every field is measured and wrapped so a
// long definition wraps inside the 620 px column instead of running out of the
// card. The fixed left / right anchors become a 0–1 ratio position.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  cardContentWidth: 620,
  paddingX: 38,
  paddingY: 34,
  radius: 22,
  accentBorder: 5,
  enFontSize: 20,
  enFontWeight: 500,
  enLetterSpacingEm: 0.14,
  enLineHeight: 1.2,
  enMarginBottom: 10,
  termFontSize: 52,
  termFontWeight: 800,
  termLetterSpacingEm: -0.01,
  termLineHeight: 1.2,
  defFontSize: 30,
  defFontWeight: 400,
  defLineHeight: 1.45,
  defMarginTop: 18,
  enterMs: 520,
  enterOffsetY: 16,
  enterScaleFrom: 0.98,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const MONO_FAMILY = '"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export const SAFE_SIDE_RATIO = 0.0625;
export const SAFE_VERTICAL_RATIO = 0.08;
export const MIN_SCALE = 0.62;
export const MAX_EN_LINES = 2;
export const MAX_TERM_LINES = 3;
export const MAX_DEFINITION_LINES = 6;

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
  return g.paddingX * 2 + g.accentBorder + g.cardContentWidth;
}

export function measureCard(content, measure) {
  const g = SOURCE_GEOMETRY;
  const enLetterSpacing = g.enFontSize * g.enLetterSpacingEm;
  const termLetterSpacing = g.termFontSize * g.termLetterSpacingEm;
  const en = content.en ? wrapText(content.en, g.cardContentWidth, g.enFontSize, g.enFontWeight, enLetterSpacing, measure) : [];
  const term = wrapText(content.term, g.cardContentWidth, g.termFontSize, g.termFontWeight, termLetterSpacing, measure);
  const definition = wrapText(content.definition, g.cardContentWidth, g.defFontSize, g.defFontWeight, 0, measure);
  const reasons = [];
  if (en.length > MAX_EN_LINES) reasons.push("英文 / 拼音过长");
  if (term.length > MAX_TERM_LINES) reasons.push("术语过长");
  if (definition.length > MAX_DEFINITION_LINES) reasons.push("定义过长");
  const enBlock = en.length ? en.length * g.enFontSize * g.enLineHeight + g.enMarginBottom : 0;
  const termBlock = term.length * g.termFontSize * g.termLineHeight;
  const definitionBlock = definition.length * g.defFontSize * g.defLineHeight + g.defMarginTop;
  return {
    en, term, definition,
    enFontSize: g.enFontSize, termFontSize: g.termFontSize, defFontSize: g.defFontSize,
    enLetterSpacing, termLetterSpacing,
    height: g.paddingY * 2 + enBlock + termBlock + definitionBlock,
    reasons,
  };
}

export function calculateTermCardLayout({content, position, size, width, height}, measure) {
  const g = SOURCE_GEOMETRY;
  const card = measureCard(content, measure);
  if (card.reasons.length) return {overflow: true, reason: `${card.reasons.join("、")}：超过来源卡片的可读行数，请缩短文字。`};

  const safeX = width * SAFE_SIDE_RATIO;
  const safeY = height * SAFE_VERTICAL_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const scale = Math.min(size, availableWidth / naturalCardWidth(), availableHeight / card.height);
  if (scale < MIN_SCALE) return {
    overflow: true,
    reason: `内容超出安全区：需要缩到 ${(scale * 100).toFixed(0)}%，低于 ${(MIN_SCALE * 100).toFixed(0)}% 可读下限。请缩短术语或定义。`,
  };

  const blockWidth = round(naturalCardWidth() * scale);
  const blockHeight = round(card.height * scale);
  return {
    overflow: false,
    scale: round(scale),
    card: {...card,
      enFontSize: round(card.enFontSize * scale),
      termFontSize: round(card.termFontSize * scale),
      defFontSize: round(card.defFontSize * scale),
      enLetterSpacing: round(card.enLetterSpacing * scale),
      termLetterSpacing: round(card.termLetterSpacing * scale),
    },
    paddingX: round(g.paddingX * scale),
    paddingY: round(g.paddingY * scale),
    radius: round(g.radius * scale),
    accentBorder: round(g.accentBorder * scale),
    contentWidth: round(g.cardContentWidth * scale),
    enMarginBottom: round(g.enMarginBottom * scale),
    defMarginTop: round(g.defMarginTop * scale),
    blockWidth,
    blockHeight,
    x: round(safeX + (availableWidth - blockWidth) * position.x),
    y: round(safeY + (availableHeight - blockHeight) * position.y),
  };
}
