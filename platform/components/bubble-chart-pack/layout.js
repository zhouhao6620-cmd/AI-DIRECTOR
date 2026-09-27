// 版式与测量｜气泡图（BubbleChartPack）
//
// 来源几何（RemotionUI `bubble-chart-pack`，registry/bases/default/primitives/bubble-chart-pack.tsx，
// MIT · commit 802a637，原件取用见 provenance）：
//   width 860 / height 520；半径 = sqrt(value / maxValue) × 100（面积与数值成正比）；
//   贪心螺旋装填（半径降序 + 黄金角 2.399 + 0.35 步进）+ 60 轮向心压缩；padding 6；
//   scale = min(W / spanX, H / spanY) × 0.96；标签 fontSize = radius × 0.3、数值 = 标签 × 0.82；
//   入场 durationInFrames 26 / stagger 7（按半径降序排名）/ exit 20；缓动 EASING.pop。
//
// 本项目适配差异（逐条记录）：
//   1. 画布按画幅等比缩放：来源 860 × 520 像素 = 默认大小（size = 1），size 0.5–3 为整组件等比缩放；
//   2. 落位由来源的固定居中改为安全区 0–1 比例（水平 x + 垂直 y）；
//   3. 标签与数值「先按半径取字号，再用真实字宽量到能放进圆内；下限仍放不下就拒绝并说明原因」——
//      来源对放不下的标签/数值是直接不画（会静默丢内容）；
//   4. 数值保留最多 2 位小数后按来源的紧凑写法显示（`formatCompactNumber`），不静默取整；
//   5. 配色：SOURCE = 来源 5 色板，BLUE / ORANGE / RED / PURPLE 为项目四套主题色板。
import {formatCompactNumber, getChartDomain} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  chartWidth: 860,
  chartHeight: 520,
  radiusUnit: 100,
  padding: 6,
  fillOpacity: 0.92,
  inkColor: "#0b0b10",
  labelRatio: 0.3,
  labelMaxFontSize: 34,
  valueRatio: 0.82,
  labelOffsetY: -0.5,
  valueOffsetY: 0.75,
  // 半径 r 的圆在标签行上能安全容纳的弦长比例：2r × 0.86 ≈ 圆内 1.7r 宽
  chordRatio: 0.86,
  spiralStepRatio: 0.12,
  spiralAngleStep: 0.35,
  spiralGrowRatio: 0.06,
  spiralMaxDistance: 40000,
  goldenAngle: 2.399,
  compactionPasses: 60,
  compactionStepRatio: 0.08,
  centerFitFactor: 0.96,
});

export const SOURCE_MOTION = Object.freeze({
  unitFrames: 26,
  staggerFrames: 7,
  exitFrames: 20,
  minDurationSeconds: 3,
  defaultSize: 1,
  sizeRange: {min: 0.5, max: 2},
});

export const BUBBLE_RANGE = Object.freeze({min: 2, max: 7});
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

/** 最少可读字号（渲染后 12 px）换算到来源单位：来源单位 × factor = 渲染像素。 */
export function minLegendFontSize(size) {
  return MIN_TEXT_FONT_SIZE / size;
}

export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return null;
}

/** 数值文本：来源的紧凑写法 + 本项目的 2 位小数上限（不静默取整）。 */
export function formatValue(value, unit = "") {
  const decimals = decimalsOf(value) ?? 0;
  return `${formatCompactNumber(value, decimals === 0 ? 0 : 2)}${unit}`;
}

export function textWidth(measure, text, fontSize, fontWeight) {
  return measure(text, fontSize, fontWeight, 0);
}

/** 来源 `packCircles`：半径降序的贪心螺旋装填 + 向心压缩。 */
export function packCircles(radii, padding) {
  const order = radii.map((radius, index) => ({radius, index})).sort((a, b) => b.radius - a.radius);
  const placed = [];

  for (const entry of order) {
    if (placed.length === 0) {
      placed.push({x: 0, y: 0, radius: entry.radius, index: entry.index});
      continue;
    }

    const step = Math.max(1, entry.radius * SOURCE_GEOMETRY.spiralStepRatio);
    let angle = entry.index * SOURCE_GEOMETRY.goldenAngle;
    let distance = step;
    let found = false;

    while (!found && distance < SOURCE_GEOMETRY.spiralMaxDistance) {
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const collides = placed.some((circle) => {
        const gap = Math.hypot(circle.x - x, circle.y - y);
        return gap < circle.radius + entry.radius + padding;
      });

      if (collides) {
        angle += SOURCE_GEOMETRY.spiralAngleStep;
        distance += step * SOURCE_GEOMETRY.spiralGrowRatio;
      } else {
        placed.push({x, y, radius: entry.radius, index: entry.index});
        found = true;
      }
    }
  }

  for (let pass = 0; pass < SOURCE_GEOMETRY.compactionPasses; pass += 1) {
    for (const circle of placed) {
      const distance = Math.hypot(circle.x, circle.y);
      if (distance < 0.001) continue;

      const step = Math.min(distance, circle.radius * SOURCE_GEOMETRY.compactionStepRatio);
      const x = circle.x - (circle.x / distance) * step;
      const y = circle.y - (circle.y / distance) * step;
      const blocked = placed.some((other) => {
        if (other === circle) return false;
        return Math.hypot(other.x - x, other.y - y) < other.radius + circle.radius + padding;
      });

      if (!blocked) {
        circle.x = x;
        circle.y = y;
      }
    }
  }

  return placed;
}

