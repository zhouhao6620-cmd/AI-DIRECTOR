import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {SOURCE_GEOMETRY} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const POSITIONS = ["LEFT", "CENTER", "RIGHT"];
export const SURFACES = ["DARK", "LIGHT"];
export const FRAMES = ["WIDE", "SQUARE", "PORTRAIT"];
export const MEDIA_KINDS = ["IMAGE", "VIDEO"];

// Visual tokens come from the local HUD styles: hud.css `.stage[data-theme]`,
// `.hud-glass` and the accent tokens in accent.ts.
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    faint: "rgba(255, 255, 255, 0.44)",
    card: "linear-gradient(160deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.045))",
    cardBorder: "rgba(255, 255, 255, 0.22)",
    cardShadow: "0 30px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
    mediaSurface: "rgba(0, 0, 0, 0.28)",
    mediaBorder: "rgba(255, 255, 255, 0.18)",
  },
  LIGHT: {
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    faint: "rgba(26, 37, 64, 0.42)",
    card: "linear-gradient(160deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.20))",
    cardBorder: "rgba(255, 255, 255, 0.85)",
    cardShadow: "0 22px 54px rgba(88, 70, 104, 0.16), 0 3px 10px rgba(88, 70, 104, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
    mediaSurface: "rgba(255, 255, 255, 0.55)",
    mediaBorder: "rgba(26, 37, 64, 0.16)",
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
  required: ["content", "position", "surface", "theme"],
  properties: {
    content: {$ref: "EvidenceMediaCardContent"},
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
    message: "请填写 1–24 字标题、材料（IMAGE / VIDEO + 项目内素材路径 + WIDE / SQUARE / PORTRAIT 画框）和来源发布方（1–20 字）。",
    details: structuredClone(checkContent.errors),
  };
  const mediaResult = validateMediaSrc(content.media.src);
  if (!mediaResult.valid) return mediaResult;
  return {valid: true};
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!ACCENTS[result]) throw new Error("未知主题。");
  return result;
}

export function assertEvidenceMediaCardProps({content, position, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, surface, theme}) || !ACCENTS[theme]) throw new Error("证据媒体卡的位置、底色或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 1)) throw new Error("证据媒体卡至少显示 1 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  if (SOURCE_GEOMETRY.enterMs > (durationInFrames / fps) * 1000 + 0.5) {
    throw new Error(`卡片入场需要 ${(SOURCE_GEOMETRY.enterMs / 1000).toFixed(2)} 秒，超出组件时长；请加长组件。`);
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
    throw new Error("证据媒体卡样板支持 24/25/30/60 fps，时长 1–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个证据媒体卡组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertEvidenceMediaCardProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

// Synthetic test content. The media path points at this component's own fixture,
// which the QA script serves as publicDir; no user media and no network is involved.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", position = "CENTER", surface = "DARK", instanceTheme = "SOURCE",
  src = "evidence-page.svg", kind = "IMAGE", frameKind = "WIDE",
  title = "结构示意与来源", caption = "合成测试页 · 非真实论文",
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-04c-evidence-media-card-sample", aspectRatio, theme, shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
          instanceId: "sample-evidence-media-card-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {size: 1, positionOffset: {x: 0.5, y: 0.5},
            content: {
              title,
              media: {kind, src, frame: frameKind, ...(caption ? {caption} : {})},
              source: {publisher: "合成测试来源", workTitle: "组件验证用示意材料", date: "2026-09", reference: "SYNTH-FIXTURE-001"},
            },
            position, surface, theme: instanceTheme,
          },
          timing: {startFrame, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04c-evidence-media-card-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04c-evidence-media-card-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: Math.round(durationSeconds * fps),
      width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
