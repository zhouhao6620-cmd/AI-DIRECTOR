import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, MONO_FAMILY, SOURCE_GEOMETRY, calculateVersusCardLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertVersusCardProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `transition: opacity 560ms cubic-bezier(0.22, 1, 0.36, 1)` and the same
// curve for the badge and the second side.
const ease = Easing.bezier(0.22, 1, 0.36, 1);

// Frame-driven stand-in for the source's `is-in` CSS transition: the same duration
// and the same curve, offset by the source's transition-delay.
function enterProgress({frame, fps, delayMs, durationMs}) {
  const start = (delayMs / 1000) * fps;
  const length = Math.max(1, Math.round((durationMs / 1000) * fps));
  return interpolate(frame - start, [0, length], [0, 1], {...clamp, easing: ease});
}

function Side({card, dim, accent, tokens, layout, progress, direction}) {
  return <div
    data-side={card.key} data-dim={dim ? "true" : "false"}
    style={{
      boxSizing: "border-box", width: layout.cardWidth, height: card.height,
      padding: `${layout.cardPaddingY}px ${layout.cardPaddingX}px`,
      borderRadius: layout.cardRadius,
      border: `${layout.cardBorder}px solid ${dim ? tokens.glassBorder : accent}`,
      background: tokens.glass,
      boxShadow: tokens.cardShadow,
      display: "flex", flexDirection: "column", gap: layout.cardGap,
      opacity: progress,
      transform: `translateX(${interpolate(progress, [0, 1], [direction * SOURCE_GEOMETRY.sideEnterOffset, 0])}px)`,
    }}
  >
    <div data-vs-kicker style={{
      fontFamily: MONO_FAMILY, fontSize: card.fontSize, fontWeight: SOURCE_GEOMETRY.kickerFontWeight,
      letterSpacing: `${card.kickerSpacing}px`, textTransform: "uppercase",
      color: dim ? tokens.muted : accent, whiteSpace: "pre",
    }}>{card.kicker.join(" ")}</div>
    <div data-vs-title style={{
      fontSize: card.titleSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight,
      lineHeight: SOURCE_GEOMETRY.titleLineHeight, letterSpacing: `${card.titleSpacing}px`,
      color: dim ? tokens.muted : tokens.ink,
    }}>
      {card.title.map((line, index) => <div data-text-line key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
    </div>
    <div data-vs-sub style={{
      fontSize: card.subSize, fontWeight: SOURCE_GEOMETRY.subFontWeight,
      lineHeight: SOURCE_GEOMETRY.subLineHeight, color: tokens.muted,
    }}>
      {card.sub.map((line, index) => <div data-text-line key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
    </div>
  </div>;
}

export function VersusCard({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertVersusCardProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateVersusCardLayout({content, position, size, width, height},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width),
  [content, position, size, width, height]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const a = {...layout.cards.a, key: "A"};
  const b = {...layout.cards.b, key: "B"};
  const dimA = content.emphasis === "B";
  const dimB = content.emphasis === "A";
  const aProgress = enterProgress({frame, fps, delayMs: 0, durationMs: SOURCE_GEOMETRY.sideEnterMs});
  const bProgress = enterProgress({frame, fps, delayMs: SOURCE_GEOMETRY.secondSideDelayMs, durationMs: SOURCE_GEOMETRY.sideEnterMs});
  const badgeOpacity = enterProgress({frame, fps, delayMs: SOURCE_GEOMETRY.badgeDelayMs, durationMs: SOURCE_GEOMETRY.badgeOpacityMs});
  const badgeScale = enterProgress({frame, fps, delayMs: SOURCE_GEOMETRY.badgeDelayMs, durationMs: SOURCE_GEOMETRY.badgeScaleMs});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-VRS-001" data-theme={theme} data-surface={surface}
      data-emphasis={content.emphasis} data-scale={layout.scale}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.blockWidth, height: layout.blockHeight,
        display: "flex", alignItems: "center",
      }}
    >
      <Side card={a} dim={dimA} accent={accent} tokens={tokens} layout={layout} progress={aProgress} direction={-1}/>
      <div data-vs-badge style={{
        width: layout.badgeSize, height: layout.badgeSize, borderRadius: "50%", flex: "none", zIndex: 2,
        margin: `0 ${-SOURCE_GEOMETRY.badgeOverlap * layout.scale}px`,
        background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: layout.badgeFontSize, fontWeight: SOURCE_GEOMETRY.badgeFontWeight,
        letterSpacing: `${layout.badgeLetterSpacing}px`,
        border: `${layout.badgeBorder}px solid ${tokens.node}`,
        opacity: badgeOpacity, transform: `scale(${interpolate(badgeScale, [0, 1], [0.5, 1])})`,
      }}>VS</div>
      <Side card={b} dim={dimB} accent={accent} tokens={tokens} layout={layout} progress={bProgress} direction={1}/>
    </div>
  </AbsoluteFill>;
}
