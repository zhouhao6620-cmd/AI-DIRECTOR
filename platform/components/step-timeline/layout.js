// Source geometry from the Overlay Studio StepTimeline source:
//   src/effects/hud/StepTimeline.tsx → .st-title / .st-list / .st-step markup,
//                                      `*keyword*` title highlight, STAGGER = 240,
//                                      CYCLE = blue → teal → violet node colour
//   src/effects/hud/hud.css          → .st / .st-title / .st-bar / .st-list / .st-step /
//                                      .st-node / .st-chip / .st-chip.is-empty rules
//   src/effects/hud/accent.ts        → ACCENT_VAR + OFFSET/LOCATION helpers
// Adaptation: steps arrive as a real content list instead of a "|" text blob, the
// "already presented" count is a real prop, and every line is wrapped by
// measurement (2 lines) instead of relying on browser re-wrapping.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  anchorInsetX: 120,
  anchorInsetY: 96,
  titleFontSize: 52,
  titleFontWeight: 800,
  titleLetterSpacingEm: -0.01,
  titleLineHeight: 1.1,
  titleBarWidth: 6,
  titleBarRadius: 3,
  titleBarHeightEm: 1.05,
  titleGap: 18,
  titleMarginBottom: 34,
  listGap: 22,
  railLeft: 11,
  railInset: 18,
  railWidth: 2,
  nodeSize: 24,
  nodeBorderWidth: 2,
  nodeDotSize: 8,
  nodeGap: 24,
  chipPaddingX: 30,
  chipPaddingY: 16,
  chipMinWidth: 320,
  chipMinHeight: 74,
  chipRadius: 15,
  chipBorderWidth: 2,
  chipFontSize: 36,
  chipFontWeight: 800,
  chipLetterSpacingEm: 0.02,
  chipLineHeight: 1.2,
  emptyChipOpacity: 0.5,
  staggerMs: 240,
  stepEnterMs: 560,
  nodeEnterMs: 460,
  barEnterMs: 560,
  slideDistance: 48,
});

// Source: CYCLE = ["blue", "teal", "violet"] and `--st-c: ACCENT_VAR[CYCLE[i % 3]]`.
// ACCENT_VAR maps every legacy step value onto --hud-blue, so the verified source
// render today shows the same accent on every node; the cycle is kept in the
// contract so the mapping stays traceable instead of being rewritten.
export const STEP_CYCLE = ["blue", "teal", "violet"];
export const SOURCE_ACCENT_COMPAT = {blue: "blue", teal: "blue", violet: "blue", pink: "blue", lav: "blue"};

export const MAX_TITLE_LINES = 2;
export const MAX_LABEL_LINES = 2;
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight) + [...text].length * letterSpacing;
}

export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;

