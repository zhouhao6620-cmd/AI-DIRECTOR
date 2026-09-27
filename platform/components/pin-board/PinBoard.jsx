import React, {useMemo} from "react";
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  CHIP_BACKGROUND, CHIP_BORDER_COLOR, CHIP_INK, EASE_CHIP_TRANSFORM, EASE_CSS_EASE, EASE_SOURCE,
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculatePinBoardLayout, chipDelayMs, progressAt,
} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertPinBoardProps} from "./model.js";

// Source curves: `.hud { --ease: cubic-bezier(0.22, 1, 0.36, 1) }`, CSS `ease` for opacities,
// and `.pbd-chip`'s own overshooting curve. They are replayed frame by frame, not by CSS.
const easeSource = Easing.bezier(...EASE_SOURCE);
const easeCss = Easing.bezier(...EASE_CSS_EASE);
const easeChip = Easing.bezier(...EASE_CHIP_TRANSFORM);

export function PinBoard({content, position, size, surface, theme, align, stepMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertPinBoardProps({content, position, size, surface, theme, align, stepMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculatePinBoardLayout({
    content, width, height, size, position, align,
    // Glyph advances only: layout.js adds the CSS letter-spacing itself.
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position, align]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const riseScale = layout.factor;
  const titleOpacity = progressAt({frame, fps, durationMs: SOURCE_MOTION.titleOpacityMs, ease: easeSource});
  const titleEnter = progressAt({frame, fps, durationMs: SOURCE_MOTION.titleTransformMs, ease: easeSource});
  const subtitleOpacity = progressAt({frame, fps, delayMs: SOURCE_MOTION.subtitleDelayMs, durationMs: SOURCE_MOTION.subtitleOpacityMs, ease: easeSource});
  const subtitleEnter = progressAt({frame, fps, delayMs: SOURCE_MOTION.subtitleDelayMs, durationMs: SOURCE_MOTION.subtitleTransformMs, ease: easeSource});

  const pins = layout.chips.map((chip, index) => {
    const delayMs = chipDelayMs(index, stepMs);
    const opacity = progressAt({frame, fps, delayMs, durationMs: SOURCE_MOTION.chipOpacityMs, ease: easeCss});
    const enter = progressAt({frame, fps, delayMs, durationMs: SOURCE_MOTION.chipTransformMs, ease: easeChip});
    return {chip, index, delayMs, opacity, enter};
  });
  const revealed = pins.filter(pin => pin.opacity > 0 || pin.enter > 0).length;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-DATA-001"
      data-theme={theme} data-surface={surface} data-align={align}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      data-revealed-count={revealed}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.cardWidth,
        display: "flex", flexDirection: "column",
        alignItems: align === "RIGHT" ? "flex-end" : "flex-start",
        gap: layout.gap, color: tokens.ink,
      }}
    >
      <div data-pin-title style={{
        fontSize: layout.title.fontSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight,
        letterSpacing: layout.title.letterSpacing, lineHeight: SOURCE_GEOMETRY.lineHeight,
        color: tokens.ink, textShadow: tokens.textShadow, whiteSpace: "pre",
        opacity: titleOpacity, transform: `translateY(${(1 - titleEnter) * -SOURCE_MOTION.titleRisePx * riseScale}px)`,
      }}>{content.title}</div>

      {layout.subtitle && <div data-pin-subtitle style={{
        fontSize: layout.subtitle.fontSize, fontWeight: SOURCE_GEOMETRY.subtitleFontWeight,
        letterSpacing: layout.subtitle.letterSpacing, lineHeight: SOURCE_GEOMETRY.lineHeight,
        color: accent, whiteSpace: "pre",
        opacity: subtitleOpacity, transform: `translateY(${(1 - subtitleEnter) * -SOURCE_MOTION.subtitleRisePx * riseScale}px)`,
      }}>{content.subtitle}</div>}

      {pins.map(({chip, index, delayMs, opacity, enter}) => <div
        key={chip.id}
        data-pin-id={chip.id} data-pin-index={index} data-pin-delay-ms={delayMs}
        data-pin-opacity={Number(opacity.toFixed(4))} data-pin-enter={Number(enter.toFixed(4))}
        style={{
          boxSizing: "border-box", width: chip.width,
          padding: `${layout.padY}px ${layout.padX}px`, borderRadius: layout.chipRadius,
          background: CHIP_BACKGROUND, color: CHIP_INK,
          border: `${layout.border}px solid ${CHIP_BORDER_COLOR}`,
          fontSize: chip.fontSize, fontWeight: SOURCE_GEOMETRY.chipFontWeight,
          letterSpacing: chip.letterSpacing, lineHeight: SOURCE_GEOMETRY.lineHeight,
          whiteSpace: "pre",
          opacity,
          transform: `translateY(${(1 - enter) * -SOURCE_MOTION.chipRisePx * riseScale}px)`
            + ` scale(${SOURCE_MOTION.chipScaleFrom + (1 - SOURCE_MOTION.chipScaleFrom) * enter})`,
        }}
      >{chip.label}</div>)}
    </div>
  </AbsoluteFill>;
}
