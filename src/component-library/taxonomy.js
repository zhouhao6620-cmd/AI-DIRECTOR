// 组件库分类体系（LIB-01）
//
// 事实源：`05_COMPONENT_ASSET_LIBRARY_BASELINE_V3.1_2026-09-15.md`
//   §7.1–§7.6 分类体系、§8.1 左侧导航、§15 冻结合同第 9–12 条。
//
// 左栏固定 4 个正式一级入口 + 1 个组件草稿箱：
//   精选推荐 / 动画组件（10 个二级入口）/ 全局包装组件（2 项）/ 人物布局（3 种状态）/ 组件草稿箱。
// 二级入口数量固定为 10：落不进这 10 个入口的组件必须重新归位，而不是新增入口。
// 本模块不含 JSX，Node 与浏览器都能直接导入，单测与页面共用同一份分类定义。

// 动画组件的 10 个二级入口（§7.2）。数量不增不改，顺序也不改。
export const ANIMATION_SUBGROUPS = [
  {id: "key-statement", en: "Key Statement", label: "核心观点"},
  {id: "kpi-number", en: "KPI Number", label: "核心数据"},
  {id: "multi-point", en: "Multi Point", label: "多点并列"},
  {id: "progressive-navigation", en: "Progressive Navigation", label: "逐项导航"},
  {id: "step-flow", en: "Step Flow", label: "步骤流程"},
  {id: "logic-node-graph", en: "Logic Node Graph", label: "逻辑节点"},
  {id: "comparison", en: "Comparison", label: "对比"},
  {id: "data-chart", en: "Data Chart", label: "数据图表"},
  {id: "evidence", en: "Evidence", label: "证据"},
  {id: "media", en: "Media", label: "媒体自由组件"},
];

// 全局包装组件当前只保留两项（§7.3 / 冻结合同第 11 条）。
export const GLOBAL_SUBGROUPS = [
  {id: "chapter-progress", en: "Chapter Progress", label: "章节与进度"},
  {id: "subtitle", en: "Subtitle", label: "字幕"},
];

// 人物布局不是普通组件，但在资产库作为独立一级入口统一展示（§7.4）。
// 当前版本三种状态都没有组件，只显示建设方向，不显示「暂无」。
export const CHARACTER_LAYOUT_ENTRIES = [
  {
    id: "full-character", en: "Full Character", label: "人物全屏",
    direction: "人物全屏底板 + 内容组件叠加的布局状态；按当前版本，Full Character 不开放 Scale，缩放不作为这一布局的编辑能力。",
  },
  {
    id: "split-layout", en: "Split Layout", label: "左右分屏",
    direction: "人物与画面内容左右分排，内容组件落在非人物一侧；分栏比例与安全区随画幅确定，尚未有组件实例落地。",
  },
  {
    id: "small-character", en: "Small Character", label: "小人物",
    direction: "人物缩到画面角标位，主体画面交给内容组件；角标位置与避让规则属于布局层，尚未有组件实例落地。",
  },
];

export const FEATURED_DIRECTION = "精选推荐是资产运营入口，不属于正式语义分类：「精选」写在库级清单里，不写进组件五层定义，也不进入 AI Director 能力索引（05 §7.1）。首版不做精选数据落地，库级清单由总控维护，清单为空时本入口只显示建设方向。";

export const DRAFT_BOX_DIRECTION = "组件草稿箱不是分类，是候选组件的暂存与预览区：Codex 侧产出的 DRAFT- 候选组件（draft: true）由组件生成目录带来，在这里预览、轻编辑并决定确认入库或丢弃（05 §7.6 / §8.5）。草稿不进正式分类、不进能力索引、AI Director 不可见，也不计入正式组件总数；草稿为空时这一入口保留并显示建设方向。";

export const UNMAPPED_NOTE = "未归位：这些组件的语义类型还不属于动画组件固定的 10 个二级入口，按 05 §7.2 必须重新归位，而不是新增入口。归位由总控确认。";

// 左侧一级导航固定顺序与固定成员（冻结合同第 9 条）。children 为二级入口。
export const LIBRARY_NAV = [
  {id: "featured", kind: "FEATURED", label: "精选推荐", en: "Featured", children: [], expandable: false},
  {id: "animation", kind: "ANIMATION", label: "动画组件", en: "Animation Components", children: ANIMATION_SUBGROUPS, expandable: true},
  {id: "global", kind: "GLOBAL", label: "全局包装组件", en: "Global Packaging Components", children: GLOBAL_SUBGROUPS, expandable: true},
  {id: "character", kind: "CHARACTER", label: "人物布局", en: "Character Layout", children: CHARACTER_LAYOUT_ENTRIES, expandable: true},
  {id: "drafts", kind: "DRAFT_BOX", label: "组件草稿箱", en: "Component Draft Box", children: [], expandable: false},
];

