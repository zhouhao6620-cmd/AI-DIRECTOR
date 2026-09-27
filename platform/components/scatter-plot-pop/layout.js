// 版式与测量｜散点图弹出（ScatterPlotPop）
//
// 来源几何（RemotionUI `scatter-plot-pop`，registry/bases/default/primitives/scatter-plot-pop.tsx，
// MIT · commit 802a637）：
//   width 860 / height 480；labelSize = max(12, 22 × width/960)；minRadius 7 / maxRadius 20（按 weight 插值）；
//   plot 内边距 top = maxRadius + 8、right = 同、bottom = labelSize ×（有 xLabel 时 3.4，否则 2.2）、left = labelSize × 3.4；
//   x / y 轴都用 niceDomain(includeZero: false, tickCount: 4)；点半径外还有一圈 2.2× 半径、0.14 不透明度的光晕；
//   入场 durationInFrames 16 / stagger 2.5 帧（按 x 升序）/ exit 20；趋势线在最后一点落定后 26 帧内画出；
//   缓动 EASING.pop（点）与 EASING.enter（趋势线）。
//
// 本项目适配差异（逐条记录）：
//   1. 来源 860 × 480 像素 = 默认大小（size = 1），size 0.65–3 为整组件等比缩放；
//   2. 落位改为安全区 0–1 比例；
//   3. 刻度与轴标题改为「先量真实字宽，放不下就拒绝并说明」——来源直接画，会互相压住；
//   4. 底色：来源是深底浅字（grid / label 用白色低透明度）；本组件保留 DARK 默
//      并增加 LIGHT（深字浅底）一套，网格与刻度色随之切换；
//   5. 配色：SOURCE = 来源的 #e8b86d 单色，四套项目主题取各自色板的第 1 位。
import {formatAxisValue, getPlotArea, niceDomain, scaleValue} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  chartWidth: 860,
  chartHeight: 480,
  minRadius: 7,
  maxRadius: 20,
  labelUnitBase: 960,
  labelSizeAtBase: 22,
  minLabelSize: 12,
  radiusInset: 8,
  axisBottomFactor: 2.2,
  axisTitleBottomFactor: 3.4,
  leftGutterFactor: 3.4,
  tickGapFactor: 0.6,
  xTickOffsetFactor: 1.2,
  xTitleBottomFactor: 0.4,
  glowFactor: 2.2,
  glowOpacity: 0.14,
  dotOpacity: 0.9,
  trendStrokeFactor: 4,
  trendStrokeMin: 2,
  trendDash: [12, 10],
  trendDelayFactor: 0.4,
  trendDrawFrames: 26,
  domainTickCount: 4,
});

export const SOURCE_MOTION = Object.freeze({
  unitFrames: 16,
  staggerFrames: 2.5,
  exitFrames: 20,
  minDurationSeconds: 3,
  defaultSize: 1,
  sizeRange: {min: 0.65, max: 2},
});

export const POINT_RANGE = Object.freeze({min: 3, max: 12});
export const VALUE_LIMIT = 1000000000;
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"IBM Plex Mono", ui-monospace, monospace';

export const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return null;
}

export function textWidth(measure, text, fontSize, fontWeight) {
  return measure(text, fontSize, fontWeight, 0);
}

/** 来源的刻度字号：max(12, 22 × width/960)，在本项目里固定按来源默认宽度计算。 */
export function sourceLabelSize(chartWidth = SOURCE_GEOMETRY.chartWidth) {
  return Math.max(SOURCE_GEOMETRY.minLabelSize, SOURCE_GEOMETRY.labelSizeAtBase * (chartWidth / SOURCE_GEOMETRY.labelUnitBase));
}

/** 来源的最小二乘趋势线：在原始数值域上拟合，再投影到屏幕坐标。 */
export function trendLine({points, xDomain, project}) {
  const count = points.length || 1;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / count;
  const covariance = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const variance = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const slope = variance === 0 ? 0 : covariance / variance;
  return {
    slope,
    start: project({x: xDomain.min, y: meanY + slope * (xDomain.min - meanX)}),
    end: project({x: xDomain.max, y: meanY + slope * (xDomain.max - meanX)}),
  };
}

