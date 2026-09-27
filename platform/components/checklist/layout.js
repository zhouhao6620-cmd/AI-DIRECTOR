// Source geometry from the Overlay Studio Checklist source:
//   src/effects/hud/Checklist.tsx → .hud-kicker title + .ck-item list markup,
//                                   "|"-separated items, `checked` count, STAGGER = 160
//   src/effects/hud/hud.css       → .ck / .ck-item / .ck-box / .hud-kicker rules
//   src/effects/hud/accent.ts     → ACCENT_VAR mapping (blue / alert / orange)
//   src/effects/hud/hud.css       → .hud-anchor--left / --right / --top-left insets
// Adaptation: items arrive as a real content list instead of a "|" text blob, the
// label is wrapped by measurement (2 lines max) instead of relying on browser
// re-wrapping, and the source's per-item stagger/entrance times drive Remotion frames.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  anchorInsetX: 120,
  anchorInsetY: 96,
  kickerFontSize: 20,
  kickerFontWeight: 600,
  kickerLetterSpacingEm: 0.18,
  kickerDotSize: 9,
  kickerDotGap: 10,
  kickerMarginBottom: 28,
  itemFontSize: 32,
  itemFontWeight: 500,
  itemLineHeight: 1.2,
  itemGap: 18,
  itemMarginBottom: 22,
  boxSize: 38,
  boxRadius: 10,
  boxBorderWidth: 2,
  checkFontSize: 22,
  checkFontWeight: 800,
  staggerMs: 160,
  itemEnterMs: 480,
  kickerEnterMs: 640,
  boxPopMs: 300,
});

export const MAX_ITEM_LINES = 2;
// The registered component refuses to clip, so a label that cannot fit the entry
// cap is reported instead of being trimmed. The source has no font floor at all.
export const MIN_ITEM_FONT_SIZE = 14;
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';

// Both current canvases hold the same pixel area as the source 1920×1080 stage,
// so the source geometry is preserved at scale 1 on both of them.
export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

// Chrome adds letter-spacing after every character (including the last one), while
// the measuring helper reports glyph advances only.
export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight) + [...text].length * letterSpacing;
}

// Source writes colours as `color-mix(in srgb, <token> <alpha>, transparent)`;
// mixing an sRGB colour with transparent black keeps the colour and scales alpha,
// so an explicit rgba() value produces the same look and is comparable in QA.
export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;

// CJK characters, and spaces, may start a new line; a run of Latin letters,
// digits or Latin punctuation stays together like it does in the browser.
export function tokensOf(label) {
  const tokens = [];
  let buffer = "";
  const flush = () => {
    if (buffer) tokens.push({text: buffer, breakable: false});
    buffer = "";
  };
  for (const char of label) {
    if (CJK.test(char) || char === " ") {
      flush();
      tokens.push({text: char, breakable: true});
    } else {
      buffer += char;
    }
  }
  flush();
  return tokens;
}

