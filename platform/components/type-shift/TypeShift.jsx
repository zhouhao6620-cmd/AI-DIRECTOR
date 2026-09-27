import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, calculateTypeShiftLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertTypeShiftProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `.ts-line` opacity 420 ms with the shared HUD curve; the re-flow uses
// cubic-bezier(0.25, 0.9, 0.3, 1) for transform / font-size / letter-spacing.
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const reflowEase = Easing.bezier(0.25, 0.9, 0.3, 1);

function rgbaOf(color) {
  if (color.startsWith("#")) return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  const parts = color.match(/[\d.]+/g).map(Number);
  return [parts[0], parts[1], parts[2]];
}

// The source hands the accent colour over with a 500 ms colour transition; the
// interpolation keeps that fade instead of snapping the hero line to the accent.
function mixColor(from, to, progress) {
  const a = rgbaOf(from);
  const b = rgbaOf(to);
  return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * progress)).join(", ")})`;
}

export function TypeShift({content, position, size, surface, theme, background, glassAlpha, shiftAtMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertTypeShiftProps({content, position, size, surface, theme, background, glassAlpha, shiftAtMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateTypeShiftLayout({content, position, size, background, width, height},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width),
  [content, position, size, background, width, height]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const shiftFrame = (shiftAtMs / 1000) * fps;
  const color = role => role === "HERO" ? accent : role === "SMALL" ? tokens.muted : tokens.ink;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-TYP-001" data-theme={theme} data-surface={surface} data-background={background}
      data-shift-ms={shiftAtMs} data-scale={layout.scale}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.blockWidth, height: layout.blockHeight,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Source `.hud-glass` is an optional plate behind the type; `glassAlpha` covers
          the plate only, so the line colours stay at full strength. */}
      {background === "GLASS" && <div data-ts-glass style={{
        position: "absolute", inset: 0, borderRadius: SOURCE_GEOMETRY.glassRadius,
        background: tokens.glass, border: `1px solid ${tokens.glassBorder}`, boxShadow: tokens.cardShadow,
        opacity: glassAlpha,
      }}/>}
      {layout.lines.map(line => {
        const reveal = interpolate(
          frame - ((SOURCE_GEOMETRY.lineRevealBaseMs + line.index * SOURCE_GEOMETRY.lineRevealStepMs) / 1000) * fps,
          [0, Math.max(1, Math.round((SOURCE_GEOMETRY.lineRevealMs / 1000) * fps))], [0, 1], {...clamp, easing: ease});
        const reflow = interpolate(
          frame - shiftFrame - (line.index * SOURCE_GEOMETRY.reflowStepMs / 1000) * fps,
          [0, Math.max(1, Math.round((SOURCE_GEOMETRY.reflowMs / 1000) * fps))], [0, 1], {...clamp, easing: reflowEase});
        const fontSize = interpolate(reflow, [0, 1], [line.fontFrom, line.fontTo]);
        const fontWeight = Math.round(interpolate(reflow, [0, 1], [line.weightFrom, line.weightTo]) / 100) * 100;
        const height = interpolate(reflow, [0, 1], [line.heightFrom, line.heightTo]);
        return <div
          key={line.index} data-ts-line data-role={line.role} data-index={line.index}
          style={{
            width: layout.blockWidth, height, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize, fontWeight, lineHeight: `${height}px`, whiteSpace: "pre",
            letterSpacing: `${interpolate(reflow, [0, 1], [0, line.letterSpacingTo])}px`,
            color: mixColor(tokens.ink, color(line.role), reflow),
            opacity: reveal,
            transform: `translateX(${interpolate(reflow, [0, 1], [line.ragShift, 0])}px)`,
          }}
        >{line.text}</div>;
      })}
    </div>
  </AbsoluteFill>;
}
