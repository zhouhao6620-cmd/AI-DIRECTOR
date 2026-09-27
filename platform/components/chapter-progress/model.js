import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const VARIANTS = ["FILL", "LINE"];
export const SURFACES = ["DARK", "LIGHT"];
export {FONT_FAMILY};

// Source tokens: hud.css `.stage[data-theme]` (dark / light) and accent.ts ACCENT_VAR.
export const SURFACE_TOKENS = {
  DARK: {node: "#12121a", barAlpha: 0.88, ink: "#ffffff", muted: "rgba(255,255,255,0.70)", faint: "rgba(255,255,255,0.44)", rule: "rgba(255,255,255,0.22)"},
  LIGHT: {node: "#ece6e0", barAlpha: 0.88, ink: "#1a2540", muted: "rgba(26,37,64,0.66)", faint: "rgba(26,37,64,0.42)", rule: "rgba(255,255,255,0.85)"},
};
export const ACCENTS = {
  SOURCE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  BLUE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  ORANGE: {DARK: "#f0a24f", LIGHT: "#d97a1c"},
  RED: {DARK: "#e88686", LIGHT: "#cf5555"},
  PURPLE: {DARK: "#8f86ea", LIGHT: "#6353d6"},
};
// Source default `progAlpha: 0.25`.
export const PROGRESS_ALPHA = 0.25;

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "variant", "showProgress", "surface", "theme"],
  properties: {
    content: {$ref: "ChapterProgressContent"},
    variant: {enum: VARIANTS},
    showProgress: {type: "boolean"},
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
    message: "请填写 2–8 个章节，每个章节需要有效 ID、1–16 字名称和 startMs / endMs 真实区间。",
    details: structuredClone(checkContent.errors),
  };
  const chapters = content.chapters;
  if (new Set(chapters.map(chapter => chapter.id)).size !== chapters.length) return {valid: false, message: "章节 ID 不能重复。"};
  for (const [index, chapter] of chapters.entries()) {
    if (chapter.endMs <= chapter.startMs) return {valid: false, message: `第 ${index + 1} 章的结束时间必须晚于开始时间。`};
    if (index > 0 && chapter.startMs < chapters[index - 1].endMs) return {valid: false, message: `第 ${index + 1} 章与上一章的区间重叠，请按真实时间轴重新划分。`};
  }
  return {valid: true};
}

export function durationMsOf({durationInFrames, fps}) {
  return (durationInFrames / fps) * 1000;
}

export function assertChapterProgressProps({content, variant, showProgress, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, variant, showProgress, surface, theme}) || !ACCENTS[theme]) throw new Error("组件变体、底色或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("章节进度条至少覆盖 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const durationMs = durationMsOf({durationInFrames, fps});
  const last = content.chapters.at(-1);
  if (last.endMs > durationMs + 0.5) throw new Error("章节区间不能超出视频总时长；请按真实时间轴重新划分。");
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps * 3 || meta.durationInFrames > meta.fps * 60) {
    throw new Error("章节进度条样板支持 24/25/30/60 fps，时长 3–60 秒。");
  }
  if (state.product.shots.length || state.product.globalPackaging.length !== 1) {
    throw new Error("章节进度条是全局包装层：样板只接受一个全局实例，不接受镜头组件。");
  }
  const instance = state.product.globalPackaging[0];
  if (instance.componentId !== COMPONENT_ID) throw new Error("全局实例的组件 ID 与章节进度条不一致。");
  if (instance.timing.startFrame !== 0 || instance.timing.durationInFrames !== meta.durationInFrames) {
    throw new Error("全局包装实例必须覆盖整片：startFrame 为 0，时长等于视频总时长。");
  }
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  assertChapterProgressProps({
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

// Synthetic, non-factual chapter labels. Chapter intervals are real intervals of
// the sample timeline: they are derived from the actual duration, not hardcoded
// render-time examples.
export function createSampleState({
  aspectRatio = "9:16", count = 4, theme = "BLUE", variant = "FILL",
  surface = "DARK", instanceTheme = "SOURCE", durationSeconds = 12, fps = 30, showProgress = true,
} = {}) {
  const durationInFrames = Math.round(durationSeconds * fps);
  const durationMs = durationMsOf({durationInFrames, fps});
  const labels = ["开场说明", "问题背景", "解决过程", "结果回顾", "补充说明", "边界条件", "验证方式", "记录归档"];
  const chapters = Array.from({length: count}, (_, index) => ({
    id: `chapter-${index + 1}`,
    label: labels[index],
    startMs: Math.round((durationMs * index) / count),
    endMs: Math.round((durationMs * (index + 1)) / count),
  }));
  return {
    product: {
      projectId: "cmp-03-chapter-progress-sample", aspectRatio, theme,
      shots: [],
      globalPackaging: [{
        instanceId: "sample-chapter-progress-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {size: 1, position: {x: 0.5, y: 0.5}, content: {chapters}, variant, showProgress, surface, theme: instanceTheme},
        timing: {startFrame: 0, durationInFrames},
      }],
    },
    technical: {
      stateId: "cmp-03-chapter-progress-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-03-chapter-progress-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames, width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
