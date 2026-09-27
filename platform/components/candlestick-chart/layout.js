// 版式与测量｜K 线图（CandlestickChart）
//
// 来源几何（RemotionUI `candlestick-chart`，registry/bases/default/primitives/candlestick-chart.tsx，
// MIT · commit 802a637）：
//   width 900 / height 460；upColor #2dd4bf、downColor #f472b6、averageColor #e8b86d、
//   gridColor rgba(250,250,250,0.10)、labelColor rgba(250,250,250,0.55)；
//   labelSize = max(11, 21 × width/960)；plot 内边距 top = labelSize、right = labelSize × 4.2（有最后价标签时）、
//   bottom = labelSize × 2.4、left = labelSize × 3.4；pitch = plotWidth / candles、bodyWidth = max(2, pitch × 0.62)；
//   影线以 open 为锚向 high / low 生长（略早于实体）、实体从 open 长到 close（十字星留 1 px）；
//   均线按收盘价窗口计算（只画窗口完整的那一段）、最后价虚线 + 右侧色块标签；
//   入场 durationInFrames 12 / stagger 3 / exit 20；缓动 EASING.enter。
//
// 本项目适配差异（逐条记录）：
//   1. 来源 900 × 460 像素 = 默认大小（size = 1），size 0.65–3 为整组件等比缩放（下限保证刻度字号 ≥ 12 px）；
//   2. 落位改为安全区 0–1 比例；
//   3. 均线窗口由来源固定 7 改为内容字段 averageWindow（0–9，0 = 不画）；来源只画窗口完整的段，本组件沿用；
//   4. 刻度、K 线标注、最后价标签改为「真实字宽校验，放不下就拒绝并说明」——来源直接画，会互相压住；
//   5. 数值保留最多 2 位小数（不静默取整），并带可选单位后缀；
//   6. 配色：SOURCE = 来源三色（涨 / 跌 / 均线），四套主题按同一角色位取色板。
import {formatAxisValue, formatCompactNumber, getPlotArea, niceDomain, scaleValue} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  chartWidth: 900,
  chartHeight: 460,
  labelUnitBase: 960,
  labelSizeAtBase: 21,
  minLabelSize: 11,
  topFactor: 1,
  rightFactor: 4.2,
  rightFactorNoPrice: 1,
  bottomFactor: 2.4,
  leftGutterFactor: 3.4,
  tickGapFactor: 0.6,
  bodyWidthFactor: 0.62,
  bodyWidthMin: 2,
  bodyRadiusFactor: 0.15,
  bodyRadiusMax: 2,
  dojiHeightFactor: 0.1,
  wickWidthFactor: 0.16,
  averageStrokeFactor: 3,
  averageStrokeMin: 2,
  averageLeadFactor: 0.5,
  lastPriceChipFactor: 3.6,
  lastPriceChipHeightFactor: 1.7,
  lastPriceChipRadiusFactor: 0.4,
  lastPriceGapFactor: 0.3,
  lastPriceStrikeFactor: 1.5,
  lastPriceDash: [5, 5],
  candleLabelOffsetFactor: 1.2,
  candleLabelFontRatio: 0.9,
  domainTickCount: 4,
  bodyOpacity: 1,
  wickOpacity: 0.85,
  averageOpacity: 0.9,
});

export const SOURCE_MOTION = Object.freeze({
  unitFrames: 12,
  staggerFrames: 3,
  exitFrames: 20,
  minDurationSeconds: 3,
  defaultSize: 1,
  sizeRange: {min: 0.65, max: 2},
  defaultAverageWindow: 7,
});

export const CANDLE_RANGE = Object.freeze({min: 5, max: 24});
export const VALUE_LIMIT = 1000000000;
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"IBM Plex Mono", ui-monospace, monospace';

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return null;
}

export function formatValue(value, unit = "") {
  const decimals = decimalsOf(value) ?? 0;
  return `${formatCompactNumber(value, decimals === 0 ? 0 : 2)}${unit}`;
}

export function textWidth(measure, text, fontSize, fontWeight) {
  return measure(text, fontSize, fontWeight, 0);
}

export function sourceLabelSize(chartWidth = SOURCE_GEOMETRY.chartWidth) {
  return Math.max(SOURCE_GEOMETRY.minLabelSize, SOURCE_GEOMETRY.labelSizeAtBase * (chartWidth / SOURCE_GEOMETRY.labelUnitBase));
}

/** 来源的 OHLC 不变量校验：high 是最高价、low 是最低价，缺一条就不是 K 线。 */
export function ohlcViolations(candles) {
  const violations = [];
  candles.forEach((candle, index) => {
    const top = Math.max(candle.open, candle.close);
    const bottom = Math.min(candle.open, candle.close);
    if (candle.high < top - 1e-9) violations.push({id: candle.id, index, kind: "high", message: `第 ${index + 1} 根的 high 低于 open / close`});
    if (candle.low > bottom + 1e-9) violations.push({id: candle.id, index, kind: "low", message: `第 ${index + 1} 根的 low 高于 open / close`});
  });
  return violations;
}

