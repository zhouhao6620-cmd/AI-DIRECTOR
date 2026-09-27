// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」写法：Interactive.* + name、内联 interpolate()、
// 输出范围 / easing / extrapolate 硬编码、不用 CSS 过渡、不拼 transform 字符串。
// 来源：RemotionUI `waterfall-chart`（MIT）；适配差异见 ./layout.js 顶部注释与 definition.json。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateWaterfallChartLayout,
} from "./layout.js";
import {BAR_OPACITY, COMPONENT_ID, SURFACE_TOKENS, assertWaterfallChartProps, stepColor} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export function WaterfallChart({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertWaterfallChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});

  const layout = useMemo(() => calculateWaterfallChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight) => measureText({
      text, fontFamily: FONT_FAMILY, fontSize, fontWeight,
    }).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const labelSize = layout.labelSize;
  const unit = layout.sourceWidth / SOURCE_GEOMETRY.labelUnitBase;

  return <AbsoluteFill name="WaterfallChart｜瀑布图" style={{backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme}
      data-surface={surface}
      data-scale={Number(layout.factor.toFixed(4))}
      data-step-count={layout.steps.length}
      data-final-level={Number(layout.finalLevel.toFixed(4))}
      data-box-width={Number(layout.boxWidth.toFixed(2))}
      data-box-height={Number(layout.boxHeight.toFixed(2))}
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.boxWidth,
        height: layout.boxHeight,
      }}
    >
      <Interactive.Svg
        name="瀑布图层"
        width={layout.drawWidth}
        height={layout.drawHeight}
        viewBox={`0 0 ${layout.sourceWidth} ${layout.sourceHeight}`}
        style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}
      >
        {layout.yTicks.map((tick) => <Interactive.G key={`tick-${tick.value}`} name={`水位 ${tick.text}`}>
          <Interactive.Line
            name="水位线"
            x1={layout.plot.left}
            y1={tick.y}
            x2={layout.plot.right}
            y2={tick.y}
            stroke={tokens.grid}
            strokeWidth={tick.value === 0 ? 2 : 1}
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

        {layout.steps.map((step, index) => {
          const start = index * SOURCE_MOTION.staggerFrames;
          const progress = interpolate(
            frame,
            [start, start + SOURCE_MOTION.unitFrames],
            [0, 1],
            {easing: EASING.enter, ...clamp},
          );
          if (progress <= 0) return null;
          // 柱从自己的起点水位长到落点水位；位置和长度一样是信息。
          const tip = step.base + (step.tip - step.base) * progress;
          const top = Math.min(step.base, tip);
          const barHeight = Math.abs(tip - step.base);
          const colour = stepColor(theme, step);
          const valueOpacity = interpolate(frame, [start + 14, start + SOURCE_MOTION.unitFrames], [0, 1], {...clamp});
          const connectorProgress = Math.min(1, Math.max(0, (progress - 0.85) / 0.15));
          const nextCentre = layout.plot.left + layout.pitch * (index + 1.5);
          const nextStep = layout.steps[index + 1];
          return <Interactive.G key={step.id} name={step.label}>
            <Interactive.Rect
              name="浮空柱"
              x={step.centre - layout.barWidth / 2}
              y={top}
              width={layout.barWidth}
              height={Math.max(1, barHeight)}
              rx={Math.min(layout.barWidth * SOURCE_GEOMETRY.barRadiusFactor, SOURCE_GEOMETRY.barRadiusMax)}
              fill={colour}
              opacity={BAR_OPACITY}
            />
            {index < layout.steps.length - 1 && nextStep && !nextStep.isTotal ? <Interactive.Line
              name="连接线"
              x1={step.centre + layout.barWidth / 2}
              y1={step.tip}
              x2={step.centre + layout.barWidth / 2 + (nextCentre - layout.barWidth / 2 - (step.centre + layout.barWidth / 2)) * connectorProgress}
              y2={step.tip}
              stroke={tokens.label}
              strokeWidth={1.5}
              strokeDasharray={`${SOURCE_GEOMETRY.connectorDash[0] * unit} ${SOURCE_GEOMETRY.connectorDash[1] * unit}`}
            /> : null}
            <Interactive.Text
              name="柱顶数值"
              x={step.centre}
              y={step.rising ? top - labelSize * SOURCE_GEOMETRY.valueGapFactor : top + barHeight + labelSize * SOURCE_GEOMETRY.valueGapFactor}
              fill={step.isTotal ? tokens.ink : colour}
              fontSize={labelSize}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={valueOpacity}
              style={{fontVariantNumeric: "tabular-nums"}}
            >{step.valueText}</Interactive.Text>
            <Interactive.Text
              name="步骤名"
              x={step.centre}
              y={layout.plot.bottom + labelSize * SOURCE_GEOMETRY.stepLabelOffsetFactor}
              fill={tokens.label}
              fontSize={labelSize}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={Math.min(1, progress * 1.5)}
            >{step.label}</Interactive.Text>
          </Interactive.G>;
        })}
      </Interactive.Svg>
    </div>
  </AbsoluteFill>;
}
