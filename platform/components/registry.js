// GENERATED FILE — 由 scripts/components-sync.mjs 生成，请勿手工编辑。
// 子窗口不要改本文件；新增组件由总控运行同步脚本收口。
import definition_four_point_navigation from "./four-point-navigation/definition.json" with {type: "json"};
import definition_chapter_progress from "./chapter-progress/definition.json" with {type: "json"};
import definition_subtitle_track from "./subtitle-track/definition.json" with {type: "json"};
import definition_checklist from "./checklist/definition.json" with {type: "json"};
import definition_pin_board from "./pin-board/definition.json" with {type: "json"};
import definition_stat_proof from "./stat-proof/definition.json" with {type: "json"};
import definition_odometer from "./odometer/definition.json" with {type: "json"};
import definition_rank_bars from "./rank-bars/definition.json" with {type: "json"};
import definition_ring_metric from "./ring-metric/definition.json" with {type: "json"};
import definition_growth_curve from "./growth-curve/definition.json" with {type: "json"};
import definition_animated_bar_chart from "./animated-bar-chart/definition.json" with {type: "json"};
import definition_bar_chart_race from "./bar-chart-race/definition.json" with {type: "json"};
import definition_bubble_chart_pack from "./bubble-chart-pack/definition.json" with {type: "json"};
import definition_candlestick_chart from "./candlestick-chart/definition.json" with {type: "json"};
import definition_comparison_bars from "./comparison-bars/definition.json" with {type: "json"};
import definition_donut_chart from "./donut-chart/definition.json" with {type: "json"};
import definition_funnel_chart from "./funnel-chart/definition.json" with {type: "json"};
import definition_gauge_dial from "./gauge-dial/definition.json" with {type: "json"};
import definition_heatmap_grid from "./heatmap-grid/definition.json" with {type: "json"};
import definition_line_chart_draw from "./line-chart-draw/definition.json" with {type: "json"};
import definition_multi_device_lineup from "./multi-device-lineup/definition.json" with {type: "json"};
import definition_pie_slice_reveal from "./pie-slice-reveal/definition.json" with {type: "json"};
import definition_radar_chart from "./radar-chart/definition.json" with {type: "json"};
import definition_scatter_plot_pop from "./scatter-plot-pop/definition.json" with {type: "json"};
import definition_sparkline_row from "./sparkline-row/definition.json" with {type: "json"};
import definition_stacked_area_chart from "./stacked-area-chart/definition.json" with {type: "json"};
import definition_treemap_blocks from "./treemap-blocks/definition.json" with {type: "json"};
import definition_waterfall_chart from "./waterfall-chart/definition.json" with {type: "json"};
import definition_entity_chips from "./entity-chips/definition.json" with {type: "json"};
import definition_evidence_media_card from "./evidence-media-card/definition.json" with {type: "json"};
import definition_logic_node_graph from "./logic-node-graph/definition.json" with {type: "json"};
import definition_free_media from "./free-media/definition.json" with {type: "json"};
import definition_punch_pill from "./punch-pill/definition.json" with {type: "json"};
import definition_quote_lockup from "./quote-lockup/definition.json" with {type: "json"};
import definition_skill_intro_card from "./skill-intro-card/definition.json" with {type: "json"};
import definition_stage_flow from "./stage-flow/definition.json" with {type: "json"};
import definition_step_timeline from "./step-timeline/definition.json" with {type: "json"};
import definition_term_card from "./term-card/definition.json" with {type: "json"};
import definition_type_shift from "./type-shift/definition.json" with {type: "json"};
import definition_ui_callout from "./ui-callout/definition.json" with {type: "json"};
import definition_versus_card from "./versus-card/definition.json" with {type: "json"};

// Source definitions are the single capability source. Director's index is a projection.
export const componentDefinitions = [definition_four_point_navigation, definition_chapter_progress, definition_subtitle_track, definition_checklist, definition_pin_board, definition_stat_proof, definition_odometer, definition_rank_bars, definition_ring_metric, definition_growth_curve, definition_animated_bar_chart, definition_bar_chart_race, definition_bubble_chart_pack, definition_candlestick_chart, definition_comparison_bars, definition_donut_chart, definition_funnel_chart, definition_gauge_dial, definition_heatmap_grid, definition_line_chart_draw, definition_multi_device_lineup, definition_pie_slice_reveal, definition_radar_chart, definition_scatter_plot_pop, definition_sparkline_row, definition_stacked_area_chart, definition_treemap_blocks, definition_waterfall_chart, definition_entity_chips, definition_evidence_media_card, definition_logic_node_graph, definition_free_media, definition_punch_pill, definition_quote_lockup, definition_skill_intro_card, definition_stage_flow, definition_step_timeline, definition_term_card, definition_type_shift, definition_ui_callout, definition_versus_card];

export function buildComponentCapabilityIndex({generatedAt = new Date().toISOString()} = {}) {
  const registered = componentDefinitions.filter(def => def.status === "REGISTERED");
  return {
    product: {components: registered.map(def => ({
      componentId: def.identity.componentId,
      name: def.identity.name,
      version: def.identity.version,
      title: def.discovery?.title ?? def.identity.name.split("｜").pop(),
      description: def.discovery?.description ?? def.semantic.useCases[0],
      tags: def.discovery?.tags ?? [],
      aliases: def.discovery?.aliases ?? [],
      variants: (def.workbench?.variants ?? []).map(id => ({
        id, label: def.workbench?.variantLabels?.[id] ?? id,
      })),
      availability: "REGISTERED", ...def.semantic,
      contentSchemaRef: def.content.schemaRef,
    }))},
    technical: {
      schemaVersion: "1.0.0",
      revision: registered.length
        ? registered.map(def => `${def.identity.componentId}@${def.identity.version}`).join("+") + "+asset-policy-v1"
        : "registered-empty-v1",
      generatedAt,
      productionPolicy: "REGISTERED_ONLY",
      assetLibraryPolicy: {
        version: "1",
        discoveryFields: ["title", "description", "tags", "aliases"],
        configurationOrder: ["VARIANT", "CONTENT", "APPEARANCE", "ANIMATION"],
        defaultAspectRatios: ["9:16", "16:9"],
        previewMode: "PLAYER_CODE",
        globalSettings: ["PROJECT_THEME", "CANVAS_ASPECT_RATIO"],
      },
    },
  };
}
