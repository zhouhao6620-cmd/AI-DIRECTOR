// Source geometry from the Overlay Studio CaptionTrack source:
//   src/effects/hud/CaptionTrack.tsx → cue parsing, *keyword* markup, capShadow()
//   src/effects/hud/hud.css          → .ctrack / .ctrack-zh / .ctrack-kw / .ctrack-en
// Adaptation: cues arrive as a real subtitle timeline ({startMs, endMs, text,
// translation}) instead of a "start|end|zh|en" text blob, and every line is
// wrapped by measurement so nothing is clipped or re-wrapped by the browser.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  zhFontSize: 44,
  zhFontWeight: 800,
  zhLineHeight: 1.35,
  zhLetterSpacingEm: 0.04,
  enFontSize: 17,
  enFontWeight: 500,
  enLineHeight: 1.35,
  enLetterSpacingEm: 0.1,
  enMarginTop: 8,
  bottomOffset: 44,
  maxBlockWidth: 1500,
  blockWidthRatio: 0.86,
  strokeWidth: 3,
  strokeColor: "#000000",
});

export const MAX_ZH_LINES = 4;
export const MAX_EN_LINES = 3;
export const SAFE_TOP_RATIO = 0.08;
export const SAFE_SIDE_RATIO = 0.06;
export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

// Chrome adds letter-spacing after every character (including the last one), while
// the measuring helper reports glyph advances only. The layout adds the spacing
// itself so wrapped lines keep the same width the browser will render.
export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

// Copied from the source `capShadow()`: a ring of zero-blur copies plus the
// original soft halo, so both light and dark canvases stay readable.
export function captionShadow({strokeWidth = 0, color = SOURCE_GEOMETRY.strokeColor, halo = 1} = {}) {
  const softHalo = `0 1px 2px rgba(0,0,0,${0.9 * halo}), 0 0 14px rgba(0,0,0,${0.55 * halo}), 0 6px 28px rgba(0,0,0,${0.45 * halo})`;
  if (!strokeWidth || strokeWidth <= 0) return softHalo;
  const ring = [];
  const directions = Math.max(24, Math.ceil(strokeWidth * 12));
  for (const [radius, count] of [[1, directions], [0.62, Math.round(directions * 0.6)], [0.3, Math.round(directions * 0.35)]]) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      ring.push(`${(Math.cos(angle) * strokeWidth * radius).toFixed(2)}px ${(Math.sin(angle) * strokeWidth * radius).toFixed(2)}px 0 ${color}`);
    }
  }
  return ring.join(", ") + ", " + softHalo;
}

// Source renders `*keyword*` runs in the accent colour (`.ctrack-kw`).
export function highlightSegments(text) {
  const source = String(text ?? "");
  const ranges = [];
  let plainText = "";
  let openAt = null;
  for (const character of source) {
    if (character === "*") {
      if (openAt === null) openAt = plainText.length;
      else {
        if (plainText.length === openAt) return {plainText, ranges: [], error: "关键词标记内不能为空。"};
        ranges.push({start: openAt, end: plainText.length});
        openAt = null;
      }
      continue;
    }
    plainText += character;
  }
  if (openAt !== null) return {plainText, ranges: [], error: "关键词标记未闭合，请成对使用 * 强调。"};
  if (/^\s*$/.test(plainText)) return {plainText, ranges: [], error: "字幕内容不能为空。"};
  return {plainText, ranges, error: null};
}

function segmentsForRange(plainText, ranges, start, end) {
  const result = [];
  let cursor = start;
  const covered = ranges.filter(range => range.end > start && range.start < end).sort((a, b) => a.start - b.start);
  for (const range of covered) {
    const from = Math.max(range.start, start);
    const to = Math.min(range.end, end);
    if (from > cursor) result.push({text: plainText.slice(cursor, from), emphasis: false});
    if (to > from) result.push({text: plainText.slice(from, to), emphasis: true});
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) result.push({text: plainText.slice(cursor, end), emphasis: false});
  return result;
}

