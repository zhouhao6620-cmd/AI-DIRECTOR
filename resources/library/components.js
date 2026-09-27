// 组件库改造清单（导航 / 频道页 / 详情页共用一份）
//
// Role: Reference（改造清单，不是基线）
//
// 左栏只保留这份清单里的组件：清单外的分类（精选推荐 / 逐项导航 / 逻辑节点 / 证据 /
// 媒体自由组件 / 人物布局 / 组件草稿箱）一律不出现在改造版页面上。
// composition 为 null 表示该颗还没改造完，频道页会以「待改造」卡片呈现、不可点。

export const PORTED_GROUPS = [
  {
    id: "animation", label: "动画组件", en: "Animation Components", badge: 17,
    subgroups: [
      {id: "key-statement", label: "核心观点", en: "Key Statement",
        components: ["CMP-PUN-001", "CMP-QTE-001", "CMP-SKL-001", "CMP-TRM-001", "CMP-TYP-001"]},
      {id: "kpi-number", label: "核心数据", en: "KPI Number",
        components: ["CMP-DATA-002", "CMP-DATA-003", "CMP-DATA-005", "CMP-DATA-014"]},
      {id: "multi-point", label: "多点并列", en: "Multi Point",
        components: ["CMP-DATA-001", "CMP-ENT-001"]},
      {id: "step-flow", label: "步骤流程", en: "Step Flow",
        components: ["CMP-CHK-001", "CMP-STP-001"]},
      {id: "comparison", label: "对比", en: "Comparison",
        components: ["CMP-DATA-011", "CMP-VRS-001"]},
      {id: "data-chart", label: "数据图表", en: "Data Chart",
        components: ["CMP-DATA-004", "CMP-DATA-006"]},
    ],
  },
  {
    id: "global", label: "全局包装组件", en: "Global Packaging Components", badge: 2,
    // 全局包装层是「叶子级」入口：点分类直接进组件详情
    subgroups: [
      {id: "chapter-progress", label: "章节与进度", en: "Chapter Progress", leaf: true, components: ["CMP-CHP-001"]},
      {id: "subtitle", label: "字幕", en: "Subtitle", leaf: true, components: ["CMP-SUB-001"]},
    ],
  },
];

// 已改造完成的合成文件（相对 project/compositions/）
export const COMPOSITIONS = {
  "CMP-SKL-001": "skill-intro-card.html",
  "CMP-PUN-001": "punch-pill.html",
  "CMP-QTE-001": "quote-lockup.html",
  "CMP-TRM-001": "term-card.html",
  "CMP-TYP-001": "type-shift.html",
  "CMP-DATA-002": "stat-proof.html",
  "CMP-DATA-003": "odometer.html",
  "CMP-DATA-005": "ring-metric.html",
  "CMP-DATA-014": "gauge-dial.html",
  "CMP-DATA-001": "pin-board.html",
  "CMP-ENT-001": "entity-chips.html",
  "CMP-CHK-001": "checklist.html",
  "CMP-STP-001": "step-timeline.html",
  "CMP-DATA-011": "comparison-bars.html",
  "CMP-VRS-001": "versus-card.html",
  "CMP-DATA-004": "rank-bars.html",
  "CMP-DATA-006": "growth-curve.html",
  "CMP-CHP-001": "chapter-progress.html",
  "CMP-SUB-001": "subtitle-track.html",
};

// 实例时长：本次统一 12 秒（= 360 帧 @30fps），与技能卡冒烟实例一致
export const INSTANCE = {aspectRatio: "16:9", width: 1920, height: 1080, fps: 30, durationSeconds: 12};

export const ALL_COMPONENTS = PORTED_GROUPS.flatMap(group =>
  group.subgroups.flatMap(subgroup => subgroup.components.map(id => ({id, group: group.id, subgroup: subgroup.id, leaf: Boolean(subgroup.leaf)}))));

export function groupOf(groupId) {
  return PORTED_GROUPS.find(group => group.id === groupId) ?? null;
}

export function subgroupOf(groupId, subgroupId) {
  return groupOf(groupId)?.subgroups.find(item => item.id === subgroupId) ?? null;
}

export function totalCount() {
  return ALL_COMPONENTS.length;
}
