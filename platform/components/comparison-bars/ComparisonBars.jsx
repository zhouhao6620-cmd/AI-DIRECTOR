// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame + 内联 interpolate，
// 结构用 Interactive.* + name，位移与缩放用 translate / scale 属性（不拼 transform 字符串），
// 输出范围、easing、extrapolate 全部硬编码，不用任何 CSS transition / animation。
import React, {useMemo} from "react";
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateComparisonBarsLayout,
} from "./layout.js";
import {ACCENTS, DOWNS, SURFACE_TOKENS, assertComparisonBarsProps} from "./model.js";
import {EASING, framesFor} from "../../elements/motion-tokens/motion-tokens.js";

export function ComparisonBars({content, position, size, surface, theme, growMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertComparisonBarsProps({content, position, size, surface, theme, growMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateComparisonBarsLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const down = DOWNS[theme][surface];
  const growFrames = Math.max(1, framesFor(growMs / 1000, fps));
  const staggerFrames = Math.max(1, framesFor(SOURCE_MOTION.defaultStaggerMs / 1000, fps));
  const pairOffsetFrames = Math.max(1, framesFor(SOURCE_MOTION.defaultPairOffsetMs / 1000, fps));
  const easeEnter = Easing.bezier(...EASING.enter);

  return <AbsoluteFill name="ComparisonBars｜对比条形" style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="DRAFT-comparison-bars"
      data-theme={theme} data-surface={surface} data-row-count={layout.rows.length} data-peak={layout.peak}
      data-card-width={Number(layout.blockWidth.toFixed(2))} data-card-height={Number(layout.blockHeight.toFixed(2))}
      data-scale={Number(layout.factor.toFixed(4))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.boxWidth, height: layout.boxHeight,
        scale: layout.factor, transformOrigin: "0 0",
        display: "flex", flexDirection: "column", gap: SOURCE_GEOMETRY.rowGap,
      }}
    >
      {content.title ? <Interactive.Div name="标题" style={{
        height: layout.headerHeight, color: tokens.ink, fontSize: SOURCE_GEOMETRY.titleFontSize,
        fontWeight: SOURCE_GEOMETRY.titleFontWeight, lineHeight: 1.2, whiteSpace: "pre",
        opacity: interpolate(frame, [0, framesFor(0.8, fps)], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>{content.title}</Interactive.Div> : null}

      {/* 两列名称：来源是条形上方的图例，色块与条形同色。 */}
      {layout.legend ? <Interactive.Div name="图例" style={{
        height: layout.legendHeight, marginLeft: layout.labelWidth, display: "flex", alignItems: "center",
        gap: SOURCE_GEOMETRY.rowGap, color: tokens.label, fontSize: layout.legend.fontSize, fontWeight: 600,
      }}>
        <Interactive.Span name="改造前图例" style={{display: "flex", alignItems: "center", gap: 8}}>
          <Interactive.Span style={{
            width: layout.legend.swatch, height: layout.legend.swatch,
            borderRadius: SOURCE_GEOMETRY.legendSwatchRadius, background: tokens.before, display: "block",
          }}/>
          {layout.legend.before}
        </Interactive.Span>
        <Interactive.Span name="改造后图例" style={{display: "flex", alignItems: "center", gap: 8}}>
          <Interactive.Span style={{
            width: layout.legend.swatch, height: layout.legend.swatch,
            borderRadius: SOURCE_GEOMETRY.legendSwatchRadius, background: accent, display: "block",
          }}/>
          {layout.legend.after}
        </Interactive.Span>
      </Interactive.Div> : null}

      {layout.rows.map(row => {
        const start = row.index * staggerFrames;
        // 同一条弹簧/曲线驱动长度：这一对条形共用一把尺，前后可比。
        const beforeProgress = interpolate(frame, [start, start + growFrames], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const afterProgress = interpolate(frame, [start + pairOffsetFrames, start + pairOffsetFrames + growFrames], [0, 1], {
          easing: easeEnter, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const valueOpacity = interpolate(afterProgress, [SOURCE_GEOMETRY.valueRevealStart, SOURCE_GEOMETRY.valueRevealStart + SOURCE_GEOMETRY.valueRevealWindow], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return <Interactive.Div key={row.id} name={`对比项 ${row.label}`} data-row-id={row.id} data-before={Number(beforeProgress.toFixed(4))} data-after={Number(afterProgress.toFixed(4))} style={{
          height: layout.rowHeight, display: "flex", alignItems: "center",
        }}>
          <Interactive.Span name="对比项标签" style={{
            width: layout.labelWidth, paddingRight: SOURCE_GEOMETRY.labelPaddingRight, boxSizing: "border-box",
            color: tokens.label, fontSize: row.labelFontSize, fontWeight: 600, textAlign: "right", whiteSpace: "pre",
          }}>{row.label}</Interactive.Span>

          <Interactive.Div name="条形组" style={{display: "grid", gap: SOURCE_GEOMETRY.barGap, flex: 1}}>
            <div style={{
              height: layout.barHeight, width: row.ratioBefore * layout.barWidth * beforeProgress,
              background: tokens.before, borderRadius: layout.barRadius,
            }}/>
            <div style={{display: "flex", alignItems: "center", gap: SOURCE_GEOMETRY.deltaGap}}>
              <Interactive.Div name="改造后条形" style={{
                height: layout.barHeight, width: row.ratioAfter * layout.barWidth * afterProgress,
                background: accent, borderRadius: layout.barRadius,
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                paddingRight: layout.valuePadding, boxSizing: "border-box",
              }}>
                {/* 数值只在条形够宽时出现，来源做法；宽度上限在版式里按最宽的一条检查。 */}
                <Interactive.Span name="条形数值" style={{
                  color: tokens.barInk, fontSize: row.valueFontSize, fontWeight: 700,
                  fontVariantNumeric: "tabular-nums", whiteSpace: "pre", opacity: valueOpacity,
                }}>{row.valueText}</Interactive.Span>
              </Interactive.Div>

              <Interactive.Span name="变化幅度" style={{
                color: row.direction === "down" ? down : accent,
                fontSize: row.chipFontSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
                // 结论最后落地：第二条条形停稳后幅度才出现。
                opacity: interpolate(afterProgress, [SOURCE_GEOMETRY.deltaRevealStart, SOURCE_GEOMETRY.deltaRevealStart + SOURCE_GEOMETRY.deltaRevealWindow], [0, 1], {
                  extrapolateLeft: "clamp", extrapolateRight: "clamp",
                }),
                translate: `${interpolate(afterProgress, [SOURCE_GEOMETRY.deltaRevealStart, SOURCE_GEOMETRY.deltaRevealStart + SOURCE_GEOMETRY.deltaRevealWindow], [-SOURCE_GEOMETRY.deltaSlidePx, 0], {
                  extrapolateLeft: "clamp", extrapolateRight: "clamp",
                })}px`,
              }}>{row.delta}</Interactive.Span>
            </div>
          </Interactive.Div>
        </Interactive.Div>;
      })}

      {content.caption ? <Interactive.Div name="小注" style={{
        height: layout.captionHeight, color: tokens.label, fontSize: SOURCE_GEOMETRY.captionFontSize,
        whiteSpace: "pre", textAlign: "right",
      }}>{content.caption}</Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
