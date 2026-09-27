// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」写法：
//   结构用 Interactive.* + name；动效用内联 interpolate()，输出范围 / easing / extrapolate 硬编码；
//   动画位移与缩放不拼 transform 字符串（SVG 里的坐标本身就是独立属性）；
//   唯一的 transform 是 y 轴标题的静态摆放（rotate(-90)），不参与任何动画。
// 来源：RemotionUI `scatter-plot-pop`（MIT）；适配差异见 ./layout.js 顶部注释与 definition.json。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateScatterPlotLayout,
} from "./layout.js";
import {
  COMPONENT_ID, DOT_OPACITY, GLOW_OPACITY, PALETTES, SURFACE_TOKENS, assertScatterPlotPopProps,
} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export function ScatterPlotPop({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertScatterPlotPopProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});

  const layout = useMemo(() => calculateScatterPlotLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight) => measureText({
      text, fontFamily: FONT_FAMILY, fontSize, fontWeight,
    }).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const dotColor = PALETTES[theme][0];
  const labelSize = layout.labelSize;
  // 来源：错峰按 x 升序，而不是数组顺序。
  const order = content.points
    .map((point, index) => ({index, x: point.x}))
    .sort((left, right) => left.x - right.x)
    .reduce((ranks, entry, rank) => {
      ranks[entry.index] = rank;
      return ranks;
    }, []);
  const lastStart = (content.points.length - 1) * SOURCE_MOTION.staggerFrames;
  const trendProgress = interpolate(
    frame,
    [
      lastStart + SOURCE_MOTION.unitFrames * SOURCE_GEOMETRY.trendDelayFactor,
      lastStart + SOURCE_MOTION.unitFrames * SOURCE_GEOMETRY.trendDelayFactor + SOURCE_GEOMETRY.trendDrawFrames,
    ],
    [0, 1],
    {easing: EASING.enter, ...clamp},
  );
  const trend = layout.trend;
  const trendUnit = layout.sourceWidth / SOURCE_GEOMETRY.labelUnitBase;

  return <AbsoluteFill name="ScatterPlotPop｜散点图弹出" style={{backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme}
      data-surface={surface}
      data-scale={Number(layout.factor.toFixed(4))}
      data-point-count={layout.points.length}
      data-box-width={Number(layout.boxWidth.toFixed(2))}
      data-box-height={Number(layout.boxHeight.toFixed(2))}
      data-trend-slope={Number(trend.slope.toFixed(4))}
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.boxWidth,
        height: layout.boxHeight,
      }}
    >
      <Interactive.Svg
        name="散点图层"
        width={layout.drawWidth}
        height={layout.drawHeight}
        viewBox={`0 0 ${layout.sourceWidth} ${layout.sourceHeight}`}
        style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}
      >
        {layout.yTicks.map((tick) => <Interactive.G key={`y-${tick.value}`} name={`y 轴刻度 ${tick.text}`}>
          <Interactive.Line
            name="网格线"
            x1={layout.plot.left}
            y1={tick.y}
            x2={layout.plot.right}
            y2={tick.y}
            stroke={tokens.grid}
            strokeWidth={1}
          />
          <Interactive.Text
            name="刻度值"
            x={layout.plot.left - labelSize * SOURCE_GEOMETRY.tickGapFactor}
            y={tick.y}
            fill={tokens.label}
            fontSize={labelSize}
            fontWeight={600}
            textAnchor="end"
            dominantBaseline="central"
            style={{fontVariantNumeric: "tabular-nums"}}
          >{tick.text}</Interactive.Text>
        </Interactive.G>)}

        {layout.xTicks.map((tick) => <Interactive.Text
          key={`x-${tick.value}`}
          name={`x 轴刻度 ${tick.text}`}
          x={tick.x}
          y={layout.plot.bottom + labelSize * SOURCE_GEOMETRY.xTickOffsetFactor}
          fill={tokens.label}
          fontSize={labelSize}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
          style={{fontVariantNumeric: "tabular-nums"}}
        >{tick.text}</Interactive.Text>)}

        {trendProgress > 0 ? <Interactive.Line
          name="趋势线"
          x1={trend.start.x}
          y1={trend.start.y}
          x2={trend.start.x + (trend.end.x - trend.start.x) * trendProgress}
          y2={trend.start.y + (trend.end.y - trend.start.y) * trendProgress}
          stroke={tokens.trend}
          strokeWidth={Math.max(SOURCE_GEOMETRY.trendStrokeMin, SOURCE_GEOMETRY.trendStrokeFactor * trendUnit)}
          strokeDasharray={`${SOURCE_GEOMETRY.trendDash[0] * trendUnit} ${SOURCE_GEOMETRY.trendDash[1] * trendUnit}`}
          strokeLinecap="round"
        /> : null}

        {layout.points.map((point, index) => {
          const rank = order[index] ?? index;
          const start = rank * SOURCE_MOTION.staggerFrames;
          const progress = interpolate(
            frame,
            [start, start + SOURCE_MOTION.unitFrames],
            [0, 1],
            {easing: EASING.pop, ...clamp},
          );
          if (progress <= 0) return null;
          return <Interactive.G key={point.id} name={`散点 ${point.id}`}>
            <Interactive.Circle
              name="光晕"
              cx={point.x}
              cy={point.y}
              r={point.radius * progress * SOURCE_GEOMETRY.glowFactor}
              fill={dotColor}
              opacity={GLOW_OPACITY * progress}
            />
            <Interactive.Circle
              name="散点"
              cx={point.x}
              cy={point.y}
              r={point.radius * progress}
              fill={dotColor}
              opacity={DOT_OPACITY}
            />
          </Interactive.G>;
        })}

        {layout.xLabel ? <Interactive.Text
          name="x 轴标题"
          x={layout.plot.left + layout.plot.width / 2}
          y={layout.sourceHeight - labelSize * SOURCE_GEOMETRY.xTitleBottomFactor}
          fill={tokens.label}
          fontSize={labelSize}
          fontWeight={600}
          textAnchor="middle"
        >{layout.xLabel.text}</Interactive.Text> : null}

        {layout.yLabel ? <Interactive.Text
          name="y 轴标题"
          x={labelSize}
          y={layout.plot.top + layout.plot.height / 2}
          fill={tokens.label}
          fontSize={labelSize}
          fontWeight={600}
          textAnchor="middle"
          // 静态摆放（不参与动画）：整条标题绕自身锚点旋转 −90°。
          transform={`rotate(-90 ${labelSize} ${layout.plot.top + layout.plot.height / 2})`}
        >{layout.yLabel.text}</Interactive.Text> : null}
      </Interactive.Svg>
    </div>
  </AbsoluteFill>;
}
