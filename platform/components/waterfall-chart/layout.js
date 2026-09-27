// 版式与测量｜瀑布图（WaterfallChart）
//
// 来源几何（RemotionUI `waterfall-chart`，registry/bases/default/primitives/waterfall-chart.tsx，
// MIT · commit 802a637）：
//   width 860 / height 440；upColor #2dd4bf、downColor #f472b6、totalColor #e8b86d、
//   gridColor rgba(250,250,250,0.10)、labelColor rgba(250,250,250,0.55)、inkColor #fafafa；
//   labelSize = max(11, 21 × width/960)；浮空柱从「上一步的结果」长到自己落定的水位（isTotal 的柱从 0 起）；
//   plot 内边距 top = labelSize × 2、right = labelSize、bottom = labelSize × 3、left = labelSize × 3.6；
//   pitch = plotWidth / steps、barWidth = pitch × 0.62；虚线连接线接上一步落定水位；
//   数值在柱顶（下降柱在柱底）上方 0.7 × labelSize；步骤名在 plot 下方 1.3 × labelSize；
//   入场 durationInFrames 20 / stagger 10 / exit 20（退场 = 淡出 + 上移 12 px，几何不变）；缓动 EASING.enter。
//
// 本项目适配差异（逐条记录）：
//   1. 来源 860 × 440 像素 = 默认大小（size = 1），size 0.65–3 为整组件等比缩放（下限保证刻度字号 ≥ 12 px）；
//   2. 落位改为安全区 0–1 比例；
//   3. y 轴刻度、柱顶数值、步骤名改为「真实字宽校验，放不下就拒绝并说明」——来源直接画，会互相压住；
//   4. 数值保留最多 2 位小数（不静默取整），并带可选单位后缀；
//   5. 配色：SOURCE = 来源三色（上行 / 下行 / 合计），四套主题按同一角色位取色板。
import {formatAxisValue, formatCompactNumber, getPlotArea, niceDomain, scaleValue} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  chartWidth: 860,
  chartHeight: 440,
  labelUnitBase: 960,
  labelSizeAtBase: 21,
  minLabelSize: 11,
  topFactor: 2,
  rightFactor: 1,
  bottomFactor: 3,
  leftGutterFactor: 3.6,
  tickGapFactor: 0.6,
  barWidthFactor: 0.62,
  barRadiusFactor: 0.1,
  barRadiusMax: 6,
  connectorDash: [6, 5],
  exitLift: 12,
  valueGapFactor: 0.7,
  stepLabelOffsetFactor: 1.3,
  domainTickCount: 4,
  barOpacity: 0.94,
});

export const SOURCE_MOTION = Object.freeze({
  unitFrames: 20,
  staggerFrames: 10,
  exitFrames: 20,
  minDurationSeconds: 3,
  defaultSize: 1,
  sizeRange: {min: 0.65, max: 2},
});

export const STEP_RANGE = Object.freeze({min: 3, max: 7});
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

/** 来源的带符号写法：`+48` / `−18`（负号用减号 U+2212，与来源一致）。 */
export function formatStepValue(step, unit = "") {
  if (step.isTotal) return formatValue(step.value, unit);
  return `${step.value >= 0 ? "+" : "−"}${formatValue(Math.abs(step.value), unit)}`;
}

export function textWidth(measure, text, fontSize, fontWeight) {
  return measure(text, fontSize, fontWeight, 0);
}

export function sourceLabelSize(chartWidth = SOURCE_GEOMETRY.chartWidth) {
  return Math.max(SOURCE_GEOMETRY.minLabelSize, SOURCE_GEOMETRY.labelSizeAtBase * (chartWidth / SOURCE_GEOMETRY.labelUnitBase));
}

/**
 * 来源的累计水位解析：普通步从上一步结果出发，isTotal 的步从 0 起并把累计重置成自己的值。
 * 每一步同时拿到起点水位 from 与落点水位 to —— 位置和长度一样是信息。
 */
export function resolveSteps(steps) {
  let running = 0;
  return steps.map((step) => {
    const from = step.isTotal ? 0 : running;
    const to = step.isTotal ? step.value : running + step.value;
    running = to;
    return {...step, from, to};
  });
}

export function calculateWaterfallChartLayout({content, width, height, size = 1, position = {x: 0.5, y: 0.5}, measure}) {
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

  const resolved = resolveSteps(content.steps);
  const levels = resolved.flatMap((step) => [step.from, step.to]);
  const domain = niceDomain(levels, {includeZero: true, tickCount: source.domainTickCount});
  const plot = getPlotArea(chartWidth, chartHeight, {
    top: labelSize * source.topFactor,
    right: labelSize * source.rightFactor,
    bottom: labelSize * source.bottomFactor,
    left: labelSize * source.leftGutterFactor,
  });
  const pitch = plot.width / Math.max(1, resolved.length);
  const barWidth = pitch * source.barWidthFactor;
  const y = (value) => plot.bottom - scaleValue(value, domain.min, domain.max) * plot.height;

  const yGutter = plot.left - labelSize * source.tickGapFactor;
  const yTicks = domain.ticks.map((tick) => {
    const text = formatAxisValue(tick);
    const tickWidth = textWidth(measure, text, labelSize, 600);
    if (tickWidth > yGutter + 0.5) overflow.push({kind: "y 轴刻度", text, available: yGutter, required: tickWidth});
    return {value: tick, text, y: y(tick), width: tickWidth};
  });

  const steps = resolved.map((step, index) => {
    const centre = plot.left + pitch * (index + 0.5);
    const valueText = formatStepValue(step, unit);
    const labelWidth = textWidth(measure, step.label, labelSize, 600);
    const valueWidth = textWidth(measure, valueText, labelSize, 700);
    const limit = pitch - labelSize * 0.2;
    if (labelWidth > limit + 0.5) {
      overflow.push({kind: "步骤名", text: step.label, available: limit, required: labelWidth});
    }
    if (valueWidth > limit + 0.5) {
      overflow.push({kind: "柱顶数值", text: valueText, available: limit, required: valueWidth});
    }
    return {
      id: step.id,
      label: step.label,
      value: step.value,
      isTotal: step.isTotal === true,
      valueText,
      from: step.from,
      to: step.to,
      centre,
      base: y(step.from),
      tip: y(step.to),
      rising: step.to >= step.from,
      labelWidth,
      valueWidth,
    };
  });

  let rejection = null;
  if (overflow.length) {
    rejection = `以下文字在版式里放不下：${overflow
      .map((item) => `${item.kind}「${item.text}」（需要 ${Math.round(item.required)} px，可用 ${Math.round(item.available)} px）`)
      .join("；")}。请缩短步骤名或数值、减少步数，或调大组件大小。`;
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
    barWidth,
    domain,
    yTicks,
    steps,
    overflow,
    rejection,
    finalLevel: resolved.length ? resolved.at(-1).to : 0,
    x: safeX + (availableWidth - boxWidth) * position.x,
    y: safeY + (availableHeight - boxHeight) * position.y,
  };
}
