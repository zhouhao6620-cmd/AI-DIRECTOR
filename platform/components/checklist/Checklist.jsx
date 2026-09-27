import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, calculateChecklistLayout, rgbaFromHex} from "./layout.js";
import {ACCENTS, CHECK_COLOR, SURFACE_TOKENS, assertChecklistProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// Source: `transition: opacity 480ms var(--ease), transform 480ms var(--ease)` and
// the 300 ms token transition on `.ck-box` background / border / colour.
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const ENTER_MS = SOURCE_GEOMETRY.itemEnterMs;
const KICKER_MS = SOURCE_GEOMETRY.kickerEnterMs;
const BOX_MS = SOURCE_GEOMETRY.boxPopMs;

export function Checklist({content, checkedCount, stepMs, position, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertChecklistProps({content, checkedCount, stepMs, position, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateChecklistLayout({
    content, checkedCount, position, width, height, stepMs,
    // Glyph advances only: layout.js adds the CSS letter-spacing itself.
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, checkedCount, position, width, height, stepMs]);
  if (layout.overflow.length) {
    const first = layout.overflow[0];
    const message = first.type === "LABEL_TOO_LONG"
      ? `步骤「${first.label}」需要 ${first.lines} 行，超过 ${first.maxLines} 行上限；请缩短文字或减少步骤数。`
      : first.type === "TITLE_TOO_LONG"
        ? `小标题「${first.label}」超出可用宽度；请缩短小标题。`
        : "内容超出画布安全区；请减少步骤数或缩短文字。";
    throw new Error(message);
  }

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const timeMs = (frame / fps) * 1000;
  const framesOf = ms => (ms / 1000) * fps;
  const direction = position === "RIGHT" ? 20 * layout.scale : -20 * layout.scale;
  const kickerProgress = interpolate(frame, [0, Math.max(1, Math.round(framesOf(KICKER_MS)))], [0, 1], {...clamp, easing: EASE});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-CHK-001"
      data-position={position} data-surface={surface} data-theme={theme}
      data-checked-count={checkedCount}
      data-entered-count={layout.items.filter(item => timeMs >= item.enterAtMs).length}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.cardWidth, height: layout.cardHeight,
      }}
    >
      {layout.kicker && <div data-ck-kicker style={{
        position: "absolute", left: 0, top: 0,
        display: "flex", alignItems: "center", gap: layout.kicker.dotGap,
        height: layout.kicker.height, marginBottom: layout.kicker.marginBottom,
        fontFamily: MONO_FONT_FAMILY, fontSize: layout.kicker.fontSize, fontWeight: SOURCE_GEOMETRY.kickerFontWeight,
        letterSpacing: layout.kicker.letterSpacing, textTransform: "uppercase", color: tokens.muted,
        opacity: kickerProgress,
        transform: `translateY(${interpolate(kickerProgress, [0, 1], [14, 0])}px)`,
        whiteSpace: "pre",
      }}>
        <span data-ck-kicker-dot style={{
          width: layout.kicker.dotSize, height: layout.kicker.dotSize, borderRadius: "50%",
          background: accent, flex: "none",
        }}/>
        <span>{layout.kicker.text}</span>
      </div>}

      {layout.items.map(item => {
        const enterFrom = framesOf(item.enterAtMs);
        const enter = interpolate(frame, [enterFrom, enterFrom + framesOf(ENTER_MS)], [0, 1], {...clamp, easing: EASE});
        const pop = interpolate(frame, [enterFrom, enterFrom + framesOf(BOX_MS)], [0, 1], {...clamp, easing: EASE});
        const fill = item.done ? pop : 0;
        return <div
          key={item.id}
          data-ck-item-id={item.id}
          data-ck-item-index={item.index}
          data-ck-item-state={item.done ? "done" : "todo"}
          data-ck-item-lines={item.lines.length}
          style={{
            position: "absolute", left: 0, top: item.y - layout.y, width: "100%", height: item.height,
            display: "flex", alignItems: "center", gap: layout.itemGap,
            opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [direction, 0])}px)`,
          }}
        >
          <div data-ck-box data-ck-box-state={item.done ? "done" : "todo"} style={{
            width: layout.boxSize, height: layout.boxSize, flex: "none",
            borderRadius: layout.boxRadius,
            border: `${layout.boxBorderWidth}px solid ${item.done ? rgbaFromHex(accent, 0.2 + 0.8 * fill) : tokens.glassBorder}`,
            background: item.done ? rgbaFromHex(accent, fill) : "transparent",
            color: `rgba(255, 255, 255, ${fill})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: layout.checkFontSize, fontWeight: SOURCE_GEOMETRY.checkFontWeight, lineHeight: 1,
            transform: `scale(${0.6 + 0.4 * (item.done ? pop : 1)})`,
          }}>{"✓"}</div>
          <div data-ck-label style={{color: item.done ? tokens.ink : tokens.muted}}>
            {item.lines.map((line, lineIndex) => <span key={lineIndex} data-ck-line style={{
              display: "block", whiteSpace: "pre",
              fontSize: item.fontSize, lineHeight: `${item.lineHeight}px`,
              fontWeight: SOURCE_GEOMETRY.itemFontWeight,
            }}>{line}</span>)}
          </div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}
