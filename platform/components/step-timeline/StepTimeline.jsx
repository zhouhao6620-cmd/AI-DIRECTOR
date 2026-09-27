import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, calculateStepTimelineLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertStepTimelineProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `transition: opacity 560ms var(--ease), transform 560ms var(--ease)` on
// `.st-step`, `transform 460ms var(--ease)` on `.st-node`, `transform 560ms` on the bar.
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function StepTimeline({content, revealed, stepMs, position, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertStepTimelineProps({content, revealed, stepMs, position, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateStepTimelineLayout({
    content, revealed, position, width, height, stepMs,
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, revealed, position, width, height, stepMs]);
  if (layout.overflow.length) {
    const first = layout.overflow[0];
    const message = first.type === "TITLE_TOO_LONG"
      ? `标题需要 ${first.lines} 行，超过 ${first.maxLines} 行上限；请缩短标题。`
      : first.type === "LABEL_TOO_LONG"
        ? `阶段「${first.label}」需要 ${first.lines} 行，超过 ${first.maxLines} 行上限；请缩短文字或减少阶段数。`
        : "内容超出画布安全区；请减少阶段数或缩短文字。";
    throw new Error(message);
  }

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const framesOf = ms => (ms / 1000) * fps;
  const timeMs = (frame / fps) * 1000;
  const direction = position === "RIGHT" ? SOURCE_GEOMETRY.slideDistance * layout.scale : -SOURCE_GEOMETRY.slideDistance * layout.scale;
  const barProgress = interpolate(frame, [0, Math.max(1, Math.round(framesOf(SOURCE_GEOMETRY.barEnterMs)))], [0, 1], {...clamp, easing: EASE});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-STP-001"
      data-position={position} data-surface={surface} data-theme={theme}
      data-revealed={revealed}
      data-entered-count={layout.steps.filter(step => timeMs >= step.enterAtMs).length}
      style={{position: "absolute", left: layout.x, top: layout.y, width: layout.cardWidth, height: layout.cardHeight}}
    >
      <div data-st-title style={{
        position: "absolute", left: 0, top: 0, height: layout.title.height,
        display: "flex", alignItems: "center", gap: layout.title.gap,
      }}>
        <span data-st-bar style={{
          width: layout.title.barWidth, height: layout.title.barHeight, borderRadius: layout.title.barRadius,
          background: accent, flex: "none",
          transform: `scaleY(${barProgress})`, transformOrigin: "top",
        }}/>
        <span data-st-title-text style={{
          color: tokens.ink, fontSize: layout.title.fontSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight,
          letterSpacing: layout.title.letterSpacing,
        }}>
          {layout.title.lines.map((line, lineIndex) => <span key={lineIndex} data-st-title-line style={{display: "block", whiteSpace: "pre", lineHeight: `${layout.title.lineHeight}px`}}>
            {line.runs.map((run, runIndex) => <span key={runIndex} data-st-key={run.emphasis ? "true" : "false"} style={{color: run.emphasis ? accent : tokens.ink}}>{run.text}</span>)}
          </span>)}
        </span>
      </div>

      {/* Source `.st-list::before`: a dotted rail inset 18 px top and bottom. */}
      <div data-st-rail style={{
        position: "absolute", left: layout.list.railLeft,
        top: layout.list.y - layout.y + layout.list.railInset,
        height: layout.list.height - layout.list.railInset * 2,
        borderLeft: `${layout.list.railWidth}px dotted ${tokens.track}`,
      }}/>
      <div data-st-list style={{
        position: "absolute", left: 0, top: layout.list.y - layout.y, width: layout.cardWidth, height: layout.list.height,
      }}>
        {layout.steps.map(step => {
          const enterFrom = framesOf(step.enterAtMs);
          const enter = interpolate(frame, [enterFrom, enterFrom + framesOf(SOURCE_GEOMETRY.stepEnterMs)], [0, 1], {...clamp, easing: EASE});
          const nodeEnter = interpolate(frame, [enterFrom, enterFrom + framesOf(SOURCE_GEOMETRY.nodeEnterMs)], [0, 1], {...clamp, easing: EASE});
          return <div
            key={step.id}
            data-st-step-id={step.id}
            data-st-step-index={step.index}
            data-st-step-state={step.empty ? "empty" : "revealed"}
            data-st-step-cycle={step.cycleColor}
            data-st-step-lines={step.lines.length}
            style={{
              position: "absolute", left: 0, top: step.y - layout.list.y, width: layout.cardWidth,
              height: step.rowHeight, display: "flex", alignItems: "center",
              opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [direction, 0])}px)`,
            }}
          >
            <span data-st-node style={{
              position: "absolute", left: layout.list.railCenter - step.nodeSize / 2, top: (step.rowHeight - step.nodeSize) / 2,
              width: step.nodeSize, height: step.nodeSize, borderRadius: "50%",
              border: `${SOURCE_GEOMETRY.nodeBorderWidth * layout.scale}px solid ${accent}`,
              background: tokens.node, display: "flex", alignItems: "center", justifyContent: "center",
              transform: `scale(${nodeEnter})`, flex: "none",
            }}>
              <span data-st-node-dot style={{
                width: SOURCE_GEOMETRY.nodeDotSize * layout.scale, height: SOURCE_GEOMETRY.nodeDotSize * layout.scale,
                borderRadius: "50%", background: accent,
              }}/>
            </span>
            <div data-st-chip data-st-chip-state={step.empty ? "empty" : "revealed"} style={{
              position: "absolute", left: layout.list.chipLeft, top: (step.rowHeight - step.chipHeight) / 2,
              width: step.chipWidth, height: step.chipHeight, boxSizing: "border-box",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `${step.chipBorder}px solid ${step.empty ? tokens.glassBorder : accent}`,
              borderRadius: SOURCE_GEOMETRY.chipRadius * layout.scale,
              padding: `${step.chipPaddingY}px ${step.chipPaddingX}px`,
              background: tokens.glass, boxShadow: tokens.cardShadow,
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              opacity: step.empty ? SOURCE_GEOMETRY.emptyChipOpacity : 1,
            }}>
              <span data-st-chip-label style={{
                color: tokens.ink, fontSize: step.chipFontSize, fontWeight: SOURCE_GEOMETRY.chipFontWeight,
                letterSpacing: step.chipLetterSpacing, textAlign: "center",
              }}>
                {step.lines.map((line, lineIndex) => <span key={lineIndex} data-st-chip-line style={{display: "block", whiteSpace: "pre", lineHeight: `${step.chipLineHeight}px`}}>{line}</span>)}
              </span>
            </div>
          </div>;
        })}
      </div>
    </div>
  </AbsoluteFill>;
}
