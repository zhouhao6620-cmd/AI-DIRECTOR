// 版式与测量｜矩形树图（TreemapBlocks）
//
// 来源几何（RemotionUI `treemap-blocks`，registry/bases/default/primitives/treemap-blocks.tsx，
// MIT · commit 802a637）：
//   width 820 / height 460；squarify（Bruls / Huizing / van Wijk）铺块，块间 gap 8、圆角 12；
//   标签 fontSize = min(innerWidth × 0.16, innerHeight × 0.2, 34)，来源的可见阈值是 fontSize > 9 且 innerWidth > fontSize × 3，
//   数值行（含占比）在 innerHeight > fontSize × 3 时出现；入场 durationInFrames 20 / stagger 6（按数值降序）/ exit 20；
//   缓动 EASING.enter；墨色 #0b0b10 压在彩色块上。
//
// 本项目适配差异（逐条记录）：
//   1. 来源 820 × 460 像素 = 默认大小（size = 1），size 0.5–3 为整组件等比缩放；
//   2. 落位改为安全区 0–1 比例；
//   3. 标签与数值不再「放不下就不画」：字号先按来源公式取，再按真实字宽 / 字高收缩，
//      渲染后字号下限 12 px；到下限仍放不下就拒绝并指出是哪一块——来源会静默丢掉标签；
//   4. 数值保留最多 2 位小数（不静默取整），占比按四舍五入到整数百分比；
//   5. 配色：SOURCE = 来源 5 色板，BLUE / ORANGE / RED / PURPLE 为项目四套主题色板。
import {formatCompactNumber} from "./elements/chart-utils/index.js";

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  chartWidth: 820,
  chartHeight: 460,
  gap: 8,
  cornerRadius: 12,
  labelWidthFactor: 0.16,
  labelHeightFactor: 0.2,
  labelMaxFontSize: 34,
  valueFontRatio: 0.82,
  labelInsetFactor: 0.6,
  labelTopFactor: 1.1,
  valueTopFactor: 2.4,
  verticalLines: 3.2,
  valueOpacity: 0.72,
  blockOpacity: 0.92,
  inkColor: "#0b0b10",
});

export const SOURCE_MOTION = Object.freeze({
  unitFrames: 20,
  staggerFrames: 6,
  exitFrames: 20,
  minDurationSeconds: 3,
  defaultSize: 1,
  sizeRange: {min: 0.5, max: 2},
});

export const BLOCK_RANGE = Object.freeze({min: 3, max: 8});
export const VALUE_LIMIT = 1000000000;
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"IBM Plex Mono", ui-monospace, monospace';

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

export function minLegendFontSize(size) {
  return MIN_TEXT_FONT_SIZE / size;
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

/** 来源 `worstRatio`：一行块在给定边上的最差长宽比。 */
function worstRatio(areas, side, total) {
  if (areas.length === 0 || side === 0 || total === 0) return Infinity;
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (total * total), (total * total) / (side * side * min));
}

/** 来源 `squarify`（Bruls / Huizing / van Wijk）：行在剩余空间的短边上生长，长宽比一变差就收行。 */
export function squarify(values, width, height) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || width <= 0 || height <= 0) return [];

  const order = values.map((value, index) => ({value, index})).sort((left, right) => right.value - left.value);
  const scale = (width * height) / total;
  const tiles = [];
  let free = {x: 0, y: 0, width, height};
  let row = [];

  const flushRow = () => {
    if (row.length === 0) return;
    const rowArea = row.reduce((sum, entry) => sum + entry.area, 0);
    const horizontal = free.width >= free.height;
    const thickness = rowArea / (horizontal ? free.height : free.width);

    let offset = 0;
    for (const entry of row) {
      const length = entry.area / thickness;
      tiles.push(horizontal
        ? {x: free.x, y: free.y + offset, width: thickness, height: length, index: entry.index}
        : {x: free.x + offset, y: free.y, width: length, height: thickness, index: entry.index});
      offset += length;
    }

    free = horizontal
      ? {x: free.x + thickness, y: free.y, width: free.width - thickness, height: free.height}
      : {x: free.x, y: free.y + thickness, width: free.width, height: free.height - thickness};
    row = [];
  };

  for (const entry of order) {
    const area = entry.value * scale;
    const side = Math.min(free.width, free.height);
    const current = row.map((item) => item.area);
    const currentTotal = current.reduce((sum, value) => sum + value, 0);
    const before = worstRatio(current, side, currentTotal);
    const after = worstRatio([...current, area], side, currentTotal + area);
    if (row.length > 0 && after > before) flushRow();
    row.push({area, index: entry.index});
  }

  flushRow();
  return tiles;
}