function hardSplit(token, maxWidth, width) {
  const chunks = [];
  let current = "";
  for (const char of token) {
    if (current && width(current + char) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Greedy wrap that never silently drops a character: an unbreakable run that is
// wider than the card is hard-split, which is what the browser does to a single
// over-long word inside a flex row.
export function wrapLabel({label, maxWidth, measure, fontSize, fontWeight, letterSpacing = 0}) {
  const width = text => textWidth(measure, text, fontSize, fontWeight, letterSpacing);
  const lines = [];
  let current = "";
  for (const token of tokensOf(label)) {
    const candidate = current + token.text;
    if (current && width(candidate.trimEnd()) > maxWidth) {
      lines.push(current.trimEnd());
      current = token.text === " " ? "" : token.text;
    } else {
      current = candidate;
    }
    if (!current) continue;
    if (width(current) > maxWidth) {
      const chunks = hardSplit(current, maxWidth, width);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) ?? "";
    }
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines.length ? lines : [""];
}

// How many full-width characters still fit on one line at the font floor.
export function lineCapacityFor({count = 4, width, height, measure, probe = "字", fontSize = SOURCE_GEOMETRY.itemFontSize}) {
  const scale = equalAreaScale(width, height);
  const available = width - SOURCE_GEOMETRY.anchorInsetX * scale * 2 - (SOURCE_GEOMETRY.boxSize + SOURCE_GEOMETRY.itemGap) * scale;
  const charWidth = textWidth(measure, probe, fontSize * scale, SOURCE_GEOMETRY.itemFontWeight);
  return Math.max(1, Math.floor(available / charWidth));
}

export function calculateChecklistLayout({
  content, checkedCount, position, width, height, measure,
  stepMs = SOURCE_GEOMETRY.staggerMs, maxLines = MAX_ITEM_LINES,
}) {
  const scale = equalAreaScale(width, height);
  const insetX = SOURCE_GEOMETRY.anchorInsetX * scale;
  const insetY = SOURCE_GEOMETRY.anchorInsetY * scale;
  const itemFontSize = SOURCE_GEOMETRY.itemFontSize * scale;
  const boxSize = SOURCE_GEOMETRY.boxSize * scale;
  const itemGap = SOURCE_GEOMETRY.itemGap * scale;
  const lineHeight = itemFontSize * SOURCE_GEOMETRY.itemLineHeight;
  const marginBottom = SOURCE_GEOMETRY.itemMarginBottom * scale;
  const availableWidth = width - insetX * 2;
  const labelMaxWidth = availableWidth - boxSize - itemGap;
  const overflow = [];

  const title = content.title ?? null;
  const kicker = title ? {
    text: title,
    fontSize: SOURCE_GEOMETRY.kickerFontSize * scale,
    letterSpacing: SOURCE_GEOMETRY.kickerFontSize * SOURCE_GEOMETRY.kickerLetterSpacingEm * scale,
    dotSize: SOURCE_GEOMETRY.kickerDotSize * scale,
    dotGap: SOURCE_GEOMETRY.kickerDotGap * scale,
    marginBottom: SOURCE_GEOMETRY.kickerMarginBottom * scale,
    height: SOURCE_GEOMETRY.kickerFontSize * 1.2 * scale,
    width: 0,
  } : null;
  if (kicker) {
    kicker.width = kicker.dotSize + kicker.dotGap + textWidth(measure, title, kicker.fontSize, SOURCE_GEOMETRY.kickerFontWeight, kicker.letterSpacing);
    if (kicker.width > availableWidth) overflow.push({type: "TITLE_TOO_LONG", label: title, required: kicker.width, available: availableWidth});
  }

  const items = content.items.map((item, index) => {
    const lines = wrapLabel({label: item.label, maxWidth: labelMaxWidth, measure, fontSize: itemFontSize, fontWeight: SOURCE_GEOMETRY.itemFontWeight});
    const widest = Math.max(...lines.map(line => textWidth(measure, line, itemFontSize, SOURCE_GEOMETRY.itemFontWeight)));
    if (lines.length > maxLines) overflow.push({type: "LABEL_TOO_LONG", id: item.id, label: item.label, lines: lines.length, maxLines});
    return {
      id: item.id,
      label: item.label,
      index,
      done: index < checkedCount,
      lines,
      width: widest,
      fontSize: itemFontSize,
      lineHeight,
      textWidth: widest,
      enterAtMs: index * stepMs,
    };
  });

  const itemHeight = item => Math.max(boxSize, item.lines.length * lineHeight);
  const cardWidth = Math.max(kicker?.width ?? 0, ...items.map(item => boxSize + itemGap + item.width), 1);
  const cardHeight = (kicker ? kicker.height + kicker.marginBottom : 0)
    + items.reduce((sum, item) => sum + itemHeight(item) + marginBottom, 0);

  const x = position === "RIGHT" ? width - insetX - cardWidth : insetX;
  const y = position === "TOP_LEFT" ? insetY : (height - cardHeight) / 2;
  if (x < 0 || x + cardWidth > width) overflow.push({type: "HORIZONTAL_OVERFLOW", required: cardWidth, available: availableWidth});
  if (y < 0 || y + cardHeight > height) overflow.push({type: "VERTICAL_OVERFLOW", required: cardHeight, available: height});

  let cursorY = y + (kicker ? kicker.height + kicker.marginBottom : 0);
  const placed = items.map(item => {
    const height = itemHeight(item);
    const textX = x + boxSize + itemGap;
    const placedItem = {...item, x: textX, y: cursorY, height, boxSize, boxX: x, boxY: cursorY + (height - boxSize) / 2};
    cursorY += height + marginBottom;
    return placedItem;
  });

  return {
    scale,
    insetX,
    insetY,
    position,
    availableWidth,
    labelMaxWidth,
    cardWidth,
    cardHeight,
    x,
    y,
    kicker,
    items: placed,
    boxSize,
    boxRadius: SOURCE_GEOMETRY.boxRadius * scale,
    boxBorderWidth: Math.max(1, SOURCE_GEOMETRY.boxBorderWidth * scale),
    checkFontSize: SOURCE_GEOMETRY.checkFontSize * scale,
    itemGap,
    overflow,
  };
}

// Source uses `transitionDelay: i * (stepMs ?? 160)` for the list and a fixed
// 480 ms entrance, so the whole list needs this much time to be fully visible.
export function resolveEntrance({items, stepMs}) {
  const stagger = Math.max(0, items.length - 1) * stepMs;
  return {
    lastEnterAtMs: stagger,
    settledAtMs: stagger + SOURCE_GEOMETRY.itemEnterMs,
    enteredCountAt: timeMs => items.filter((_, index) => timeMs >= index * stepMs).length,
  };
}