// 语义类型 → 二级入口。唯一来源是 `definition.semantic.type`，不改组件定义。
// 同一语义类型永远落同一个入口，避免出现「同一组件在两个入口下都能找到」。
const SUBGROUP_BY_TYPE = {
  KEY_STATEMENT: "key-statement",
  KPI_STATEMENT: "kpi-number",
  KPI_INTEGER_COUNTER: "kpi-number",
  KPI_RATIO: "kpi-number",
  MULTI_POINT_PINBOARD: "multi-point",
  ENTITY_CHIPS: "multi-point",
  PROGRESSIVE_NAVIGATION: "progressive-navigation",
  CHECKLIST: "step-flow",
  STEP_TIMELINE: "step-flow",
  LOGIC_NODE_GRAPH: "logic-node-graph",
  COMPARISON: "comparison",
  DATA_RANKING: "data-chart",
  DATA_TREND: "data-chart",
  // CMP-06 的数据可视化语义都复用既有「数据图表」入口；不新增二级分类。
  DATA_RELATION: "data-chart",
  DATA_FINANCIAL: "data-chart",
  DATA_COMPOSITION: "data-chart",
  DATA_CONVERSION: "data-chart",
  DATA_DISTRIBUTION: "data-chart",
  DATA_MULTI_AXIS: "data-chart",
  DATA_CORRELATION: "data-chart",
  DATA_BRIDGE: "data-chart",
  // 仪表盘表达一个当前 KPI，与既有单指标 / 比例指标同属「核心数据」。
  KPI_GAUGE: "kpi-number",
  EVIDENCE_MEDIA_CARD: "evidence",
  // 界面标注（ANNOTATION）是画面上的自由媒体标注，按确认的架构归「媒体自由组件」：
  // 证据 1 项（证据媒体卡）/ 媒体 2 项（自由媒体、界面标注）。
  ANNOTATION: "media",
  FREE_MEDIA: "media",
  // 多设备排列承载可编辑屏幕媒体；它不是数据图表，归既有「媒体自由组件」。
  MEDIA_SHOWCASE: "media",
};

// 全局包装组件两类各自只对一个语义类型（§7.3）。
const GLOBAL_SUBGROUP_BY_TYPE = {
  CHAPTER_PROGRESS: "chapter-progress",
  SUBTITLE: "subtitle",
};

export const UNMAPPED_SUBGROUP = "unmapped";

// 一个组件落在左栏哪个位置。返回：
//   {section: "animation" | "global", subgroup, mapped} —— mapped=false 表示需要重新归位。
export function classificationOf(definition) {
  const type = definition?.semantic?.type;
  if (GLOBAL_SUBGROUP_BY_TYPE[type]) return {section: "global", subgroup: GLOBAL_SUBGROUP_BY_TYPE[type], mapped: true};
  if (SUBGROUP_BY_TYPE[type]) return {section: "animation", subgroup: SUBGROUP_BY_TYPE[type], mapped: true};
  return {section: "animation", subgroup: UNMAPPED_SUBGROUP, mapped: false};
}

// 草稿不进入正式分类（§7.6）：草稿箱是唯一的入口。
export function sectionOf(entry) {
  if (entry?.draft === true) return "drafts";
  return classificationOf(entry?.definition).section;
}

export function subgroupOf(entry) {
  if (entry?.draft === true) return null;
  return classificationOf(entry?.definition).subgroup;
}

// 当前左栏位置下的条目集合。subgroup 为 null 表示该一级入口的全部条目。
export function entriesInScope(entries, section, subgroup = null) {
  return entries.filter(entry => {
    if (sectionOf(entry) !== section) return false;
    return subgroup === null || subgroupOf(entry) === subgroup;
  });
}

// 左栏角标与计数：只统计真实存在的条目，人物布局统计的是布局状态数而不是组件数。
export function navCounts(entries) {
  const count = section => entries.filter(entry => sectionOf(entry) === section).length;
  const unmapped = entries.filter(entry => entry.draft !== true && !classificationOf(entry.definition).mapped).length;
  return {
    featured: 0, // 首版不落地精选清单：没有库级清单，就不假装有推荐组件。
    animation: count("animation"),
    global: count("global"),
    character: CHARACTER_LAYOUT_ENTRIES.length,
    drafts: count("drafts"),
    unmapped,
  };
}

export function subgroupLabel(section, subgroup) {
  const list = section === "global" ? GLOBAL_SUBGROUPS : ANIMATION_SUBGROUPS;
  return list.find(item => item.id === subgroup) ?? null;
}

export function sectionLabel(section) {
  return LIBRARY_NAV.find(item => item.id === section) ?? null;
}
