import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, decimalsOf, totalReachMs} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const AXIS_RANGE = {min: 3, max: 6};
export const SERIES_RANGE = {min: 1, max: 3};
export const VALUE_LIMIT = 1000000000;
export const SIZE_RANGE = {min: 0.6, max: 2};
export {FONT_FAMILY};

// 来源 tokens：radar-chart.tsx 的 gridColor / labelColor（深底舞台）。
// 浅底是适配产物——来源只有深底一档，浅底按同一对比关系给出。
export const SURFACE_TOKENS = {
  DARK: {ink: "#fafafa", muted: "rgba(250, 250, 250, 0.60)", grid: "rgba(250, 250, 250, 0.14)"},
  LIGHT: {ink: "#1a2540", muted: "rgba(26, 37, 64, 0.64)", grid: "rgba(26, 37, 64, 0.16)"},
};

// series 配色：SOURCE 就是来源 DEFAULT_COLORS（琥珀 · 青 · 粉）；
// 其余四套是项目主题。不变量：任何主题的非首位颜色都不得等于其它主题的主色（像素取证依赖它）。
export const SERIES = {
  SOURCE: {
    DARK: ["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b", "#4ade80"],
    LIGHT: ["#a1691a", "#0f8f84", "#c2407f", "#5142d0", "#b4690a", "#1f7a4d"],
  },
  BLUE: {
    DARK: ["#5fa0fa", "#7fd4f5", "#a5b4fc", "#38bdf8", "#4dd0e1", "#93c5fd"],
    LIGHT: ["#1e63d8", "#0f86b8", "#4f46e5", "#0369a1", "#0d7c8a", "#3b82f6"],
  },
  ORANGE: {
    DARK: ["#f0a24f", "#f8d477", "#e8865d", "#fbbf24", "#f5a3b8", "#e0b04a"],
    LIGHT: ["#d97a1c", "#b58a10", "#c25a24", "#a16207", "#c2407f", "#a5751a"],
  },
  RED: {
    DARK: ["#e88686", "#f4a4a4", "#c96b52", "#d97a9a", "#f5b3c4", "#b03a3a"],
    LIGHT: ["#cf5555", "#b03a3a", "#a8482c", "#a93a63", "#c2407f", "#d97a9a"],
  },
  PURPLE: {
    DARK: ["#8f86ea", "#b4a8f5", "#e8a0e0", "#c4b5fd", "#a78bfa", "#7c5cd6"],
    LIGHT: ["#6353d6", "#8a7ae0", "#b055c0", "#7c5cd6", "#6d28d9", "#0f86b8"],
  },
};

export const PALETTE_INVARIANT = "每个主题的 series 配色（第 2 位起）不得等于任何主题的主色（第 1 位）。";

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "RadarChartContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: SIZE_RANGE.min, maximum: SIZE_RANGE.max},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(SERIES)]},
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

export function seriesOf(theme = "SOURCE", surface = "DARK") {
  const palette = SERIES[theme]?.[surface];
  if (!palette) throw new Error("未知主题或底色。");
  return palette;
}

export function primaryOf(theme = "SOURCE", surface = "DARK") {
  return seriesOf(theme, surface)[0];
}

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 3–6 根轴（每根 1–6 字）与 1–3 组数据（每组一个稳定 ID、1–10 字名称、与轴数等长的数值）。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.series.map(entry => entry.id)).size !== content.series.length) {
    return {valid: false, message: "数据组 ID 不能重复。"};
  }
  for (const entry of content.series) {
    if (entry.values.length !== content.axes.length) return {
      valid: false,
      message: `「${entry.label}」有 ${entry.values.length} 个数值，但轴有 ${content.axes.length} 根：每根轴都要有一个值，否则多边形会缺角。`,
    };
    for (const value of entry.values) {
      if (decimalsOf(value) === null) return {
        valid: false,
        message: `「${entry.label}」的数值最多保留 2 位小数；更精确的数值请先自行取整。`,
      };
    }
  }
  const peak = Math.max(...content.series.flatMap(entry => entry.values));
  if (content.maxValue !== undefined && peak > content.maxValue) return {
    valid: false,
    message: `最大值 ${peak} 超过设定的量程上限 ${content.maxValue}：来源会把多边形画到外圈之外，这里直接拒绝。请调大 maxValue 或改数值。`,
  };
  return {valid: true};
}

export function assertRadarChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !SERIES[theme]) {
    throw new Error(`组件位置、大小、底色或主题超出支持范围（大小 ${SIZE_RANGE.min}–${SIZE_RANGE.max}×，主题须为项目主题或四套预设）。`);
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("雷达图至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = totalReachMs(content.series.length, content.axes.length);
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`最后一根轴要到 ${(endMs / 1000).toFixed(1)} 秒才伸到位，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请减少轴数 / 数据组或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个雷达图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.6–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便每根轴都伸到位。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertRadarChartProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!SERIES[result]) throw new Error("未知主题。");
  return result;
}

// Synthetic, non-factual series. Does not read or send the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-radar-chart-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-radar-chart-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: content ?? {
            axes: ["覆盖", "稳定", "速度", "成本", "质量"],
            series: [
              {id: "series-1", label: "本季", values: [82, 74, 64, 58, 91]},
              {id: "series-2", label: "上季", values: [70, 66, 58, 52, 80]},
            ],
          },
          position: {...position}, size, surface, theme: instanceTheme,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-radar-chart-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-radar-chart-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = {webSize: 420, ringCount: 4, fillOpacity: 0.22};
export const SOURCE_TIMING = Object.freeze({reachMs: 600, axisStaggerMs: 167, seriesOffsetMs: 333, seriesBaseDelayMs: 267, webFadeMs: 400});
