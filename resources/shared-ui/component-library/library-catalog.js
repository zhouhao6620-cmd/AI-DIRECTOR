// 组件库数据装配（LIB-01）
//
// 单一数据源：`src/component-lab/component-catalog.generated.js`（由 scripts/components-sync.mjs
// 生成的组件目录，含完整五层定义与内容 schema）。本模块**只读**它，不新建数据源、
// 不改生成物，也不把缺失的数据补成假的：目录里没有字段，页面上就没有这一项。
//
// 本模块不含 JSX，Node 与浏览器都能直接导入。

import {generatedComponentCatalog} from "../component-lab/component-catalog.generated.js";
import {classificationOf} from "./taxonomy.js";
import {landscapePreviewOf} from "./landscape-previews.js";

export const TAGS_NOTE = "标签";

// 标签筛选词表（05 §7.7）：本版不锁定 Tags 词表，筛选控件先用**已有真实字段**，
// 所以这里的字段全部来自组件能力索引与组件定义，不需要新增数据。
// 列表页只暴露这里列出的类型字段；其余字段的数据仍随组件目录带下来，
// 需要时把 id 加进 VISIBLE_FILTER_FACETS 即可，不需要新增数据（用户当前指令）。
export const VISIBLE_FILTER_FACETS = ["tag"];

export const FACET_DEFINITIONS = [
  {id: "tag", label: "标签", hint: "definition.discovery.tags"},
  {id: "type", label: "类型", hint: "definition.semantic.type"},
  {id: "motion", label: "动画模式", hint: "definition.runtime.motionBehavior.patterns"},
  {id: "density", label: "密度", hint: "definition.semantic.density"},
  {id: "depth", label: "层级深度", hint: "definition.semantic.depth"},
  {id: "cardinality", label: "条目数", hint: "definition.semantic.min / maxCardinality"},
  {id: "status", label: "状态", hint: "component-catalog.generated.js status"},
  {id: "source", label: "来源", hint: "definition.provenance.source"},
];

const TYPE_LABELS = {
  KEY_STATEMENT: "核心观点",
  KPI_STATEMENT: "核心数据 · 数据实证",
  KPI_INTEGER_COUNTER: "核心数据 · 整数计数",
  KPI_RATIO: "核心数据 · 比例指标",
  MULTI_POINT_PINBOARD: "多点并列",
  ENTITY_CHIPS: "多点并列 · 实体标签",
  PROGRESSIVE_NAVIGATION: "逐项导航",
  CHECKLIST: "步骤流程 · 打勾清单",
  STEP_TIMELINE: "步骤流程 · 时间线",
  LOGIC_NODE_GRAPH: "逻辑节点",
  COMPARISON: "对比",
  DATA_RANKING: "数据图表 · 排名",
  DATA_TREND: "数据图表 · 趋势",
  DATA_RELATION: "数据图表 · 关系",
  DATA_FINANCIAL: "数据图表 · 金融",
  DATA_COMPOSITION: "数据图表 · 构成",
  DATA_CONVERSION: "数据图表 · 转化",
  KPI_GAUGE: "核心数据 · 仪表盘",
  DATA_DISTRIBUTION: "数据图表 · 分布",
  MEDIA_SHOWCASE: "媒体自由组件 · 多设备展示",
  DATA_MULTI_AXIS: "数据图表 · 多维",
  DATA_CORRELATION: "数据图表 · 相关性",
  DATA_BRIDGE: "数据图表 · 增减拆解",
  EVIDENCE_MEDIA_CARD: "证据 · 媒体卡",
  ANNOTATION: "证据 · 界面标注",
  FREE_MEDIA: "媒体自由组件",
  CHAPTER_PROGRESS: "章节与进度",
  SUBTITLE: "字幕",
};

const DENSITY_LABELS = {LOW: "低", LOW_MEDIUM: "中低", MEDIUM: "中", MEDIUM_HIGH: "中高", HIGH: "高"};
const DEPTH_LABELS = {ONE_LEVEL: "单层", TWO_LEVEL: "两层"};
const STATUS_LABELS = {REGISTERED: "已注册", DRAFT: "草稿"};
const SOURCE_LABELS = {
  OVERLAY_STUDIO: "Overlay Studio 来源",
  OVERLAY_STUDIO_WITH_REMOTIONUI_MODEL_CHECK: "Overlay Studio 来源（RemotionUI 能力记录核对）",
  BUILT_IN_PROJECT: "本项目自建",
  LOCAL_REMOTION: "本机 Remotion 来源",
  REMOTIONUI: "RemotionUI 来源",
};
const enumValue = (id, label, value, extra = {}) => ({id, label, value, ...extra});

function typeFacet(type) {
  return enumValue(type, TYPE_LABELS[type] ?? type, type);
}

function densityFacet(density) {
  return enumValue(density, `${DENSITY_LABELS[density] ?? density}密度`, density);
}

function depthFacet(depth) {
  return enumValue(depth, DEPTH_LABELS[depth] ?? depth, depth);
}

function cardinalityFacet(min, max) {
  if (min === max) return enumValue(`c-${min}`, `${min} 条`, `c-${min}`, {min, max});
  return enumValue(`c-${min}-${max}`, `${min}–${max} 条`, `c-${min}-${max}`, {min, max});
}

function sourceFacet(provenance = {}) {
  const source = provenance.source ?? "UNKNOWN";
  return enumValue(source, SOURCE_LABELS[source] ?? source, source);
}

