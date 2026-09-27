import React, {useId, useMemo} from "react";
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  EASE_SOURCE, FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  breathePhase, calculateGrowthCurveLayout, easeOutExpo, formatNumber, progressAt,
} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertGrowthCurveProps} from "./model.js";

const easeSource = Easing.bezier(...EASE_SOURCE);

export function GrowthCurve({content, position, size, surface, theme, drawMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertGrowthCurveProps({content, position, size, surface, theme, drawMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateGrowthCurveLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  // The source names the gradient per instance, so two cards on one canvas never share a fill.
  const gradientId = `gcv-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const draw = progressAt({frame, fps, durationMs: drawMs, ease: easeOutExpo});
  const peakProgress = progressAt({frame, fps, durationMs: drawMs + SOURCE_MOTION.peakCountExtraMs, ease: easeOutExpo});
  const breath = breathePhase({frame, fps});
  const brightness = 1 + (SOURCE_MOTION.breathMaxBrightness - 1) * breath;
  const glow = SOURCE_MOTION.breathShadowPx * breath;
  const litCount = layout.points.filter(point => Math.max(0, Math.min(1, (draw - point.threshold) / SOURCE_MOTION.pointLightWindow)) > 0).length;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-DATA-006"
      data-theme={theme} data-surface={surface}
      data-draw={Number(draw.toFixed(4))} data-peak={Number((layout.peak * peakProgress).toFixed(4))}
      data-lit-points={litCount} data-point-count={layout.points.length}
      data-breath-phase={Number(breath.toFixed(4))}
      data-card-width={Number(layout.boxWidth.toFixed(2))} data-card-height={Number(layout.boxHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: layout.boxWidth,
        boxSizing: "border-box", padding: `${layout.padTop}px ${layout.padX}px ${layout.padBottom}px`,
        borderRadius: layout.boxRadius, background: tokens.glass, border: `1px solid ${tokens.glassBorder}`,
        boxShadow: tokens.cardShadow, color: tokens.ink,
        display: "flex", flexDirection: "column", gap: SOURCE_GEOMETRY.boxGap * layout.factor,
      }}
    >
      <div data-gcv-head style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between"}}>
        <div>
          {layout.kicker && <div data-gcv-kicker style={{
            display: "flex", alignItems: "center", gap: 10 * layout.factor,
            fontFamily: MONO_FONT_FAMILY, fontSize: layout.kicker.fontSize, fontWeight: SOURCE_GEOMETRY.kickerFontWeight,
            letterSpacing: layout.kicker.letterSpacing, color: accent, textTransform: "uppercase", whiteSpace: "pre",
          }}>
            <i data-gcv-kicker-bar style={{
              width: SOURCE_GEOMETRY.kickerBarWidth * layout.factor, height: SOURCE_GEOMETRY.kickerBarHeight * layout.factor,
              borderRadius: SOURCE_GEOMETRY.kickerBarHeight * layout.factor / 2, background: accent, flex: "none",
            }}/>
            <span>{content.kicker}</span>
          </div>}
          {layout.kickerZh && <div data-gcv-kicker-zh style={{
            marginTop: SOURCE_GEOMETRY.kickerZhMarginTop * layout.factor,
            fontSize: layout.kickerZh.fontSize, fontWeight: SOURCE_GEOMETRY.kickerZhFontWeight,
            color: tokens.ink, whiteSpace: "pre", lineHeight: SOURCE_GEOMETRY.lineHeight,
          }}>{content.kickerZh}</div>}
        </div>
        <div data-gcv-peak style={{
          fontSize: SOURCE_GEOMETRY.peakFontSize * layout.factor, fontWeight: SOURCE_GEOMETRY.peakFontWeight,
          lineHeight: 1, color: accent, fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
          filter: `brightness(${brightness.toFixed(4)}) drop-shadow(0 0 ${glow.toFixed(3)}px ${accent})`,
        }}>
          {Math.round(layout.peak * peakProgress)}
          {layout.unit && <em data-gcv-peak-unit style={{
            fontStyle: "normal", fontSize: SOURCE_GEOMETRY.peakUnitFontSize * layout.factor,
            fontWeight: SOURCE_GEOMETRY.peakUnitFontWeight, marginLeft: SOURCE_GEOMETRY.peakUnitMarginLeft * layout.factor,
            color: tokens.muted,
          }}>{content.unit}</em>}
        </div>
      </div>

      <svg data-gcv-svg width={layout.svgWidth} height={layout.svgHeight} viewBox={`0 0 ${SOURCE_GEOMETRY.svgWidth} ${SOURCE_GEOMETRY.svgHeight}`} style={{display: "block", marginTop: 4 * layout.factor, overflow: "visible"}}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={SOURCE_GEOMETRY.areaOpacity}/>
            <stop offset="100%" stopColor={accent} stopOpacity={0}/>
          </linearGradient>
        </defs>
        {layout.geometry.area && <path data-gcv-area d={layout.geometry.area} fill={`url(#${gradientId})`} opacity={draw}/>}
        {layout.geometry.line && <path data-gcv-line d={layout.geometry.line} fill="none" stroke={accent}
          strokeWidth={SOURCE_GEOMETRY.lineWidth} strokeLinecap="round" strokeLinejoin="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}/>}
        {layout.points.map(point => {
          const on = Math.max(0, Math.min(1, (draw - point.threshold) / SOURCE_MOTION.pointLightWindow));
          return <g key={point.id} data-gcv-point-id={point.id} data-gcv-point-on={Number(on.toFixed(4))} opacity={on}>
            <text data-gcv-val x={point.node.x} y={point.node.y - 18} textAnchor="middle" style={{
              fontSize: point.valueFontSize, fontWeight: SOURCE_GEOMETRY.valueFontWeight, fill: tokens.ink,
            }}>{formatNumber(point.value, point.decimals)}</text>
            <circle data-gcv-dot cx={point.node.x} cy={point.node.y} r={SOURCE_GEOMETRY.dotRadius * (0.4 + 0.6 * on)}
              fill={accent} stroke={tokens.ink} strokeWidth={SOURCE_GEOMETRY.dotStroke}/>
            <text data-gcv-lb x={point.node.x} y={layout.geometry.baseY + 30} textAnchor="middle" style={{
              fontSize: point.labelFontSize, fontWeight: SOURCE_GEOMETRY.labelFontWeight, fill: tokens.muted,
            }}>{point.label}</text>
          </g>;
        })}
      </svg>

      {layout.caption && <div data-gcv-cap style={{
        opacity: draw, fontSize: layout.caption.fontSize, color: tokens.muted, textAlign: "right", whiteSpace: "pre",
      }}>{content.caption}</div>}
    </div>
  </AbsoluteFill>;
}
