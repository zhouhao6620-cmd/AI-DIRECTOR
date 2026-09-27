// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」写法：Interactive.* + name、内联 interpolate()、
// 输出范围 / easing / extrapolate 硬编码、不用 CSS 过渡、不拼 transform 字符串。
// 来源：RemotionUI `candlestick-chart`（MIT）；适配差异见 ./layout.js 顶部注释与 definition.json。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateCandlestickChartLayout,
} from "./layout.js";
import {
  AVERAGE_OPACITY, COMPONENT_ID, LAST_PRICE_INK, PALETTES, ROLE_INDEX, SURFACE_TOKENS, WICK_OPACITY,
  assertCandlestickChartProps, candleColor,
} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export function CandlestickChart({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertCandlestickChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});

  const layout = useMemo(() => calculateCandlestickChartLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight) => measureText({
      text, fontFamily: FONT_FAMILY, fontSize, fontWeight,
    }).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const labelSize = layout.labelSize;
  const averageColor = PALETTES[theme][ROLE_INDEX.average];
  const unit = layout.sourceWidth / SOURCE_GEOMETRY.labelUnitBase;
  // 来源：影线比实体早 0.35 个生长时长出发（极值先于收盘被知道）。
  const wickLead = SOURCE_MOTION.unitFrames * 0.35;
  const growth = (index, lead = 0) => interpolate(
    frame,
    [
      index * SOURCE_MOTION.staggerFrames - lead,
      index * SOURCE_MOTION.staggerFrames + SOURCE_MOTION.unitFrames - lead,
    ],
    [0, 1],
    {easing: EASING.enter, ...clamp},
  );
  const lastVisible = growth(layout.candles.length - 1);

  return <AbsoluteFill name="CandlestickChart｜K 线图" style={{backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme}
      data-surface={surface}
      data-scale={Number(layout.factor.toFixed(4))}
      data-candle-count={layout.candles.length}
      data-average-window={layout.averageWindow}
      data-average-points={layout.average.length}
      data-box-width={Number(layout.boxWidth.toFixed(2))}
      data-box-height={Number(layout.boxHeight.toFixed(2))}
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.boxWidth,
        height: layout.boxHeight,
      }}
    >
      <Interactive.Svg
        name="K 线图层"
        width={layout.drawWidth}
        height={layout.drawHeight}
        viewBox={`0 0 ${layout.sourceWidth} ${layout.sourceHeight}`}
        style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}
      >
        {layout.yTicks.map((tick) => <Interactive.G key={`tick-${tick.value}`} name={`价格 ${tick.text}`}>
          <Interactive.Line
            name="价格线"
            x1={layout.plot.left}
            y1={tick.y}
            x2={layout.plot.right}
            y2={tick.y}
            stroke={tokens.grid}
            strokeWidth={1}
          />
          <Interactive.Text
            name="刻度值"
            x={layout.plot.left - labelSize * SOURCE_GEOMETRY.tickGapFactor}
            y={tick.y}
            fill={tokens.label}
            fontSize={labelSize}
            fontWeight={600}
            textAnchor="end"
            dominantBaseline="central"
            style={{fontVariantNumeric: "tabular-nums"}}
          >{tick.text}</Interactive.Text>
        </Interactive.G>)}

        {layout.candles.map((candle) => {
          const body = growth(candle.index);
          const wick = growth(candle.index, wickLead);
          if (body <= 0) return null;
          const closeY = candle.openY + (candle.closeY - candle.openY) * body;
          const highY = candle.openY + (candle.highY - candle.openY) * wick;
          const lowY = candle.openY + (candle.lowY - candle.openY) * wick;
          const colour = candleColor(theme, candle);
          return <Interactive.G key={candle.id} name={candle.label ?? `第 ${candle.index + 1} 根`}>
            <Interactive.Line
              name="影线"
              x1={candle.centre}
              y1={highY}
              x2={candle.centre}
              y2={lowY}
              stroke={colour}
              strokeWidth={Math.max(1, layout.bodyWidth * SOURCE_GEOMETRY.wickWidthFactor)}
              opacity={WICK_OPACITY}
            />
            <Interactive.Rect
              name="实体"
              x={candle.centre - layout.bodyWidth / 2}
              y={Math.min(candle.openY, closeY)}
              width={layout.bodyWidth}
              // 十字星（开收同价）也要看得见：至少 0.1 × 体宽。
              height={Math.max(
                Math.max(1, layout.bodyWidth * SOURCE_GEOMETRY.dojiHeightFactor),
                Math.abs(closeY - candle.openY),
              )}
              rx={Math.min(SOURCE_GEOMETRY.bodyRadiusMax, layout.bodyWidth * SOURCE_GEOMETRY.bodyRadiusFactor)}
              fill={colour}
            />
            {candle.labelMetrics ? <Interactive.Text
              name="K 线标注"
              x={candle.centre}
              y={layout.plot.bottom + labelSize * SOURCE_GEOMETRY.candleLabelOffsetFactor}
              fill={tokens.label}
              fontSize={candle.labelMetrics.fontSize}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={Math.min(1, body * 1.4)}
            >{candle.label}</Interactive.Text> : null}
          </Interactive.G>;
        })}

        {layout.average.length > 1 ? layout.average.slice(1).map((point, segment) => {
          const previous = layout.average[segment];
          // 来源：均线比自己那根 K 线略早一点长出来，读起来像跟着画面在算。
          const reach = growth(point.index, -SOURCE_MOTION.unitFrames * SOURCE_GEOMETRY.averageLeadFactor);
          if (reach <= 0) return null;
          return <Interactive.Line
            key={`average-${point.index}`}
            name={`均线 ${point.index + 1}`}
            x1={previous.x}
            y1={previous.y}
            x2={previous.x + (point.x - previous.x) * reach}
            y2={previous.y + (point.y - previous.y) * reach}
            stroke={averageColor}
            strokeWidth={Math.max(SOURCE_GEOMETRY.averageStrokeMin, SOURCE_GEOMETRY.averageStrokeFactor * unit)}
            strokeLinecap="round"
            opacity={AVERAGE_OPACITY}
          />;
        }) : null}

        {layout.showLastPrice ? <Interactive.G name="最后价" opacity={lastVisible}>
          <Interactive.Line
            name="最后价虚线"
            x1={layout.plot.left}
            y1={layout.lastPriceY}
            x2={layout.plot.right}
            y2={layout.lastPriceY}
            stroke={layout.lastPriceRising ? PALETTES[theme][ROLE_INDEX.up] : PALETTES[theme][ROLE_INDEX.down]}
            strokeWidth={SOURCE_GEOMETRY.lastPriceStrikeFactor}
            strokeDasharray={`${SOURCE_GEOMETRY.lastPriceDash[0] * unit} ${SOURCE_GEOMETRY.lastPriceDash[1] * unit}`}
            opacity={0.6}
          />
          <Interactive.Rect
            name="最后价色块"
            x={layout.plot.right + labelSize * SOURCE_GEOMETRY.lastPriceGapFactor}
            y={layout.lastPriceY - labelSize * (SOURCE_GEOMETRY.lastPriceChipHeightFactor / 2)}
            width={labelSize * SOURCE_GEOMETRY.lastPriceChipFactor}
            height={labelSize * SOURCE_GEOMETRY.lastPriceChipHeightFactor}
            rx={labelSize * SOURCE_GEOMETRY.lastPriceChipRadiusFactor}
            fill={layout.lastPriceRising ? PALETTES[theme][ROLE_INDEX.up] : PALETTES[theme][ROLE_INDEX.down]}
          />
          <Interactive.Text
            name="最后价数值"
            x={layout.plot.right + labelSize * (SOURCE_GEOMETRY.lastPriceGapFactor + SOURCE_GEOMETRY.lastPriceChipFactor / 2)}
            y={layout.lastPriceY}
            fill={LAST_PRICE_INK}
            fontSize={labelSize}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            style={{fontVariantNumeric: "tabular-nums"}}
          >{layout.lastPriceText}</Interactive.Text>
        </Interactive.G> : null}
      </Interactive.Svg>
    </div>
  </AbsoluteFill>;
}