/** 装填结果 → 画布坐标：整簇缩放到来源画布，返回每颗气泡的静止位置与半径。 */
export function packCluster(bubbles, {
  width = SOURCE_GEOMETRY.chartWidth,
  height = SOURCE_GEOMETRY.chartHeight,
  padding = SOURCE_GEOMETRY.padding,
} = {}) {
  const values = bubbles.map((bubble) => bubble.value);
  const maxValue = Math.max(...values, 0) || 1;
  const radii = values.map((value) => Math.sqrt(value / maxValue) * SOURCE_GEOMETRY.radiusUnit);
  const circles = packCircles(radii, padding);

  const extent = circles.reduce((bounds, circle) => ({
    minX: Math.min(bounds.minX, circle.x - circle.radius),
    maxX: Math.max(bounds.maxX, circle.x + circle.radius),
    minY: Math.min(bounds.minY, circle.y - circle.radius),
    maxY: Math.max(bounds.maxY, circle.y + circle.radius),
  }), {minX: 0, maxX: 0, minY: 0, maxY: 0});
  const spanX = Math.max(1, extent.maxX - extent.minX);
  const spanY = Math.max(1, extent.maxY - extent.minY);
  const scale = Math.min(width / spanX, height / spanY) * SOURCE_GEOMETRY.centerFitFactor;
  const centreX = (extent.minX + extent.maxX) / 2;
  const centreY = (extent.minY + extent.maxY) / 2;

  // 来源的入场顺序 = 半径降序的排名（largest first, centre outward）。
  const arrival = new Map(circles.map((circle) => [circle.index, 0]));
  [...circles].sort((a, b) => b.radius - a.radius).forEach((circle, rank) => arrival.set(circle.index, rank));

  return {
    scale,
    centreX,
    centreY,
    arrival,
    domain: getChartDomain(values, {includeZero: true}),
    circles: circles.map((circle) => ({
      index: circle.index,
      radius: circle.radius * scale,
      x: width / 2 + (circle.x - centreX) * scale,
      y: height / 2 + (circle.y - centreY) * scale,
      rank: arrival.get(circle.index) ?? 0,
    })),
  };
}

export function calculateBubbleChartLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
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
  const floor = minLegendFontSize(size);
  const overflow = [];

  const packed = packCluster(content.bubbles);
  const bubbles = packed.circles.map((circle) => {
    const bubble = content.bubbles[circle.index];
    const valueText = formatValue(bubble.value, unit);
    // 圆内可用的横向净空：2r × 0.86（标签行与数值行分别校验）。
    const innerWidth = circle.radius * 2 * source.chordRatio;
    let labelFontSize = Math.min(circle.radius * source.labelRatio, source.labelMaxFontSize);
    let valueFontSize = labelFontSize * source.valueRatio;
    // 先缩字号到「两行都放得下」，把字号下限留给最后一步判定。
    for (let pass = 0; pass < 2; pass += 1) {
      const labelWidth = textWidth(measure, bubble.label, labelFontSize, 700);
      const valueWidth = textWidth(measure, valueText, valueFontSize, 600);
      const ratio = Math.min(1, innerWidth / Math.max(labelWidth, 1), innerWidth / Math.max(valueWidth, 1));
      if (ratio >= 1) break;
      labelFontSize *= ratio;
      valueFontSize = labelFontSize * source.valueRatio;
    }
    const labelWidth = textWidth(measure, bubble.label, labelFontSize, 700);
    const valueWidth = textWidth(measure, valueText, valueFontSize, 600);
    if (labelFontSize < floor - 1e-9 || Math.max(labelWidth, valueWidth) > innerWidth + 0.5) {
      overflow.push({
        id: bubble.id,
        kind: "气泡标签",
        text: `${bubble.label} / ${valueText}`,
        available: innerWidth,
        required: Math.max(labelWidth, valueWidth),
      });
    }
    return {
      id: bubble.id,
      label: bubble.label,
      value: bubble.value,
      valueText,
      x: circle.x,
      y: circle.y,
      radius: circle.radius,
      rank: circle.rank,
      labelFontSize,
      valueFontSize,
      labelWidth,
      valueWidth,
      innerWidth,
    };
  });

  // 只拒绝「内容放不下」：放大到超出安全区属于 05 基线 V3.2 明确不做自动验收的边界
  //（3.0× 的版面溢出由人工在生产环节处理），因此这里不因为盒子变大而拒绝。
  let rejection = null;
  if (overflow.length) {
    rejection = `以下气泡在字号下限（渲染后 12 px）内仍放不进标签与数值：${overflow
      .map((item) => item.text)
      .join("、")}。请缩短标签、减少条目，或让各项数值更接近（气泡半径按数值平方根分配）。`;
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
    availableWidth,
    availableHeight,
    fitsSafeArea,
    overflow,
    rejection,
    bubbles,
    smallestRadius: bubbles.length ? Math.min(...bubbles.map((bubble) => bubble.radius)) : 0,
    largestRadius: bubbles.length ? Math.max(...bubbles.map((bubble) => bubble.radius)) : 0,
    x: safeX + (availableWidth - boxWidth) * position.x,
    y: safeY + (availableHeight - boxHeight) * position.y,
  };
}
