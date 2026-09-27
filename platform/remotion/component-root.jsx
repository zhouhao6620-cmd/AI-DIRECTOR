// GENERATED FILE — 由 scripts/components-sync.mjs 生成，请勿手工编辑。
// 子窗口不要改本文件；新增组件由总控运行同步脚本收口。
import React from "react";
import {Composition, registerRoot} from "remotion";
import {ComponentSample} from "./component-sample.jsx";
import {createSampleState as createSampleState_four_point_navigation} from "../components/four-point-navigation/model.js";
import {createSampleState as createSampleState_chapter_progress} from "../components/chapter-progress/model.js";
import {createSampleState as createSampleState_subtitle_track} from "../components/subtitle-track/model.js";
import {createSampleState as createSampleState_checklist} from "../components/checklist/model.js";
import {createSampleState as createSampleState_pin_board} from "../components/pin-board/model.js";
import {createSampleState as createSampleState_stat_proof} from "../components/stat-proof/model.js";
import {createSampleState as createSampleState_odometer} from "../components/odometer/model.js";
import {createSampleState as createSampleState_rank_bars} from "../components/rank-bars/model.js";
import {createSampleState as createSampleState_ring_metric} from "../components/ring-metric/model.js";
import {createSampleState as createSampleState_growth_curve} from "../components/growth-curve/model.js";
import {createSampleState as createSampleState_animated_bar_chart} from "../components/animated-bar-chart/model.js";
import {createSampleState as createSampleState_bar_chart_race} from "../components/bar-chart-race/model.js";
import {createSampleState as createSampleState_bubble_chart_pack} from "../components/bubble-chart-pack/model.js";
import {createSampleState as createSampleState_candlestick_chart} from "../components/candlestick-chart/model.js";
import {createSampleState as createSampleState_comparison_bars} from "../components/comparison-bars/model.js";
import {createSampleState as createSampleState_donut_chart} from "../components/donut-chart/model.js";
import {createSampleState as createSampleState_funnel_chart} from "../components/funnel-chart/model.js";
import {createSampleState as createSampleState_gauge_dial} from "../components/gauge-dial/model.js";
import {createSampleState as createSampleState_heatmap_grid} from "../components/heatmap-grid/model.js";
import {createSampleState as createSampleState_line_chart_draw} from "../components/line-chart-draw/model.js";
import {createSampleState as createSampleState_multi_device_lineup} from "../components/multi-device-lineup/model.js";
import {createSampleState as createSampleState_pie_slice_reveal} from "../components/pie-slice-reveal/model.js";
import {createSampleState as createSampleState_radar_chart} from "../components/radar-chart/model.js";
import {createSampleState as createSampleState_scatter_plot_pop} from "../components/scatter-plot-pop/model.js";
import {createSampleState as createSampleState_sparkline_row} from "../components/sparkline-row/model.js";
import {createSampleState as createSampleState_stacked_area_chart} from "../components/stacked-area-chart/model.js";
import {createSampleState as createSampleState_treemap_blocks} from "../components/treemap-blocks/model.js";
import {createSampleState as createSampleState_waterfall_chart} from "../components/waterfall-chart/model.js";
import {createSampleState as createSampleState_entity_chips} from "../components/entity-chips/model.js";
import {createSampleState as createSampleState_evidence_media_card} from "../components/evidence-media-card/model.js";
import {createSampleState as createSampleState_logic_node_graph} from "../components/logic-node-graph/model.js";
import {createSampleState as createSampleState_free_media} from "../components/free-media/model.js";
import {createSampleState as createSampleState_punch_pill} from "../components/punch-pill/model.js";
import {createSampleState as createSampleState_quote_lockup} from "../components/quote-lockup/model.js";
import {createSampleState as createSampleState_skill_intro_card} from "../components/skill-intro-card/model.js";
import {createSampleState as createSampleState_stage_flow} from "../components/stage-flow/model.js";
import {createSampleState as createSampleState_step_timeline} from "../components/step-timeline/model.js";
import {createSampleState as createSampleState_term_card} from "../components/term-card/model.js";
import {createSampleState as createSampleState_type_shift} from "../components/type-shift/model.js";
import {createSampleState as createSampleState_ui_callout} from "../components/ui-callout/model.js";
import {createSampleState as createSampleState_versus_card} from "../components/versus-card/model.js";
import {projectProductionStateForRemotion} from "./production-projection.js";
import {componentCompositions} from "./component-compositions.js";

