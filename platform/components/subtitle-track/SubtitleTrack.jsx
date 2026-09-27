import React, {useMemo} from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, calculateSubtitleBlock, captionShadow, resolveActiveCue} from "./layout.js";
import {ACCENTS, STROKE_COLOR, STROKE_WIDTH, assertSubtitleTrackProps} from "./model.js";

export function SubtitleTrack({content, position, variant, stroke, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertSubtitleTrackProps({content, position, variant, stroke, theme, durationInFrames}, {fps, width, height});
  // Glyph advances only: layout.js adds the CSS letter-spacing itself.
  const measure = (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width;
  const activeIndex = resolveActiveCue({cues: content.cues, timeMs: (frame / fps) * 1000});
  const cue = activeIndex >= 0 ? content.cues[activeIndex] : null;
  // Hooks stay unconditional: the track draws nothing between cues, but the hook
  // order must not change from frame to frame.
  const block = useMemo(
    () => (cue ? calculateSubtitleBlock({cue, variant, width, height, position, measure}) : null),
    [cue, variant, width, height, position.x, position.y],
  );

  // Source behaviour: no cue on screen → nothing rendered, and no fade between cues.
  if (!cue) return null;
  if (!block || block.overflow) throw new Error(block?.reason ?? "字幕内容超出支持范围。");

  const accent = ACCENTS[theme].keyword;
  const zhShadow = captionShadow({strokeWidth: stroke ? STROKE_WIDTH : 0, color: STROKE_COLOR, halo: 1});
  const enShadow = captionShadow({strokeWidth: stroke ? STROKE_WIDTH * 0.6 : 0, color: STROKE_COLOR, halo: 0.7});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-SUB-001"
      data-cue-id={cue.id} data-cue-index={activeIndex}
      data-theme={theme} data-variant={variant} data-stroke={stroke ? "on" : "off"} data-position={`${position.x},${position.y}`}
      style={{
        position: "absolute", left: block.left, top: block.top, width: block.blockWidth,
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      }}
    >
      <div data-subtitle-line="zh" style={{
        fontSize: block.zhFontSize, fontWeight: SOURCE_GEOMETRY.zhFontWeight, lineHeight: SOURCE_GEOMETRY.zhLineHeight,
        letterSpacing: `${block.zhLetterSpacing}px`, color: "#fff", textShadow: zhShadow,
      }}>
        {block.zh.lines.map((line, index) => <div data-text-line key={index} style={{whiteSpace: "pre"}}>
          {line.segments.map((segment, segmentIndex) => segment.emphasis
            ? <i data-keyword key={segmentIndex} style={{fontStyle: "normal", color: accent}}>{segment.text}</i>
            : <span key={segmentIndex}>{segment.text}</span>)}
        </div>)}
      </div>
      {block.showTranslation && block.en.lines.length > 0 && <div data-subtitle-line="en" style={{
        marginTop: block.enMarginTop, fontSize: block.enFontSize, fontWeight: SOURCE_GEOMETRY.enFontWeight,
        lineHeight: SOURCE_GEOMETRY.enLineHeight, letterSpacing: `${block.enLetterSpacing}px`,
        color: "rgba(255,255,255,0.82)", textShadow: enShadow,
      }}>
        {block.en.lines.map((line, index) => <div data-text-line key={index} style={{whiteSpace: "pre"}}>
          {line.segments.map((segment, segmentIndex) => <span key={segmentIndex}>{segment.text}</span>)}
        </div>)}
      </div>}
    </div>
  </AbsoluteFill>;
}