export function calculateScatterPlotLayout({content, width, height, size = 1, position = {x: 0.5, y: 0.5}, measure}) {
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
  const labelSize = sourceLabelSize(chartWidth);
  const overflow = [];

  const xDomain = niceDomain(content.points.map((point) => point.x), {includeZero: false, tickCount: source.domainTickCount});
  const yDomain = niceDomain(content.points.map((point) => point.y), {includeZero: false, tickCount: source.domainTickCount});
  const plot = getPlotArea(chartWidth, chartHeight, {
    top: source.maxRadius + source.radiusInset,
    right: source.maxRadius + source.radiusInset,
    bottom: labelSize * (content.xLabel ? source.axisTitleBottomFactor : source.axisBottomFactor),
    left: labelSize * source.leftGutterFactor,
  });
  const project = (point) => ({
    x: plot.left + scaleValue(point.x, xDomain.min, xDomain.max) * plot.width,
    y: plot.bottom - scaleValue(point.y, yDomain.min, yDomain.max) * plot.height,
  });

  // 刻度左对齐到 plot.left − 0.6 × labelSize，可用宽度就是左侧留白减去这一小段。
  const yGutter = plot.left - labelSize * source.tickGapFactor;
  const yTicks = yDomain.ticks.map((tick) => {
    const text = formatAxisValue(tick);
    const tickWidth = textWidth(measure, text, labelSize, 600);
    if (tickWidth > yGutter + 0.5) overflow.push({kind: "y 轴刻度", text, available: yGutter, required: tickWidth});
    return {value: tick, text, y: plot.bottom - scaleValue(tick, yDomain.min, yDomain.max) * plot.height, width: tickWidth};
  });

  const xTicks = xDomain.ticks.map((tick) => {
    const text = formatAxisValue(tick);
    const tickWidth = textWidth(measure, text, labelSize, 600);
    return {value: tick, text, x: plot.left + scaleValue(tick, xDomain.min, xDomain.max) * plot.width, width: tickWidth};
  });
  for (let index = 0; index < xTicks.length - 1; index += 1) {
    const gap = xTicks[index + 1].x - xTicks[index].x;
    const need = (xTicks[index].width + xTicks[index + 1].width) / 2 + labelSize * 0.3;
    if (need > gap + 0.5) {
      overflow.push({kind: "x 轴刻度", text: `${xTicks[index].text} / ${xTicks[index + 1].text}`, available: gap, required: need});
    }
  }

  const axisTitle = (text, available, kind) => {
    if (!text) return null;
    const titleWidth = textWidth(measure, text, labelSize, 600);
    if (titleWidth > available + 0.5) overflow.push({kind, text, available, required: titleWidth});
    return {text, fontSize: labelSize, width: titleWidth};
  };
  const xLabel = axisTitle(content.xLabel, plot.width, "x 轴标题");
  const yLabel = axisTitle(content.yLabel, plot.height, "y 轴标题");

  const weights = content.points.map((point) => point.weight ?? 1);
  const maxWeight = Math.max(...weights, 1);
  const points = content.points.map((point) => ({
    id: point.id,
    x: project(point).x,
    y: project(point).y,
    radius: source.minRadius + ((point.weight ?? 1) / maxWeight) * (source.maxRadius - source.minRadius),
    xValue: point.x,
    yValue: point.y,
  }));

  let rejection = null;
  if (overflow.length) {
    rejection = `以下刻度或轴标题在版式里放不下：${overflow
      .map((item) => `${item.text}（需要 ${Math.round(item.required)} px，可用 ${Math.round(item.available)} px）`)
      .join("；")}。请缩短轴标题、减少数量级跨度或调大组件大小。`;
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
    xDomain,
    yDomain,
    xTicks,
    yTicks,
    xLabel,
    yLabel,
    points,
    trend: trendLine({points: content.points, xDomain, project}),
    overflow,
    rejection,
    x: safeX + (availableWidth - boxWidth) * position.x,
    y: safeY + (availableHeight - boxHeight) * position.y,
  };
}
