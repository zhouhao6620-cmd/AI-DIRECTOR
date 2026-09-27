// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame / Easing 曲线 +
// 归一化进度，样式内联、不写 CSS 过渡；文字块用 Interactive.* + name 保证 Studio 可点选。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  calculatePieSliceRevealLayout, clamp01, polar, progressAt, wedgePath,
} from "./layout.js";
import {COMPONENT_ID, SERIES, SURFACE_TOKENS, assertPieSliceRevealProps} from "./model.js";

export function PieSliceReveal({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertPieSliceRevealProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculatePieSliceRevealLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const palette = SERIES[theme][surface];
  const drawn = layout.slices.map((slice, index) => ({
    ...slice,
    color: slice.color ?? palette[index % palette.length],
    progress: progressAt({frame, fps, delayMs: index * SOURCE_MOTION.staggerMs, durationMs: SOURCE_MOTION.sweepMs, ease: EASING.enter}),
  }));

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme} data-surface={surface}
      data-slice-count={drawn.length}
      data-progress={drawn.map(slice => Number(slice.progress.toFixed(4))).join(",")}
      data-colors={drawn.map(slice => slice.color).join(",")}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.cardWidth, height: layout.cardHeight,
        display: "flex", flexDirection: "column", alignItems: "center", gap: layout.legendGap,
      }}
    >
      <div style={{position: "relative", width: layout.pieSize, height: layout.pieSize, flex: "none"}}>
        <Interactive.Svg
          name="饼图" width={layout.pieSize} height={layout.pieSize}
          viewBox={`0 0 ${SOURCE_GEOMETRY.pieSize} ${SOURCE_GEOMETRY.pieSize}`}
          style={{display: "block", overflow: "visible"}}
        >
          {drawn.map((slice, index) => {
            if (slice.progress <= 0) return null;
            const swept = Math.max(0, slice.span * slice.progress - layout.gapInDegrees);
            const midAngle = slice.startAngle + swept / 2;
            // 来源：扇区沿自己的角平分线向外滑出，扫过的过程中角平分线自己在动。
            const offsetDistance = layout.radius * SOURCE_GEOMETRY.explode * slice.progress;
            const offset = polar(0, 0, offsetDistance, midAngle);
            const label = polar(0, 0, slice.labelRadius, midAngle);
            return <g key={slice.id} data-pie-slice-id={slice.id} data-pie-slice-index={index}
              data-pie-slice-progress={Number(slice.progress.toFixed(4))}
              transform={`translate(${offset.x} ${offset.y})`}>
              <path
                d={wedgePath(SOURCE_GEOMETRY.pieSize / 2, SOURCE_GEOMETRY.pieSize / 2, layout.radius, slice.startAngle, slice.startAngle + swept)}
                fill={slice.color}
              />
              {layout.showLabels && slice.progress > SOURCE_MOTION.labelFadeStart ? <text
                data-pie-slice-label x={SOURCE_GEOMETRY.pieSize / 2 + label.x} y={SOURCE_GEOMETRY.pieSize / 2 + label.y}
                fill={tokens.onSlice} fontSize={slice.labelFontSize} fontWeight={SOURCE_GEOMETRY.labelFontWeight}
                textAnchor="middle" dominantBaseline="central"
                opacity={clamp01((slice.progress - SOURCE_MOTION.labelFadeStart) / SOURCE_MOTION.labelFadeWindow)}
                style={{fontVariantNumeric: "tabular-nums"}}
              >{slice.percentText}</text> : null}
            </g>;
          })}
        </Interactive.Svg>
      </div>

      {layout.showLegend ? <Interactive.Div name="图例" style={{
        display: "flex", flexDirection: "column", gap: layout.legendRowGap,
      }}>
        {layout.legendRows.map((slice, index) => {
          const progress = drawn[index].progress;
          return <div
            key={slice.id} data-pie-legend-id={slice.id} data-pie-legend-index={index}
            data-pie-legend-progress={Number(progress.toFixed(4))}
            style={{
              display: "flex", alignItems: "center", gap: layout.legendInnerGap,
              opacity: clamp01(progress * 1.6),
              translate: `0 ${(1 - progress) * layout.pieSize * 0.04}px`,
            }}
          >
            <span data-pie-legend-dot style={{
              width: layout.legendDot, height: layout.legendDot, borderRadius: 999,
              background: drawn[index].color, flexShrink: 0,
            }}/>
            <span data-pie-legend-label style={{
              width: layout.labelBox, fontSize: slice.nameFontSize, fontWeight: 600, color: tokens.ink, whiteSpace: "pre",
            }}>{slice.label}</span>
            <span data-pie-legend-value style={{
              width: layout.valueBox, textAlign: "right", fontFamily: MONO_FONT_FAMILY, fontSize: slice.valueFontSize,
              fontWeight: 600, color: tokens.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
            }}>{slice.valueText}</span>
          </div>;
        })}
      </Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
