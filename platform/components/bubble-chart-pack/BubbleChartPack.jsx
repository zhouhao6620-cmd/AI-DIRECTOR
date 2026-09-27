// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」写法：
//   结构用 Interactive.* + name（元素在 Studio 里可点选与改样式）；
//   动效用内联 interpolate()，输出范围 / easing / extrapolate 全部硬编码；
//   位移与缩放用独立属性（translate / scale）而不是 transform 字符串；不用 CSS 过渡。
// 来源：RemotionUI `bubble-chart-pack`（MIT）；适配差异见 ./layout.js 顶部注释与 definition.json。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateBubbleChartLayout} from "./layout.js";
import {COMPONENT_ID, PALETTES, SURFACE_TOKENS, assertBubbleChartPackProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export function BubbleChartPack({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertBubbleChartPackProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});

  const layout = useMemo(() => calculateBubbleChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight) => measureText({
      text, fontFamily: FONT_FAMILY, fontSize, fontWeight,
    }).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const palette = PALETTES[theme];
  const tokens = SURFACE_TOKENS[surface];
  const centreX = layout.sourceWidth / 2;
  const centreY = layout.sourceHeight / 2;

  return <AbsoluteFill name="BubbleChartPack｜气泡图" style={{backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme}
      data-surface={surface}
      data-scale={Number(layout.factor.toFixed(4))}
      data-bubble-count={layout.bubbles.length}
      data-box-width={Number(layout.boxWidth.toFixed(2))}
      data-box-height={Number(layout.boxHeight.toFixed(2))}
      data-min-radius={Number(layout.smallestRadius.toFixed(2))}
      data-max-radius={Number(layout.largestRadius.toFixed(2))}
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.boxWidth,
        height: layout.boxHeight,
      }}
    >
      <Interactive.Svg
        name="气泡层"
        width={layout.drawWidth}
        height={layout.drawHeight}
        viewBox={`0 0 ${layout.sourceWidth} ${layout.sourceHeight}`}
        style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}
      >
        {layout.bubbles.map((bubble) => {
          // 来源：按半径降序排名错峰，largest first, centre outward。
          const start = bubble.rank * SOURCE_MOTION.staggerFrames;
          const progress = interpolate(
            frame,
            [start, start + SOURCE_MOTION.unitFrames],
            [0, 1],
            {easing: EASING.pop, ...clamp},
          );
          if (progress <= 0) return null;
          // 气泡从簇心推到位、半径从 0 长到目标值：同一条进度驱动。
          const x = centreX + (bubble.x - centreX) * progress;
          const y = centreY + (bubble.y - centreY) * progress;
          const radius = bubble.radius * progress;
          const labelOpacity = interpolate(
            frame,
            [start + SOURCE_MOTION.unitFrames * 0.55, start + SOURCE_MOTION.unitFrames],
            [0, 1],
            {...clamp},
          );
          return <Interactive.G key={bubble.id} name={bubble.label}>
            <Interactive.Circle
              name="气泡"
              cx={x}
              cy={y}
              r={radius}
              fill={palette[bubble.rank % palette.length]}
              opacity={tokens.fillOpacity}
            />
            <Interactive.Text
              name="标签"
              x={x}
              y={y + bubble.labelFontSize * SOURCE_GEOMETRY.labelOffsetY}
              fill={tokens.ink}
              fontSize={bubble.labelFontSize}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={labelOpacity}
            >
              {bubble.label}
            </Interactive.Text>
            <Interactive.Text
              name="数值"
              x={x}
              y={y + bubble.labelFontSize * SOURCE_GEOMETRY.labelOffsetY + bubble.valueFontSize * 1.25}
              fill={tokens.ink}
              fontSize={bubble.valueFontSize}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={labelOpacity * 0.72}
              style={{fontVariantNumeric: "tabular-nums"}}
            >
              {bubble.valueText}
            </Interactive.Text>
          </Interactive.G>;
        })}
      </Interactive.Svg>
    </div>
  </AbsoluteFill>;
}
