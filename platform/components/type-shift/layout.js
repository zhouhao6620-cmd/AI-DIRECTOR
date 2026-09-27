// Source geometry is copied from the Overlay Studio HUD TypeShift source:
//   src/effects/hud/TypeShift.tsx → `.ts` markup, the `|` line split, the `*` hero
//     and `—` small markers, the RAGS offset table, the 150 + 160 × index reveal and
//     the `shiftAtMs` re-flow
//   src/effects/hud/hud.css      → .ts-line (40 px / 500, 1.6 line height, ink,
//     nowrap), .ts.pA transform: translateX(var(--ts-rag)), .ts.pB hero 84 px / 800
//     in the accent colour, mid 44 px / 600, small 28 px muted with 0.16 em tracking,
//     and the 420 / 620 / 500 ms transitions (re-flow curve cubic-bezier(0.25, 0.9, 0.3, 1))
//   src/effects/hud/accent.ts    → ACCENT_VAR, GLASS_DEFAULTS / glassClass / glassVars
// Adaptation inside layout.js: the lines arrive as an array instead of a
// `|`-separated string, every line is measured in both phases so the block fits the
// safe area, and the draft rags are clamped per line so the pre-shift state cannot
// leave the canvas. The fixed centre / left / right anchors become a 0–1 ratio
// position inside the safe area.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  baseFontSize: 40,
  baseFontWeight: 500,
  baseLineHeight: 1.6,
  heroFontSize: 84,
  heroFontWeight: 800,
  heroLineHeight: 1.3,
  heroLetterSpacingEm: -0.01,
  midFontSize: 44,
  midFontWeight: 600,
  midLineHeight: 1.6,
  midLetterSpacingEm: 0,
  smallFontSize: 28,
  smallFontWeight: 400,
  smallLineHeight: 1.6,
  smallLetterSpacingEm: 0.16,
  rags: [-180, 40, -80, 120, -30],
  lineRevealMs: 420,
  lineRevealBaseMs: 150,
  lineRevealStepMs: 160,
  reflowMs: 620,
  reflowStepMs: 70,
  colorMs: 500,
  defaultGlassAlpha: 0.6,
  glassRadius: 20,
  defaultShiftMs: 1600,
  minShiftMs: 800,
  maxShiftMs: 4000,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const ROLES = ["HERO", "MID", "SMALL"];
export const BACKGROUNDS = ["NONE", "GLASS"];
export const SAFE_SIDE_RATIO = 0.0625;
export const SAFE_VERTICAL_RATIO = 0.08;
export const MIN_SCALE = 0.6;
export const MIN_GLASS_ALPHA = 0.2;
export const MAX_GLASS_ALPHA = 1;

// Source role rule: `*` marks the post-shift hero line, `—` / `-` marks the small
// closing line, everything else stays a mid line.
export function parseLines(lines) {
  return lines.map(line => {
    const text = line.trim();
    if (text.startsWith("*")) return {role: "HERO", text: text.slice(1).trim()};
    if (text.startsWith("—") || text.startsWith("-")) return {role: "SMALL", text};
    return {role: "MID", text};
  });
}

export function roleMetrics(role) {
  const g = SOURCE_GEOMETRY;
  if (role === "HERO") return {fontSize: g.heroFontSize, fontWeight: g.heroFontWeight, lineHeight: g.heroLineHeight, letterSpacingEm: g.heroLetterSpacingEm};
  if (role === "SMALL") return {fontSize: g.smallFontSize, fontWeight: g.smallFontWeight, lineHeight: g.smallLineHeight, letterSpacingEm: g.smallLetterSpacingEm};
  return {fontSize: g.midFontSize, fontWeight: g.midFontWeight, lineHeight: g.midLineHeight, letterSpacingEm: g.midLetterSpacingEm};
}

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing) {
  return measure(text, fontSize, fontWeight, letterSpacing) + [...text].length * letterSpacing;
}

const round = value => Number(value.toFixed(3));

export function calculateTypeShiftLayout({content, position, size, background, width, height}, measure) {
  const g = SOURCE_GEOMETRY;
  const parsed = parseLines(content.lines);
  const lines = parsed.map((line, index) => {
    const metrics = roleMetrics(line.role);
    const pAWidth = textWidth(measure, line.text, g.baseFontSize, g.baseFontWeight, 0);
    const pBWidth = textWidth(measure, line.text, metrics.fontSize, metrics.fontWeight, metrics.fontSize * metrics.letterSpacingEm);
    return {
      ...line, index, ...metrics,
      pAWidth, pBWidth,
      pAHeight: g.baseFontSize * g.baseLineHeight,
      pBHeight: metrics.fontSize * metrics.lineHeight,
      rag: g.rags[index % g.rags.length],
    };
  });
  const requiredWidth = Math.max(...lines.flatMap(line => [line.pAWidth, line.pBWidth]));
  const totalP = lines.length * g.baseFontSize * g.baseLineHeight;
  const totalB = lines.reduce((sum, line) => sum + line.pBHeight, 0);
  const requiredHeight = Math.max(totalP, totalB);

  const safeX = width * SAFE_SIDE_RATIO;
  const safeY = height * SAFE_VERTICAL_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const scale = Math.min(size, availableWidth / requiredWidth, availableHeight / requiredHeight);
  if (scale < MIN_SCALE) return {
    overflow: true,
    reason: `文字切换超出安全区：需要缩到 ${(scale * 100).toFixed(0)}%，低于 ${(MIN_SCALE * 100).toFixed(0)}% 可读下限。请缩短行文字或减少行数。`,
  };

  const blockWidth = round(requiredWidth * scale);
  const blockHeight = round(requiredHeight * scale);
  const x = round(safeX + (availableWidth - blockWidth) * position.x);
  const y = round(safeY + (availableHeight - blockHeight) * position.y);
  const renderLines = lines.map(line => {
    const leftP = x + (blockWidth - line.pAWidth * scale) / 2;
    const shiftMin = safeX - leftP;
    const shiftMax = width - safeX - leftP - line.pAWidth * scale;
    const ragShift = round(Math.min(Math.max(line.rag * scale, Math.min(shiftMin, shiftMax)), Math.max(shiftMin, shiftMax)));
    return {
      role: line.role, text: line.text, index: line.index, rag: line.rag, ragShift,
      pAWidth: round(line.pAWidth * scale), pBWidth: round(line.pBWidth * scale),
      fontFrom: round(g.baseFontSize * scale), fontTo: round(line.fontSize * scale),
      weightFrom: g.baseFontWeight, weightTo: line.fontWeight,
      heightFrom: round(line.pAHeight * scale), heightTo: round(line.pBHeight * scale),
      letterSpacingTo: round(line.fontSize * line.letterSpacingEm * scale),
    };
  });
  return {
    overflow: false,
    scale: round(scale),
    background,
    lines: renderLines,
    blockWidth,
    blockHeight,
    x, y,
  };
}
