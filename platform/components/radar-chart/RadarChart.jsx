// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame / Easing 曲线 +
// 归一化进度，样式内联、不写 CSS 过渡；文字块用 Interactive.* + name 保证 Studio 可点选。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateRadarChartLayout, clamp01, progressAt, webPath,
} from "./layout.js";
import {COMPONENT_ID, SERIES, SURFACE_TOKENS, assertRadarChartProps} from "./model.js";

export function RadarChart({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertRadarChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateRadarChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const palette = SERIES[theme][surface];
  // 网先整块淡入（它是量具、不是数据），多边形再逐轴伸出去（来源的设计意图）。
  const webOpacity = progressAt({frame, fps, durationMs: SOURCE_MOTION.webFadeMs, ease: EASING.enter});
  const series = layout.series.map((entry, index) => {
    const reached = entry.values.map((ratio, axis) => ({
      ratio,
      progress: progressAt({
        frame, fps, ease: EASING.pop,
        delayMs: entry.baseDelayMs + axis * SOURCE_MOTION.axisStaggerMs,
        durationMs: SOURCE_MOTION.reachMs,
      }),
    }));
    return {...entry, color: entry.color ?? palette[index % palette.length], reached};
  });

  const polygonPath = vertices => vertices
    .map((vertex, axis) => `${axis === 0 ? "M" : "L"} ${(layout.centre + layout.axisUnits[axis].x * vertex.distance).toFixed(2)} ${(layout.centre + layout.axisUnits[axis].y * vertex.distance).toFixed(2)}`)
    .join(" ");

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme} data-surface={surface}
      data-axis-count={layout.axes.length} data-series-count={series.length}
      data-web-opacity={Number(webOpacity.toFixed(4))}
      data-reach={series.map(entry => entry.reached.map(vertex => Number(vertex.progress.toFixed(3))).join("|")).join(",")}
      data-colors={series.map(entry => entry.color).join(",")}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.cardWidth, height: layout.cardHeight,
        display: "flex", flexDirection: "column", alignItems: "center", gap: layout.legendGap,
      }}
    >
      <Interactive.Svg
        name="雷达网" width={layout.boxSize} height={layout.boxSize}
        viewBox={`0 0 ${layout.boxSize} ${layout.boxSize}`}
        style={{display: "block", overflow: "visible"}}
      >
        <g opacity={webOpacity}>
          {Array.from({length: layout.ringCount}, (_, ring) => {
            const ringRadius = (layout.radius * (ring + 1)) / layout.ringCount;
            return <path
              key={ring} data-radar-ring={ring}
              d={`${webPath(layout.centre, ringRadius, layout.axisUnits)} Z`}
              fill="none" stroke={tokens.grid} strokeWidth={1}
              opacity={ring === layout.ringCount - 1 ? 1 : 0.6}
            />;
          })}
          {layout.axisUnits.map((unit, axis) => <line
            key={axis} data-radar-spoke={axis}
            x1={layout.centre} y1={layout.centre}
            x2={layout.centre + unit.x * layout.radius} y2={layout.centre + unit.y * layout.radius}
            stroke={tokens.grid} strokeWidth={1}
          />)}
          {layout.axes.map(axis => <text
            key={axis.axis} data-radar-axis={axis.axis}
            x={layout.centre + axis.anchorX} y={layout.centre + axis.anchorY}
            fill={tokens.muted} fontSize={axis.fontSize} fontWeight={SOURCE_GEOMETRY.labelFontWeight}
            textAnchor={axis.textAnchor} dominantBaseline="central"
          >{axis.label}</text>)}
        </g>

        {series.map((entry, index) => {
          const vertices = entry.reached.map((vertex, axis) => ({
            distance: vertex.ratio * layout.radius * clamp01(vertex.progress),
            progress: vertex.progress,
          }));
          return <g key={entry.id} data-radar-series-id={entry.id} data-radar-series-index={index}>
            <path
              d={`${polygonPath(vertices)} Z`}
              fill={entry.color} fillOpacity={layout.fillOpacity} stroke={entry.color}
              strokeWidth={layout.strokeWidth} strokeLinejoin="round"
            />
            {layout.showVertices ? vertices.map((vertex, axis) => <circle
              key={axis} data-radar-vertex={`${index}-${axis}`}
              cx={layout.centre + layout.axisUnits[axis].x * vertex.distance}
              cy={layout.centre + layout.axisUnits[axis].y * vertex.distance}
              r={layout.vertexRadius * clamp01(vertex.progress)} fill={entry.color}
            />) : null}
          </g>;
        })}
      </Interactive.Svg>

      {layout.showLegend ? <Interactive.Div name="图例" style={{
        display: "flex", alignItems: "center", gap: layout.legendItemGap, height: layout.legendHeight,
      }}>
        {series.map((entry, index) => <div key={entry.id} data-radar-legend-id={entry.id} style={{
          display: "flex", alignItems: "center", gap: layout.legendInnerGap,
        }}>
          <span data-radar-legend-dot style={{
            width: layout.legendDot, height: layout.legendDot, borderRadius: 999, background: entry.color, flexShrink: 0,
          }}/>
          <span data-radar-legend-label style={{
            fontSize: entry.labelFontSize, fontWeight: SOURCE_GEOMETRY.legendFontWeight, color: tokens.ink, whiteSpace: "pre",
          }}>{entry.label}</span>
        </div>)}
      </Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
