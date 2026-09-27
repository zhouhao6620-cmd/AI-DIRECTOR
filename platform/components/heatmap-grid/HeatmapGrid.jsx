// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」：动效只用 useCurrentFrame / Easing 曲线 +
// 归一化进度，样式内联、不写 CSS 过渡；格子与文字块用 Interactive.Div + name 保证 Studio 可点选。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, interpolateColors, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {EASING} from "./elements/motion-tokens/index.js";
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateHeatmapGridLayout, cellDelayMs, clamp01, progressAt,
} from "./layout.js";
import {ACCENTS, COMPONENT_ID, SURFACE_TOKENS, assertHeatmapGridProps} from "./model.js";

export function HeatmapGrid({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertHeatmapGridProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateHeatmapGridLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const progressOf = cell => progressAt({
    frame, fps, delayMs: cellDelayMs(cell.row, cell.column), durationMs: SOURCE_MOTION.fillMs, ease: EASING.enter,
  });

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme} data-surface={surface}
      data-rows={layout.rowCount} data-columns={layout.columnCount}
      data-cell-count={layout.rowCount * layout.columnCount}
      data-peak={layout.peak}
      data-card-width={Number(layout.cardWidth.toFixed(2))} data-card-height={Number(layout.cardHeight.toFixed(2))}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.cardWidth, height: layout.cardHeight,
        display: "flex", flexDirection: "column",
      }}
    >
      {layout.hasColumnLabels ? <Interactive.Div name="列标签行" style={{
        display: "flex", marginLeft: layout.gutter, height: layout.labelLineHeight,
      }}>
        {layout.columnLabels.map((label, column) => <span
          key={column} data-heat-column-label={column}
          style={{
            width: layout.pitch, fontSize: label.fontSize, fontWeight: SOURCE_GEOMETRY.labelFontWeight,
            color: tokens.muted, whiteSpace: "pre",
          }}
        >{content.columnLabels[column]}</span>)}
      </Interactive.Div> : null}

      <Interactive.Div name="网格" style={{
        display: "flex", flexDirection: "column", gap: layout.gap,
        marginTop: layout.hasColumnLabels ? layout.columnLabelGap : 0,
      }}>
        {layout.cells.map(row => <div key={row[0].row} style={{display: "flex", alignItems: "center", gap: layout.gap}}>
          {layout.hasRowLabels ? <span data-heat-row-label={row[0].row} style={{
            width: layout.gutter - layout.gap, fontSize: layout.rowLabels[row[0].row].fontSize,
            fontWeight: SOURCE_GEOMETRY.labelFontWeight, color: tokens.muted, textAlign: "right", whiteSpace: "pre",
          }}>{content.rowLabels[row[0].row]}</span> : null}
          {row.map(cell => {
            // 来源：强度同时由颜色和尺寸承载——小尺寸差让「忙」的一列在余光里也读得出来。
            const progress = progressOf(cell);
            const shown = clamp01(progress);
            return <Interactive.Div
              key={cell.column} name={`格子 ${cell.row + 1}-${cell.column + 1}`}
              data-heat-cell={`${cell.row}-${cell.column}`}
              data-heat-cell-value={cell.value}
              data-heat-cell-intensity={Number(cell.intensity.toFixed(6))}
              data-heat-cell-progress={Number(shown.toFixed(4))}
              style={{
                width: layout.cellSize, height: layout.cellSize, borderRadius: layout.cornerRadius,
                background: cell.intensity === 0
                  ? tokens.empty
                  : interpolateColors(cell.intensity * shown, [0, 1], [tokens.empty, accent]),
                scale: SOURCE_GEOMETRY.cellScaleMin
                  + SOURCE_GEOMETRY.cellScaleRange * shown
                  + cell.intensity * shown * SOURCE_GEOMETRY.cellScaleIntensity,
                opacity: SOURCE_GEOMETRY.cellOpacityMin + SOURCE_GEOMETRY.cellOpacityRange * shown,
              }}
            />;
          })}
        </div>)}
      </Interactive.Div>

      {layout.showLegend ? <Interactive.Div name="图例" style={{
        display: "flex", alignItems: "center", gap: layout.legendGap, marginLeft: layout.gutter,
        marginTop: layout.legendGap, fontSize: layout.labelFont, fontWeight: SOURCE_GEOMETRY.labelFontWeight,
        color: tokens.muted,
      }}>
        <span data-heat-legend-less>{SOURCE_GEOMETRY.legendLess}</span>
        {SOURCE_GEOMETRY.legendSteps.map(step => <span
          key={step} data-heat-legend-step={step}
          style={{
            width: layout.legendSwatch, height: layout.legendSwatch, borderRadius: layout.legendRadius,
            background: interpolateColors(step, [0, 1], [tokens.empty, accent]),
          }}
        />)}
        <span data-heat-legend-more>{SOURCE_GEOMETRY.legendMore}</span>
      </Interactive.Div> : null}
    </div>
  </AbsoluteFill>;
}
