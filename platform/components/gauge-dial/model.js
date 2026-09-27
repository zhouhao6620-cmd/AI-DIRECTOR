import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, decimalsOf} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const VALUE_LIMIT = 1000000000;
export const SIZE_RANGE = {min: 0.7, max: 2};
export const TICK_RANGE = {min: 0, max: SOURCE_GEOMETRY.maxTickCount, illegal: 1};
export const DEFAULT_RANGE = {min: 0, max: 100};
export {FONT_FAMILY};

// 来源 tokens：gauge-dial.tsx 的 trackColor / inkColor / labelColor（深底舞台）。
// 浅底是适配产物——来源只有深底一档，浅底按同一对比关系给出。
export const SURFACE_TOKENS = {
  DARK: {ink: "#fafafa", muted: "rgba(250, 250, 250, 0.58)", track: "rgba(250, 250, 250, 0.10)"},
  LIGHT: {ink: "#1a2540", muted: "rgba(26, 37, 64, 0.62)", track: "rgba(26, 37, 64, 0.12)"},
};

// 单值组件的强调色：SOURCE 就是来源 color(#e8b86d) 与来源 DEFAULT_COLORS 的首色；
// 其余四套是项目主题。五套主色互不相同——配色像素取证依赖这一点。
export const ACCENTS = {
  SOURCE: {DARK: "#e8b86d", LIGHT: "#a1691a"},
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
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "GaugeDialContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: SIZE_RANGE.min, maximum: SIZE_RANGE.max},
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

export function accentOf(theme = "SOURCE", surface = "DARK") {
  const colour = ACCENTS[theme]?.[surface];
  if (!colour) throw new Error("未知主题或底色。");
  return colour;
}

export function validateContent(content) {
  // 先单独拦 tickCount = 1：来源用 `index / (tickCount − 1)` 定位刻度，1 会让所有刻度变成 NaN，
  // 而 schema 的 `not` 只会说「格式不对」，说不清原因。
  if (content?.tickCount === TICK_RANGE.illegal) return {
    valid: false,
    message: "刻度数不能是 1：来源用 index / (tickCount − 1) 定位刻度，1 会让所有刻度变成 NaN（坐标无效）。请写 0（不画刻度）或 2–12。",
  };
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写量程范围内的目标值（min / max 可选，默认 0–100）；单位 ≤6 字、标签 ≤12 字、刻度数可为 0 或 2–12。",
    details: structuredClone(checkContent.errors),
  };
  const min = content.min ?? DEFAULT_RANGE.min;
  const max = content.max ?? DEFAULT_RANGE.max;
  if (!(max > min)) return {valid: false, message: `量程需要 max（${max}）大于 min（${min}）。`};
  if (content.value < min || content.value > max) return {
    valid: false,
    message: `目标值 ${content.value} 不在量程 ${min}–${max} 内。来源会把越界值裁到端点，掩盖错误；这里直接拒绝，请改数值或改量程。`,
  };
  for (const [name, value] of [["min", min], ["max", max], ["value", content.value]]) {
    if (decimalsOf(value) === null) return {
      valid: false,
      message: `「${name}」最多保留 2 位小数（当前 ${value}）；更精确的数值请先自行取整。`,
    };
  }
  return {valid: true};
}

export function assertGaugeDialProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !ACCENTS[theme]) {
    throw new Error(`组件位置、大小、底色或主题超出支持范围（大小 ${SIZE_RANGE.min}–${SIZE_RANGE.max}×，主题须为项目主题或四套预设）。`);
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("仪表盘至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = SOURCE_MOTION.sweepMs;
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`指针与弧要到 ${(endMs / 1000).toFixed(1)} 秒才走完，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个仪表盘组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.7–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便指针走到目标。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertGaugeDialProps({
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

// Synthetic, non-factual metric. Does not read or send the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-gauge-dial-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-gauge-dial-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: content ?? {value: 72, min: 0, max: 100, unit: "%", label: "本机样例达标率"},
          position: {...position}, size, surface, theme: instanceTheme,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-gauge-dial-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-gauge-dial-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
