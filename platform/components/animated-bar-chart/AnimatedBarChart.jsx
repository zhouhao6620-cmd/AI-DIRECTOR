// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame + spring / 内联 interpolate，
// 结构用 Interactive.* + name，位移与缩放用 translate / scale 属性（不拼 transform 字符串），
// 输出范围、easing、extrapolate 全部硬编码，不用任何 CSS transition / animation。
import React, {useMemo} from "react";
import {AbsoluteFill, Easing, Interactive, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {BAR_SPRING, FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateAnimatedBarChartLayout} from "./layout.js";
import {ACCENTS, DOWNS, EMPHASIS, SURFACE_TOKENS, UPS, assertAnimatedBarChartProps} from "./model.js";
import {DEFAULT_FPS, EASING, durationsFor, framesFor} from "../../elements/motion-tokens/motion-tokens.js";
import {formatCompactNumber} from "../../elements/chart-utils/chart-utils.js";

export function AnimatedBarChart({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertAnimatedBarChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateAnimatedBarChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const emphasis = EMPHASIS[theme][surface];
  const up = UPS[theme][surface];
  const down = DOWNS[theme][surface];
  const durations = durationsFor(fps);
  const barFrames = Math.max(1, framesFor(SOURCE_MOTION.barSpringSeconds, fps));
  // The source's STAGGER token is in its own 30 fps frames; convert through seconds so the stagger
  // keeps the source's real time (0.267 s) on a 24 / 25 / 60 fps composition too.
  const subtitleDelay = framesFor(SOURCE_MOTION.subtitleDelayFrames / DEFAULT_FPS, fps);
  const axisDelay = framesFor(SOURCE_MOTION.axisDelayFrames / DEFAULT_FPS, fps);
  const rowDelay = framesFor(SOURCE_MOTION.rowDelayFrames / DEFAULT_FPS, fps);
  const rowStep = framesFor(SOURCE_MOTION.rowDelayStepFrames / DEFAULT_FPS, fps);
  const easeEnter = Easing.bezier(...EASING.enter);
  // 头部与坐标轴共用来源的 DURATION.normal（0.8 秒），本组件按 fps 还原成帧。
  const headerFrames = Math.max(1, durations.normal);

  return <AbsoluteFill name="AnimatedBarChart｜动态柱状图" style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="DRAFT-animated-bar-chart"
      data-theme={theme} data-surface={surface} data-bar-count={layout.bars.length}
      data-orientation={layout.isPortrait ? "PORTRAIT" : "LANDSCAPE"}
      data-card-width={Number(layout.blockWidth.toFixed(2))} data-card-height={Number(layout.blockHeight.toFixed(2))}
      data-scale={Number(layout.factor.toFixed(4))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.boxWidth, height: layout.boxHeight,
        scale: layout.factor, transformOrigin: "0 0", display: "flex", flexDirection: "column",
        gap: layout.mainGap,
      }}
    >
      {content.title ? <Interactive.Div name="标题组" style={{
        display: "grid", gap: layout.headerGap,
        opacity: interpolate(frame, [0, headerFrames], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
        translate: `0 ${interpolate(frame, [0, headerFrames], [layout.lift, 0], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        })}px`,
      }}>
        <Interactive.Div name="标题" style={{
          color: tokens.ink, fontSize: layout.titleFontSize, fontWeight: SOURCE_GEOMETRY.titleFontWeight,
          lineHeight: SOURCE_GEOMETRY.titleLineHeight, letterSpacing: "-0.025em", whiteSpace: "pre",
        }}>{content.title}</Interactive.Div>
        {content.subtitle ? <Interactive.Div name="副标题" style={{
          color: tokens.label, fontSize: layout.subtitleFontSize, fontWeight: SOURCE_GEOMETRY.subtitleFontWeight,
          lineHeight: SOURCE_GEOMETRY.subtitleLineHeight, whiteSpace: "pre",
          opacity: interpolate(frame, [subtitleDelay, subtitleDelay + headerFrames], [0, 1], {
            easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
          }),
        }}>{content.subtitle}</Interactive.Div> : null}
      </Interactive.Div> : null}

      <Interactive.Div name="条目" style={{position: "relative", display: "flex", flexDirection: "column", gap: layout.rowGap}}>
        {/* 网格线只覆盖条目区，不会穿过标题与坐标轴之间的空白（来源写法）。 */}
        <Interactive.Div name="网格线层" style={{
          position: "absolute", left: layout.labelWidth + layout.gap, right: layout.valueWidth + layout.gap,
          top: 0, bottom: 0,
          opacity: interpolate(frame, [axisDelay, axisDelay + headerFrames], [0, 1], {
            easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
          }),
        }}>
          {layout.axisTicks.map(tick => <div key={tick.value} style={{
            position: "absolute", top: 0, bottom: 0, left: `${tick.leftRatio * 100}%`, width: 1, background: tokens.grid,
          }}/>)}
        </Interactive.Div>

        {layout.bars.map(bar => {
          const delay = rowDelay + bar.index * rowStep;
          // 一条弹簧同时驱动条形长度、计数与整行上浮：数字不可能超出条形已经走到的位置。
          const enter = spring({frame: frame - delay, fps, config: {...BAR_SPRING}, durationInFrames: barFrames});
          const fill = bar.emphasis ? emphasis : accent;
          return <Interactive.Div
            key={bar.id} name={`条目 ${bar.label}`} data-bar-id={bar.id} data-enter={Number(enter.toFixed(4))}
            style={{
              display: "grid", gridTemplateColumns: `${layout.labelWidth}px 1fr ${layout.valueWidth}px`,
              gap: layout.gap, alignItems: "center",
              opacity: Math.min(1, enter * 1.6),
              translate: `0 ${(1 - enter) * layout.lift}px`,
            }}
          >
            <Interactive.Div name="条形名" style={{
              color: bar.emphasis ? tokens.ink : tokens.label,
              fontSize: layout.labelFontSize, fontWeight: bar.emphasis ? 700 : 600,
              letterSpacing: "-0.01em", whiteSpace: "pre",
            }}>{bar.label}</Interactive.Div>

            <Interactive.Div name="条形轨道" style={{
              position: "relative", height: layout.barHeight, borderRadius: layout.barRadius, background: tokens.track,
            }}>
              <Interactive.Div name="条形" style={{
                // 近零也保留一条可见药丸，但它仍然是长出来的，不是直接弹出。
                width: `${Math.max(bar.ratio, SOURCE_GEOMETRY.countFloorRatio) * enter * 100}%`,
                height: "100%", borderRadius: layout.barRadius,
                background: `linear-gradient(90deg, ${fill}e6 0%, ${fill} 62%)`,
                boxShadow: bar.emphasis ? `0 0 ${layout.glow}px ${fill}44` : undefined,
              }}/>
            </Interactive.Div>

            <Interactive.Div name="数值组" style={{display: "grid", justifyItems: "end", gap: layout.gap / 3}}>
              <Interactive.Div name="数值" style={{
                fontSize: bar.valueFontSize, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1,
                fontVariantNumeric: "tabular-nums", color: bar.emphasis ? fill : tokens.ink, whiteSpace: "pre",
              }}>{`${formatCompactNumber(bar.value * enter)}${layout.unit}`}</Interactive.Div>
              {bar.deltaText === "" ? null : <Interactive.Div name="变化幅度" style={{
                fontSize: layout.deltaFontSize, fontWeight: 600, lineHeight: 1,
                color: bar.direction === "down" ? down : bar.direction === "up" ? up : tokens.label,
                // 幅度是条目的结论：等条形长到 70% 才出现。
                opacity: interpolate(enter, [SOURCE_GEOMETRY.deltaRevealStart, 1], [0, 1], {
                  extrapolateLeft: "clamp", extrapolateRight: "clamp",
                }),
              }}>{bar.deltaText}</Interactive.Div>}
            </Interactive.Div>
          </Interactive.Div>;
        })}
      </Interactive.Div>

      {/* 刻度行：与网格线同一进度淡入，端点向内收，坐标轴不会超出条区。 */}
      <Interactive.Div name="刻度行" style={{
        position: "relative", height: layout.axisHeight, marginLeft: layout.labelWidth + layout.gap,
        marginRight: layout.valueWidth + layout.gap, marginTop: layout.axisMarginTop - layout.mainGap,
        opacity: interpolate(frame, [axisDelay, axisDelay + headerFrames], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>
        {layout.axisTicks.map(tick => <div key={tick.value} style={{
          position: "absolute", top: 0, left: `${tick.leftRatio * 100}%`,
          translate: tick.first ? "none" : tick.last ? "-100%" : "-50%",
          color: tokens.axis, fontSize: layout.axisFontSize, fontWeight: 600,
          fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
        }}>{tick.text}</div>)}
      </Interactive.Div>

      {content.caption ? <Interactive.Div name="小注" style={{
        height: layout.captionHeight, color: tokens.label, fontSize: SOURCE_GEOMETRY.captionFontSize,
        whiteSpace: "pre", textAlign: "right",
      }}>{content.caption}</Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
