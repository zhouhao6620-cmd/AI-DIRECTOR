import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {SOURCE_GEOMETRY, resolveEntrance} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const STAGGER_RANGE_MS = [80, 1200];
export const MAX_BRANCHES = 6;
export const MAX_CHILDREN_PER_BRANCH = 2;

// Node surfaces are built from the local HUD tokens (hud.css `.stage[data-theme]`):
// the dark node colour, the glass gradient / border pair and the ink scale.
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    faint: "rgba(255, 255, 255, 0.44)",
    node: "#12121a",
    glass: "linear-gradient(160deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.045))",
    glassBorder: "rgba(255, 255, 255, 0.22)",
    cardShadow: "0 30px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
  },
  LIGHT: {
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    faint: "rgba(26, 37, 64, 0.42)",
    node: "#ece6e0",
    glass: "linear-gradient(160deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.20))",
    glassBorder: "rgba(255, 255, 255, 0.85)",
    cardShadow: "0 22px 54px rgba(88, 70, 104, 0.16), 0 3px 10px rgba(88, 70, 104, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
  },
};

export const ACCENTS = {
  SOURCE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  BLUE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  ORANGE: {DARK: "#f0a24f", LIGHT: "#d97a1c"},
  RED: {DARK: "#e88686", LIGHT: "#cf5555"},
  PURPLE: {DARK: "#8f86ea", LIGHT: "#6353d6"},
};

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "stepMs", "surface", "theme"],
  properties: {
    content: {$ref: "LogicNodeGraphContent"},
    stepMs: {type: "integer", minimum: STAGGER_RANGE_MS[0], maximum: STAGGER_RANGE_MS[1]},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    size: {type: "number", minimum: 0.05, maximum: 2},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1}}},
  },
};
const instanceSchema = {
  type: "object", additionalProperties: false,
  required: ["instanceId", "componentId", "version", "props", "timing"],
  properties: {
    instanceId: {type: "string", minLength: 1},
    componentId: {const: COMPONENT_ID}, version: {const: COMPONENT_VERSION},
    props: propsSchema,
    timing: {
      type: "object", additionalProperties: false, required: ["startFrame", "durationInFrames"],
      properties: {startFrame: {type: "integer", minimum: 0}, durationInFrames: {type: "integer", minimum: 1}},
    },
  },
};
const checkInstance = ajv.compile(instanceSchema);
const checkProps = ajv.compile(propsSchema);

export function allNodesOf(content) {
  return [
    {id: "center", kind: "CENTER", label: content.center.label, children: content.branches},
    ...content.branches.map(branch => ({...branch, kind: "BRANCH"})),
    ...content.branches.flatMap(branch => branch.children.map(child => ({...child, kind: "LEAF", parentId: branch.id}))),
  ];
}

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 1–12 字中心节点和 2–6 个一级分支（每支 1–12 字），每个分支可有 0–2 个二级节点（每个 1–10 字）。",
    details: structuredClone(checkContent.errors),
  };
  const ids = [...content.branches.map(branch => branch.id), ...content.branches.flatMap(branch => branch.children.map(child => child.id))];
  if (new Set(ids).size !== ids.length) return {valid: false, message: "节点 ID 不能重复。"};
  return {valid: true};
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!ACCENTS[result]) throw new Error("未知主题。");
  return result;
}

export function assertLogicNodeGraphProps({content, stepMs, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, stepMs, surface, theme}) || !ACCENTS[theme]) throw new Error("逻辑节点图的底色、主题或节奏超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 2)) throw new Error("逻辑节点图至少显示 2 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const nodes = allNodesOf(content);
  const entrance = resolveEntrance({nodes: nodes.map((_, index) => ({order: index})), stepMs});
  const durationMs = (durationInFrames / fps) * 1000;
  if (entrance.settledAtMs > durationMs + 0.5) {
    throw new Error(`按当前节奏展开节点需要 ${(entrance.settledAtMs / 1000).toFixed(2)} 秒，超出组件时长 ${(durationMs / 1000).toFixed(2)} 秒；请缩短节奏或加长组件。`);
  }
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps * 2 || meta.durationInFrames > meta.fps * 60) {
    throw new Error("逻辑节点图样板支持 24/25/30/60 fps，时长 2–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个逻辑节点图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertLogicNodeGraphProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

// Synthetic, non-factual node labels. Nothing here reads the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  stepMs = SOURCE_GEOMETRY.staggerMs, center = "本段核心结论",
  branches = [
    {id: "branch-1", label: "内容理解", children: [{id: "leaf-1-1", label: "资料来源"}]},
    {id: "branch-2", label: "组件资产", children: [{id: "leaf-2-1", label: "结构组件"}]},
    {id: "branch-3", label: "导演编排", children: []},
    {id: "branch-4", label: "导出交付", children: []},
  ],
  durationSeconds = 10, fps = 30, startFrame = 15, durationInFrames = 270,
} = {}) {
  return {
    product: {
      projectId: "cmp-04c-logic-node-graph-sample", aspectRatio, theme, shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
          instanceId: "sample-logic-node-graph-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {size: 1, position: {x: 0.5, y: 0.5}, content: {center: {label: center}, branches: structuredClone(branches)}, stepMs, surface, theme: instanceTheme},
          timing: {startFrame, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04c-logic-node-graph-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04c-logic-node-graph-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: Math.round(durationSeconds * fps),
      width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
