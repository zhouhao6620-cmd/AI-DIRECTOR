import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {MAX_ITEM_LINES, SOURCE_GEOMETRY, resolveEntrance} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const POSITIONS = ["LEFT", "RIGHT", "TOP_LEFT"];
export const SURFACES = ["DARK", "LIGHT"];
export const STAGGER_RANGE_MS = [50, 2000];
export {MAX_ITEM_LINES};

// Source tokens: hud.css `.stage[data-theme]` (dark / light) + `.hud-glass*`.
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    faint: "rgba(255, 255, 255, 0.44)",
    glassBorder: "rgba(255, 255, 255, 0.22)",
  },
  LIGHT: {
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    faint: "rgba(26, 37, 64, 0.42)",
    glassBorder: "rgba(255, 255, 255, 0.85)",
  },
};

// Source accent tokens: accent.ts ACCENT_VAR → --hud-blue / --hud-alert / --hud-orange.
export const ACCENTS = {
  SOURCE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  BLUE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  ORANGE: {DARK: "#f0a24f", LIGHT: "#d97a1c"},
  RED: {DARK: "#e88686", LIGHT: "#cf5555"},
  PURPLE: {DARK: "#8f86ea", LIGHT: "#6353d6"},
};
export const CHECK_COLOR = "#ffffff";

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "checkedCount", "stepMs", "position", "surface", "theme"],
  properties: {
    content: {$ref: "ChecklistContent"},
    checkedCount: {type: "integer", minimum: 0, maximum: 6},
    stepMs: {type: "integer", minimum: STAGGER_RANGE_MS[0], maximum: STAGGER_RANGE_MS[1]},
    position: {enum: POSITIONS},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    size: {type: "number", minimum: 0.05, maximum: 2},
    positionOffset: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1}}},
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

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 2–6 个步骤，每个步骤需要有效 ID 和 1–32 字名称；可选小标题 1–24 字。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.items.map(item => item.id)).size !== content.items.length) {
    return {valid: false, message: "步骤 ID 不能重复。"};
  }
  return {valid: true};
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!ACCENTS[result]) throw new Error("未知主题。");
  return result;
}

export function durationMsOf({durationInFrames, fps}) {
  return (durationInFrames / fps) * 1000;
}

export function assertChecklistProps({content, checkedCount, stepMs, position, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, checkedCount, stepMs, position, surface, theme}) || !ACCENTS[theme]) {
    throw new Error("步骤打勾的位置、底色、主题或完成数超出支持范围。");
  }
  if (checkedCount > content.items.length) throw new Error("已完成步骤数不能超过步骤总数。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 2)) throw new Error("步骤打勾至少显示 2 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const entrance = resolveEntrance({items: content.items, stepMs});
  const durationMs = durationMsOf({durationInFrames, fps});
  if (entrance.settledAtMs > durationMs + 0.5) {
    throw new Error(`按当前间隔逐条出现需要 ${(entrance.settledAtMs / 1000).toFixed(2)} 秒，超出组件时长 ${(durationMs / 1000).toFixed(2)} 秒；请缩短间隔或加长组件。`);
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
    throw new Error("步骤打勾样板支持 24/25/30/60 fps，时长 2–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个步骤打勾组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertChecklistProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

// Synthetic, non-factual step labels. Nothing here reads the user's video, subtitles
// or any external source.
export function createSampleState({
  aspectRatio = "9:16", count = 4, theme = "BLUE", position = "LEFT", surface = "DARK",
  instanceTheme = "SOURCE", stepMs = SOURCE_GEOMETRY.staggerMs, checkedCount = 3,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210, title = "制作步骤",
} = {}) {
  const labels = ["确认目标", "拆分步骤", "逐项执行", "核对结果", "记录来源", "补充说明"];
  return {
    product: {
      projectId: "cmp-04c-checklist-sample", aspectRatio, theme, shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
          instanceId: "sample-checklist-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {size: 1, positionOffset: {x: 0.5, y: 0.5},
            content: {title, items: labels.slice(0, count).map((label, index) => ({id: `step-${index + 1}`, label}))},
            checkedCount: Math.min(checkedCount, count), stepMs, position, surface, theme: instanceTheme,
          },
          timing: {startFrame, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04c-checklist-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04c-checklist-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: Math.round(durationSeconds * fps),
      width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
