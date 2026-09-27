// Element｜chart-utils（Adapted｜组件私有副本）
//
// Source: RemotionGit/registry/chart-utils.json →
//         registry/bases/default/lib/chart-utils.ts（MIT，commit 802a637）
//
// 取用范围：来源里纯数学、与帧无关的图表工具。环形图只用到数值格式化
// （环内合计与图例口径一致），因此本副本只带 `formatCompactNumber`。
// 域计算（getChartDomain / niceDomain / plotPoints / buildSmoothPath …）属于线柱面积类
// 组件的取用范围，这里不复制，避免出现「抄了却没用」的僵尸副本。
//
// 适配差异：
//   1. 来源 `124000` → `"124K"`；本组件的中文场景数字同样走这条紧凑口径，
//      但把语言固定为 `en`（来源即 `en`），千分位与中文排版无关；
//   2. 小数位沿用来源的 `maximumFractionDigits`（默认 1）。

/** 来源 `formatCompactNumber`：`124000` → `"124K"`。 */
export function formatCompactNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits,
  }).format(value);
}
