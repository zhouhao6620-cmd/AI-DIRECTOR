// Source geometry copied from the RemotionUI heatmap-grid source (read-only):
//   registry/bases/default/primitives/heatmap-grid.tsx
//     cellSize 34 / gap 8 / cornerRadius 8 / color #e8b86d / emptyColor rgba(250,250,250,0.07)
//     labelSize = max(11, cellSize × 0.42)；pitch = cellSize + gap
//     行标签栏 gutter = cellSize × 2.6（右对齐）；列标签行与网格左对齐（width = pitch）
//     格子：intensity = value / peak；背景 = interpolateColors(intensity × shown, [0,1], [empty, color])
//            scale = 0.55 + 0.45 × shown + intensity × shown × 0.06；opacity = 0.25 + 0.75 × shown
//     波前：按「列 × 3 帧 + 行 × 1.5 帧」错峰（斜向推进）；单格 14 帧填满
//     图例：Less → 5 个色阶 → More
//   registry/bases/default/lib/motion-tokens.ts → EASING.enter（0.16, 1, 0.3, 1）
//
// Adaptations performed here（详见 docs/component-assets/CMP-06_BATCH_B_QA_REPORT.md）：
//   1. 来源允许参差不齐的行（短行按空格子补齐）——那会让「列」的语义含糊，本组件要求矩形网格并在内容校验里拒绝；
//   2. 列标签槽只有 pitch 宽（默认 42 px），中文 3 字就放不下了 → 列标签上限 2 字、行标签上限 4 字，并逐格实测；
//   3. 图例的 Less / More 改成中文「少」「多」；标签字号下限对齐项目口径 12 px（来源 11 px）；
//   4. 位置改为安全区 0–1 比例；不排入退场（来源的 exitAtInFrames 由片段时序决定）。

export const SOURCE_GEOMETRY = Object.freeze({
  cellSize: 34,
  gap: 8,
  cornerRadius: 8,
  labelFontRatio: 0.42,
  labelFontMinSize: 12,
  labelFontWeight: 600,
  rowGutterRatio: 2.6,
  labelLineHeight: 1.6,
  columnLabelGapRatio: 0.5,
  legendGapRatio: 0.5,
  legendSwatchRatio: 0.66,
  legendSwatchRadiusRatio: 0.66,
  legendSteps: [0.12, 0.36, 0.6, 0.84, 1],
  legendLess: "少",
  legendMore: "多",
  cellScaleMin: 0.55,
  cellScaleRange: 0.45,
  cellScaleIntensity: 0.06,
  cellOpacityMin: 0.25,
  cellOpacityRange: 0.75,
});

export const SOURCE_MOTION = Object.freeze({
  // 来源 14 / 3 / 1.5 帧（30 fps）。
  fillMs: 467,
  columnStaggerMs: 100,
  rowStaggerMs: 50,
  sourceFillFrames: 14,
  sourceColumnStaggerFrames: 3,
  sourceRowStaggerFrames: 1.5,
  sourceFps: 30,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"SF Mono", ui-monospace, monospace';
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (1920 * 1080));
}

export function decimalsOf(value) {
  if (Number.isInteger(value)) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) return 1;
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-9) return 2;
  return null;
}

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

export function progressAt({frame, fps, delayMs = 0, durationMs, ease = value => value}) {
  const start = (delayMs / 1000) * fps;
  const span = Math.max(1, (durationMs / 1000) * fps);
  const t = Math.min(1, Math.max(0, (frame - start) / span));
  return ease(t);
}

/** 波前错峰：来源是「列 × 3 帧 + 行 × 1.5 帧」的斜向推进。 */
export function cellDelayMs(row, column) {
  return column * SOURCE_MOTION.columnStaggerMs + row * SOURCE_MOTION.rowStaggerMs;
}

/** 整段动画窗口：最后一格（右下角）填满的时刻。 */
export function totalFillMs(rowCount, columnCount) {
  return cellDelayMs(Math.max(0, rowCount - 1), Math.max(0, columnCount - 1)) + SOURCE_MOTION.fillMs;
}

