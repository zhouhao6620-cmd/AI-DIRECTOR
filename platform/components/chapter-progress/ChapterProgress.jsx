import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, calculateChapterBarLayout, resolveChapterTimeline, rgbaFromHex} from "./layout.js";
import {ACCENTS, PROGRESS_ALPHA, SURFACE_TOKENS, assertChapterProgressProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1)`.
const ENTRANCE_MS = 700;

export function ChapterProgress({content, variant, showProgress, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertChapterProgressProps({content, variant, showProgress, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateChapterBarLayout({
    chapters: content.chapters, width, height,
    // Glyph advances only: layout.js adds the CSS letter-spacing itself.
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, width, height]);
  if (layout.overflow.length) {
    throw new Error(`章节名称过长，无法在等分格内完整显示：${layout.overflow.map(item => item.label).join("、")}。请缩短名称或减少章节数。`);
  }

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const timeline = resolveChapterTimeline({chapters: content.chapters, timeMs: (frame / fps) * 1000});
  const entrance = interpolate(frame, [0, Math.max(1, Math.round((ENTRANCE_MS / 1000) * fps))], [0, 1], {
    ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-CHP-001"
      data-theme={theme} data-surface={surface} data-variant={variant}
      data-active-index={timeline.activeIndex} data-fill-percent={Number(timeline.fillPercent.toFixed(4))}
      style={{
        position: "absolute", left: 0, top: 0, width, height: layout.barHeight, boxSizing: "border-box",
        display: "flex", alignItems: "stretch",
        background: rgbaFromHex(tokens.node, tokens.barAlpha),
        borderBottom: `${layout.ruleWidth}px solid ${tokens.rule}`,
        transform: `translateY(${interpolate(entrance, [0, 1], [-110, 0])}%)`,
      }}
    >
      {showProgress && variant === "FILL" && <div data-cbar-fill style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: `${timeline.fillPercent}%`,
        background: rgbaFromHex(accent, PROGRESS_ALPHA),
      }}>
        <div data-cbar-fill-edge style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: layout.progressEdgeWidth,
          background: accent, opacity: 0.9,
        }}/>
      </div>}
      {layout.segments.map((segment, index) => {
        const state = index === timeline.activeIndex ? "on" : index < timeline.activeIndex ? "done" : "todo";
        return <div
          key={segment.id}
          data-chapter-id={segment.id} data-chapter-state={state} data-chapter-index={index}
          style={{position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${layout.padding}px`}}
        >
          {index > 0 && <div data-cbar-rule style={{
            position: "absolute", left: 0, top: layout.ruleInset, bottom: layout.ruleInset,
            width: layout.ruleWidth, background: tokens.rule,
          }}/>}
          <span data-cbar-label style={{
            whiteSpace: "pre", fontSize: segment.fontSize,
            fontWeight: state === "on" ? 800 : 600,
            letterSpacing: `${segment.letterSpacing}px`,
            color: state === "on" ? tokens.ink : state === "done" ? tokens.muted : tokens.faint,
          }}>{segment.label}</span>
          {showProgress && variant === "LINE" && state === "on" && <div data-cbar-prog style={{
            position: "absolute", left: 0, bottom: 0, height: layout.progressLineHeight,
            width: `${timeline.progress * 100}%`, background: accent,
          }}/>}
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}
