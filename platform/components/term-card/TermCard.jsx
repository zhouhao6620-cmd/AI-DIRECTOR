import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, MONO_FAMILY, SOURCE_GEOMETRY, calculateTermCardLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertTermCardProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `transition: opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms …`.
const ease = Easing.bezier(0.22, 1, 0.36, 1);

export function TermCard({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertTermCardProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateTermCardLayout({content, position, size, width, height},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width),
  [content, position, size, width, height]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const enter = interpolate(frame, [0, Math.max(1, Math.round((SOURCE_GEOMETRY.enterMs / 1000) * fps))], [0, 1], {...clamp, easing: ease});
  const card = layout.card;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-TRM-001" data-theme={theme} data-surface={surface} data-scale={layout.scale}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.blockWidth, height: layout.blockHeight,
        boxSizing: "border-box", padding: `${layout.paddingY}px ${layout.paddingX}px`,
        borderRadius: layout.radius,
        // Source `.tc-card` draws only the 5 px accent left border.
        borderLeft: `${layout.accentBorder}px solid ${accent}`,
        background: tokens.glass, boxShadow: tokens.cardShadow,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [SOURCE_GEOMETRY.enterOffsetY, 0])}px) scale(${interpolate(enter, [0, 1], [SOURCE_GEOMETRY.enterScaleFrom, 1])})`,
        transformOrigin: "left center",
      }}
    >
      {card.en.length > 0 && <div data-tc-en style={{
        fontFamily: MONO_FAMILY, fontSize: card.enFontSize, fontWeight: SOURCE_GEOMETRY.enFontWeight,
        letterSpacing: `${card.enLetterSpacing}px`, textTransform: "uppercase", color: tokens.muted,
        marginBottom: layout.enMarginBottom, whiteSpace: "pre",
      }}>{card.en.join(" ")}</div>}
      <div data-tc-term style={{
        fontSize: card.termFontSize, fontWeight: SOURCE_GEOMETRY.termFontWeight,
        lineHeight: SOURCE_GEOMETRY.termLineHeight, letterSpacing: `${card.termLetterSpacing}px`, color: accent,
      }}>
        {card.term.map((line, index) => <div data-text-line key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
      </div>
      <div data-tc-def style={{
        fontSize: card.defFontSize, fontWeight: SOURCE_GEOMETRY.defFontWeight,
        lineHeight: SOURCE_GEOMETRY.defLineHeight, color: tokens.ink, marginTop: layout.defMarginTop,
      }}>
        {card.definition.map((line, index) => <div data-text-line key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
      </div>
    </div>
  </AbsoluteFill>;
}
