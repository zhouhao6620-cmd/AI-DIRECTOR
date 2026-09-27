// Source geometry is copied from the Overlay Studio ChapterBar source:
//   src/effects/hud/ChapterBar.tsx  → .cbar markup and chapter/progress math
//   src/effects/hud/hud.css         → .cbar / .cbar-item / .cbar-fill / .cbar-prog rules
//   src/effects/hud/accent.ts       → ACCENT_VAR mapping (blue / alert / orange)
// Adaptation inside layout.js: chapter intervals are supplied as real start/end
// ranges instead of "start seconds + fallback end", and label text is measured so
// it always fits the equal-width source segment instead of being clipped by
// `overflow: hidden`.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  barHeight: 48,
  fontSize: 21,
  fontWeight: 600,
  activeFontWeight: 800,
  letterSpacingEm: 0.08,
  ruleInset: 14,
  ruleWidth: 1,
  progressLineHeight: 4,
  progressEdgeWidth: 3,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

// Source has no font floor (it clips with `overflow: hidden`). The registered
// component refuses to clip, so it shrinks to this floor and then rejects.
export const MIN_LABEL_FONT_SIZE = 14;
export const SEGMENT_PADDING_PX = 8;

// Both current canvases (1080×1920 and 1920×1080) hold the same pixel area as the
// source 1920×1080 stage, so source geometry is preserved at scale 1.
export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

// Source uses `color-mix(in srgb, <token> <alpha>, transparent)`. Mixing an sRGB
// colour with transparent black keeps the colour and scales alpha, so the same
// look is produced by an explicit rgba() value that is also comparable in QA.
export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// Chrome adds letter-spacing after every character (including the last one), while
// the measuring helper reports glyph advances only. The layout therefore always
// adds the spacing itself, so a fitted label can never overflow its segment.
export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

// Same rule as the source: the active chapter is the last one whose start has
// been reached; the bar is split into equal-width segments, so the fill is
// (finished chapters + current chapter progress) / segment count.
export function resolveChapterTimeline({chapters, timeMs}) {
  let activeIndex = 0;
  for (let index = 0; index < chapters.length; index += 1) if (timeMs >= chapters[index].startMs) activeIndex = index;
  const active = chapters[activeIndex];
  const span = Math.max(1, active.endMs - active.startMs);
  const progress = Math.min(1, Math.max(0, (timeMs - active.startMs) / span));
  return {
    activeIndex,
    progress,
    fillPercent: ((activeIndex + progress) / chapters.length) * 100,
    complete: timeMs >= chapters.at(-1).endMs,
  };
}

export function calculateChapterBarLayout({chapters, width, height, measure, minFontSize = MIN_LABEL_FONT_SIZE}) {
  const scale = equalAreaScale(width, height);
  const segmentWidth = width / chapters.length;
  const padding = SEGMENT_PADDING_PX * scale;
  const ruleWidth = Math.max(1, Math.round(SOURCE_GEOMETRY.ruleWidth * scale));
  const available = segmentWidth - padding * 2 - ruleWidth;
  const baseFontSize = SOURCE_GEOMETRY.fontSize * scale;
  const letterSpacing = baseFontSize * SOURCE_GEOMETRY.letterSpacingEm;
  const overflow = [];

  const segments = chapters.map((chapter, index) => {
    const measured = textWidth(measure, chapter.label, baseFontSize, SOURCE_GEOMETRY.fontWeight, letterSpacing);
    let fontSize = baseFontSize;
    if (measured > available) fontSize = Math.max(minFontSize * scale, baseFontSize * (available / measured));
    const fitted = textWidth(measure, chapter.label, fontSize, SOURCE_GEOMETRY.fontWeight, fontSize * SOURCE_GEOMETRY.letterSpacingEm);
    if (fitted > available + 0.5) overflow.push({id: chapter.id, label: chapter.label, available, required: fitted});
    return {
      id: chapter.id,
      label: chapter.label,
      index,
      startMs: chapter.startMs,
      endMs: chapter.endMs,
      fontSize,
      letterSpacing: fontSize * SOURCE_GEOMETRY.letterSpacingEm,
      fitted,
      available,
      x: segmentWidth * index,
      width: segmentWidth,
    };
  });

  return {
    scale,
    segmentWidth,
    padding,
    ruleWidth,
    ruleInset: SOURCE_GEOMETRY.ruleInset * scale,
    barHeight: SOURCE_GEOMETRY.barHeight * scale,
    baseFontSize,
    progressLineHeight: SOURCE_GEOMETRY.progressLineHeight * scale,
    progressEdgeWidth: Math.max(1, SOURCE_GEOMETRY.progressEdgeWidth * scale),
    segments,
    overflow,
  };
}

// How many full-width characters a segment can still hold at the font floor.
// The registered component reports this instead of clipping long labels.
export function labelCapacityFor({count, width, height, measure, probe = "字", minFontSize = MIN_LABEL_FONT_SIZE}) {
  const scale = equalAreaScale(width, height);
  const available = width / count - SEGMENT_PADDING_PX * scale * 2 - Math.max(1, Math.round(SOURCE_GEOMETRY.ruleWidth * scale));
  const charWidth = textWidth(measure, probe, minFontSize * scale, SOURCE_GEOMETRY.fontWeight, minFontSize * scale * SOURCE_GEOMETRY.letterSpacingEm);
  return Math.max(1, Math.floor(available / charWidth));
}
