import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FITS, KINDS, SOURCE_GEOMETRY, VARIANTS, defaultAspectFor, resolveEntrance} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const STAGGER_RANGE_MS = [0, 2000];
export {FITS, KINDS, VARIANTS};

export const SURFACE_TOKENS = {
  DARK: {
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    faint: "rgba(255, 255, 255, 0.44)",
    frameBorder: "rgba(255, 255, 255, 0.22)",
    frameShadow: "0 30px 70px rgba(0, 0, 0, 0.38)",
  },
  LIGHT: {
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    faint: "rgba(26, 37, 64, 0.42)",
    frameBorder: "rgba(255, 255, 255, 0.85)",
    frameShadow: "0 22px 54px rgba(88, 70, 104, 0.16)",
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
  required: ["content", "variant", "stepMs", "theme"],
  properties: {
    content: {$ref: "FreeMediaContent"},
    variant: {enum: VARIANTS},
    stepMs: {type: "integer", minimum: STAGGER_RANGE_MS[0], maximum: STAGGER_RANGE_MS[1]},
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

// Media must stay inside the project: a publicDir-relative path, never a URL and
// never a path that escapes the asset root.
export function validateMediaSrc(src) {
  if (typeof src !== "string" || !src.length) return {valid: false, message: "素材路径不能为空。"};
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src)) return {valid: false, message: "素材路径不能是网络地址；请使用项目内素材。"};
  if (src.startsWith("/") || src.startsWith("~")) return {valid: false, message: "素材路径必须相对 publicDir，不能以 / 或 ~ 开头。"};
  if (src.split("/").includes("..")) return {valid: false, message: "素材路径不能跳出素材根目录。"};
  return {valid: true};
}

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 1–4 个媒体项：每项需要 ID、类型（IMAGE / VIDEO / LOGO）、项目内素材路径、归一化位置 x / y、宽度占比、画框比例与填充方式。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.items.map(item => item.id)).size !== content.items.length) {
    return {valid: false, message: "媒体项 ID 不能重复。"};
  }
  for (const item of content.items) {
    const result = validateMediaSrc(item.src);
    if (!result.valid) return result;
  }
  return {valid: true};
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!ACCENTS[result]) throw new Error("未知主题。");
  return result;
}

export function assertFreeMediaProps({content, variant, stepMs, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, variant, stepMs, theme}) || !ACCENTS[theme]) throw new Error("自由媒体的形态、节奏或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 1)) throw new Error("自由媒体至少显示 1 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const entrance = resolveEntrance({items: content.items, stepMs});
  const durationMs = (durationInFrames / fps) * 1000;
  if (entrance.settledAtMs > durationMs + 0.5) {
    throw new Error(`按当前节奏逐个入场需要 ${(entrance.settledAtMs / 1000).toFixed(2)} 秒，超出组件时长 ${(durationMs / 1000).toFixed(2)} 秒；请缩短节奏或加长组件。`);
  }
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps || meta.durationInFrames > meta.fps * 60) {
    throw new Error("自由媒体样板支持 24/25/30/60 fps，时长 1–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个自由媒体组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertFreeMediaProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

export function mediaItem({id, kind = "IMAGE", src, x = 0.5, y = 0.5, width: itemWidth = 0.6, aspect, fit = "CONTAIN", radius = 0, opacity = 1}) {
  return {id, kind, src, x, y, width: itemWidth, aspect: aspect ?? defaultAspectFor(kind), fit, radius, opacity};
}

// Synthetic test content. Every path points at this component's own fixtures, which
// the QA script serves as publicDir; no user media and no network is involved.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", variant = "FRAMED", instanceTheme = "SOURCE",
  stepMs = SOURCE_GEOMETRY.staggerMs,
  items = [
    mediaItem({id: "photo-1", kind: "IMAGE", src: "media-photo.svg", x: 0.5, y: 0.34, width: 0.82, radius: 24}),
    mediaItem({id: "clip-1", kind: "VIDEO", src: "sample-clip.mp4", x: 0.34, y: 0.7, width: 0.46, radius: 16}),
    mediaItem({id: "logo-1", kind: "LOGO", src: "logo-mark.svg", x: 0.8, y: 0.72, width: 0.16, radius: 0}),
  ],
  durationSeconds = 10, fps = 30, startFrame = 15, durationInFrames = 270,
} = {}) {
  return {
    product: {
      projectId: "cmp-04c-free-media-sample", aspectRatio, theme, shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
          instanceId: "sample-free-media-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {size: 1, position: {x: 0.5, y: 0.5}, content: {items: structuredClone(items)}, variant, stepMs, theme: instanceTheme},
          timing: {startFrame, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04c-free-media-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04c-free-media-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: Math.round(durationSeconds * fps),
      width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
