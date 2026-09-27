// GENERATED FILE — 由 scripts/components-sync.mjs 生成，请勿手工编辑。
// 子窗口不要改本文件；新增组件由总控运行同步脚本收口。
// Plain-JS single source for "component → QA composition". It stays free of JSX
// so Node QA scripts and the browser lab can both import it.
export const componentCompositions = {
  "CMP-NAV-004": {compositionId: "FourPointNavigation", layer: "SHOT"},
  "CMP-CHP-001": {compositionId: "ChapterProgress", layer: "GLOBAL"},
  "CMP-SUB-001": {compositionId: "SubtitleTrack", layer: "GLOBAL"},
  "CMP-CHK-001": {compositionId: "Checklist", layer: "SHOT"},
  "CMP-DATA-001": {compositionId: "PinBoard", layer: "SHOT"},
  "CMP-DATA-002": {compositionId: "StatProof", layer: "SHOT"},
  "CMP-DATA-003": {compositionId: "Odometer", layer: "SHOT"},
  "CMP-DATA-004": {compositionId: "RankBars", layer: "SHOT"},
  "CMP-DATA-005": {compositionId: "RingMetric", layer: "SHOT"},
  "CMP-DATA-006": {compositionId: "GrowthCurve", layer: "SHOT"},
  "CMP-DATA-007": {compositionId: "AnimatedBarChart", layer: "SHOT"},
  "CMP-DATA-008": {compositionId: "BarChartRace", layer: "SHOT"},
  "CMP-DATA-009": {compositionId: "BubbleChartPack", layer: "SHOT"},
  "CMP-DATA-010": {compositionId: "CandlestickChart", layer: "SHOT"},
  "CMP-DATA-011": {compositionId: "ComparisonBars", layer: "SHOT"},
  "CMP-DATA-012": {compositionId: "DonutChart", layer: "SHOT"},
  "CMP-DATA-013": {compositionId: "FunnelChart", layer: "SHOT"},
  "CMP-DATA-014": {compositionId: "GaugeDial", layer: "SHOT"},
  "CMP-DATA-015": {compositionId: "HeatmapGrid", layer: "SHOT"},
  "CMP-DATA-016": {compositionId: "LineChartDraw", layer: "SHOT"},
  "CMP-DATA-017": {compositionId: "MultiDeviceLineup", layer: "SHOT"},
  "CMP-DATA-018": {compositionId: "PieSliceReveal", layer: "SHOT"},
  "CMP-DATA-019": {compositionId: "RadarChart", layer: "SHOT"},
  "CMP-DATA-020": {compositionId: "ScatterPlotPop", layer: "SHOT"},
  "CMP-DATA-021": {compositionId: "SparklineRow", layer: "SHOT"},
  "CMP-DATA-022": {compositionId: "StackedAreaChart", layer: "SHOT"},
  "CMP-DATA-023": {compositionId: "TreemapBlocks", layer: "SHOT"},
  "CMP-DATA-024": {compositionId: "WaterfallChart", layer: "SHOT"},
  "CMP-ENT-001": {compositionId: "EntityChips", layer: "SHOT"},
  "CMP-EVD-001": {compositionId: "EvidenceMediaCard", layer: "SHOT"},
  "CMP-LNG-001": {compositionId: "LogicNodeGraph", layer: "SHOT"},
  "CMP-MED-001": {compositionId: "FreeMedia", layer: "SHOT"},
  "CMP-PUN-001": {compositionId: "PunchPill", layer: "SHOT"},
  "CMP-QTE-001": {compositionId: "QuoteLockup", layer: "SHOT"},
  "CMP-SKL-001": {compositionId: "SkillIntroCard", layer: "SHOT"},
  "CMP-STG-001": {compositionId: "StageFlow", layer: "SHOT"},
  "CMP-STP-001": {compositionId: "StepTimeline", layer: "SHOT"},
  "CMP-TRM-001": {compositionId: "TermCard", layer: "SHOT"},
  "CMP-TYP-001": {compositionId: "TypeShift", layer: "SHOT"},
  "CMP-UIC-001": {compositionId: "UICallout", layer: "SHOT"},
  "CMP-VRS-001": {compositionId: "VersusCard", layer: "SHOT"},
};

export const compositionIds = Object.fromEntries(
  Object.entries(componentCompositions).map(([componentId, entry]) => [componentId, entry.compositionId]),
);

export const globalLayerComponentIds = Object.entries(componentCompositions)
  .filter(([, entry]) => entry.layer === "GLOBAL").map(([componentId]) => componentId);

// A QA sample state carries exactly one component instance; this resolves which one.
export function componentIdOfState(productionState) {
  const globalInstance = productionState?.product?.globalPackaging?.[0];
  if (globalInstance?.componentId) return globalInstance.componentId;
  const shotInstance = productionState?.product?.shots?.[0]?.componentInstances?.[0];
  return shotInstance?.componentId ?? null;
}
