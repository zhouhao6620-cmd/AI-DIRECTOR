// Source geometry from the Overlay Studio EntityChips source:
//   src/effects/hud/EntityChips.tsx → `.etc-row` / `.etc-chip` markup, max 3 chips,
//                                     `transitionDelay: i * stepMs` and note delay
//   src/effects/hud/hud.css          → .etc / .etc-row / .etc-chip(--light/--dark) /
//                                     .etc-name / .etc-sub / .etc-note rules +
//                                     `.hud-anchor--left/--center/--right` insets
//   src/effects/hud/accent.ts        → ACCENT_VAR (dark chip sub line colour)
// Adaptation: nameplates arrive as a real content list instead of a
// "light|name|sub" text blob, the source's silent `.slice(0, 3)` becomes a
// rejection, and a row that cannot fit the canvas is refused instead of overflowing.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  anchorInsetX: 120,
  anchorInsetY: 96,
  rowGap: 20,
  chipPaddingX: 28,
  chipPaddingY: 16,
  chipRadius: 12,
  chipLightBackground: "rgba(255, 255, 255, 0.94)",
  chipDarkBackground: "rgba(20, 19, 28, 0.85)",
  chipDarkBorder: "rgba(255, 255, 255, 0.14)",
  chipBorderWidth: 1,
  chipShadow: "0 14px 34px rgba(0, 0, 0, 0.3)",
  lightNameColor: "#16181d",
  lightSubColor: "rgba(22, 24, 29, 0.62)",
  darkNameColor: "#f4f2ec",
  nameFontSize: 30,
  nameFontWeight: 900,
  nameLetterSpacingEm: 0.04,
  nameLineHeight: 1.2,
  subFontSize: 15,
  subFontWeight: 700,
  subLetterSpacingEm: 0.2,
  subLineHeight: 1.2,
  subMarginTop: 5,
  noteGap: 4,
  noteAFontSize: 22,
  noteAFontWeight: 800,
  noteAColor: "rgba(255, 255, 255, 0.85)",
  noteBFontSize: 17,
  noteBFontWeight: 600,
  noteBColor: "rgba(255, 255, 255, 0.5)",
  chipEnterMs: 500,
  chipSlideDistance: 30,
  noteSlideDistance: 20,
  staggerMs: 500,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

// `letterSpacing` is added by the layout, because Chrome also appends it after the
// last character while the measuring helper reports glyph advances only.
export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight) + [...text].length * letterSpacing;
}