/** 简单移动平均：只返回窗口完整的位置（来源口径）。 */
export function movingAveragePoints({candles, window: windowSize, xOf, yOf}) {
  if (!(windowSize > 1)) return [];
  const points = [];
  for (let index = windowSize - 1; index < candles.length; index += 1) {
    const slice = candles.slice(index - windowSize + 1, index + 1);
    const mean = slice.reduce((sum, candle) => sum + candle.close, 0) / slice.length;
    points.push({index, x: xOf(index), y: yOf(mean), mean});
  }
  return points;
}

export function calculateCandlestickChartLayout({content, width, height, size = 1, position = {x: 0.5, y: 0.5}, measure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const source = SOURCE_GEOMETRY;
  const chartWidth = source.chartWidth;
  const chartHeight = source.chartHeight;
  const boxWidth = chartWidth * factor;
  const boxHeight = chartHeight * factor;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const unit = content.unit ?? "";
  const labelSize = sourceLabelSize(chartWidth);
  const overflow = [];

  const showLastPrice = content.showLastPrice !== false;
  const domain = niceDomain(
    content.candles.flatMap((candle) => [candle.high, candle.low]),
    {includeZero: false, tickCount: source.domainTickCount},
  );
  const plot = getPlotArea(chartWidth, chartHeight, {
    top: labelSize * source.topFactor,
    right: labelSize * (showLastPrice ? source.rightFactor : source.rightFactorNoPrice),
    bottom: labelSize * source.bottomFactor,
    left: labelSize * source.leftGutterFactor,
  });
  const pitch = plot.width / Math.max(1, content.candles.length);
  const bodyWidth = Math.max(source.bodyWidthMin, pitch * source.bodyWidthFactor);
  const y = (value) => plot.bottom - scaleValue(value, domain.min, domain.max) * plot.height;
  const xOf = (index) => plot.left + pitch * (index + 0.5);

  const yGutter = plot.left - labelSize * source.tickGapFactor;
  const yTicks = domain.ticks.map((tick) => {
    const text = formatAxisValue(tick);
    const tickWidth = textWidth(measure, text, labelSize, 600);
    if (tickWidth > yGutter + 0.5) overflow.push({kind: "y 轴刻度", text, available: yGutter, required: tickWidth});
    return {value: tick, text, y: y(tick), width: tickWidth};
  });

  const labelLimit = pitch * 0.98;
  const candles = content.candles.map((candle, index) => {
    const rising = candle.close >= candle.open;
    let labelMetrics = null;
    if (candle.label) {
      const labelWidth = textWidth(measure, candle.label, labelSize * source.candleLabelFontRatio, 600);
      if (labelWidth > labelLimit + 0.5) {
        overflow.push({kind: "K 线标注", text: candle.label, available: labelLimit, required: labelWidth});
      }
      labelMetrics = {width: labelWidth, fontSize: labelSize * source.candleLabelFontRatio};
    }
    return {
      id: candle.id,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      label: candle.label ?? null,
      labelMetrics,
      rising,
      index,
      centre: xOf(index),
      openY: y(candle.open),
      closeY: y(candle.close),
      highY: y(candle.high),
      lowY: y(candle.low),
    };
  });

  const averageWindow = Number.isInteger(content.averageWindow) ? content.averageWindow : SOURCE_MOTION.defaultAverageWindow;
  const average = movingAveragePoints({candles: content.candles, window: averageWindow, xOf, yOf: y});
  const lastCandle = candles.at(-1) ?? null;
  const lastPriceText = lastCandle ? formatValue(lastCandle.close, unit) : "";
  const chipAvailable = labelSize * source.lastPriceChipFactor - labelSize * source.lastPriceChipRadiusFactor;
  const lastPriceWidth = textWidth(measure, lastPriceText, labelSize, 700);
  if (showLastPrice && lastPriceWidth > chipAvailable + 0.5) {
    overflow.push({kind: "最后价标签", text: lastPriceText, available: chipAvailable, required: lastPriceWidth});
  }

  let rejection = null;
  if (overflow.length) {
    rejection = `以下文字在版式里放不下：${overflow
      .map((item) => `${item.kind}「${item.text}」（需要 ${Math.round(item.required)} px，可用 ${Math.round(item.available)} px）`)
      .join("；")}。请缩短标注 / 单位、减少 K 线根数，或调大组件大小。`;
  }
  const fitsSafeArea = boxWidth <= availableWidth + 0.5 && boxHeight <= availableHeight + 0.5;

  return {
    canvasScale,
    factor,
    sourceWidth: chartWidth,
    sourceHeight: chartHeight,
    drawWidth: boxWidth,
    drawHeight: boxHeight,
    boxWidth,
    boxHeight,
    fitsSafeArea,
    availableWidth,
    availableHeight,
    labelSize,
    plot,
    pitch,
    bodyWidth,
    domain,
    yTicks,
    candles,
    average,
    averageWindow,
    showLastPrice,
    lastPriceText,
    lastPriceY: lastCandle ? y(lastCandle.close) : 0,
    lastPriceRising: lastCandle ? lastCandle.rising : true,
    overflow,
    rejection,
    x: safeX + (availableWidth - boxWidth) * position.x,
    y: safeY + (availableHeight - boxHeight) * position.y,
  };
}
