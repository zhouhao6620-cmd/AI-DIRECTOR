// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame / Easing 曲线 +
// 归一化进度，样式内联、不写 CSS 过渡；文字块用 Interactive.* + name 保证 Studio 可点选。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, MONO_FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION,
  arcPath, calculateGaugeDialLayout, formatNumber, polar, progressAt,
} from "./layout.js";
import {ACCENTS, COMPONENT_ID, SURFACE_TOKENS, assertGaugeDialProps} from "./model.js";

export function GaugeDial({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertGaugeDialProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateGaugeDialLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  // 来源：弧用入场曲线、指针用过冲曲线——指针稳住之后回坐，弧不回退（来源的设计意图）。
  const arcProgress = progressAt({frame, fps, durationMs: SOURCE_MOTION.sweepMs, ease: EASING.enter});
  const needleProgress = progressAt({frame, fps, durationMs: SOURCE_MOTION.sweepMs, ease: EASING.pop});
  const arcFraction = layout.target * arcProgress;
  const needleFraction = layout.target * needleProgress;
  const needleAngle = layout.startAngle + needleFraction * layout.sweepDegrees;
  const needleTip = polar(SOURCE_GEOMETRY.dialSize / 2, SOURCE_GEOMETRY.dialSize / 2, layout.needleTip, needleAngle);
  const needleTail = polar(SOURCE_GEOMETRY.dialSize / 2, SOURCE_GEOMETRY.dialSize / 2, layout.needleTail, needleAngle + 180);
  const readout = formatNumber(layout.min + (layout.max - layout.min) * arcFraction, layout.decimals);

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme} data-surface={surface}
      data-gauge-target={Number(layout.target.toFixed(6))}
      data-gauge-arc={Number(arcFraction.toFixed(6))}
      data-gauge-needle={Number(needleFraction.toFixed(6))}
      data-gauge-readout={Number((layout.min + (layout.max - layout.min) * arcFraction).toFixed(6))}
      data-gauge-ticks={layout.tickCount}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.cardWidth, height: layout.cardHeight,
      }}
    >
      <Interactive.Svg
        name="仪表盘" width={layout.dialSize} height={layout.dialSize}
        viewBox={`0 0 ${SOURCE_GEOMETRY.dialSize} ${SOURCE_GEOMETRY.dialSize}`}
        style={{display: "block", overflow: "visible"}}
      >
        <path
          data-gauge-track
          d={arcPath(SOURCE_GEOMETRY.dialSize / 2, SOURCE_GEOMETRY.dialSize / 2, layout.radius, layout.startAngle, layout.endAngle)}
          fill="none" stroke={tokens.track} strokeWidth={layout.thickness} strokeLinecap="round"
        />
        <path
          data-gauge-arc
          d={arcPath(SOURCE_GEOMETRY.dialSize / 2, SOURCE_GEOMETRY.dialSize / 2, layout.radius, layout.startAngle, layout.startAngle + arcFraction * layout.sweepDegrees)}
          fill="none" stroke={accent} strokeWidth={layout.thickness} strokeLinecap="round"
        />

        {layout.tickCount > 0 ? Array.from({length: layout.tickCount}, (_, index) => {
          const fraction = index / (layout.tickCount - 1);
          const angle = layout.startAngle + fraction * layout.sweepDegrees;
          const outer = polar(SOURCE_GEOMETRY.dialSize / 2, SOURCE_GEOMETRY.dialSize / 2, layout.tickOuter, angle);
          const inner = polar(SOURCE_GEOMETRY.dialSize / 2, SOURCE_GEOMETRY.dialSize / 2, layout.tickInner, angle);
          // 指针已经越过的刻度更亮，所以弧被指针遮住的地方仍然读得出当前值（来源口径）。
          const passed = fraction <= needleFraction;
          return <line
            key={angle} data-gauge-tick-index={index} data-gauge-tick-passed={passed}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke={passed ? tokens.ink : tokens.muted} strokeWidth={layout.tickWidth}
            strokeLinecap="round" opacity={passed ? SOURCE_GEOMETRY.tickPassedOpacity : SOURCE_GEOMETRY.tickIdleOpacity}
          />;
        }) : null}

        <line
          data-gauge-needle
          x1={needleTail.x} y1={needleTail.y} x2={needleTip.x} y2={needleTip.y}
          stroke={tokens.ink} strokeWidth={layout.needleWidth} strokeLinecap="round"
        />
        <circle data-gauge-hub cx={SOURCE_GEOMETRY.dialSize / 2} cy={SOURCE_GEOMETRY.dialSize / 2} r={layout.hubOuter} fill={tokens.ink}/>
        <circle data-gauge-hub-inner cx={SOURCE_GEOMETRY.dialSize / 2} cy={SOURCE_GEOMETRY.dialSize / 2} r={layout.hubInner} fill={accent}/>
      </Interactive.Svg>

      <div style={{position: "absolute", left: 0, right: 0, top: layout.readoutTop, textAlign: "center"}}>
        <Interactive.Div name="读数" style={{maxWidth: layout.readoutBox, margin: "0 auto"}}>
          <div data-gauge-value style={{
            fontFamily: MONO_FONT_FAMILY, fontSize: layout.readout.fontSize, fontWeight: SOURCE_GEOMETRY.readoutFontWeight,
            lineHeight: 1, color: tokens.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "pre",
          }}>{readout}{content.unit ?? ""}</div>
          {layout.label ? <div data-gauge-label style={{
            fontSize: layout.label.fontSize, fontWeight: SOURCE_GEOMETRY.labelFontWeight,
            letterSpacing: layout.label.letterSpacing, color: tokens.muted,
            marginTop: layout.labelMarginTop, whiteSpace: "pre",
          }}>{content.label}</div> : null}
        </Interactive.Div>
      </div>
    </div>
  </AbsoluteFill>;
}