export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function calculateEntityChipsLayout({
  content, position, width, height, measure, measureMono = measure,
  stepMs = SOURCE_GEOMETRY.staggerMs,
}) {
  const scale = equalAreaScale(width, height);
  const insetX = SOURCE_GEOMETRY.anchorInsetX * scale;
  const insetY = SOURCE_GEOMETRY.anchorInsetY * scale;
  const availableWidth = width - insetX * 2;
  const overflow = [];

  const paddingX = SOURCE_GEOMETRY.chipPaddingX * scale;
  const paddingY = SOURCE_GEOMETRY.chipPaddingY * scale;
  const borderWidth = Math.max(1, SOURCE_GEOMETRY.chipBorderWidth * scale);
  const nameFontSize = SOURCE_GEOMETRY.nameFontSize * scale;
  const nameLetterSpacing = nameFontSize * SOURCE_GEOMETRY.nameLetterSpacingEm;
  const nameLineHeight = nameFontSize * SOURCE_GEOMETRY.nameLineHeight;
  const subFontSize = SOURCE_GEOMETRY.subFontSize * scale;
  const subLetterSpacing = subFontSize * SOURCE_GEOMETRY.subLetterSpacingEm;
  const subLineHeight = subFontSize * SOURCE_GEOMETRY.subLineHeight;
  const subMarginTop = SOURCE_GEOMETRY.subMarginTop * scale;
  const rowGap = SOURCE_GEOMETRY.rowGap * scale;

  const chips = content.chips.map((chip, index) => {
    const nameWidth = textWidth(measure, chip.name, nameFontSize, SOURCE_GEOMETRY.nameFontWeight, nameLetterSpacing);
    const subWidth = chip.sub ? textWidth(measureMono, chip.sub, subFontSize, SOURCE_GEOMETRY.subFontWeight, subLetterSpacing) : 0;
    const border = chip.style === "DARK" ? borderWidth : 0;
    return {
      id: chip.id, style: chip.style, name: chip.name, sub: chip.sub ?? null, index,
      width: Math.max(nameWidth, subWidth) + paddingX * 2 + border * 2,
      height: paddingY * 2 + nameLineHeight + (chip.sub ? subMarginTop + subLineHeight : 0) + border * 2,
      nameWidth, subWidth, nameFontSize, nameLineHeight, nameLetterSpacing, subFontSize, subLineHeight,
      subLetterSpacing, subMarginTop, paddingX, paddingY, border,
      enterAtMs: index * stepMs,
    };
  });

  const note = (content.noteA || content.noteB) ? (() => {
    const noteFontSizeA = SOURCE_GEOMETRY.noteAFontSize * scale;
    const noteFontSizeB = SOURCE_GEOMETRY.noteBFontSize * scale;
    const widthA = content.noteA ? textWidth(measure, content.noteA, noteFontSizeA, SOURCE_GEOMETRY.noteAFontWeight) : 0;
    const widthB = content.noteB ? textWidth(measure, content.noteB, noteFontSizeB, SOURCE_GEOMETRY.noteBFontWeight) : 0;
    const lineHeightA = content.noteA ? noteFontSizeA * 1.2 : 0;
    const lineHeightB = content.noteB ? noteFontSizeB * 1.2 : 0;
    const noteGap = content.noteA && content.noteB ? SOURCE_GEOMETRY.noteGap * scale : 0;
    return {
      a: content.noteA ?? null, b: content.noteB ?? null,
      width: Math.max(widthA, widthB), height: lineHeightA + noteGap + lineHeightB,
      noteFontSizeA, noteFontSizeB, lineHeightA, lineHeightB, noteGap,
      enterAtMs: chips.length * stepMs,
    };
  })() : null;

  const rowWidth = chips.reduce((sum, chip) => sum + chip.width, 0) + rowGap * (chips.length - 1 + (note ? 1 : 0));
  const rowHeight = Math.max(...chips.map(chip => chip.height), note?.height ?? 0);
  const x = position === "RIGHT" ? width - insetX - rowWidth : position === "CENTER" ? (width - rowWidth) / 2 : insetX;
  const y = (height - rowHeight) / 2;
  if (rowWidth > availableWidth) overflow.push({type: "HORIZONTAL_OVERFLOW", required: rowWidth, available: availableWidth});
  if (x < 0 || x + rowWidth > width) overflow.push({type: "HORIZONTAL_OVERFLOW", required: rowWidth, available: width});
  if (y < 0 || y + rowHeight > height) overflow.push({type: "VERTICAL_OVERFLOW", required: rowHeight, available: height});

  let cursorX = x;
  const placedChips = chips.map(chip => {
    const placed = {...chip, x: cursorX, y: y + (rowHeight - chip.height) / 2};
    cursorX += chip.width + rowGap;
    return placed;
  });
  const placedNote = note ? {...note, x: cursorX, y: y + (rowHeight - note.height) / 2} : null;

  return {
    scale, insetX, insetY, availableWidth,
    rowWidth, rowHeight, x, y,
    chips: placedChips, note: placedNote, overflow,
  };
}

export function resolveEntrance({chips, note, stepMs}) {
  const lastEnterAtMs = Math.max(0, chips.length - 1 + (note ? 1 : 0)) * stepMs;
  return {
    lastEnterAtMs,
    settledAtMs: lastEnterAtMs + SOURCE_GEOMETRY.chipEnterMs,
    enteredCountAt: timeMs => chips.filter((_, index) => timeMs >= index * stepMs).length,
  };
}

// Full-width characters a nameplate can still hold on one line, with the note shown.
export function nameCapacityFor({count, width, height, measure, noteWidth = 0, probe = "字"}) {
  const scale = equalAreaScale(width, height);
  const available = width - SOURCE_GEOMETRY.anchorInsetX * scale * 2;
  const rowGap = SOURCE_GEOMETRY.rowGap * scale;
  const perChip = (available - noteWidth - rowGap * count) / count;
  const inner = perChip - SOURCE_GEOMETRY.chipPaddingX * 2 * scale - Math.max(1, SOURCE_GEOMETRY.chipBorderWidth * scale) * 2;
  const nameFontSize = SOURCE_GEOMETRY.nameFontSize * scale;
  const charWidth = textWidth(measure, probe, nameFontSize, SOURCE_GEOMETRY.nameFontWeight, nameFontSize * SOURCE_GEOMETRY.nameLetterSpacingEm);
  return Math.max(1, Math.floor(inner / charWidth));
}