function motionFacets(runtime = {}) {
  const patterns = runtime.motionBehavior?.patterns ?? [];
  if (!patterns.length) return [];
  return patterns.map(pattern => enumValue(pattern, MOTION_LABELS[pattern] ?? pattern, pattern));
}

// 动画表现是只读能力描述（05 §1.5）。中文标签覆盖当前组件池出现过的模式，未收录的显示原文。
const MOTION_LABELS = {
  Linear: "线性推进",
  Radial: "中心辐射",
  Convergent: "汇聚",
  "Sequential Reveal": "逐项揭示",
  "Progressive Build": "递进构建",
  Expansion: "展开",
  Emphasis: "强调",
  "State Change": "状态切换",
  Persistent: "常驻停留",
  "Card Rise": "卡片上浮",
  "Card Entrance": "卡片入场",
  "Pop In": "弹出式出现",
  "Mask Reveal": "遮罩揭示",
  "Grow Draw": "曲线生长",
  "Draft Scatter": "草稿散落",
  "Typography Reflow": "文字重排",
  "Sequential Card Swap": "卡片依次切换",
  "Connector Draw": "连线绘制",
  "Dual Side Collision": "两侧对撞",
  "Typewriter Accent Line": "强调线打字机",
};

export function motionPatternLabel(pattern) {
  return MOTION_LABELS[pattern] ?? pattern;
}

// public/ 前缀在页面里换成本机服务的根路径；预览资产是真实文件，不做占位图。
export function assetUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  return `/${String(pathOrUrl).replace(/^\/+/, "").replace(/^public\//, "")}`;
}

// 把目录条目装配成页面条目：补齐分类、筛选字段与预览资产路径，不改动原定义。
export function buildLibraryEntry(raw) {
  const definition = raw.definition ?? {};
  const identity = definition.identity ?? {};
  const semantic = definition.semantic ?? {};
  const runtime = definition.runtime ?? {};
  const discovery = definition.discovery ?? {};
  const facetList = {
    tag: (discovery.tags ?? raw.tags ?? []).map(tag => enumValue(tag, tag, tag)),
    type: semantic.type ? [typeFacet(semantic.type)] : [],
    motion: motionFacets(runtime),
    density: semantic.density ? [densityFacet(semantic.density)] : [],
    depth: semantic.depth ? [depthFacet(semantic.depth)] : [],
    cardinality: Number.isFinite(semantic.minCardinality) && Number.isFinite(semantic.maxCardinality)
      ? [cardinalityFacet(semantic.minCardinality, semantic.maxCardinality)] : [],
    status: [enumValue(raw.status ?? definition.status ?? "UNKNOWN",
      STATUS_LABELS[raw.status ?? definition.status] ?? (raw.status ?? definition.status ?? "未知"), raw.status ?? definition.status)],
    source: provenanceFacetOrEmpty(definition.provenance),
  };
  return {
    componentId: raw.componentId,
    title: discovery.title ?? raw.title ?? identity.name ?? raw.componentId,
    englishName: raw.name ?? null,
    displayName: discovery.title ?? raw.title ?? identity.name ?? raw.componentId,
    version: identity.version ?? null,
    status: raw.status ?? definition.status ?? null,
    draft: raw.draft === true,
    note: discovery.description ?? raw.note ?? null,
    tags: discovery.tags ?? raw.tags ?? [],
    aliases: discovery.aliases ?? raw.aliases ?? [],
    useCases: semantic.useCases ?? [],
    definition,
    contentSchema: raw.contentSchema ?? null,
    createState: raw.createState,
    assertState: raw.assertState,
    classification: raw.draft === true ? {section: "drafts", subgroup: null, mapped: true} : classificationOf(definition),
    preview: {
      poster: assetUrl(`component-previews/${raw.componentId}/poster.png`),
      // 卡片用横版截图：优先用定义里声明的 identity.previewLandscapeRef，
      // 其次用截图脚本产出的清单（landscape-previews.js）。
      // 页面不猜文件名、不探测不存在的文件；两者都没有时回退竖版海报居中显示。
      landscape: assetUrl(identity.previewLandscapeRef ?? landscapePreviewOf(raw.componentId)),
    },
    facets: facetList,
  };
}

function provenanceFacetOrEmpty(provenance) {
  if (!provenance?.source) return [];
  return [sourceFacet(provenance)];
}

// 页面使用的条目表。默认读生成目录；单测可以把合成目录传进来验证草稿逻辑，
// 页面永远用默认值，不引入第二个数据源。
export function buildLibraryEntries(catalog = generatedComponentCatalog) {
  return catalog.map(buildLibraryEntry);
}

export const libraryEntries = buildLibraryEntries();

export function facetValueLabel(entry, facetId, valueId) {
  return (entry.facets[facetId] ?? []).find(option => option.id === valueId)?.label ?? valueId;
}

// 标签语义色：同一个字段永远用同一个色，颜色只在标签上表达「这是什么维度的信息」，
// 不改变文字与状态本身。状态类按真实状态分色，不按字段分色（见 STATUS_TONES）。
export const TAG_TONES = ["tag", "type", "count", "capability", "density", "depth", "motion", "status", "source"];
const STATUS_TONES = {REGISTERED: "success", DRAFT: "warning"};
const FACET_TONES = {
  tag: "type", type: "type", cardinality: "count", density: "density", depth: "depth",
  motion: "motion", source: "source",
};

export function tagTone(facetId, valueId) {
  if (facetId === "status") return STATUS_TONES[valueId] ?? "status";
  return FACET_TONES[facetId] ?? "count";
}
