// Source geometry copied from the Overlay Studio PinBoard source (read-only):
//   src/effects/hud/PinBoard.tsx → .pbd column markup, `items` split on "|", per-chip transitionDelay
//   src/effects/hud/hud.css      → .pbd-* rules and .hud-anchor--top-right / --top-left placement
//   src/effects/hud/accent.ts    → ACCENT_VAR mapping (blue / alert / orange)
//
// Adaptations performed here (recorded in docs/component-assets/CMP-04A_SOURCE_STYLE_ADAPTATION.md):
//   1. title / subtitle / chips are measured, so no label can overflow the safe area.
//      The source lets the browser lay the column out freely next to a fixed 120 px / 96 px corner.
//   2. the column is placed by the project's 0–1 safe-area ratio (CMP-02 convention) instead of
//      that fixed corner anchor;
//   3. the source's `position: top-right | top-left` becomes the `align` prop (RIGHT | LEFT),
//      which only decides which edge the column contents line up to;
//   4. the source declares no line-height for .pbd-title / .pbd-sub / .pbd-chip, so the
//      Chromium `normal` value is reproduced explicitly as 1.2 so measurement is deterministic.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  titleFontSize: 36,
  titleFontWeight: 900,
  titleLetterSpacing: 2,
  subtitleFontSize: 28,
  subtitleFontWeight: 800,
  subtitleLetterSpacing: 1,
  chipFontSize: 26,
  chipFontWeight: 700,
  chipLetterSpacing: 1,
  chipPadX: 22,
  chipPadY: 8,
  chipRadius: 10,
  chipBorderWidth: 1,
  columnGap: 13,
  lineHeight: 1.2,
  anchorX: 120,
  anchorY: 96,
});

// `.pbd-chip` in hud.css: a fixed near-black plate with a white hairline, independent of
// the card surface — the plate is the source's "黑牌", so it does not follow DARK / LIGHT.
export const CHIP_BACKGROUND = "rgba(15, 13, 21, 0.9)";
export const CHIP_INK = "rgba(255, 255, 255, 0.95)";
export const CHIP_BORDER_COLOR = "rgba(255, 255, 255, 0.24)";

// `.hud { --ease: cubic-bezier(0.22, 1, 0.36, 1) }` — the HUD family entrance curve.
export const EASE_SOURCE = Object.freeze([0.22, 1, 0.36, 1]);
// CSS `ease`, used by `.spf-box` / `.pbd` opacity transitions.
export const EASE_CSS_EASE = Object.freeze([0.25, 0.1, 0.25, 1]);
// `.pbd-chip` transform curve: cubic-bezier(0.2, 0.9, 0.3, 1.3) — the overshoot is the "落钉" snap.
export const EASE_CHIP_TRANSFORM = Object.freeze([0.2, 0.9, 0.3, 1.3]);