export function calculateTreemapBlocksLayout({content, width, height, size = 1, position = {x: 0.5, y: 0.5}, measure}) {
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

  const total = content.blocks.reduce((sum, block) => sum + block.value, 0) || 1;
  const tiles = squarify(content.blocks.map((block) => block.value), chartWidth, chartHeight);

  const blocks = tiles.map((tile) => {
    const block = content.blocks[tile.index];
    const innerWidth = Math.max(0, tile.width - source.gap);
    const innerHeight = Math.max(0, tile.height - source.gap);
    const valueText = formatValue(block.value, unit);
    const shareText = `${valueText} · ${Math.round((block.value / total) * 100)}%`;
    let labelFontSize = Math.min(
      innerWidth * source.labelWidthFactor,
      innerHeight * source.labelHeightFactor,
      source.labelMaxFontSize,
    );
    // 先按文本宽度收缩，再按「三行高」收缩，最后才判定下限。
    for (let pass = 0; pass < 2; pass += 1) {
      const available = innerWidth - source.labelInsetFactor * 2 * labelFontSize;
      const needed = Math.max(
        textWidth(measure, block.label, labelFontSize, 700),
        textWidth(measure, shareText, labelFontSize * source.valueFontRatio, 600),
      );
      if (needed <= available || labelFontSize <= 1) break;
      labelFontSize *= Math.max(0.2, available / needed);
    }
    if (innerHeight < labelFontSize * source.verticalLines) {
      labelFontSize = innerHeight / source.verticalLines;
    }
    const available = innerWidth - source.labelInsetFactor * 2 * labelFontSize;
    const labelWidth = textWidth(measure, block.label, labelFontSize, 700);
    const shareWidth = textWidth(measure, shareText, labelFontSize * source.valueFontRatio, 600);
    const needed = Math.max(labelWidth, shareWidth);
    if (labelFontSize < floor - 1e-9 || needed > available + 0.5) {
      overflow.push({
        id: block.id,
        kind: "矩形树图标签",
        text: `${block.label} / ${shareText}`,
        available: Math.max(available, 0),
        required: needed,
      });
    }
    return {
      id: block.id,
      label: block.label,
      value: block.value,
      valueText,
      shareText,
      share: block.value / total,
      rank: tiles.indexOf(tile),
      x: tile.x,
      y: tile.y,
      width: tile.width,
      height: tile.height,
      innerWidth,
      innerHeight,
      labelFontSize,
      labelWidth,
      shareWidth,
    };
  });

  let rejection = null;
  if (overflow.length) {
    rejection = `以下矩形在字号下限（渲染后 12 px）内仍放不下标签与数值：${overflow
      .map((item) => item.text)
      .join("、")}。请缩短标签、减少条目，或让各项数值更接近（面积按数值分配，落差越大最小的块越小）。`;
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
    blocks,
    total,
    overflow,
    rejection,
    smallestInner: blocks.length ? Math.min(...blocks.map((block) => Math.min(block.innerWidth, block.innerHeight))) : 0,
    x: safeX + (availableWidth - boxWidth) * position.x,
    y: safeY + (availableHeight - boxHeight) * position.y,
  };
}