// One QA composition per registered component. Metadata comes from the sample
// ProductionState, so the composition always matches the state under test.
const sampleFactories = {
  "CMP-NAV-004": () => createSampleState_four_point_navigation(),
  "CMP-CHP-001": () => createSampleState_chapter_progress(),
  "CMP-SUB-001": () => createSampleState_subtitle_track(),
  "CMP-CHK-001": () => createSampleState_checklist(),
  "CMP-DATA-001": () => createSampleState_pin_board(),
  "CMP-DATA-002": () => createSampleState_stat_proof(),
  "CMP-DATA-003": () => createSampleState_odometer(),
  "CMP-DATA-004": () => createSampleState_rank_bars(),
  "CMP-DATA-005": () => createSampleState_ring_metric(),
  "CMP-DATA-006": () => createSampleState_growth_curve(),
  "CMP-DATA-007": () => createSampleState_animated_bar_chart(),
  "CMP-DATA-008": () => createSampleState_bar_chart_race(),
  "CMP-DATA-009": () => createSampleState_bubble_chart_pack(),
  "CMP-DATA-010": () => createSampleState_candlestick_chart(),
  "CMP-DATA-011": () => createSampleState_comparison_bars(),
  "CMP-DATA-012": () => createSampleState_donut_chart(),
  "CMP-DATA-013": () => createSampleState_funnel_chart(),
  "CMP-DATA-014": () => createSampleState_gauge_dial(),
  "CMP-DATA-015": () => createSampleState_heatmap_grid(),
  "CMP-DATA-016": () => createSampleState_line_chart_draw(),
  "CMP-DATA-017": () => createSampleState_multi_device_lineup(),
  "CMP-DATA-018": () => createSampleState_pie_slice_reveal(),
  "CMP-DATA-019": () => createSampleState_radar_chart(),
  "CMP-DATA-020": () => createSampleState_scatter_plot_pop(),
  "CMP-DATA-021": () => createSampleState_sparkline_row(),
  "CMP-DATA-022": () => createSampleState_stacked_area_chart(),
  "CMP-DATA-023": () => createSampleState_treemap_blocks(),
  "CMP-DATA-024": () => createSampleState_waterfall_chart(),
  "CMP-ENT-001": () => createSampleState_entity_chips(),
  "CMP-EVD-001": () => createSampleState_evidence_media_card(),
  "CMP-LNG-001": () => createSampleState_logic_node_graph(),
  "CMP-MED-001": () => createSampleState_free_media(),
  "CMP-PUN-001": () => createSampleState_punch_pill(),
  "CMP-QTE-001": () => createSampleState_quote_lockup(),
  "CMP-SKL-001": () => createSampleState_skill_intro_card(),
  "CMP-STG-001": () => createSampleState_stage_flow(),
  "CMP-STP-001": () => createSampleState_step_timeline(),
  "CMP-TRM-001": () => createSampleState_term_card(),
  "CMP-TYP-001": () => createSampleState_type_shift(),
  "CMP-UIC-001": () => createSampleState_ui_callout(),
  "CMP-VRS-001": () => createSampleState_versus_card(),
};

const compositions = Object.entries(componentCompositions).map(([componentId, entry]) => {
  const createSample = sampleFactories[componentId];
  const meta = createSample().technical;
  return {id: entry.compositionId, createSample, width: meta.width, height: meta.height, fps: meta.fps, durationInFrames: meta.durationInFrames};
});

function Root() {
  return <>
    {compositions.map(({id, createSample, ...size}) => <Composition key={id} id={id} component={ComponentSample} {...size}
      defaultProps={{projection: projectProductionStateForRemotion(createSample(), {renderTarget: "motion"})}}
      calculateMetadata={({props}) => ({...props.projection.compositionMetadata, defaultCodec: "prores", defaultVideoImageFormat: "png", defaultPixelFormat: "yuva444p10le", defaultProResProfile: "4444"})}/>)}
  </>;
}
registerRoot(Root);
