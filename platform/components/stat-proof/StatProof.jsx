import React, {useMemo} from "react";
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  EASE_CSS_EASE, EASE_SOURCE, FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  breathePhase, calculateStatProofLayout, easeOutExpo, formatNumber, progressAt,
} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertStatProofProps} from "./model.js";

const easeSource = Easing.bezier(...EASE_SOURCE);
const easeCss = Easing.bezier(...EASE_CSS_EASE);

export function StatProof({content, position, size, surface, theme, countMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertStatProofProps({content, position, size, surface, theme, countMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateStatProofLayout({
    content, width, height, size, position,
    // Glyph advances only: layout.js adds the CSS letter-spacing itself.
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const boxOpacity = progressAt({frame, fps, durationMs: SOURCE_MOTION.boxOpacityMs, ease: easeCss});
  const boxEnter = progressAt({frame, fps, durationMs: SOURCE_MOTION.boxTransformMs, ease: easeSource});
  const count = progressAt({frame, fps, durationMs: countMs, ease: easeOutExpo});
  const shown = formatNumber(content.value * count, layout.decimals);
  const breath = breathePhase({frame, fps});
  const brightness = 1 + (SOURCE_MOTION.breathMaxBrightness - 1) * breath;
  const glow = SOURCE_MOTION.breathShadowPx * breath;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-DATA-002"
      data-theme={theme} data-surface={surface}
      data-count={Number((content.value * count).toFixed(4))} data-count-progress={Number(count.toFixed(4))}
      data-breath-phase={Number(breath.toFixed(4))}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.cardWidth,
        display: "flex", flexDirection: "column", gap: layout.gap, color: tokens.ink,
        opacity: boxOpacity, transform: `translateY(${(1 - boxEnter) * SOURCE_MOTION.boxRisePx * layout.factor}px)`,
      }}
    >
      <div data-spf-kicker style={{
        display: "flex", alignItems: "center", gap: layout.kickerGap,
        fontFamily: MONO_FONT_FAMILY, fontSize: layout.kicker.fontSize, fontWeight: SOURCE_GEOMETRY.kickerFontWeight,
        letterSpacing: layout.kicker.letterSpacing, color: accent, whiteSpace: "pre",
      }}>
        <i data-spf-bar style={{width: layout.kickerBarWidth, height: layout.kickerBarHeight, background: accent, flex: "none"}}/>
        <span data-spf-kicker-text>{content.kicker}</span>
      </div>

      {layout.kickerZh && <div data-spf-kicker-zh style={{
        fontSize: layout.kickerZh.fontSize, letterSpacing: layout.kickerZh.letterSpacing,
        color: tokens.muted, whiteSpace: "pre", lineHeight: SOURCE_GEOMETRY.lineHeight,
      }}>{content.kickerZh}</div>}

      <div data-spf-num style={{
        fontSize: layout.numFontSize, fontWeight: SOURCE_GEOMETRY.numFontWeight,
        lineHeight: SOURCE_GEOMETRY.numLineHeight, letterSpacing: layout.numLetterSpacing,
        color: tokens.ink, whiteSpace: "pre", fontVariantNumeric: "tabular-nums",
        filter: `brightness(${brightness.toFixed(4)}) drop-shadow(0 0 ${glow.toFixed(3)}px ${accent})`,
      }}>
        {content.prefix ? <span data-spf-prefix style={{color: accent}}>{content.prefix}</span> : null}
        <span data-spf-value>{shown}</span>
        {content.suffix ? <span data-spf-suffix style={{
          color: accent, fontSize: layout.suffixFontSize, verticalAlign: `${SOURCE_GEOMETRY.suffixRaiseEm}em`,
        }}>{content.suffix}</span> : null}
      </div>

      {layout.footEn && <div data-spf-foot-en style={{
        marginTop: SOURCE_GEOMETRY.footEnMarginTop * layout.factor,
        fontFamily: MONO_FONT_FAMILY, fontSize: layout.footEn.fontSize, fontWeight: SOURCE_GEOMETRY.footEnFontWeight,
        letterSpacing: layout.footEn.letterSpacing, color: accent, whiteSpace: "pre",
      }}>{content.footEn}</div>}
      {layout.footZh && <div data-spf-foot-zh style={{
        fontSize: layout.footZh.fontSize, letterSpacing: layout.footZh.letterSpacing,
        color: tokens.muted, whiteSpace: "pre", lineHeight: SOURCE_GEOMETRY.lineHeight,
      }}>{content.footZh}</div>}
    </div>
  </AbsoluteFill>;
}