// CJK characters and spaces may start a new line; a run of Latin letters, digits
// or Latin punctuation stays together exactly like it does in the browser.
export function tokensOf(text) {
  const tokens = [];
  let buffer = "";
  const flush = () => {
    if (buffer) tokens.push({text: buffer, breakable: false});
    buffer = "";
  };
  for (const char of text) {
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

export function wrapText({text, maxWidth, measure, fontSize, fontWeight, letterSpacing = 0}) {
  const width = value => textWidth(measure, value, fontSize, fontWeight, letterSpacing);
  const lines = [];
  let current = "";
  for (const token of tokensOf(text)) {
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

// Source renders `*keyword*` runs in the accent colour: `renderTitle` splits on
// /(\*[^*]+\*)/, so only a closed pair with at least one character is markup.
// Parsing keeps every character, so a title that passes validation loses nothing.
export const EMPHASIS_PATTERN = /(\*[^*]+\*)/;

export function parseTitleRuns(title) {
  return title.split(EMPHASIS_PATTERN)
    .filter(segment => segment.length > 0)
    .map(segment => segment.length > 2 && segment.startsWith("*") && segment.endsWith("*")
      ? {text: segment.slice(1, -1), emphasis: true}
      : {text: segment, emphasis: false});
}

// The registered component refuses to render a stray `*` or an empty `**` pair:
// both are markup mistakes, and dropping them silently would lose characters.
export function titleMarkupIsValid(title) {
  const remainder = title.replace(/\*[^*]+\*/g, "");
  return !remainder.includes("*");
}

// Title tokens keep the *keyword* emphasis per token so it survives a line break.
export function titleTokens(title) {
  const tokens = [];
  let buffer = "";
  let bufferEmphasis = false;
  const flush = () => {
    if (buffer) tokens.push({text: buffer, breakable: false, emphasis: bufferEmphasis});
    buffer = "";
  };
  for (const run of parseTitleRuns(title)) {
    for (const char of run.text) {
      if (CJK.test(char) || char === " ") {
        flush();
        tokens.push({text: char, breakable: true, emphasis: run.emphasis});
      } else {
        if (buffer && run.emphasis !== bufferEmphasis) flush();
        bufferEmphasis = run.emphasis;
        buffer += char;
      }
    }
    flush();
  }
  return tokens;
}

export function wrapTokens(tokens, {maxWidth, width}) {
  const lines = [];
  let current = [];
  const textOf = list => list.map(token => token.text).join("").trimEnd();
  for (const token of tokens) {
    if (current.length && width(textOf([...current, token])) > maxWidth) {
      lines.push(current);
      current = token.text === " " ? [] : [token];
    } else {
      current.push(token);
    }
    if (current.length && !token.breakable && width(textOf(current)) > maxWidth) {
      const chunks = hardSplit(current.map(entry => entry.text).join(""), maxWidth, width);
      lines.push(...chunks.slice(0, -1).map(text => [{text, breakable: true, emphasis: token.emphasis}]));
      current = [{text: chunks.at(-1) ?? "", breakable: true, emphasis: token.emphasis}];
    }
  }
  if (current.length) lines.push(current);
  return lines.map(line => {
    const trimmed = [...line];
    while (trimmed.length && trimmed.at(-1).text === " ") trimmed.pop();
    const runs = [];
    for (const token of trimmed) {
      const last = runs.at(-1);
      if (last && last.emphasis === token.emphasis) last.text += token.text;
      else runs.push({text: token.text, emphasis: token.emphasis});
    }
    return {runs, text: trimmed.map(token => token.text).join("")};
  });
}

// Wraps the *keyword* title while keeping every run's emphasis across line breaks.
export function wrapTitleRuns({title, maxWidth, measure, fontSize, fontWeight, letterSpacing = 0}) {
  const width = value => textWidth(measure, value, fontSize, fontWeight, letterSpacing);
  const lines = wrapTokens(titleTokens(title), {maxWidth, width});
  return lines.length ? lines : [{runs: [{text: "", emphasis: false}], text: ""}];
}

export function calculateStepTimelineLayout({
  content, revealed, position, width, height, measure,
  stepMs = SOURCE_GEOMETRY.staggerMs, maxTitleLines = MAX_TITLE_LINES, maxLabelLines = MAX_LABEL_LINES,
}) {
  const scale = equalAreaScale(width, height);
  const insetX = SOURCE_GEOMETRY.anchorInsetX * scale;
  const insetY = SOURCE_GEOMETRY.anchorInsetY * scale;
  const availableWidth = width - insetX * 2;
  const titleFontSize = SOURCE_GEOMETRY.titleFontSize * scale;
  const titleLetterSpacing = titleFontSize * SOURCE_GEOMETRY.titleLetterSpacingEm;
  const barWidth = SOURCE_GEOMETRY.titleBarWidth * scale;
  const titleGap = SOURCE_GEOMETRY.titleGap * scale;
  const titleMaxWidth = availableWidth - barWidth - titleGap;
  const overflow = [];

  const titleLines = wrapTitleRuns({title: content.title, maxWidth: titleMaxWidth, measure, fontSize: titleFontSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight, letterSpacing: titleLetterSpacing});
  if (titleLines.length > maxTitleLines) overflow.push({type: "TITLE_TOO_LONG", label: content.title, lines: titleLines.length, maxLines: maxTitleLines});
  const titleMeasure = titleLines.map(line => ({...line, width: textWidth(measure, line.text, titleFontSize, SOURCE_GEOMETRY.titleFontWeight, titleLetterSpacing)}));

  const nodeSize = SOURCE_GEOMETRY.nodeSize * scale;
  const nodeGap = SOURCE_GEOMETRY.nodeGap * scale;
  const chipPaddingX = SOURCE_GEOMETRY.chipPaddingX * scale;
  const chipPaddingY = SOURCE_GEOMETRY.chipPaddingY * scale;
  const chipBorder = Math.max(1, SOURCE_GEOMETRY.chipBorderWidth * scale);
  const chipFontSize = SOURCE_GEOMETRY.chipFontSize * scale;
  const chipLineHeight = chipFontSize * SOURCE_GEOMETRY.chipLineHeight;
  const chipLetterSpacing = chipFontSize * SOURCE_GEOMETRY.chipLetterSpacingEm;
  const chipMaxWidth = availableWidth - nodeSize - nodeGap;
  const chipTextWidth = chipMaxWidth - chipPaddingX * 2 - chipBorder * 2;
  const chipMinWidth = Math.min(SOURCE_GEOMETRY.chipMinWidth * scale, chipMaxWidth);
  const chipMinHeight = SOURCE_GEOMETRY.chipMinHeight * scale;
  const listGap = SOURCE_GEOMETRY.listGap * scale;

  const steps = content.steps.map((step, index) => {
    const empty = index >= revealed;
    const lines = empty ? [] : wrapText({text: step.label, maxWidth: chipTextWidth, measure, fontSize: chipFontSize, fontWeight: SOURCE_GEOMETRY.chipFontWeight, letterSpacing: chipLetterSpacing});
    if (lines.length > maxLabelLines) overflow.push({type: "LABEL_TOO_LONG", id: step.id, label: step.label, lines: lines.length, maxLines: maxLabelLines});
    const widest = Math.max(0, ...lines.map(line => textWidth(measure, line, chipFontSize, SOURCE_GEOMETRY.chipFontWeight, chipLetterSpacing)));
    const chipWidth = Math.min(chipMaxWidth, Math.max(chipMinWidth, widest + chipPaddingX * 2 + chipBorder * 2));
    const chipHeight = Math.max(chipMinHeight, lines.length * chipLineHeight + chipPaddingY * 2 + chipBorder * 2);
    return {
      id: step.id, label: step.label, index, empty, lines,
      cycleColor: STEP_CYCLE[index % STEP_CYCLE.length],
      chipWidth, chipHeight, rowHeight: Math.max(nodeSize, chipHeight),
      chipFontSize, chipLineHeight, chipLetterSpacing, chipPaddingX, chipPaddingY, chipBorder,
      nodeSize, nodeGap,
      enterAtMs: index * stepMs,
    };
  });

  const titleBarHeight = titleFontSize * SOURCE_GEOMETRY.titleBarHeightEm;
  const titleHeight = titleMeasure.length * titleFontSize * SOURCE_GEOMETRY.titleLineHeight;
  const titleMarginBottom = SOURCE_GEOMETRY.titleMarginBottom * scale;
  const listHeight = steps.reduce((sum, step, index) => sum + step.rowHeight + (index ? listGap : 0), 0);
  const cardHeight = titleHeight + titleMarginBottom + listHeight;
  const cardWidth = Math.max(
    barWidth + titleGap + Math.max(...titleMeasure.map(line => line.width)),
    ...steps.map(step => nodeSize + nodeGap + step.chipWidth),
  );
  const x = position === "RIGHT" ? width - insetX - cardWidth : insetX;
  const y = position === "TOP_LEFT" ? insetY : (height - cardHeight) / 2;
  if (x < 0 || x + cardWidth > width) overflow.push({type: "HORIZONTAL_OVERFLOW", required: cardWidth, available: availableWidth});
  if (y < 0 || y + cardHeight > height) overflow.push({type: "VERTICAL_OVERFLOW", required: cardHeight, available: height});

  let cursorY = y + titleHeight + titleMarginBottom;
  const placed = steps.map((step, index) => {
    const row = {...step, y: cursorY, x: x + nodeSize + nodeGap, nodeX: x, nodeY: cursorY + (step.rowHeight - nodeSize) / 2};
    cursorY += step.rowHeight + (index < steps.length - 1 ? listGap : 0);
    return row;
  });

  return {
    scale, insetX, insetY, availableWidth,
    cardWidth, cardHeight, x, y,
    title: {
      lines: titleMeasure, fontSize: titleFontSize, lineHeight: titleFontSize * SOURCE_GEOMETRY.titleLineHeight,
      letterSpacing: titleLetterSpacing, barWidth, barHeight: titleBarHeight, barRadius: SOURCE_GEOMETRY.titleBarRadius * scale,
      gap: titleGap, marginBottom: titleMarginBottom, height: titleHeight, width: Math.max(...titleMeasure.map(line => line.width)),
    },
    list: {
      y: y + titleHeight + titleMarginBottom, height: listHeight, gap: listGap,
      railLeft: SOURCE_GEOMETRY.railLeft * scale, railInset: SOURCE_GEOMETRY.railInset * scale,
      railWidth: Math.max(1, SOURCE_GEOMETRY.railWidth * scale),
      railCenter: SOURCE_GEOMETRY.railLeft * scale + Math.max(1, SOURCE_GEOMETRY.railWidth * scale) / 2,
      chipLeft: nodeSize + nodeGap,
    },
    steps: placed,
    overflow,
  };
}

export function resolveEntrance({steps, stepMs}) {
  const stagger = Math.max(0, steps.length - 1) * stepMs;
  return {
    lastEnterAtMs: stagger,
    settledAtMs: stagger + SOURCE_GEOMETRY.stepEnterMs,
    enteredCountAt: timeMs => steps.filter((_, index) => timeMs >= index * stepMs).length,
  };
}

// How many full-width chip characters still fit on one line.
export function chipLineCapacityFor({width, height, measure, probe = "字"}) {
  const scale = equalAreaScale(width, height);
  const available = width - SOURCE_GEOMETRY.anchorInsetX * scale * 2 - (SOURCE_GEOMETRY.nodeSize + SOURCE_GEOMETRY.nodeGap) * scale
    - (SOURCE_GEOMETRY.chipPaddingX * 2 + SOURCE_GEOMETRY.chipBorderWidth * 2) * scale;
  const charWidth = textWidth(measure, probe, SOURCE_GEOMETRY.chipFontSize * scale, SOURCE_GEOMETRY.chipFontWeight, SOURCE_GEOMETRY.chipFontSize * SOURCE_GEOMETRY.chipLetterSpacingEm * scale);
  return Math.max(1, Math.floor(available / charWidth));
}

export function titleLineCapacityFor({width, height, measure, probe = "字"}) {
  const scale = equalAreaScale(width, height);
  const available = width - SOURCE_GEOMETRY.anchorInsetX * scale * 2 - (SOURCE_GEOMETRY.titleBarWidth + SOURCE_GEOMETRY.titleGap) * scale;
  const fontSize = SOURCE_GEOMETRY.titleFontSize * scale;
  const charWidth = textWidth(measure, probe, fontSize, SOURCE_GEOMETRY.titleFontWeight, fontSize * SOURCE_GEOMETRY.titleLetterSpacingEm);
  return Math.max(1, Math.floor(available / charWidth));
}
