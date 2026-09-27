// 补建组件（来源不足）：枝鸥 / Overlay Studio 的 20 个效果里没有证据媒体卡，
// RemotionUI 的 Media Frame 只核验过目录记录、未安装也未抓取到详情（见 CMP-01 证据表）。
// 因此本组件的内容结构（材料 + 来源说明）与版式都由本项目自建：
//   - 材料：IMAGE / VIDEO + 画框形态（WIDE 16:9 / SQUARE 1:1 / PORTRAIT 4:5）+ 可选图注；
//   - 来源：发布方（必填）+ 作品名 / 出处 / 日期 / 链接（可选，只作为文字展示，不联网抓取）；
//   - 版式：材料框在上、标题与来源在下，卡片宽度先按画布可用高度反推，保证不溢出。
// 视觉令牌取自本地 HUD 既有样式（玻璃边框、卡片投影、等宽小字与强调色）。

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  safeMarginRatio: 0.075,
  cardPadding: 22,
  cardRadius: 20,
  mediaRadius: 14,
  mediaBorderWidth: 1,
  mediaSurface: "rgba(0, 0, 0, 0.28)",
  titleFontSize: 26,
  titleFontWeight: 700,
  titleLineHeight: 1.3,
  titleMarginTop: 20,
  accentRuleWidth: 3,
  accentRuleGap: 12,
  monoFontSize: 15,
  monoFontWeight: 600,
  monoLetterSpacingEm: 0.06,
  monoLineHeight: 1.5,
  sourceMarginTop: 10,
  enterMs: 520,
  cardWidthRatio: {CENTER: 1, LEFT: 0.72, RIGHT: 0.72},
  frameAspect: {WIDE: 16 / 9, SQUARE: 1, PORTRAIT: 4 / 5},
  // Absolute floor: below this the material is no longer readable, so the layout
  // reports the card instead of shrinking it further.
  minCardWidth: 280,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

// `letterSpacing` is added by the layout: Chrome also appends it after the last
// character while the measuring helper reports glyph advances only.
export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight) + [...text].length * letterSpacing;
}

export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;

