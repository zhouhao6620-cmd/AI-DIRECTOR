import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_BAR_INK, SOURCE_GEOMETRY, SOURCE_MOTION, SOURCE_PALETTE, fallbackMeasure} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const SERIES_RANGE = {min: contentSchema.properties.series.minItems, max: contentSchema.properties.series.maxItems};
export const STEP_RANGE = {min: contentSchema.properties.steps.minItems, max: contentSchema.properties.steps.maxItems};
export const STEP_MS_RANGE = SOURCE_MOTION.stepMsRange;
export const VALUE_LIMIT = contentSchema.properties.series.items.properties.values.items.maximum;
export const TITLE_MAX_LENGTH = contentSchema.properties.title.maxLength;
export const SERIES_LABEL_MAX_LENGTH = contentSchema.properties.series.items.properties.label.maxLength;
export const STEP_MAX_LENGTH = contentSchema.properties.steps.items.maxLength;
export const UNIT_MAX_LENGTH = contentSchema.properties.unit.maxLength;
export const CAPTION_MAX_LENGTH = contentSchema.properties.caption.maxLength;
export {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, SOURCE_PALETTE, SOURCE_BAR_INK};

// Source surfaces (registry/bases/default/primitives/bar-chart-race.tsx):
//   inkColor #fafafa · labelColor rgba(250,250,250,0.55) · bar text #0b0b10 (hardcoded in the source)
export const SURFACE_TOKENS = {
  DARK: {ink: "#fafafa", label: "rgba(250, 250, 250, 0.55)", barInk: SOURCE_BAR_INK},
  LIGHT: {ink: "#12131a", label: "rgba(18, 19, 26, 0.62)", barInk: "#ffffff"},
};

/** SOURCE is the source's own DEFAULT_COLORS array, verbatim and in order. */
export const SERIES_PALETTES = {
  SOURCE: {DARK: [...SOURCE_PALETTE], LIGHT: ["#b9843a", "#0f9c8c", "#cf4f96", "#5b5bd6", "#c07a09", "#12a89a"]},
  BLUE: {
    DARK: ["#5fa0fa", "#7fb8ff", "#3f86e6", "#a9d0ff", "#2f6fd0", "#cfe4ff"],
    LIGHT: ["#1e63d8", "#3b82f6", "#0f4fbb", "#60a5fa", "#0b3f96", "#93c5fd"],
  },
  ORANGE: {
    DARK: ["#f0a24f", "#f6c177", "#dd8536", "#ffd9a8", "#c26f22", "#ffe9cd"],
    LIGHT: ["#d97a1c", "#ea9a3c", "#b96311", "#f2b463", "#96500b", "#f8d1a0"],
  },
  RED: {
    DARK: ["#e88686", "#f0a3a3", "#d46666", "#ffc4c4", "#bb4f4f", "#ffdede"],
    LIGHT: ["#cf5555", "#df7070", "#b53f3f", "#ef9494", "#8f2f2f", "#f7c0c0"],
  },
  PURPLE: {
    DARK: ["#8f86ea", "#a8a1f0", "#736ecb", "#c7c2f7", "#5c56b0", "#e0ddfb"],
    LIGHT: ["#6353d6", "#7b6ce0", "#4c3fbd", "#9a8ee9", "#3a2f96", "#c1b8f5"],
  },
};

export const ACCENTS = Object.fromEntries(Object.entries(SERIES_PALETTES).map(([theme, surfaces]) => [theme, {
  DARK: surfaces.DARK[0], LIGHT: surfaces.LIGHT[0],
}]));

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme", "stepMs"],
  properties: {
    content: {$ref: "BarChartRaceContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.4, maximum: 2},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(SERIES_PALETTES)]},
    stepMs: {type: "integer", minimum: STEP_MS_RANGE.min, maximum: STEP_MS_RANGE.max},
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
    message: `请填写 ${STEP_RANGE.min}–${STEP_RANGE.max} 个时间点（每个 1–${STEP_MAX_LENGTH} 字，例如年份）与 ${SERIES_RANGE.min}–${SERIES_RANGE.max} 条系列（每条 1–${SERIES_LABEL_MAX_LENGTH} 字名 + 与时间点同长的 0–1,000,000,000 数值）。标题最多 ${TITLE_MAX_LENGTH} 字，单位最多 ${UNIT_MAX_LENGTH} 字，小注最多 ${CAPTION_MAX_LENGTH} 字。`,
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.series.map(entry => entry.id)).size !== content.series.length) {
    return {valid: false, message: "系列 ID 不能重复。"};
  }
  const mismatched = content.series.filter(entry => entry.values.length !== content.steps.length);
  if (mismatched.length) {
    return {
      valid: false,
      message: `每条系列的数值个数必须和时间点个数一致（当前 ${content.steps.length} 个时间点）：${mismatched.map(entry => entry.label).join("、")} 的数值个数不符。`,
    };
  }
  return {valid: true};
}

/** The race has to reach its last keyframe inside the instance, otherwise the standings never hold. */
export function motionEndMs({content, stepMs}) {
  return Math.max(0, content.steps.length - 1) * stepMs;
}

export function assertBarChartRaceProps({content, position, size, surface, theme, stepMs, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme, stepMs}) || !SERIES_PALETTES[theme]) {
    throw new Error("组件位置、大小、底色、主题或每帧时长超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("柱状竞速图至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = motionEndMs({content, stepMs}) + 400;
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`竞速要到 ${(endMs / 1000).toFixed(1)} 秒才走完最后一个时间点，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请缩短每帧时长、减少时间点或延长显示时长。`);
  }
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames > meta.fps * 30) throw new Error("样板支持 24/25/30/60 fps，最长 30 秒。");
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个柱状竞速图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.4–2，每帧时长 200–2000 ms，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便竞速走完。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertBarChartRaceProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!SERIES_PALETTES[result]) throw new Error("未知主题。");
  return result;
}

export function paletteOf(theme, surface = "DARK") {
  return SERIES_PALETTES[resolveTheme("BLUE", theme)][surface];
}

export function accentOf(theme, surface = "DARK") {
  return paletteOf(theme, surface)[0];
}

/** Synthetic, non-factual standings. Does not read or send the user's video or subtitles. */
export function createContent({
  title = "本机合成样例", unit = "万", caption = "数值来自本机合成样例",
  steps = ["2021", "2022", "2023", "2024", "2025"],
  series = [
    {id: "series-1", label: "甲方案", values: [42, 48, 55, 61, 70]},
    {id: "series-2", label: "乙方案", values: [51, 57, 60, 66, 68]},
    {id: "series-3", label: "丙方案", values: [30, 38, 49, 58, 64]},
    {id: "series-4", label: "丁方案", values: [22, 26, 31, 36, 41]},
  ],
} = {}) {
  return {
    title, unit, caption, steps: [...steps],
    series: series.map(entry => ({...entry, values: [...entry.values]})),
  };
}

export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null, stepMs = SOURCE_MOTION.defaultStepMs,
  durationSeconds = 8, fps = 30, startFrame = 0, durationInFrames = 240,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-bar-chart-race-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-bar-chart-race-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {content: content ?? createContent(), position: {...position}, size, surface, theme: instanceTheme, stepMs},
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-bar-chart-race-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-bar-chart-race-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
export {fallbackMeasure};
