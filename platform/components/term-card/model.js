import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export {FONT_FAMILY};

// Source tokens: hud.css `.stage[data-theme="dark" | "light"]`.
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.70)",
    glass: "linear-gradient(160deg, rgba(255,255,255,0.11), rgba(255,255,255,0.045))",
    glassBorder: "rgba(255,255,255,0.22)",
    cardShadow: "0 30px 70px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  LIGHT: {
    ink: "#1a2540",
    muted: "rgba(26,37,64,0.66)",
    glass: "linear-gradient(160deg, rgba(255,255,255,0.52), rgba(255,255,255,0.20))",
    glassBorder: "rgba(255,255,255,0.85)",
    cardShadow: "0 22px 54px rgba(88,70,104,0.16), 0 3px 10px rgba(88,70,104,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
  },
};

export const ACCENTS = {
  SOURCE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  BLUE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  ORANGE: {DARK: "#f0a24f", LIGHT: "#d97a1c"},
  RED: {DARK: "#e88686", LIGHT: "#cf5555"},
  PURPLE: {DARK: "#8f86ea", LIGHT: "#6353d6"},
};

export const DEFAULT_POSITION = Object.freeze({x: 1, y: 0.5});
export const DEFAULT_SIZE = 1;

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "TermCardContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.8, maximum: 2},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
  },
};
const instanceSchema = {
  type: "object", additionalProperties: false,
  required: ["instanceId", "componentId", "version", "props", "timing"],
  properties: {
    instanceId: {type: "string", minLength: 1},
    componentId: {const: COMPONENT_ID}, version: {const: COMPONENT_VERSION},
    props: propsSchema,
    timing: {type: "object", additionalProperties: false, required: ["startFrame", "durationInFrames"], properties: {
      startFrame: {type: "integer", minimum: 0}, durationInFrames: {type: "integer", minimum: 1},
    }},
  },
};
const checkInstance = ajv.compile(instanceSchema);
const checkProps = ajv.compile(propsSchema);

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写术语（1–24 字）和一句话定义（1–120 字）；英文 / 拼音可选，最长 40 字。",
    details: structuredClone(checkContent.errors),
  };
  return {valid: true};
}

export function assertTermCardProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !ACCENTS[theme]) throw new Error("组件位置、大小、底色或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("组件至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps * 3 || meta.durationInFrames > meta.fps * 60) {
    throw new Error("术语解释卡样板支持 24/25/30/60 fps，时长 3–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个术语卡组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertTermCardProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!ACCENTS[result]) throw new Error("未知主题。");
  return result;
}

export function createContent() {
  return {en: "Term Card", term: "术语卡", definition: "视频里蹦出新名词时，用一句话给它下定义。"};
}

export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", instanceTheme = "SOURCE", surface = "DARK",
  size = DEFAULT_SIZE, position = DEFAULT_POSITION, content, durationSeconds = 6, fps = 30,
} = {}) {
  const durationInFrames = Math.round(durationSeconds * fps);
  return {
    product: {
      projectId: "cmp-04b-term-card-sample", aspectRatio, theme,
      shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-term-card-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {content: content ?? createContent(), position: {...position}, size, surface, theme: instanceTheme},
          timing: {startFrame: 0, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04b-term-card-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04b-term-card-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames, width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