function hardSplit(text, maxWidth, width) {
  const chunks = [];
  let current = "";
  for (const char of text) {
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

// Greedy wrap with the browser's CJK / Latin break rules; no character is dropped.
export function wrapText({text, maxWidth, measure, fontSize, fontWeight, letterSpacing = 0}) {
  const width = value => textWidth(measure, value, fontSize, fontWeight, letterSpacing);
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
  const lines = [];
  let current = "";
  for (const token of tokens) {
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

export function sourceLineOf(content, {separator = " · "} = {}) {
  const parts = [content.source.publisher, content.source.workTitle, content.source.date].filter(Boolean);
  return parts.join(separator);
}

export function sourceDetailOf(content) {
  return [content.source.reference, content.source.url].filter(Boolean).join(" · ");
}

export function calculateEvidenceMediaCardLayout({
  content, position, width, height, measure, monoMeasure = measure, maxTitleLines = 2,
}) {
  const scale = equalAreaScale(width, height);
  const marginX = width * SOURCE_GEOMETRY.safeMarginRatio;
  const marginY = height * SOURCE_GEOMETRY.safeMarginRatio;
  const usableWidth = width - marginX * 2;
  const usableHeight = height - marginY * 2;
  const overflow = [];

  const padding = SOURCE_GEOMETRY.cardPadding * scale;
  const titleFontSize = SOURCE_GEOMETRY.titleFontSize * scale;
  const titleLineHeight = titleFontSize * SOURCE_GEOMETRY.titleLineHeight;
  const titleMarginTop = SOURCE_GEOMETRY.titleMarginTop * scale;
  const ruleWidth = SOURCE_GEOMETRY.accentRuleWidth * scale;
  const ruleGap = SOURCE_GEOMETRY.accentRuleGap * scale;
  const monoFontSize = SOURCE_GEOMETRY.monoFontSize * scale;
  const monoLetterSpacing = monoFontSize * SOURCE_GEOMETRY.monoLetterSpacingEm;
  const monoLineHeight = monoFontSize * SOURCE_GEOMETRY.monoLineHeight;
  const sourceMarginTop = SOURCE_GEOMETRY.sourceMarginTop * scale;

  const titleMaxWidth = usableWidth * SOURCE_GEOMETRY.cardWidthRatio[position] - padding * 2 - ruleWidth - ruleGap;
  const titleLines = wrapText({text: content.title, maxWidth: titleMaxWidth, measure, fontSize: titleFontSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight});
  if (titleLines.length > maxTitleLines) overflow.push({type: "TITLE_TOO_LONG", label: content.title, lines: titleLines.length, maxLines: maxTitleLines});

  const caption = content.media.caption ?? null;
  const sourceLine = sourceLineOf(content);
  const sourceDetail = sourceDetailOf(content);
  const textBlockHeight = titleMarginTop + titleLines.length * titleLineHeight
    + (caption ? monoLineHeight : 0)
    + sourceMarginTop + monoLineHeight * (sourceDetail ? 2 : 1);

  const aspect = SOURCE_GEOMETRY.frameAspect[content.media.frame];
  // The material box is exactly the chosen frame ratio; the card wraps it, so the box
  // is the element that is fitted to the remaining height budget.
  const maxMediaWidth = usableWidth * SOURCE_GEOMETRY.cardWidthRatio[position] - padding * 2;
  const heightBudget = Math.max(0, usableHeight - textBlockHeight - padding * 2);
  const mediaWidth = Math.max(60, Math.min(maxMediaWidth, heightBudget * aspect));
  const mediaHeight = mediaWidth / aspect;
  const cardWidth = mediaWidth + padding * 2;
  const cardHeight = mediaHeight + textBlockHeight + padding * 2;
  const minCardWidth = SOURCE_GEOMETRY.minCardWidth * scale;
  if (cardWidth < minCardWidth) {
    overflow.push({type: "CARD_TOO_SMALL", required: minCardWidth, available: cardWidth});
  }
  const x = position === "RIGHT" ? width - marginX - cardWidth : position === "CENTER" ? (width - cardWidth) / 2 : marginX;
  const y = (height - cardHeight) / 2;
  if (y < 0 || y + cardHeight > height) overflow.push({type: "VERTICAL_OVERFLOW", required: cardHeight + marginY * 2, available: height});

  return {
    scale, marginX, marginY, usableWidth, usableHeight,
    card: {x, y, width: cardWidth, height: cardHeight, padding, radius: SOURCE_GEOMETRY.cardRadius * scale},
    media: {
      x: x + padding, y: y + padding, width: mediaWidth, height: mediaHeight,
      radius: SOURCE_GEOMETRY.mediaRadius * scale,
      borderWidth: Math.max(1, SOURCE_GEOMETRY.mediaBorderWidth * scale),
      kind: content.media.kind, src: content.media.src, frame: content.media.frame, aspect,
    },
    title: {
      lines: titleLines, fontSize: titleFontSize, lineHeight: titleLineHeight,
      x: x + padding + ruleWidth + ruleGap, y: y + padding + mediaHeight + titleMarginTop,
      ruleX: x + padding, ruleY: y + padding + mediaHeight + titleMarginTop,
      ruleWidth, ruleHeight: titleLines.length === 1 ? titleLineHeight : titleLineHeight * titleLines.length,
    },
    caption: caption ? {
      text: caption, fontSize: monoFontSize, lineHeight: monoLineHeight, letterSpacing: monoLetterSpacing,
      x: x + padding, y: y + padding + mediaHeight + titleMarginTop + titleLines.length * titleLineHeight,
    } : null,
    source: {
      line: sourceLine, detail: sourceDetail, fontSize: monoFontSize, lineHeight: monoLineHeight, letterSpacing: monoLetterSpacing,
      x: x + padding,
      y: y + padding + mediaHeight + titleMarginTop + titleLines.length * titleLineHeight + (caption ? monoLineHeight : 0) + sourceMarginTop,
    },
    overflow,
  };
}

// Full-width characters the card title can hold on one line.
export function titleCapacityFor({position = "CENTER", width, height, measure, probe = "字"}) {
  const scale = equalAreaScale(width, height);
  const available = (width - width * SOURCE_GEOMETRY.safeMarginRatio * 2) * SOURCE_GEOMETRY.cardWidthRatio[position]
    - SOURCE_GEOMETRY.cardPadding * 2 * scale - (SOURCE_GEOMETRY.accentRuleWidth + SOURCE_GEOMETRY.accentRuleGap) * scale;
  const fontSize = SOURCE_GEOMETRY.titleFontSize * scale;
  const charWidth = textWidth(measure, probe, fontSize, SOURCE_GEOMETRY.titleFontWeight);
  return Math.max(1, Math.floor(available / charWidth));
}
