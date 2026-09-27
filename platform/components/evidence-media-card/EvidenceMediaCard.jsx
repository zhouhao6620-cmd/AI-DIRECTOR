import React, {useMemo} from "react";
import {AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, calculateEvidenceMediaCardLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertEvidenceMediaCardProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function EvidenceMediaCard({content, position, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertEvidenceMediaCardProps({content, position, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateEvidenceMediaCardLayout({
    content, position, width, height,
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width,
    monoMeasure: (text, fontSize, fontWeight) => measureText({text, fontFamily: MONO_FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, position, width, height]);
  if (layout.overflow.length) {
    const first = layout.overflow[0];
    const message = first.type === "TITLE_TOO_LONG"
      ? `标题需要 ${first.lines} 行，超过 ${first.maxLines} 行上限；请缩短标题。`
      : first.type === "CARD_TOO_SMALL"
        ? "当前画幅与画框比例下材料框过小；请改用更扁的画框、缩短标题或换用横屏画幅。"
        : "证据卡超出画布安全区；请缩短内容或换用横屏画幅。";
    throw new Error(message);
  }

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const enter = interpolate(frame, [0, Math.max(1, Math.round((SOURCE_GEOMETRY.enterMs / 1000) * fps))], [0, 1], {...clamp, easing: EASE});
  const mediaSrc = staticFile(layout.media.src);
  const mediaStyle = {
    width: layout.media.width, height: layout.media.height,
    objectFit: "contain", display: "block",
    borderRadius: layout.media.radius,
  };

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-EVD-001"
      data-position={position} data-surface={surface} data-theme={theme}
      data-media-kind={layout.media.kind} data-media-frame={layout.media.frame} data-media-src={layout.media.src}
      style={{
        position: "absolute", left: layout.card.x, top: layout.card.y,
        width: layout.card.width, height: layout.card.height, boxSizing: "border-box",
        padding: layout.card.padding, borderRadius: layout.card.radius,
        background: tokens.card, border: `1px solid ${tokens.cardBorder}`, boxShadow: tokens.cardShadow,
        opacity: enter, transform: `scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
      }}
    >
      <div data-evd-media style={{
        position: "relative", width: layout.media.width, height: layout.media.height,
        borderRadius: layout.media.radius, overflow: "hidden",
        background: tokens.mediaSurface, border: `${layout.media.borderWidth}px solid ${tokens.mediaBorder}`,
        boxSizing: "border-box",
      }}>
        {layout.media.kind === "VIDEO"
          ? <OffthreadVideo src={mediaSrc} muted style={mediaStyle} pauseWhenBuffering/>
          : <Img src={mediaSrc} style={mediaStyle}/>}
      </div>

      <div data-evd-title style={{
        position: "absolute", left: layout.title.ruleX - layout.card.x, top: layout.title.y - layout.card.y,
        width: layout.title.ruleWidth, height: layout.title.ruleHeight, background: accent,
      }}/>
      <div data-evd-title-text style={{position: "absolute", left: layout.title.x - layout.card.x, top: layout.title.y - layout.card.y}}>
        {layout.title.lines.map((line, index) => <span key={index} data-evd-title-line style={{
          display: "block", whiteSpace: "pre", color: tokens.ink,
          fontSize: layout.title.fontSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight,
          lineHeight: `${layout.title.lineHeight}px`,
        }}>{line}</span>)}
      </div>

      {layout.caption && <div data-evd-caption style={{
        position: "absolute", left: layout.caption.x - layout.card.x, top: layout.caption.y - layout.card.y,
        fontFamily: MONO_FONT_FAMILY, fontSize: layout.caption.fontSize, fontWeight: SOURCE_GEOMETRY.monoFontWeight,
        letterSpacing: layout.caption.letterSpacing, lineHeight: `${layout.caption.lineHeight}px`, color: tokens.muted,
        whiteSpace: "pre",
      }}>{layout.caption.text}</div>}

      <div data-evd-source style={{position: "absolute", left: layout.source.x - layout.card.x, top: layout.source.y - layout.card.y}}>
        <div data-evd-source-line style={{
          fontFamily: MONO_FONT_FAMILY, fontSize: layout.source.fontSize, fontWeight: SOURCE_GEOMETRY.monoFontWeight,
          letterSpacing: layout.source.letterSpacing, lineHeight: `${layout.source.lineHeight}px`, color: tokens.ink,
          whiteSpace: "pre",
        }}>{layout.source.line}</div>
        {layout.source.detail && <div data-evd-source-detail style={{
          fontFamily: MONO_FONT_FAMILY, fontSize: layout.source.fontSize, fontWeight: SOURCE_GEOMETRY.monoFontWeight,
          letterSpacing: layout.source.letterSpacing, lineHeight: `${layout.source.lineHeight}px`, color: tokens.faint,
          whiteSpace: "pre",
        }}>{layout.source.detail}</div>}
      </div>
    </div>
  </AbsoluteFill>;
}
