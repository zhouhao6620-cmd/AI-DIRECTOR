// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame / Easing 曲线 +
// 归一化进度，样式内联、不写 CSS 过渡；文字块用 Interactive.* + name 保证 Studio 可点选。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  calculateFunnelChartLayout, clamp01, progressAt,
} from "./layout.js";
import {COMPONENT_ID, SERIES, SURFACE_TOKENS, assertFunnelChartProps} from "./model.js";

export function FunnelChart({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertFunnelChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateFunnelChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const palette = SERIES[theme][surface];
  const accent = palette[0];
  const dropoffColor = palette[2];
  const bands = layout.stages.map(stage => {
    const next = layout.stages[stage.index + 1];
    const progress = progressAt({frame, fps, delayMs: stage.startMs, durationMs: SOURCE_MOTION.wipeMs, ease: EASING.enter});
    // 环比 chip 是「关于两段的结论」，所以要等下一段也出现之后才落定（来源口径）。
    const dropoffProgress = progressAt({
      frame, fps, delayMs: stage.startMs + SOURCE_MOTION.staggerMs + SOURCE_MOTION.wipeMs * SOURCE_MOTION.dropoffExtraRatio,
      durationMs: SOURCE_MOTION.dropoffFadeMs, ease: EASING.enter,
    });
    const topWidth = stage.fraction * layout.funnelWidth;
    const bottomWidth = next ? next.fraction * layout.funnelWidth : topWidth;
    const top = stage.index * (layout.bandHeight + layout.gap);
    const revealBottom = top + layout.bandHeight * progress;
    const revealWidth = topWidth + (bottomWidth - topWidth) * progress;
    return {
      ...stage, next, top, topWidth, bottom: top + layout.bandHeight, revealBottom, revealWidth,
      progress, dropoffProgress,
      color: stage.color ?? accent,
      opacity: (layout.tailOpacity + (1 - layout.tailOpacity) * (1 - stage.index / Math.max(1, layout.stageCount - 1))),
    };
  });

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme} data-surface={surface}
      data-stage-count={bands.length}
      data-progress={bands.map(band => Number(band.progress.toFixed(4))).join(",")}
      data-dropoffs={bands.map(band => band.dropoff).join(",")}
      data-colors={bands.map(band => band.color).join(",")}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.cardWidth, height: layout.cardHeight,
      }}
    >
      <Interactive.Svg
        name="漏斗" width={layout.chartWidth} height={layout.chartHeight}
        viewBox={`0 0 ${SOURCE_GEOMETRY.chartWidth} ${SOURCE_GEOMETRY.chartHeight}`}
        style={{display: "block", overflow: "visible"}}
      >
        {bands.map(band => <React.Fragment key={band.id}>
          <path
            data-funnel-band-id={band.id} data-funnel-band-index={band.index}
            data-funnel-band-progress={Number(band.progress.toFixed(4))}
            data-funnel-band-width={Number((band.topWidth / layout.factor).toFixed(2))}
            d={`M ${(layout.centre - band.topWidth / 2) / layout.factor} ${band.top / layout.factor} L ${(layout.centre + band.topWidth / 2) / layout.factor} ${band.top / layout.factor} L ${(layout.centre + band.revealWidth / 2) / layout.factor} ${band.revealBottom / layout.factor} L ${(layout.centre - band.revealWidth / 2) / layout.factor} ${band.revealBottom / layout.factor} Z`}
            fill={band.color} opacity={band.opacity * clamp01(band.progress * 4)}
          />
          <text
            data-funnel-name-id={band.id}
            x={(layout.gutter - layout.labelFont) / layout.factor} y={(band.top + layout.bandHeight * layout.labelNameYRatio) / layout.factor}
            fill={tokens.ink} fontSize={band.nameFontSize / layout.factor} fontWeight={SOURCE_GEOMETRY.labelFontWeight}
            textAnchor="end" dominantBaseline="central"
            opacity={clamp01((band.progress - 0.25) / 0.35)}
          >{band.label}</text>
          <text
            data-funnel-value-id={band.id}
            x={(layout.gutter - layout.labelFont) / layout.factor} y={(band.top + layout.bandHeight * layout.labelValueYRatio) / layout.factor}
            fill={tokens.muted} fontSize={band.valueFontSize / layout.factor} fontWeight={SOURCE_GEOMETRY.labelFontWeight}
            textAnchor="end" dominantBaseline="central"
            opacity={clamp01((band.progress - 0.45) / 0.35)}
            style={{fontVariantNumeric: "tabular-nums"}}
          >{band.valueText}</text>
          {layout.showDropoff && band.next ? <text
            data-funnel-dropoff-id={band.id} data-funnel-dropoff-value={band.dropoff}
            x={(layout.chartWidth - layout.labelFont * 0.5) / layout.factor} y={(band.bottom + layout.gap / 2) / layout.factor}
            fill={dropoffColor} fontSize={(band.dropoffFontSize ?? layout.labelFont) / layout.factor} fontWeight={700}
            textAnchor="end" dominantBaseline="central" opacity={band.dropoffProgress}
            style={{fontVariantNumeric: "tabular-nums"}}
          >{band.dropoffText}</text> : null}
        </React.Fragment>)}

        {layout.showDropoff && layout.dropoffHeader ? <text
          data-funnel-dropoff-header
          x={(layout.chartWidth - layout.labelFont * 0.5) / layout.factor} y={(bands[0].top + layout.bandHeight * layout.dropoffHeaderYRatio) / layout.factor}
          fill={tokens.muted} fontSize={layout.dropoffHeader.fontSize / layout.factor} fontWeight={SOURCE_GEOMETRY.labelFontWeight}
          textAnchor="end" dominantBaseline="central" opacity={clamp01((bands[0].progress - 0.4) / 0.3)}
        >{SOURCE_GEOMETRY.dropoffHeaderZh}</text> : null}
      </Interactive.Svg>
    </div>
  </AbsoluteFill>;
}
