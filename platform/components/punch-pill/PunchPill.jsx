import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, calculatePunchPillLayout, rgbaFromHex} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertPunchPillProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 460ms …`.
const ease = Easing.bezier(0.22, 1, 0.36, 1);

function enterProgress({frame, fps, durationMs}) {
  return interpolate(frame, [0, Math.max(1, Math.round((durationMs / 1000) * fps))], [0, 1], {...clamp, easing: ease});
}

export function PunchPill({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertPunchPillProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculatePunchPillLayout({content, position, size, width, height},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width),
  [content, position, size, width, height]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const opacity = enterProgress({frame, fps, durationMs: SOURCE_GEOMETRY.enterOpacityMs});
  const scale = enterProgress({frame, fps, durationMs: SOURCE_GEOMETRY.enterScaleMs});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-PUN-001" data-theme={theme} data-surface={surface}
      data-scale={layout.scale}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.blockWidth, height: layout.blockHeight,
        display: "flex", alignItems: "center",
      }}
    >
      <div data-pp-pill style={{
        boxSizing: "border-box", display: "inline-flex", alignItems: "center",
        gap: layout.gap, padding: `${layout.paddingY}px ${layout.paddingX}px`,
        borderRadius: layout.radius, border: `${layout.border}px solid ${accent}`,
        background: rgbaFromHex(accent, SOURCE_GEOMETRY.fillAlpha),
        boxShadow: tokens.cardShadow,
        fontSize: layout.fontSize, fontWeight: SOURCE_GEOMETRY.fontWeight, lineHeight: SOURCE_GEOMETRY.lineHeight,
        color: tokens.ink, whiteSpace: "pre",
        opacity, transform: `scale(${interpolate(scale, [0, 1], [SOURCE_GEOMETRY.enterScaleFrom, 1])})`,
      }}>
        <span data-pp-dot style={{width: layout.dotSize, height: layout.dotSize, borderRadius: "50%", background: accent, flex: "none"}}/>
        {layout.text}
      </div>
    </div>
  </AbsoluteFill>;
}
