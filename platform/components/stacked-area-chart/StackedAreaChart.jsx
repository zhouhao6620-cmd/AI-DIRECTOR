// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame + 内联 interpolate，
// 结构用 Interactive.* + name，位移与缩放用 translate / scale 属性（不拼 transform 字符串），
// 输出范围、easing、extrapolate 全部硬编码，不用任何 CSS transition / animation。
import React, {useId, useMemo} from "react";
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateStackedAreaChartLayout} from "./layout.js";
import {SURFACE_TOKENS, assertStackedAreaChartProps, paletteOf} from "./model.js";
import {EASING, framesFor} from "../../elements/motion-tokens/motion-tokens.js";

export function StackedAreaChart({content, position, size, surface, theme, wipeMs, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertStackedAreaChartProps({content, position, size, surface, theme, wipeMs, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateStackedAreaChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const palette = paletteOf(theme, surface);
  const wipeFrames = Math.max(1, framesFor(wipeMs / 1000, fps));
  const bandOffsetFrames = Math.max(1, framesFor(SOURCE_MOTION.defaultBandOffsetMs / 1000, fps));
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const easeEditorial = Easing.bezier(...EASING.editorial);

  return <AbsoluteFill name="StackedAreaChart｜堆叠面积图" style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="DRAFT-stacked-area-chart"
      data-theme={theme} data-surface={surface} data-series-count={layout.bands.length}
      data-point-count={layout.pointCount} data-peak={Math.max(...(layout.stacks.at(-1) ?? [0]))}
      data-card-width={Number(layout.blockWidth.toFixed(2))} data-card-height={Number(layout.blockHeight.toFixed(2))}
      data-scale={Number(layout.factor.toFixed(4))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.boxWidth, height: layout.boxHeight,
        scale: layout.factor, transformOrigin: "0 0", display: "flex", flexDirection: "column",
        gap: SOURCE_GEOMETRY.titleGap,
      }}
    >
      {content.title ? <Interactive.Div name="标题" style={{
        height: layout.titleHeight, color: tokens.ink, fontSize: SOURCE_GEOMETRY.titleFontSize,
        fontWeight: SOURCE_GEOMETRY.titleFontWeight, lineHeight: 1.2, whiteSpace: "pre",
        opacity: interpolate(frame, [0, framesFor(0.8, fps)], [0, 1], {
          easing: easeEditorial, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        }),
      }}>{content.title}</Interactive.Div> : null}

      <Interactive.Svg
        name="堆叠面积" width={layout.designWidth} height={layout.designHeight}
        viewBox={`0 0 ${layout.designWidth} ${layout.designHeight}`}
        style={{display: "block", fontFamily: FONT_FAMILY}}
      >
        <Interactive.G name="数值轴">
          {layout.axisTicks.map(tick => <Interactive.G key={tick.value} name={`刻度 ${tick.text}`}>
            <Interactive.Line
              x1={layout.plot.left} y1={tick.y} x2={layout.plot.right} y2={tick.y}
              stroke={tokens.grid} strokeWidth={1}
            />
            <Interactive.Text
              x={layout.plot.left - SOURCE_GEOMETRY.axisLabelGapFactor * layout.labelSize} y={tick.y}
              fill={tokens.label} fontSize={layout.labelSize} fontWeight={600}
              textAnchor="end" dominantBaseline="central" style={{fontVariantNumeric: "tabular-nums"}}
            >{tick.text}</Interactive.Text>
          </Interactive.G>)}
        </Interactive.G>

        {/* 色带自下而上依次擦入：一条横向裁剪从左走到右，不是淡入也不是纵向生长。 */}
        <Interactive.G name="色带">
          {layout.bands.map(band => {
            const start = band.index * bandOffsetFrames;
            const revealed = interpolate(frame, [start, start + wipeFrames], [0, 1], {
              easing: easeEditorial, extrapolateLeft: "clamp", extrapolateRight: "clamp",
            });
            const color = band.color ?? palette[band.index % palette.length];
            const clipId = `sac-${uid}-${band.index}-wipe`;
            if (revealed <= 0) return null;
            return <Interactive.G key={band.id} name={`色带 ${band.label}`} data-band-id={band.id} data-band-revealed={Number(revealed.toFixed(4))}>
              <defs>
                <clipPath id={clipId}>
                  <rect x={layout.plot.left} y={layout.plot.top} width={layout.plot.width * revealed} height={layout.plot.height}/>
                </clipPath>
              </defs>
              <Interactive.Path
                name="色带面积" d={band.areaPath} fill={color} fillOpacity={layout.fillOpacity} clipPath={`url(#${clipId})`}
              />
              {/* 上边缘发丝线：来源在每条色带顶部描一道同色线，色带之间不会糊在一起。 */}
              <Interactive.Path
                name="上边缘" d={band.topPath} fill="none" stroke={color} strokeWidth={layout.bandStroke}
                strokeLinecap="round" clipPath={`url(#${clipId})`}
              />
            </Interactive.G>;
          })}
        </Interactive.G>

        <Interactive.G name="类别标签">
          {layout.categories.map(category => <Interactive.Text
            key={category.label} name={`类别 ${category.label}`} x={category.x}
            y={layout.plot.bottom + layout.labelSize * SOURCE_GEOMETRY.xLabelOffsetFactor}
            fill={tokens.label} fontSize={category.fontSize} fontWeight={600}
            textAnchor={category.anchor} dominantBaseline="central"
          >{category.label}</Interactive.Text>)}
        </Interactive.G>

        <Interactive.G name="图例">
          {layout.legend.map((item, index) => <Interactive.G
            key={item.id} name={`图例 ${item.label}`}
            opacity={interpolate(frame, [index * bandOffsetFrames, index * bandOffsetFrames + 12], [0, 1], {
              easing: easeEditorial, extrapolateLeft: "clamp", extrapolateRight: "clamp",
            })}
          >
            <Interactive.Rect
              name="色块" x={item.x} y={layout.labelSize * SOURCE_GEOMETRY.legendRectOffsetFactor}
              width={item.swatch} height={item.swatch} rx={3}
              fill={palette[index % palette.length]}
            />
            <Interactive.Text
              name="系列名" x={item.x + item.textGap + item.swatch / 2} y={layout.labelSize}
              fill={tokens.label} fontSize={item.fontSize} fontWeight={600} dominantBaseline="central"
            >{item.label}</Interactive.Text>
          </Interactive.G>)}
        </Interactive.G>
      </Interactive.Svg>

      {content.caption ? <Interactive.Div name="小注" style={{
        height: layout.captionHeight, color: tokens.label, fontSize: SOURCE_GEOMETRY.captionFontSize,
        whiteSpace: "pre", textAlign: "right",
      }}>{content.caption}</Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