export function buildCaptionLines({text, maxWidth, fontSize, fontWeight, letterSpacing, measure, maxLines = Infinity}) {
  const parsed = highlightSegments(text);
  if (parsed.error) return {lines: [], overflow: true, error: parsed.error, ranges: []};
  const graphemes = [...new Intl.Segmenter("zh", {granularity: "grapheme"}).segment(parsed.plainText)].map(item => item.segment);
  const boundaries = [];
  let lineStart = 0;
  let candidate = "";
  for (const grapheme of graphemes) {
    if (candidate && textWidth(measure, candidate + grapheme, fontSize, fontWeight, letterSpacing) > maxWidth) {
      boundaries.push({start: lineStart, end: lineStart + candidate.length});
      lineStart += candidate.length;
      candidate = grapheme;
    } else candidate += grapheme;
  }
  if (candidate) boundaries.push({start: lineStart, end: lineStart + candidate.length});

  const lines = boundaries.map(boundary => ({
    ...boundary,
    text: parsed.plainText.slice(boundary.start, boundary.end),
    width: textWidth(measure, parsed.plainText.slice(boundary.start, boundary.end), fontSize, fontWeight, letterSpacing),
    segments: segmentsForRange(parsed.plainText, parsed.ranges, boundary.start, boundary.end),
  }));
  return {lines, overflow: lines.length > maxLines, error: null, ranges: parsed.ranges, plainText: parsed.plainText};
}

// Source behaviour: a cue is on screen for `start <= t < end`; between cues the
// track renders nothing (no fade, no dim plate).
export function resolveActiveCue({cues, timeMs}) {
  for (let index = 0; index < cues.length; index += 1) {
    if (timeMs >= cues[index].startMs && timeMs < cues[index].endMs) return index;
  }
  return -1;
}

export function calculateSubtitleBlock({cue, variant, width, height, position, measure}) {
  const scale = equalAreaScale(width, height);
  const zhFontSize = SOURCE_GEOMETRY.zhFontSize * scale;
  const enFontSize = SOURCE_GEOMETRY.enFontSize * scale;
  const zhLetterSpacing = zhFontSize * SOURCE_GEOMETRY.zhLetterSpacingEm;
  const enLetterSpacing = enFontSize * SOURCE_GEOMETRY.enLetterSpacingEm;
  const sideSafe = width * SAFE_SIDE_RATIO;
  const maxBlockWidth = Math.min(width - sideSafe * 2, SOURCE_GEOMETRY.maxBlockWidth * scale, width * SOURCE_GEOMETRY.blockWidthRatio);
  const showTranslation = variant === "BILINGUAL" && Boolean(cue.translation);

  const zh = buildCaptionLines({
    text: cue.text, maxWidth: maxBlockWidth, fontSize: zhFontSize, fontWeight: SOURCE_GEOMETRY.zhFontWeight,
    letterSpacing: zhLetterSpacing, measure, maxLines: MAX_ZH_LINES,
  });
  const en = showTranslation ? buildCaptionLines({
    text: cue.translation, maxWidth: maxBlockWidth, fontSize: enFontSize, fontWeight: SOURCE_GEOMETRY.enFontWeight,
    letterSpacing: enLetterSpacing, measure, maxLines: MAX_EN_LINES,
  }) : {lines: [], overflow: false, error: null};

  if (zh.error || en.error) return {overflow: true, reason: zh.error ?? en.error, cueId: cue.id};
  if (zh.overflow) return {overflow: true, reason: `字幕过长：中文主行在安全区内超过 ${MAX_ZH_LINES} 行，请拆分字幕条。`, cueId: cue.id};
  if (en.overflow) return {overflow: true, reason: `英文小字过长：超过 ${MAX_EN_LINES} 行，请缩短译文。`, cueId: cue.id};

  const zhLineHeightPx = zhFontSize * SOURCE_GEOMETRY.zhLineHeight;
  const enLineHeightPx = enFontSize * SOURCE_GEOMETRY.enLineHeight;
  const enMarginTop = SOURCE_GEOMETRY.enMarginTop * scale;
  const blockWidth = Math.min(maxBlockWidth, Math.max(
    ...zh.lines.map(line => line.width),
    ...(showTranslation ? en.lines.map(line => line.width) : [0]),
    1,
  ));
  const blockHeight = zh.lines.length * zhLineHeightPx + (showTranslation ? enMarginTop + en.lines.length * enLineHeightPx : 0);
  const topSafe = height * SAFE_TOP_RATIO;
  const bottomSafe = SOURCE_GEOMETRY.bottomOffset * scale;
  const verticalSpace = Math.max(0, height - topSafe - bottomSafe - blockHeight);

  return {
    scale, zhFontSize, enFontSize, zhLetterSpacing, enLetterSpacing, zhLineHeightPx, enLineHeightPx, enMarginTop,
    maxBlockWidth, showTranslation, zh, en, blockWidth, blockHeight,
    left: sideSafe + (width - sideSafe * 2 - blockWidth) * position.x,
    top: topSafe + verticalSpace * position.y,
    overflow: false,
  };
}
