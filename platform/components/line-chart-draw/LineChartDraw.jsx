// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame + 内联 interpolate，
// 结构用 Interactive.* + name，位移与缩放用 translate / scale 属性（不拼 transform 字符串），
// 输出范围、easing、extrapolate 全部硬编码，不用任何 CSS transition / animation。
import React, {useId, useMemo} from "react";
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateLineChartDrawLayout,
} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertLineChartDrawProps} from "./model.js";
import {EASING, durationsFor, framesFor} from "../../elements/motion-tokens/motion-tokens.js";
import {getPathDrawStyles, pointAtLength} from "../../elements/path-utils/path-utils.js";

export function LineChartDraw({content, position, size, surface, theme, drawMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertLineChartDrawProps({content, position, size, surface, theme, drawMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateLineChartDrawLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const drawFrames = framesFor(drawMs / 1000, fps);
  const durations = durationsFor(fps);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const gradientId = `lcd-fill-${uid}`;
  const clipId = `lcd-clip-${uid}`;
  const easeEnter = Easing.bezier(...EASING.enter);
  // 曲线进度：来源 progress = interpolate(frame, [delay, delay + durationInFrames], [0, 1], EASING.enter)
  const draw = interpolate(frame, [0, drawFrames], [0, 1], {
    easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  // 笔尖沿真实弧长走，而不是按进度插值：陡峭段落也不会跑到曲线外面（来源注释同此）。
  const tip = pointAtLength(layout.linePath, layout.pathLength * draw) ?? {x: layout.plot.left, y: layout.plot.bottom};
  const dotWindow = Math.max(1, layout.plot.width * SOURCE_GEOMETRY.dotRevealWindowRatio);
  const litPoints = layout.points.filter(point => Math.max(0, Math.min(1, (tip.x - point.node.x + dotWindow) / dotWindow)) > 0).length;

  return <AbsoluteFill name="LineChartDraw｜折线图描绘" style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="DRAFT-line-chart-draw"
      data-theme={theme} data-surface={surface}
      data-draw={Number(draw.toFixed(4))} data-point-count={layout.points.length}
      data-lit-points={litPoints} data-card-width={Number(layout.blockWidth.toFixed(2))}
      data-card-height={Number(layout.blockHeight.toFixed(2))} data-scale={Number(layout.factor.toFixed(4))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.boxWidth, height: layout.boxHeight,
        scale: layout.factor, transformOrigin: "0 0",
      }}
    >
      {content.title ? <Interactive.Div name="标题" style={{
        marginBottom: SOURCE_GEOMETRY.titleMarginBottom,
        color: tokens.ink, fontSize: SOURCE_GEOMETRY.titleFontSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight,
        lineHeight: 1.2, whiteSpace: "pre",
        opacity: interpolate(frame, [0, durations.normal], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
        translate: `0 ${interpolate(frame, [0, durations.normal], [18, 0], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        })}px`,
      }}>{content.title}</Interactive.Div> : null}

      <Interactive.Svg
        name="折线图" width={layout.designWidth} height={layout.designHeight}
        viewBox={`0 0 ${layout.designWidth} ${layout.designHeight}`}
        style={{display: "block", overflow: "visible", fontFamily: FONT_FAMILY}}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={SOURCE_GEOMETRY.areaGradientOpacity}/>
            <stop offset="100%" stopColor={accent} stopOpacity={0}/>
          </linearGradient>
          {/* 面积的擦入用与曲线同一进度的裁剪矩形，来源写法一致。 */}
          <clipPath id={clipId}>
            <rect
              x={layout.plot.left} y={layout.plot.top - layout.strokeWidth}
              width={layout.plot.width * draw} height={layout.plot.height + layout.strokeWidth * 2}
            />
          </clipPath>
        </defs>

        <Interactive.G name="数值轴">
          {layout.axisTicks.map(tick => <React.Fragment key={tick.value}>
            <Interactive.Line
              name={`网格线 ${tick.text}`} x1={layout.plot.left} y1={tick.y} x2={layout.plot.right} y2={tick.y}
              stroke={tokens.grid} strokeWidth={SOURCE_GEOMETRY.gridStrokeWidth}
              // 零线承载基线，来源给它更重的一档。
              opacity={tick.zero ? SOURCE_GEOMETRY.gridZeroOpacity : 1}
            />
            <Interactive.Text
              name={`刻度 ${tick.text}`} x={layout.plot.left - SOURCE_GEOMETRY.gutterGap / 2} y={tick.y}
              fill={tokens.label} fontSize={layout.labelSize} fontWeight={600}
              textAnchor="end" dominantBaseline="central" style={{fontVariantNumeric: "tabular-nums"}}
            >{tick.text}</Interactive.Text>
          </React.Fragment>)}
        </Interactive.G>

        <Interactive.Path
          name="渐变面积" d={layout.areaPath} fill={`url(#${gradientId})`} clipPath={`url(#${clipId})`}
        />

        <Interactive.Path
          name="折线" d={layout.linePath} fill="none" stroke={accent}
          strokeWidth={layout.strokeWidth} strokeLinecap="round" strokeLinejoin="round"
          style={getPathDrawStyles(draw, layout.linePath)}
        />

        <Interactive.G name="数据点">
          {layout.points.map(point => {
            // 笔尖越过点时用 4% 图表宽的窗口长出圆点，读起来是曲线把点放下，而不是闪一下。
            const reveal = Math.max(0, Math.min(1, (tip.x - point.node.x + dotWindow) / dotWindow));
            return <Interactive.G key={point.id} name={`数据点 ${point.label}`} data-point-id={point.id} data-point-on={Number(reveal.toFixed(4))} opacity={reveal}>
              <Interactive.Circle
                name="圆点" cx={point.node.x} cy={point.node.y}
                r={layout.strokeWidth * SOURCE_GEOMETRY.dotRadiusScale * reveal}
                fill={accent} stroke={tokens.surface}
                strokeWidth={layout.strokeWidth * SOURCE_GEOMETRY.dotStrokeScale * reveal}
              />
              <Interactive.Text
                name="类别标签" x={point.node.x} y={layout.plot.bottom + SOURCE_GEOMETRY.xLabelOffset + layout.labelSize / 2}
                fill={tokens.label} fontSize={point.labelFontSize} fontWeight={600}
                textAnchor={point.axisAnchor} dominantBaseline="central"
              >{point.label}</Interactive.Text>
            </Interactive.G>;
          })}
        </Interactive.G>

        {draw > 0 && draw < 1 ? <Interactive.G name="笔尖">
          <Interactive.Circle
            name="笔尖光晕" cx={tip.x} cy={tip.y} r={layout.strokeWidth * SOURCE_GEOMETRY.headHaloScale}
            fill={accent} opacity={SOURCE_GEOMETRY.headHaloOpacity}
          />
          <Interactive.Circle name="笔尖" cx={tip.x} cy={tip.y} r={layout.strokeWidth * SOURCE_GEOMETRY.headDotScale} fill={accent}/>
        </Interactive.G> : null}

        <Interactive.Text
          name="末点数值" x={layout.endPoint.x} y={layout.endPoint.y - layout.endLabel.offsetY}
          fill={accent} fontSize={layout.endLabel.fontSize} fontWeight={700}
          textAnchor="end" dominantBaseline="central"
          opacity={interpolate(draw, [SOURCE_MOTION.endLabelStart, 1], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          })}
          style={{fontVariantNumeric: "tabular-nums"}}
        >{layout.endLabelText}</Interactive.Text>
      </Interactive.Svg>

      {content.caption ? <Interactive.Div name="小注" style={{
        marginTop: SOURCE_GEOMETRY.captionMarginTop, color: tokens.muted,
        fontSize: SOURCE_GEOMETRY.captionFontSize, whiteSpace: "pre", textAlign: "right",
        opacity: interpolate(frame, [drawFrames + 4, drawFrames + 4 + durations.fast], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>{content.caption}</Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
