// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」写法：Interactive.* + name、内联 interpolate()、
// 输出范围 / easing / extrapolate 硬编码、不用 CSS 过渡、不拼 transform 字符串。
// 来源：RemotionUI `treemap-blocks`（MIT）；适配差异见 ./layout.js 顶部注释与 definition.json。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateTreemapBlocksLayout,
} from "./layout.js";
import {COMPONENT_ID, PALETTES, SURFACE_TOKENS, assertTreemapBlocksProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export function TreemapBlocks({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertTreemapBlocksProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});

  const layout = useMemo(() => calculateTreemapBlocksLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight) => measureText({
      text, fontFamily: FONT_FAMILY, fontSize, fontWeight,
    }).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const palette = PALETTES[theme];
  const tokens = SURFACE_TOKENS[surface];
  const source = SOURCE_GEOMETRY;

  return <AbsoluteFill name="TreemapBlocks｜矩形树图" style={{backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme}
      data-surface={surface}
      data-scale={Number(layout.factor.toFixed(4))}
      data-block-count={layout.blocks.length}
      data-box-width={Number(layout.boxWidth.toFixed(2))}
      data-box-height={Number(layout.boxHeight.toFixed(2))}
      data-smallest-inner={Number(layout.smallestInner.toFixed(2))}
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.boxWidth,
        height: layout.boxHeight,
      }}
    >
      <Interactive.Svg
        name="矩形树图层"
        width={layout.drawWidth}
        height={layout.drawHeight}
        viewBox={`0 0 ${layout.sourceWidth} ${layout.sourceHeight}`}
        style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}
      >
        {layout.blocks.map((block) => {
          // 来源：按数值降序错峰，最大的块先到位，块从自身中心长出来。
          const start = block.rank * SOURCE_MOTION.staggerFrames;
          const progress = interpolate(
            frame,
            [start, start + SOURCE_MOTION.unitFrames],
            [0, 1],
            {easing: EASING.enter, ...clamp},
          );
          if (progress <= 0) return null;
          const innerWidth = Math.max(0, block.width - source.gap) * progress;
          const innerHeight = Math.max(0, block.height - source.gap) * progress;
          const x = block.x + source.gap / 2 + (Math.max(0, block.width - source.gap) - innerWidth) / 2;
          const y = block.y + source.gap / 2 + (Math.max(0, block.height - source.gap) - innerHeight) / 2;
          const labelOpacity = interpolate(
            frame,
            [start + SOURCE_MOTION.unitFrames * 0.6, start + SOURCE_MOTION.unitFrames],
            [0, 1],
            {...clamp},
          );
          return <Interactive.G key={block.id} name={block.label}>
            <Interactive.Rect
              name="数据块"
              x={x}
              y={y}
              width={innerWidth}
              height={innerHeight}
              rx={Math.min(source.cornerRadius, innerWidth / 2, innerHeight / 2)}
              fill={palette[block.rank % palette.length]}
              opacity={tokens.blockOpacity}
            />
            <Interactive.Text
              name="标签"
              x={x + block.labelFontSize * source.labelInsetFactor}
              y={y + block.labelFontSize * source.labelTopFactor}
              fill={tokens.ink}
              fontSize={block.labelFontSize}
              fontWeight={700}
              dominantBaseline="central"
              opacity={labelOpacity}
            >{block.label}</Interactive.Text>
            <Interactive.Text
              name="数值与占比"
              x={x + block.labelFontSize * source.labelInsetFactor}
              y={y + block.labelFontSize * source.valueTopFactor}
              fill={tokens.ink}
              fontSize={block.labelFontSize * source.valueFontRatio}
              fontWeight={600}
              dominantBaseline="central"
              opacity={labelOpacity * source.valueOpacity}
              style={{fontVariantNumeric: "tabular-nums"}}
            >{block.shareText}</Interactive.Text>
          </Interactive.G>;
        })}
      </Interactive.Svg>
    </div>
  </AbsoluteFill>;
}