export function calculateHeatmapGridLayout({content, width, height, size = 1, position = {x: 0, y: 0}, measure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const overflow = [];

  const fitText = (text, fontSize, fontWeight, letterSpacing, maxWidth, id, kind) => {
    const natural = textWidth(measure, text, fontSize, fontWeight, letterSpacing);
    let resolved = {fontSize, letterSpacing, width: natural};
    if (maxWidth !== null && natural > maxWidth) {
      const scaled = Math.max(MIN_TEXT_FONT_SIZE * canvasScale, fontSize * (maxWidth / natural));
      const ratio = scaled / fontSize;
      resolved = {
        fontSize: scaled,
        letterSpacing: letterSpacing * ratio,
        width: textWidth(measure, text, scaled, fontWeight, letterSpacing * ratio),
      };
      // 真实字体度量不是严格线性的，按残差再收一次（见同批其它组件）。
      if (resolved.width > maxWidth) {
        const corrected = Math.max(MIN_TEXT_FONT_SIZE * canvasScale, scaled * (maxWidth / resolved.width));
        const correctedRatio = corrected / fontSize;
        resolved = {
          fontSize: corrected,
          letterSpacing: letterSpacing * correctedRatio,
          width: textWidth(measure, text, corrected, fontWeight, letterSpacing * correctedRatio),
        };
      }
      if (resolved.width > maxWidth + 0.5) overflow.push({id, kind, text, available: maxWidth, required: resolved.width});
    }
    return resolved;
  };

  const rowCount = content.cells.length;
  const columnCount = content.cells[0].length;
  const cellSize = SOURCE_GEOMETRY.cellSize * factor;
  const gap = SOURCE_GEOMETRY.gap * factor;
  const pitch = cellSize + gap;
  const cornerRadius = SOURCE_GEOMETRY.cornerRadius * factor;
  const labelFont = Math.max(SOURCE_GEOMETRY.labelFontMinSize * canvasScale, cellSize * SOURCE_GEOMETRY.labelFontRatio);
  const hasRowLabels = Array.isArray(content.rowLabels) && content.rowLabels.length > 0;
  const hasColumnLabels = Array.isArray(content.columnLabels) && content.columnLabels.length > 0;
  const gutter = hasRowLabels ? cellSize * SOURCE_GEOMETRY.rowGutterRatio : 0;
  const columnLabelGap = hasColumnLabels ? cellSize * SOURCE_GEOMETRY.columnLabelGapRatio : 0;
  const labelLineHeight = labelFont * SOURCE_GEOMETRY.labelLineHeight;

  const rowLabels = hasRowLabels
    ? content.rowLabels.map((label, row) => fitText(label, labelFont, SOURCE_GEOMETRY.labelFontWeight, 0, Math.max(0, gutter - gap), `row-label-${row}`, "行标签"))
    : [];
  const columnLabels = hasColumnLabels
    ? content.columnLabels.map((label, column) => fitText(label, labelFont, SOURCE_GEOMETRY.labelFontWeight, 0, pitch, `column-label-${column}`, "列标签"))
    : [];

  const peak = content.maxValue ?? Math.max(...content.cells.flat(), 1);
  const cells = content.cells.map((row, rowIndex) => row.map((value, column) => ({
    row: rowIndex, column, value,
    intensity: clamp01(value / (peak || 1)),
  })));

  const gridWidth = gutter + columnCount * cellSize + Math.max(0, columnCount - 1) * gap;
  const gridHeight = rowCount * cellSize + Math.max(0, rowCount - 1) * gap;
  const showLegend = content.showLegend !== false;
  const legendGap = cellSize * SOURCE_GEOMETRY.legendGapRatio;
  const legendSwatch = cellSize * SOURCE_GEOMETRY.legendSwatchRatio;
  const legendRadius = cornerRadius * SOURCE_GEOMETRY.legendSwatchRadiusRatio;
  const columnLabelBlock = hasColumnLabels ? labelLineHeight + columnLabelGap : 0;
  const legendBlock = showLegend ? legendGap + Math.max(legendSwatch, labelFont) : 0;
  const cardWidth = gridWidth;
  const cardHeight = columnLabelBlock + gridHeight + legendBlock;

  let rejection = null;
  if (overflow.length) {
    rejection = `以下内容在字号下限内仍放不进自己的标签槽：${overflow.map(item => item.text).join("、")}。请缩短标签或减少行列。`;
  }

  return {
    canvasScale, factor, availableWidth, availableHeight, overflow, rejection,
    rowCount, columnCount, cellSize, gap, pitch, cornerRadius, labelFont, labelLineHeight,
    hasRowLabels, hasColumnLabels, gutter, columnLabelGap, rowLabels, columnLabels, peak, cells,
    showLegend, legendGap, legendSwatch, legendRadius, columnLabelBlock, legendBlock,
    gridWidth, gridHeight, cardWidth, cardHeight,
    x: safeX + (availableWidth - cardWidth) * position.x,
    y: safeY + (availableHeight - cardHeight) * position.y,
  };
}
