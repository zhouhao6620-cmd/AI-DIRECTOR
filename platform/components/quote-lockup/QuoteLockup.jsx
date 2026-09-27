import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, MONO_FAMILY, SOURCE_GEOMETRY, calculateQuoteLockupLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertQuoteLockupProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const ease = Easing.bezier(0.22, 1, 0.36, 1);

// Frame-driven stand-in for the source's transition-delay + duration pairs.
function progress({frame, fps, delayMs, durationMs}) {
  const start = (delayMs / 1000) * fps;
  const length = Math.max(1, Math.round((durationMs / 1000) * fps));
  return interpolate(frame - start, [0, length], [0, 1], {...clamp, easing: ease});
}

export function QuoteLockup({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertQuoteLockupProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateQuoteLockupLayout({content, position, size, width, height},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width),
  [content, position, size, width, height]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const mark = progress({frame, fps, delayMs: 0, durationMs: SOURCE_GEOMETRY.fadeMs});
  const rule = progress({frame, fps, delayMs: SOURCE_GEOMETRY.ruleDelayMs, durationMs: SOURCE_GEOMETRY.ruleRevealMs});
  const author = progress({frame, fps, delayMs: SOURCE_GEOMETRY.authorDelayMs, durationMs: SOURCE_GEOMETRY.fadeMs});
  const quote = layout.quote;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-QTE-001" data-theme={theme} data-surface={surface}
      data-scale={layout.scale} data-lines={quote.lines.length}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.blockWidth, height: layout.blockHeight,
        boxSizing: "border-box", padding: `${layout.paddingTop}px ${layout.paddingX}px ${layout.paddingBottom}px`,
        borderRadius: layout.radius, background: tokens.glass, border: `1px solid ${tokens.glassBorder}`,
        boxShadow: tokens.cardShadow, display: "flex", flexDirection: "column", alignItems: "flex-start",
      }}
    >
      <div data-ql-mark style={{
        fontFamily: MONO_FAMILY, fontSize: layout.markFontSize, lineHeight: 0.6, height: layout.markHeight,
        color: accent, fontWeight: 400,
        opacity: mark, transform: `translateY(${interpolate(mark, [0, 1], [SOURCE_GEOMETRY.fadeOffsetY, 0])}px)`,
      }}>“</div>
      <div data-ql-body style={{
        fontSize: quote.bodyFontSize, fontWeight: SOURCE_GEOMETRY.bodyFontWeight,
        lineHeight: SOURCE_GEOMETRY.bodyLineHeight, letterSpacing: `${quote.letterSpacing}px`, color: tokens.ink,
        width: layout.contentWidth,
      }}>
        {quote.lines.map((line, index) => {
          const reveal = progress({
            frame, fps,
            delayMs: SOURCE_GEOMETRY.lineDelayBaseMs + index * SOURCE_GEOMETRY.lineDelayStepMs,
            durationMs: SOURCE_GEOMETRY.lineRevealMs,
          });
          return <span data-ql-line key={index} style={{display: "block", overflow: "hidden"}}>
            <span data-text-line style={{
              display: "block", whiteSpace: "pre",
              transform: `translateY(${interpolate(reveal, [0, 1], [112, 0])}%)`,
            }}>{line.wrapped.join("\n")}</span>
          </span>;
        })}
      </div>
      <div data-ql-rule style={{
        height: layout.ruleHeight, width: layout.ruleWidth, borderRadius: layout.ruleRadius,
        background: accent, marginTop: layout.ruleMarginTop,
        transform: `scaleX(${rule})`, transformOrigin: "left",
      }}/>
      {quote.author.length > 0 && <div data-ql-author style={{
        marginTop: layout.authorMarginTop, fontSize: quote.authorFontSize,
        fontWeight: SOURCE_GEOMETRY.authorFontWeight, letterSpacing: `${quote.authorLetterSpacing}px`,
        color: tokens.muted, textTransform: "uppercase", whiteSpace: "pre",
        opacity: author, transform: `translateY(${interpolate(author, [0, 1], [SOURCE_GEOMETRY.fadeOffsetY, 0])}px)`,
      }}>{quote.author.join(" ")}</div>}
    </div>
  </AbsoluteFill>;
}