export const SOURCE_MOTION = Object.freeze({
  titleOpacityMs: 420,
  titleTransformMs: 460,
  titleRisePx: 18,
  subtitleDelayMs: 140,
  subtitleOpacityMs: 420,
  subtitleTransformMs: 460,
  subtitleRisePx: 14,
  chipBaseDelayMs: 400,
  chipOpacityMs: 340,
  chipTransformMs: 430,
  chipRisePx: 16,
  chipScaleFrom: 0.68,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

// The source clips nothing (it has no font floor). The registered component shrinks to this
// floor and then refuses, so no point is ever silently dropped or cut off.
export const MIN_LABEL_FONT_SIZE = 14;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

// Both current canvases (1080×1920 and 1920×1080) hold the same pixel area as the source
// 1920×1080 stage, so source geometry is preserved at scale 1.
export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

// Chrome adds letter-spacing after every character (including the last one), while a measuring
// helper reports glyph advances only, so the layout always adds the spacing itself.
export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

// Frame-driven equivalent of a CSS transition with `transition-delay`:
// before the delay the value is 0, it reaches 1 after `durationMs`, then stays there.
export function progressAt({frame, fps, delayMs = 0, durationMs, ease = value => value}) {
  const start = (delayMs / 1000) * fps;
  const span = Math.max(1, (durationMs / 1000) * fps);
  const t = Math.min(1, Math.max(0, (frame - start) / span));
  return ease(t);
}

// The source pins chip *i* at `400 ms + i × stepMs` (`transitionDelay: 400 + i * stepMs`).
export function chipDelayMs(index, stepMs) {
  return SOURCE_MOTION.chipBaseDelayMs + index * stepMs;
}

// The last chip must be fully pinned before the instance ends, otherwise content would be
// silently dropped. This is the real bound behind the source's "stepMs 对齐口播" note.
export function lastChipRevealMs(count, stepMs) {
  return chipDelayMs(count - 1, stepMs) + SOURCE_MOTION.chipTransformMs;
}

// How many full-width characters still fit one chip at the font floor.
export function chipCapacityFor({width, height, size = 1, measure, probe = "字", minFontSize = MIN_LABEL_FONT_SIZE}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const available = width - width * SAFE_X_RATIO * 2
    - (SOURCE_GEOMETRY.chipPadX * 2 + SOURCE_GEOMETRY.chipBorderWidth * 2) * factor;
  const charWidth = textWidth(measure, probe, minFontSize * canvasScale, SOURCE_GEOMETRY.chipFontWeight,
    (minFontSize * canvasScale / SOURCE_GEOMETRY.chipFontSize) * SOURCE_GEOMETRY.chipLetterSpacing);
  return Math.max(1, Math.floor(available / charWidth));
}

export function calculatePinBoardLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure, minFontSize = MIN_LABEL_FONT_SIZE}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const floor = minFontSize * canvasScale;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const padX = SOURCE_GEOMETRY.chipPadX * factor;
  const padY = SOURCE_GEOMETRY.chipPadY * factor;
  const border = SOURCE_GEOMETRY.chipBorderWidth * factor;
  const gap = SOURCE_GEOMETRY.columnGap * factor;
  const overflow = [];

  // Shrink to the readable floor first, then report instead of clipping.
  const fitText = (text, fontSize, fontWeight, letterSpacing, maxWidth, id, kind) => {
    const natural = textWidth(measure, text, fontSize, fontWeight, letterSpacing);
    let resolved = {fontSize, letterSpacing, width: natural};
    if (natural > maxWidth) {
      const scaled = Math.max(floor, fontSize * (maxWidth / natural));
      const ratio = scaled / fontSize;
      resolved = {
        fontSize: scaled,
        letterSpacing: letterSpacing * ratio,
        width: textWidth(measure, text, scaled, fontWeight, letterSpacing * ratio),
      };
    }
    if (resolved.width > maxWidth + 0.5) overflow.push({id, kind, text, available: maxWidth, required: resolved.width});
    return resolved;
  };

  const title = fitText(content.title, SOURCE_GEOMETRY.titleFontSize * factor, SOURCE_GEOMETRY.titleFontWeight,
    SOURCE_GEOMETRY.titleLetterSpacing * factor, availableWidth, "title", "章节标题");

  const subtitle = content.subtitle
    ? fitText(content.subtitle, SOURCE_GEOMETRY.subtitleFontSize * factor, SOURCE_GEOMETRY.subtitleFontWeight,
      SOURCE_GEOMETRY.subtitleLetterSpacing * factor, availableWidth, "subtitle", "强调副题")
    : null;

  const chipTextWidth = availableWidth - padX * 2 - border * 2;
  const chips = content.items.map(item => {
    const fitted = fitText(item.label, SOURCE_GEOMETRY.chipFontSize * factor, SOURCE_GEOMETRY.chipFontWeight,
      SOURCE_GEOMETRY.chipLetterSpacing * factor, chipTextWidth, item.id, "要点");
    return {
      id: item.id,
      label: item.label,
      fontSize: fitted.fontSize,
      letterSpacing: fitted.letterSpacing,
      textWidth: fitted.width,
      width: fitted.width + padX * 2 + border * 2,
      height: fitted.fontSize * SOURCE_GEOMETRY.lineHeight + padY * 2 + border * 2,
    };
  });

  const titleHeight = title.fontSize * SOURCE_GEOMETRY.lineHeight;
  const subtitleHeight = subtitle ? subtitle.fontSize * SOURCE_GEOMETRY.lineHeight : 0;
  const childCount = 1 + (subtitle ? 1 : 0) + chips.length;
  const cardWidth = Math.max(title.width, subtitle?.width ?? 0, ...chips.map(chip => chip.width));
  const cardHeight = titleHeight + subtitleHeight
    + chips.reduce((sum, chip) => sum + chip.height, 0)
    + gap * (childCount - 1);

  let rejection = null;
  if (overflow.length) {
    rejection = `以下文字在字号下限内仍放不进安全区域：${overflow.map(item => item.text).join("、")}。请缩短文字或调小大小。`;
  } else if (cardWidth > availableWidth + 0.5) {
    rejection = `要点钉板宽度 ${Math.round(cardWidth)} px 超出安全区域 ${Math.round(availableWidth)} px。请缩短文字或调小大小。`;
  } else if (cardHeight > availableHeight + 0.5) {
    rejection = `要点钉板高度 ${Math.round(cardHeight)} px 超出安全区域 ${Math.round(availableHeight)} px。请减少要点或调小大小。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow,
    cardWidth, cardHeight, gap, padX, padY, border, chipRadius: SOURCE_GEOMETRY.chipRadius * factor,
    title, subtitle, chips, rejection,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
