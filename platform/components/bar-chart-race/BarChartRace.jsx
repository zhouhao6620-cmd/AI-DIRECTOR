// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame + 内联 interpolate，
// 结构用 Interactive.* + name，位移与缩放用 translate / scale 属性（不拼 transform 字符串），
// 输出范围、easing、extrapolate 全部硬编码，不用任何 CSS transition / animation。
import React, {useMemo} from "react";
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateBarChartRaceLayout, raceStateAt, timeAt,
} from "./layout.js";
import {SURFACE_TOKENS, assertBarChartRaceProps, paletteOf} from "./model.js";
import {EASING, framesFor} from "../../elements/motion-tokens/motion-tokens.js";
import {formatCompactNumber} from "../../elements/chart-utils/chart-utils.js";

export function BarChartRace({content, position, size, surface, theme, stepMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertBarChartRaceProps({content, position, size, surface, theme, stepMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateBarChartRaceLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const palette = paletteOf(theme, surface);
  const time = timeAt({frame, fps, stepMs, stepCount: content.steps.length});
  const unit = content.unit ?? "";
  const race = raceStateAt({content, time, valueText: value => `${formatCompactNumber(value)}${unit}`});
  const stepIndex = Math.min(content.steps.length - 1, Math.max(0, Math.round(time)));
  const activeStep = layout.steps[stepIndex] ?? layout.steps[0];
  const easeEnter = Easing.bezier(...EASING.enter);

  return <AbsoluteFill name="BarChartRace｜柱状竞速图" style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="DRAFT-bar-chart-race"
      data-theme={theme} data-surface={surface} data-series-count={race.rows.length}
      data-step-count={content.steps.length} data-step-index={stepIndex} data-time={Number(time.toFixed(4))}
      data-leader={Number(race.leader.toFixed(2))}
      data-card-width={Number(layout.blockWidth.toFixed(2))} data-card-height={Number(layout.blockHeight.toFixed(2))}
      data-scale={Number(layout.factor.toFixed(4))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.boxWidth, height: layout.boxHeight,
        scale: layout.factor, transformOrigin: "0 0", display: "flex", flexDirection: "column",
        gap: SOURCE_GEOMETRY.blockGap,
      }}
    >
      {content.title ? <Interactive.Div name="标题" style={{
        height: layout.titleHeight, color: tokens.ink, fontSize: SOURCE_GEOMETRY.titleFontSize,
        fontWeight: SOURCE_GEOMETRY.titleFontWeight, lineHeight: 1.2, whiteSpace: "pre",
        opacity: interpolate(frame, [0, framesFor(0.8, fps)], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>{content.title}</Interactive.Div> : null}

      <Interactive.Div name="竞速榜" style={{position: "relative", width: layout.boxWidth, height: layout.boardHeight}}>
        {race.rows.map(row => {
          // 行名与排名都要看得见：可见窗口之外的行淡出，而不是被裁掉（来源同此）。
          if (row.visibility <= 0) return null;
          const color = row.color ?? palette[row.index % palette.length];
          return <Interactive.Div
            key={row.id} name={`系列 ${row.label}`} data-row-id={row.id}
            data-rank={Number(row.rank.toFixed(4))} data-current={Number(row.current.toFixed(4))}
            style={{
              position: "absolute", top: 0, left: 0, width: layout.boxWidth, height: layout.rowHeight,
              display: "flex", alignItems: "center", gap: layout.rowGap,
              // 分数名次：两条数值交叉时条形互相滑过，而不是整行跳一格。
              translate: `0 ${row.rank * layout.pitch}px`,
              opacity: row.visibility,
            }}
          >
            <Interactive.Span name="系列名" style={{
              width: layout.labelWidth - layout.rowGap, textAlign: "right", color: tokens.label,
              fontSize: layout.labelFontSize, fontWeight: 600, whiteSpace: "nowrap",
            }}>{row.label}</Interactive.Span>

            <Interactive.Div name="条形" style={{
              height: layout.rowHeight, width: Math.max(layout.minBarWidth, row.ratio * layout.barWidth),
              borderRadius: layout.barRadius, background: color,
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              paddingRight: layout.valuePadding, boxSizing: "border-box",
            }}>
              <Interactive.Span name="数值" style={{
                color: tokens.barInk, fontSize: layout.valueFontSize, fontWeight: 700,
                fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
              }}>{row.valueText}</Interactive.Span>
            </Interactive.Div>
          </Interactive.Div>;
        })}

        {/* 当前时间点：右下角的大字，压得很淡，只做计时参考。 */}
        <Interactive.Div name="时间点" style={{
          position: "absolute", right: 0, bottom: 0, color: tokens.ink,
          fontSize: layout.stepFontSize, fontWeight: 700, opacity: layout.stepOpacity,
          fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
          // 换时间点时淡出再淡入，避免数字瞬间跳变。
          translate: `0 ${interpolate(frame - (stepIndex * framesFor(stepMs / 1000, fps)), [0, framesFor(0.2, fps)], [10, 0], {
            easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
          })}px`,
        }}>{activeStep?.label ?? ""}</Interactive.Div>
      </Interactive.Div>

      {content.caption ? <Interactive.Div name="小注" style={{
        height: layout.captionHeight, color: tokens.label, fontSize: SOURCE_GEOMETRY.captionFontSize,
        whiteSpace: "pre", textAlign: "right",
      }}>{content.caption}</Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
