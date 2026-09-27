import React, {useMemo} from "react";
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  EASE_SOURCE, FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  calculateRankBarsLayout, easeOutExpo, formatNumber, progressAt, staggerDelayMs,
} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertRankBarsProps} from "./model.js";

const easeSource = Easing.bezier(...EASE_SOURCE);

export function RankBars({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertRankBarsProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateRankBarsLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  // Source: one shared `useProgress(1400)` ramp for every row's number.
  const valueProgress = progressAt({frame, fps, durationMs: SOURCE_MOTION.valueRampMs, ease: easeOutExpo});

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-DATA-004"
      data-theme={theme} data-surface={surface}
      data-row-count={layout.rows.length} data-top-id={layout.topIds.join(",")}
      data-value-progress={Number(valueProgress.toFixed(4))}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.cardWidth,
        display: "flex", flexDirection: "column", color: tokens.ink,
      }}
    >
      {content.title ? <div data-rb-title style={{
        display: "inline-flex", alignItems: "center", gap: 10 * layout.factor,
        fontFamily: MONO_FONT_FAMILY, fontSize: 20 * layout.factor, fontWeight: 600,
        letterSpacing: `${0.18 * 20 * layout.factor}px`, textTransform: "uppercase",
        color: tokens.muted, marginBottom: 28 * layout.factor, whiteSpace: "pre",
      }}>
        <i data-rb-title-dot style={{width: 9 * layout.factor, height: 9 * layout.factor, borderRadius: "50%", background: accent, flex: "none"}}/>
        <span>{content.title}</span>
      </div> : null}

      {layout.rows.map((row, index) => {
        const delayMs = staggerDelayMs(index);
        const enter = progressAt({frame, fps, delayMs, durationMs: SOURCE_MOTION.rowFadeMs, ease: easeSource});
        const fill = progressAt({frame, fps, delayMs, durationMs: SOURCE_MOTION.fillMs, ease: easeSource});
        const shown = formatNumber(row.value * valueProgress, row.decimals);
        return <div
          key={row.id}
          data-rb-row-id={row.id} data-rb-index={index} data-rb-top={row.isTop}
          data-rb-fraction={Number(row.fraction.toFixed(6))} data-rb-fill-progress={Number(fill.toFixed(4))}
          data-rb-value={Number((row.value * valueProgress).toFixed(4))}
          style={{
            marginBottom: index === layout.rows.length - 1 ? 0 : layout.rowGap,
            opacity: enter, transform: `translateY(${(1 - enter) * SOURCE_MOTION.rowRisePx * layout.factor}px)`,
          }}
        >
          <div data-rb-head style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: layout.headGap,
          }}>
            <span data-rb-name style={{
              fontSize: row.nameFontSize, fontWeight: SOURCE_GEOMETRY.nameFontWeight,
              color: row.isTop ? tokens.ink : tokens.muted, whiteSpace: "pre",
            }}>{row.name}</span>
            <span data-rb-val style={{
              fontFamily: MONO_FONT_FAMILY, fontSize: row.valueFontSize, fontWeight: SOURCE_GEOMETRY.valueFontWeight,
              color: row.isTop ? accent : tokens.muted, whiteSpace: "pre",
            }}>{shown}{content.suffix ?? ""}</span>
          </div>
          <div data-rb-track style={{
            height: layout.trackHeight, width: "100%", borderRadius: layout.trackRadius,
            background: tokens.track, overflow: "hidden",
          }}>
            <div data-rb-fill style={{
              height: "100%", borderRadius: layout.trackRadius,
              background: row.isTop ? accent : tokens.lav,
              transform: `scaleX(${row.fraction * fill})`, transformOrigin: "left",
            }}/>
          </div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}
