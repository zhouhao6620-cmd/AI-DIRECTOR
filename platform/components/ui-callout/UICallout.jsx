import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, calculateUICalloutLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertUICalloutProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const ease = Easing.bezier(0.22, 1, 0.36, 1);

function progress({frame, fps, delayMs, durationMs}) {
  const start = (delayMs / 1000) * fps;
  const length = Math.max(1, Math.round((durationMs / 1000) * fps));
  return interpolate(frame - start, [0, length], [0, 1], {...clamp, easing: ease});
}

export function UICallout({content, ring, side, position, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertUICalloutProps({content, ring, side, position, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateUICalloutLayout({content, ring, side, position, width, height},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width),
  [content, ring, side, position, width, height]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const geometry = layout.geometry;
  const ringEnter = progress({frame, fps, delayMs: 0, durationMs: SOURCE_GEOMETRY.ringEnterMs});
  const lineGrow = progress({frame, fps, delayMs: SOURCE_GEOMETRY.lineDelayMs, durationMs: SOURCE_GEOMETRY.lineGrowMs});
  const tagEnter = progress({frame, fps, delayMs: SOURCE_GEOMETRY.tagDelayMs, durationMs: SOURCE_GEOMETRY.tagEnterMs});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-UIC-001" data-theme={theme} data-surface={surface} data-side={side}
      data-ring={`${ring.width}x${ring.height}`}
      style={{position: "absolute", left: layout.x, top: layout.y, width: layout.blockWidth, height: layout.blockHeight}}
    >
      <div data-uc-ring style={{
        position: "absolute", left: geometry.ringLeft, top: geometry.ringTop,
        width: ring.width, height: ring.height, boxSizing: "border-box",
        border: `${SOURCE_GEOMETRY.ringBorder}px solid ${accent}`, borderRadius: SOURCE_GEOMETRY.ringRadius,
        opacity: ringEnter, transform: `scale(${interpolate(ringEnter, [0, 1], [SOURCE_GEOMETRY.ringScaleFrom, 1])})`,
      }}/>
      <svg data-uc-leader width={layout.blockWidth} height={layout.blockHeight} style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}>
        <line x1={geometry.lineFrom} y1={geometry.midY} x2={geometry.lineTo} y2={geometry.midY} style={{
          stroke: accent, strokeWidth: SOURCE_GEOMETRY.lineWidth,
          strokeDasharray: SOURCE_GEOMETRY.lineLength,
          strokeDashoffset: SOURCE_GEOMETRY.lineLength * (1 - lineGrow),
        }}/>
      </svg>
      <div data-uc-tag style={{
        position: "absolute", left: geometry.tagLeft, top: geometry.midY,
        boxSizing: "border-box", padding: `${SOURCE_GEOMETRY.tagPaddingY}px ${SOURCE_GEOMETRY.tagPaddingX}px`,
        borderRadius: SOURCE_GEOMETRY.tagRadius,
        background: tokens.glass, border: `${SOURCE_GEOMETRY.tagBorder}px solid ${tokens.glassBorder}`,
        borderLeft: `${SOURCE_GEOMETRY.tagAccentBorder}px solid ${accent}`,
        boxShadow: tokens.cardShadow,
        fontSize: SOURCE_GEOMETRY.tagFontSize, fontWeight: SOURCE_GEOMETRY.tagFontWeight,
        lineHeight: SOURCE_GEOMETRY.tagLineHeight, color: tokens.ink, whiteSpace: "nowrap",
        opacity: tagEnter,
        transform: `translateY(calc(-50% + ${interpolate(tagEnter, [0, 1], [SOURCE_GEOMETRY.tagOffsetY, 0])}px))`,
      }}>{content.label}</div>
    </div>
  </AbsoluteFill>;
}
