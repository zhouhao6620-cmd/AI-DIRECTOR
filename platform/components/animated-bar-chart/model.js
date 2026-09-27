import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {
  BAR_SPRING, FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, SOURCE_PALETTE, fallbackMeasure,
} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const BAR_RANGE = {min: contentSchema.properties.bars.minItems, max: contentSchema.properties.bars.maxItems};
export const VALUE_LIMIT = contentSchema.properties.bars.items.properties.value.maximum;
export const TITLE_MAX_LENGTH = contentSchema.properties.title.maxLength;
export const SUBTITLE_MAX_LENGTH = contentSchema.properties.subtitle.maxLength;
export const LABEL_MAX_LENGTH = contentSchema.properties.bars.items.properties.label.maxLength;
export const DELTA_MAX_LENGTH = contentSchema.properties.bars.items.properties.delta.maxLength;
export const UNIT_MAX_LENGTH = contentSchema.properties.unit.maxLength;
export const CAPTION_MAX_LENGTH = contentSchema.properties.caption.maxLength;
export {BAR_SPRING, FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, SOURCE_PALETTE};

// Source surfaces (registry/bases/default/scenes/animated-bar-chart/index.tsx COLORS):
//   label rgba(250,250,250,0.62) · axis rgba(250,250,250,0.42) · grid rgba(250,250,250,0.08)
//   track rgba(250,250,250,0.05) · ink #fafafa · bar #2dd4bf · accent #e8b86d · up #2dd4bf · down #f87171
//   The source's own plate is #080810; this component is transparent (adaptation 1).
export const SURFACE_TOKENS = {
  DARK: {
    ink: SOURCE_PALETTE.ink, label: SOURCE_PALETTE.label, axis: SOURCE_PALETTE.axis,
    grid: SOURCE_PALETTE.grid, track: SOURCE_PALETTE.track,
  },
  LIGHT: {
    ink: "#12131a", label: "rgba(18, 19, 26, 0.66)", axis: "rgba(18, 19, 26, 0.48)",
    grid: "rgba(18, 19, 26, 0.10)", track: "rgba(18, 19, 26, 0.06)",
  },
};

/** SOURCE keeps the scene palette (bar #2dd4bf, accent #e8b86d). */
export const ACCENTS = {
  SOURCE: {DARK: SOURCE_PALETTE.bar, LIGHT: "#0f9c8c"},
  BLUE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  ORANGE: {DARK: "#f0a24f", LIGHT: "#d97a1c"},
  RED: {DARK: "#e88686", LIGHT: "#cf5555"},
  PURPLE: {DARK: "#8f86ea", LIGHT: "#6353d6"},
};

export const EMPHASIS = {
  SOURCE: {DARK: SOURCE_PALETTE.accent, LIGHT: "#b9843a"},
  BLUE: {DARK: "#a9cbfb", LIGHT: "#4b83d6"},
  ORANGE: {DARK: "#ffd9a8", LIGHT: "#d99a45"},
  RED: {DARK: "#ffc4c4", LIGHT: "#cf7070"},
  PURPLE: {DARK: "#c7c2f7", LIGHT: "#7b6ce0"},
};

// Rise and fall are semantic, not brand: the source hardcodes them in COLORS and changes only the bar
// colour with `accentColor`. The four project themes keep that rule — a gain is a gain in every theme.
const UP_BY_SURFACE = {DARK: SOURCE_PALETTE.up, LIGHT: "#0f9c8c"};
const DOWN_BY_SURFACE = {DARK: SOURCE_PALETTE.down, LIGHT: "#cf4b4b"};
export const UPS = Object.fromEntries(Object.keys(ACCENTS).map(theme => [theme, {...UP_BY_SURFACE}]));
export const DOWNS = Object.fromEntries(Object.keys(ACCENTS).map(theme => [theme, {...DOWN_BY_SURFACE}]));

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "AnimatedBarChartContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.4, maximum: 2},
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
    message: `请填写 ${BAR_RANGE.min}–${BAR_RANGE.max} 个条目（每个需要稳定 ID、1–${LABEL_MAX_LENGTH} 字名和 0–1,000,000,000 的数值）。标题最多 ${TITLE_MAX_LENGTH} 字，副标题最多 ${SUBTITLE_MAX_LENGTH} 字，单位最多 ${UNIT_MAX_LENGTH} 字，幅度最多 ${DELTA_MAX_LENGTH} 字，小注最多 ${CAPTION_MAX_LENGTH} 字。`,
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.bars.map(bar => bar.id)).size !== content.bars.length) {
    return {valid: false, message: "条目 ID 不能重复。"};
  }
  return {valid: true};
}

/** Last row's spring window, in milliseconds: delay = STAGGER.normal × (1 + index). */
export function motionEndMs({content, fps = 30}) {
  const delayFrames = SOURCE_MOTION.rowDelayFrames + Math.max(0, content.bars.length - 1) * SOURCE_MOTION.rowDelayStepFrames;
  return ((delayFrames + SOURCE_MOTION.barSpringSeconds * fps) / fps) * 1000;
}

export function assertAnimatedBarChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !ACCENTS[theme]) {
    throw new Error("组件位置、大小、底色或主题超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("动态柱状图至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = motionEndMs({content, fps}) + 200;
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`最后一条要到 ${(endMs / 1000).toFixed(1)} 秒才长完，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请减少条目或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个动态柱状图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.4–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便每条长完。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertAnimatedBarChartProps({
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

export function accentOf(theme, surface = "DARK") {
  return ACCENTS[resolveTheme("BLUE", theme)][surface];
}

export function emphasisOf(theme, surface = "DARK") {
  return EMPHASIS[resolveTheme("BLUE", theme)][surface];
}

export function upOf(theme, surface = "DARK") {
  return UPS[resolveTheme("BLUE", theme)][surface];
}

export function downOf(theme, surface = "DARK") {
  return DOWNS[resolveTheme("BLUE", theme)][surface];
}

/** Synthetic, non-factual bars. Does not read or send the user's video or subtitles. */
export function createContent({
  title = "本机合成样例", subtitle = "同一条尺上的六个条目", unit = "万",
  caption = "数值来自本机合成样例",
  bars = [
    {id: "bar-1", label: "甲方案", value: 86, delta: "+18%"},
    {id: "bar-2", label: "乙方案", value: 74, delta: "+9%"},
    {id: "bar-3", label: "丙方案", value: 61, delta: "−4%"},
    {id: "bar-4", label: "丁方案", value: 45, delta: "+2%"},
    {id: "bar-5", label: "戊方案", value: 32, delta: "−11%"},
    {id: "bar-6", label: "己方案", value: 21, delta: "+5%"},
  ],
} = {}) {
  return {title, subtitle, unit, caption, bars: bars.map(bar => ({...bar}))};
}

export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null,
  durationSeconds = 8, fps = 30, startFrame = 0, durationInFrames = 240,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-animated-bar-chart-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-animated-bar-chart-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {content: content ?? createContent(), position: {...position}, size, surface, theme: instanceTheme},
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-animated-bar-chart-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-animated-bar-chart-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
export {fallbackMeasure};
