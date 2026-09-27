// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame / Easing 曲线 +
// 归一化进度，样式内联、不写 CSS 过渡；文字块用 Interactive.* + name 保证 Studio 可点选。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {formatCompactNumber} from "./elements/chart-utils/index.js";
import {
  FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  calculateDonutChartLayout, clamp01, progressAt,
} from "./layout.js";
import {COMPONENT_ID, SERIES, SURFACE_TOKENS, assertDonutChartProps} from "./model.js";

export function DonutChart({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertDonutChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateDonutChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const palette = SERIES[theme][surface];
  // 来源：每段自己的扫过窗口是 index × stagger 起、持续 durationInFrames。
  const drawn = layout.segments.map((segment, index) => ({
    ...segment,
    color: segment.color ?? palette[index % palette.length],
    progress: progressAt({frame, fps, delayMs: index * SOURCE_MOTION.staggerMs, durationMs: SOURCE_MOTION.sweepMs, ease: EASING.enter}),
  }));
  // 来源口径：环内合计只累计「已经落定」的分段，所以任何一帧上数字与环都自洽。
  const landed = drawn.reduce((sum, segment) => sum + segment.value * segment.progress, 0);
  const total = layout.total || 1;
  let cursor = 0;
  const arcs = drawn.map(segment => {
    const startFraction = cursor;
    cursor += segment.value / total;
    const length = Math.max(0, (segment.value / total) * layout.circumferenceSource * segment.progress - layout.gapSource);
    return {...segment, startFraction, length};
  });

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme} data-surface={surface}
      data-segment-count={drawn.length}
      data-progress={drawn.map(segment => Number(segment.progress.toFixed(4))).join(",")}
      data-landed={Number(landed.toFixed(4))}
      data-colors={drawn.map(segment => segment.color).join(",")}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.cardWidth, height: layout.cardHeight,
        display: "flex", alignItems: "center", gap: layout.legendGap, color: tokens.ink,
      }}
    >
      <Interactive.Div name="环形" style={{position: "relative", width: layout.ringSize, height: layout.ringSize, flex: "none"}}>
        <Interactive.Svg
          name="圆环" width={layout.ringSize} height={layout.ringSize}
          viewBox={`0 0 ${SOURCE_GEOMETRY.ringSize} ${SOURCE_GEOMETRY.ringSize}`}
          style={{display: "block", overflow: "visible"}}
        >
          {/* 轨道：来源在分段下面先画一圈浅色底环，缺口看得见而不是被裁掉。 */}
          <circle
            data-donut-track cx={SOURCE_GEOMETRY.ringSize / 2} cy={SOURCE_GEOMETRY.ringSize / 2}
            r={layout.radiusSource} fill="none" stroke={tokens.track} strokeWidth={SOURCE_GEOMETRY.thickness}
          />
          {arcs.map((segment, index) => <circle
            key={segment.id}
            data-donut-arc-id={segment.id} data-donut-arc-index={index}
            data-donut-arc-fraction={Number((segment.value / total).toFixed(6))}
            data-donut-arc-progress={Number(segment.progress.toFixed(4))}
            cx={SOURCE_GEOMETRY.ringSize / 2} cy={SOURCE_GEOMETRY.ringSize / 2}
            r={layout.radiusSource} fill="none" stroke={segment.color}
            strokeWidth={SOURCE_GEOMETRY.thickness} strokeLinecap="butt"
            strokeDasharray={`${segment.length} ${layout.circumferenceSource}`}
            transform={`rotate(${-90 + segment.startFraction * 360} ${SOURCE_GEOMETRY.ringSize / 2} ${SOURCE_GEOMETRY.ringSize / 2})`}
          />)}
        </Interactive.Svg>

        {layout.showTotal ? <div style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center",
        }}>
          <Interactive.Div name="环内合计" style={{maxWidth: layout.holeBox}}>
            <div data-donut-total style={{
              fontFamily: MONO_FONT_FAMILY, fontSize: layout.holeValue.fontSize, fontWeight: 700, lineHeight: 1,
              color: tokens.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
            }}>{formatCompactNumber(landed)}{content.unit ?? ""}</div>
            {layout.holeLabel ? <div data-donut-total-label style={{
              fontSize: layout.holeLabel.fontSize, fontWeight: 600, letterSpacing: layout.holeLabel.letterSpacing,
              color: tokens.muted, marginTop: layout.ringSize * SOURCE_GEOMETRY.totalLabelMarginRatio,
              whiteSpace: "pre",
            }}>{content.totalLabel}</div> : null}
          </Interactive.Div>
        </div> : null}
      </Interactive.Div>

      {layout.showLegend ? <Interactive.Div name="图例" style={{
        display: "flex", flexDirection: "column", gap: layout.legendRowGap,
      }}>
        {arcs.map((segment, index) => <div
          key={segment.id} data-donut-legend-id={segment.id} data-donut-legend-index={index}
          data-donut-legend-progress={Number(segment.progress.toFixed(4))}
          style={{
            display: "flex", alignItems: "center", gap: layout.legendInnerGap,
            // 每一行跟着自己那一段一起到位，图例读起来是过程而不是事后注解（来源口径）。
            opacity: clamp01(segment.progress * 1.6),
            translate: `0 ${(1 - segment.progress) * layout.ringSize * 0.05}px`,
          }}
        >
          <span data-donut-legend-dot style={{
            width: layout.legendDot, height: layout.legendDot, borderRadius: 999,
            background: segment.color, flexShrink: 0,
          }}/>
          <span data-donut-legend-label style={{
            width: layout.labelBox, fontSize: segment.labelFontSize, fontWeight: 600, color: tokens.ink, whiteSpace: "pre",
          }}>{segment.label}</span>
          <span data-donut-legend-value style={{
            fontFamily: MONO_FONT_FAMILY, fontSize: segment.valueFontSize, fontWeight: 600,
            color: tokens.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
          }}>{Math.round((segment.value / total) * segment.progress * 100)}%</span>
        </div>)}
      </Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
