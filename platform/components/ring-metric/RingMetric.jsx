import React, {useMemo} from "react";
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  EASE_SOURCE, FONT_FAMILY, MONO_FONT_FAMILY, RING_CIRCUMFERENCE, SOURCE_GEOMETRY, SOURCE_MOTION,
  calculateRingMetricLayout, dashOffsetOf, formatNumber, progressAt, ratioOf,
} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertRingMetricProps} from "./model.js";

const easeSource = Easing.bezier(...EASE_SOURCE);

export function RingMetric({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertRingMetricProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateRingMetricLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: MONO_FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const progress = progressAt({frame, fps, durationMs: SOURCE_MOTION.progressMs, ease: easeSource});
  const ratio = ratioOf(content.value, content.max);
  const dashOffset = dashOffsetOf(ratio, progress);
  const shown = formatNumber(content.value * progress, layout.decimals);
  const center = layout.ringSize / 2;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-DATA-005"
      data-theme={theme} data-surface={surface}
      data-ratio={Number(ratio.toFixed(6))} data-progress={Number(progress.toFixed(4))}
      data-dash-offset={Number(dashOffset.toFixed(4))} data-dasharray={Number(RING_CIRCUMFERENCE.toFixed(4))}
      data-value={Number((content.value * progress).toFixed(4))}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.cardWidth,
        display: "flex", flexDirection: "column", alignItems: "center", gap: layout.gap, color: tokens.ink,
      }}
    >
      {layout.kicker && <div data-rm-kicker style={{
        fontFamily: MONO_FONT_FAMILY, fontSize: layout.kicker.fontSize, fontWeight: SOURCE_GEOMETRY.kickerFontWeight,
        letterSpacing: layout.kicker.letterSpacing, textTransform: "uppercase", color: tokens.muted, whiteSpace: "pre",
      }}>{content.kicker}</div>}

      <div data-rm-ring style={{position: "relative", width: layout.ringSize, height: layout.ringSize}}>
        <svg viewBox={`0 0 ${SOURCE_GEOMETRY.ringSize} ${SOURCE_GEOMETRY.ringSize}`} style={{
          width: "100%", height: "100%", transform: "rotate(-90deg)",
        }}>
          <circle data-rm-track cx={SOURCE_GEOMETRY.ringSize / 2} cy={SOURCE_GEOMETRY.ringSize / 2}
            r={SOURCE_GEOMETRY.ringRadius} strokeWidth={SOURCE_GEOMETRY.strokeWidth} fill="none" stroke={tokens.track}/>
          <circle data-rm-prog cx={SOURCE_GEOMETRY.ringSize / 2} cy={SOURCE_GEOMETRY.ringSize / 2}
            r={SOURCE_GEOMETRY.ringRadius} strokeWidth={SOURCE_GEOMETRY.strokeWidth} fill="none" stroke={accent}
            strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={dashOffset}/>
        </svg>
        <div data-rm-center style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4 * layout.factor,
        }}>
          <div data-rm-num style={{
            display: "flex", alignItems: "baseline", fontFamily: MONO_FONT_FAMILY,
            fontWeight: SOURCE_GEOMETRY.numFontWeight, fontSize: layout.numFontSize,
            lineHeight: 1, letterSpacing: layout.numFontSize * SOURCE_GEOMETRY.numLetterSpacingEm,
            color: tokens.ink, whiteSpace: "pre",
          }}>
            <span data-rm-value>{shown}</span>
            {layout.unit && <span data-rm-unit style={{
              fontSize: layout.unit.fontSize, color: tokens.muted, marginLeft: layout.unitMarginLeft, whiteSpace: "pre",
            }}>{content.unit}</span>}
          </div>
        </div>
      </div>

      {layout.label && <div data-rm-label style={{
        fontSize: layout.label.fontSize, color: tokens.muted, whiteSpace: "pre", lineHeight: SOURCE_GEOMETRY.lineHeight,
      }}>{content.label}</div>}
    </div>
  </AbsoluteFill>;
}
