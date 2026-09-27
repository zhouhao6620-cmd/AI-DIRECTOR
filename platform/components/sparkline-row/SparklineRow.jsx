// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame + 内联 interpolate，
// 结构用 Interactive.* + name，位移与缩放用 translate / scale 属性（不拼 transform 字符串），
// 输出范围、easing、extrapolate 全部硬编码，不用任何 CSS transition / animation。
import React, {useId, useMemo} from "react";
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateSparklineRowLayout} from "./layout.js";
import {ACCENTS, DOWNS, SURFACE_TOKENS, UPS, assertSparklineRowProps} from "./model.js";
import {EASING, framesFor} from "../../elements/motion-tokens/motion-tokens.js";
import {getPathDrawStyles} from "../../elements/path-utils/path-utils.js";

export function SparklineRow({content, position, size, surface, theme, drawMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertSparklineRowProps({content, position, size, surface, theme, drawMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateSparklineRowLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const up = UPS[theme][surface];
  const down = DOWNS[theme][surface];
  const drawFrames = Math.max(1, framesFor(drawMs / 1000, fps));
  const staggerFrames = Math.max(1, framesFor(SOURCE_MOTION.defaultStaggerMs / 1000, fps));
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const easeEnter = Easing.bezier(...EASING.enter);

  return <AbsoluteFill name="SparklineRow｜迷你折线组" style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="DRAFT-sparkline-row"
      data-theme={theme} data-surface={surface} data-row-count={layout.rows.length}
      data-card-width={Number(layout.blockWidth.toFixed(2))} data-card-height={Number(layout.blockHeight.toFixed(2))}
      data-scale={Number(layout.factor.toFixed(4))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.boxWidth, height: layout.boxHeight,
        scale: layout.factor, transformOrigin: "0 0",
        display: "flex", flexDirection: "column", gap: SOURCE_GEOMETRY.blockGap,
      }}
    >
      {content.title ? <Interactive.Div name="标题" style={{
        height: layout.titleHeight, color: tokens.ink, fontSize: SOURCE_GEOMETRY.titleFontSize,
        fontWeight: SOURCE_GEOMETRY.titleFontWeight, lineHeight: 1.2, whiteSpace: "pre",
      }}>{content.title}</Interactive.Div> : null}

      <Interactive.Div name="指标行" style={{display: "grid"}}>
        {layout.rows.map(row => {
          const start = row.index * staggerFrames;
          const progress = interpolate(frame, [start, start + drawFrames], [0, 1], {
            easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const gradientId = `spr-${uid}-${row.index}-fill`;
          const clipId = `spr-${uid}-${row.index}-clip`;
          const deltaColor = row.direction === "up" ? up : row.direction === "down" ? down : tokens.label;
          return <Interactive.Div
            key={row.id} name={`指标 ${row.label}`} data-row-id={row.id} data-row-progress={Number(progress.toFixed(4))}
            style={{
              display: "flex", alignItems: "center", gap: layout.rowGap, height: layout.rowHeight,
              borderBottom: row.divider === "none" ? "none" : `1px solid ${tokens.divider}`,
              opacity: interpolate(frame, [start, start + drawFrames / SOURCE_GEOMETRY.rowOpacityGain], [0, 1], {
                easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
              }),
              translate: `0 ${interpolate(frame, [start, start + drawFrames], [layout.rowHeight * SOURCE_GEOMETRY.rowLiftRatio, 0], {
                easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
              })}px`,
            }}
          >
            <Interactive.Span name="指标名" style={{
              color: tokens.label, fontSize: row.labelFontSize, fontWeight: 600, flex: 1, whiteSpace: "pre",
            }}>{row.label}</Interactive.Span>

            {/* 一条迷你折线：描边沿自身弧长画出，下方渐变同步擦入。 */}
            <Interactive.Svg
              name="迷你折线" width={layout.sparkWidth} height={layout.sparkHeight}
              viewBox={`0 0 ${layout.sparkWidth} ${layout.sparkHeight}`}
              style={{overflow: "visible", flexShrink: 0, fontFamily: FONT_FAMILY}}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={SOURCE_GEOMETRY.areaGradientOpacity}/>
                  <stop offset="100%" stopColor={accent} stopOpacity={0}/>
                </linearGradient>
                <clipPath id={clipId}>
                  <rect x={0} y={-layout.strokeWidth} width={layout.sparkWidth * progress} height={layout.sparkHeight + layout.strokeWidth * 2}/>
                </clipPath>
              </defs>
              <Interactive.Path name="渐变面积" d={row.areaPath} fill={`url(#${gradientId})`} clipPath={`url(#${clipId})`}/>
              <Interactive.Path
                name="折线" d={row.linePath} fill="none" stroke={accent} strokeWidth={layout.strokeWidth}
                strokeLinecap="round" strokeLinejoin="round" style={getPathDrawStyles(progress, row.linePath)}
              />
              {/* 末点圆点：折线画到 92% 才落下，读起来是线把点放下。 */}
              <Interactive.Circle
                name="末点" cx={row.last.x} cy={row.last.y} r={layout.strokeWidth * SOURCE_GEOMETRY.headDotScale}
                fill={accent}
                opacity={interpolate(progress, [SOURCE_GEOMETRY.headDotStart, 1], [0, 1], {
                  extrapolateLeft: "clamp", extrapolateRight: "clamp",
                })}
              />
            </Interactive.Svg>

            <Interactive.Span name="当前值" style={{
              color: tokens.ink, fontSize: row.valueFontSize, fontWeight: 700,
              fontVariantNumeric: "tabular-nums", minWidth: layout.valueMinWidth, textAlign: "right", whiteSpace: "pre",
            }}>{row.valueText}</Interactive.Span>

            {row.deltaText === "" ? null : <Interactive.Span name="变化幅度" style={{
              color: deltaColor, fontSize: row.deltaFontSize, fontWeight: 600,
              fontVariantNumeric: "tabular-nums", minWidth: layout.deltaMinWidth, textAlign: "right", whiteSpace: "pre",
              // 幅度是这一行的结论，等折线画到 80% 才出现。
              opacity: interpolate(progress, [SOURCE_GEOMETRY.deltaStart, 1], [0, 1], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              }),
            }}>{row.deltaText}</Interactive.Span>}
          </Interactive.Div>;
        })}
      </Interactive.Div>

      {content.caption ? <Interactive.Div name="小注" style={{
        height: layout.captionHeight, color: tokens.label, fontSize: SOURCE_GEOMETRY.captionFontSize,
        whiteSpace: "pre", textAlign: "right",
      }}>{content.caption}</Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
