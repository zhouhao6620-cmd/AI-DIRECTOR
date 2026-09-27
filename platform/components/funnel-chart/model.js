import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_MOTION, decimalsOf, totalWipeMs} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const STAGE_RANGE = {min: 2, max: 5};
export const VALUE_LIMIT = 1000000000;
export const SIZE_RANGE = {min: 0.6, max: 2};
export {FONT_FAMILY};

// 来源 tokens：funnel-chart.tsx 的 inkColor / labelColor / dropoffColor（深底舞台）。
// 浅底是适配产物——来源只有深底一档，浅底按同一对比关系给出。
export const SURFACE_TOKENS = {
  DARK: {ink: "#fafafa", muted: "rgba(250, 250, 250, 0.55)", grid: "rgba(250, 250, 250, 0.14)"},
  LIGHT: {ink: "#1a2540", muted: "rgba(26, 37, 64, 0.62)", grid: "rgba(26, 37, 64, 0.16)"},
};

// 阶段配色：SOURCE 就是来源 color(#e8b86d) 与 dropoffColor(#f472b6)；
// 其余四套是项目主题（第 3 位就是环比色）。不变量：非首位颜色不得等于其它主题主色。
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

export const PALETTE_INVARIANT = "每个主题的配色（第 2 位起）不得等于任何主题的主色（第 1 位）。";

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "FunnelChartContent"},
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

export function dropoffColorOf(theme = "SOURCE", surface = "DARK") {
  return seriesOf(theme, surface)[2];
}

export function stageColor(theme, surface, stage, index) {
  return stage.color ?? seriesOf(theme, surface)[index % seriesOf(theme, surface).length];
}

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 2–5 个阶段（每段需要稳定 ID、1–8 字名称与 0–1,000,000,000 以内的数值）；单位与两个开关可留空。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.stages.map(stage => stage.id)).size !== content.stages.length) {
    return {valid: false, message: "阶段 ID 不能重复。"};
  }
  for (const stage of content.stages) {
    if (decimalsOf(stage.value) === null) return {
      valid: false,
      message: `「${stage.label}」的数值最多保留 2 位小数；更精确的数值请先自行取整。`,
    };
  }
  if (!content.stages.some(stage => stage.value > 0)) {
    return {valid: false, message: "至少有一个阶段的数值要大于 0，否则漏斗没有可读的收窄比例。"};
  }
  return {valid: true};
}

export function assertFunnelChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !SERIES[theme]) {
    throw new Error(`组件位置、大小、底色或主题超出支持范围（大小 ${SIZE_RANGE.min}–${SIZE_RANGE.max}×，主题须为项目主题或四套预设）。`);
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("漏斗图至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = totalWipeMs(content.stages.length);
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`最后一段要到 ${(endMs / 1000).toFixed(1)} 秒才擦完（含环比淡入），超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请减少阶段或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个漏斗图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.6–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便每段都擦到位。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertFunnelChartProps({
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

// Synthetic, non-factual funnel. Does not read or send the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-funnel-chart-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-funnel-chart-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: content ?? {
            stages: [
              {id: "stage-1", label: "曝光", value: 128000},
              {id: "stage-2", label: "点击", value: 42600},
              {id: "stage-3", label: "加购", value: 15800},
              {id: "stage-4", label: "下单", value: 5200},
            ],
            unit: "次",
            showDropoff: true,
            showConversion: false,
          },
          position: {...position}, size, surface, theme: instanceTheme,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-funnel-chart-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-funnel-chart-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = {chartWidth: 820, chartHeight: 420, bandGap: 10, tailOpacity: 0.5};
export const SOURCE_TIMING = SOURCE_MOTION;
