import React, {useMemo} from "react";
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  DIGITS, EASE_REEL, FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  calculateOdometerLayout, digitDelayMs, progressAt,
} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertOdometerProps} from "./model.js";

const easeReel = Easing.bezier(...EASE_REEL);

export function Odometer({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertOdometerProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateOdometerLayout({
    content, width, height, size, position,
    // Glyph advances only: the odometer uses no letter-spacing.
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: MONO_FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const targets = layout.digits.map(digit => Number(digit));
  const settledCount = targets.filter((target, index) => progressAt({
    frame, fps, delayMs: digitDelayMs(index, targets.length), durationMs: SOURCE_MOTION.reelMs, ease: easeReel,
  }) >= 1 - 1e-9).length;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-DATA-003"
      data-theme={theme} data-surface={surface}
      data-digit-count={targets.length} data-settled-digits={settledCount}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.cardWidth,
        display: "flex", flexDirection: "column", alignItems: "center", gap: layout.gap, color: tokens.ink,
      }}
    >
      {layout.kicker && <div data-od-kicker style={{
        fontFamily: MONO_FONT_FAMILY, fontSize: layout.kicker.fontSize, fontWeight: SOURCE_GEOMETRY.kickerFontWeight,
        letterSpacing: layout.kicker.letterSpacing, textTransform: "uppercase", color: tokens.muted, whiteSpace: "pre",
      }}>{content.kicker}</div>}

      <div data-od-row style={{display: "flex", alignItems: "baseline", gap: layout.rowGap}}>
        {targets.map((target, index) => {
          const delayMs = digitDelayMs(index, targets.length);
          const reel = progressAt({frame, fps, delayMs, durationMs: SOURCE_MOTION.reelMs, ease: easeReel});
          return <span
            key={index}
            data-od-slot data-od-target={target} data-od-reel-progress={Number(reel.toFixed(4))}
            style={{
              height: layout.slotHeight, overflow: "hidden", display: "inline-block",
              fontFamily: MONO_FONT_FAMILY, fontSize: layout.slotFontSize, fontWeight: SOURCE_GEOMETRY.slotFontWeight,
              lineHeight: SOURCE_GEOMETRY.slotHeightEm, color: tokens.ink, textShadow: tokens.textShadow,
            }}
          >
            <span data-od-reel style={{
              display: "flex", flexDirection: "column",
              transform: `translateY(${-target * SOURCE_GEOMETRY.slotHeightEm * reel}em)`,
            }}>
              {DIGITS.map(digit => <span key={digit} data-od-d style={{
                height: `${SOURCE_GEOMETRY.slotHeightEm}em`, display: "block",
              }}>{digit}</span>)}
            </span>
          </span>;
        })}
        {layout.unit && <span data-od-unit style={{
          fontSize: layout.unit.fontSize, fontWeight: SOURCE_GEOMETRY.unitFontWeight,
          color: accent, marginLeft: layout.unitMarginLeft, whiteSpace: "pre",
        }}>{content.unit}</span>}
      </div>

      {layout.label && <div data-od-label style={{
        fontSize: layout.label.fontSize, color: tokens.muted, whiteSpace: "pre", lineHeight: SOURCE_GEOMETRY.lineHeight,
      }}>{content.label}</div>}
    </div>
  </AbsoluteFill>;
}
