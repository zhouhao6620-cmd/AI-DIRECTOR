import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, calculateEntityChipsLayout} from "./layout.js";
import {assertEntityChipsProps, subColorOf} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `transition: opacity 0.5s var(--ease), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)`.
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const CHIP_MS = SOURCE_GEOMETRY.chipEnterMs;

export function EntityChips({content, stepMs, position, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertEntityChipsProps({content, stepMs, position, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateEntityChipsLayout({
    content, position, width, height, stepMs,
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width,
    measureMono: (text, fontSize, fontWeight) => measureText({text, fontFamily: MONO_FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, position, width, height, stepMs]);
  if (layout.overflow.length) {
    throw new Error(`名牌总宽 ${Math.round(layout.overflow[0].required)} px 超出可用宽度 ${Math.round(layout.overflow[0].available)} px；请缩短名称、减少名牌数量或去掉侧注。`);
  }

  const framesOf = ms => (ms / 1000) * fps;
  const enterOf = enterAtMs => interpolate(frame, [framesOf(enterAtMs), framesOf(enterAtMs + CHIP_MS)], [0, 1], {...clamp, easing: EASE});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-ENT-001"
      data-position={position} data-theme={theme}
      style={{position: "absolute", left: layout.x, top: layout.y, width: layout.rowWidth, height: layout.rowHeight}}
    >
      {layout.chips.map(chip => {
        const enter = enterOf(chip.enterAtMs);
        return <div
          key={chip.id}
          data-etc-chip-id={chip.id}
          data-etc-chip-style={chip.style}
          data-etc-chip-index={chip.index}
          style={{
            position: "absolute", left: chip.x - layout.x, top: chip.y - layout.y,
            width: chip.width, height: chip.height, boxSizing: "border-box",
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: `${chip.paddingY}px ${chip.paddingX}px`,
            borderRadius: SOURCE_GEOMETRY.chipRadius * layout.scale,
            background: chip.style === "DARK" ? SOURCE_GEOMETRY.chipDarkBackground : SOURCE_GEOMETRY.chipLightBackground,
            border: chip.style === "DARK" ? `${chip.border}px solid ${SOURCE_GEOMETRY.chipDarkBorder}` : "none",
            boxShadow: SOURCE_GEOMETRY.chipShadow,
            // Source `.etc.hud, .etc.hud * { text-shadow: none !important }`.
            textShadow: "none",
            opacity: enter,
            transform: `translateX(${interpolate(enter, [0, 1], [-SOURCE_GEOMETRY.chipSlideDistance * layout.scale, 0])}px)`,
          }}
        >
          <span data-etc-name style={{
            whiteSpace: "pre", color: chip.style === "DARK" ? SOURCE_GEOMETRY.darkNameColor : SOURCE_GEOMETRY.lightNameColor,
            fontSize: chip.nameFontSize, fontWeight: SOURCE_GEOMETRY.nameFontWeight,
            letterSpacing: chip.nameLetterSpacing, lineHeight: `${chip.nameLineHeight}px`,
          }}>{chip.name}</span>
          {chip.sub && <span data-etc-sub style={{
            whiteSpace: "pre", fontFamily: MONO_FONT_FAMILY,
            color: subColorOf(chip.style, theme),
            fontSize: chip.subFontSize, fontWeight: SOURCE_GEOMETRY.subFontWeight,
            letterSpacing: chip.subLetterSpacing, lineHeight: `${chip.subLineHeight}px`,
            marginTop: chip.subMarginTop,
          }}>{chip.sub}</span>}
        </div>;
      })}
      {layout.note && <div
        data-etc-note
        style={{
          position: "absolute", left: layout.note.x - layout.x, top: layout.note.y - layout.y,
          display: "flex", flexDirection: "column", justifyContent: "center",
          opacity: enterOf(layout.note.enterAtMs),
          transform: `translateX(${interpolate(enterOf(layout.note.enterAtMs), [0, 1], [-SOURCE_GEOMETRY.noteSlideDistance * layout.scale, 0])}px)`,
        }}
      >
        {layout.note.a && <span data-etc-note-a style={{
          whiteSpace: "pre", fontSize: layout.note.noteFontSizeA, fontWeight: SOURCE_GEOMETRY.noteAFontWeight,
          color: SOURCE_GEOMETRY.noteAColor, lineHeight: `${layout.note.lineHeightA}px`,
        }}>{layout.note.a}</span>}
        {layout.note.b && <span data-etc-note-b style={{
          whiteSpace: "pre", fontSize: layout.note.noteFontSizeB, fontWeight: SOURCE_GEOMETRY.noteBFontWeight,
          color: SOURCE_GEOMETRY.noteBColor, lineHeight: `${layout.note.lineHeightB}px`,
          marginTop: layout.note.a ? layout.note.noteGap : 0,
        }}>{layout.note.b}</span>}
      </div>}
    </div>
  </AbsoluteFill>;
}
