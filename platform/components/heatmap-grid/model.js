import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, decimalsOf, totalFillMs} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const ROW_RANGE = {min: 2, max: 6};
export const COLUMN_RANGE = {min: 2, max: 7};
export const VALUE_LIMIT = 1000000000;
export const SIZE_RANGE = {min: 0.8, max: 2};
export {FONT_FAMILY};

// 来源 tokens：heatmap-grid.tsx 的 emptyColor / labelColor（深底舞台）。
// 浅底是适配产物——来源只有深底一档，浅底按同一对比关系给出。
export const SURFACE_TOKENS = {
  DARK: {ink: "#fafafa", muted: "rgba(250, 250, 250, 0.50)", empty: "rgba(250, 250, 250, 0.07)"},
  LIGHT: {ink: "#1a2540", muted: "rgba(26, 37, 64, 0.60)", empty: "rgba(26, 37, 64, 0.08)"},
};

// 色阶顶色：SOURCE 就是来源 color(#e8b86d)；其余四套是项目主题。
// 五套主色互不相同——配色像素取证依赖这一点（本组件只用一个颜色）。
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
    content: {$ref: "HeatmapGridContent"},
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
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 2–6 行、每行 2–7 个非负数值（最多 2 位小数）；行标签 ≤6 字、列标签 ≤3 字、量程上限与图例开关可留空。",
    details: structuredClone(checkContent.errors),
  };
  const rowCount = content.cells.length;
  const columnCount = content.cells[0].length;
  // 来源允许参差不齐的行（短行按空格子补齐）；那会让「列」的语义含糊，这里要求矩形网格。
  const ragged = content.cells.find(row => row.length !== columnCount);
  if (ragged) return {
    valid: false,
    message: `每一行的格子数要一致：第一行有 ${columnCount} 个，有一行只有 ${ragged.length} 个。参差不齐的网格会让「列」失去意义。`,
  };
  for (const row of content.cells) for (const value of row) {
    if (decimalsOf(value) === null) return {
      valid: false,
      message: `数值 ${value} 最多保留 2 位小数；更精确的数值请先自行取整。`,
    };
  }
  if (!content.cells.some(row => row.some(value => value > 0))) {
    return {valid: false, message: "至少有一个格子要大于 0，否则热力图整片是空格子。"};
  }
  if (content.rowLabels && content.rowLabels.length !== rowCount) return {
    valid: false,
    message: `行标签有 ${content.rowLabels.length} 个，但网格有 ${rowCount} 行：每行一个标签，多一个少一个都会错位。`,
  };
  if (content.columnLabels && content.columnLabels.length !== columnCount) return {
    valid: false,
    message: `列标签有 ${content.columnLabels.length} 个，但网格有 ${columnCount} 列：每列一个标签，多一个少一个都会错位。`,
  };
  const peak = Math.max(...content.cells.flat());
  if (content.maxValue !== undefined && peak > content.maxValue) return {
    valid: false,
    message: `最大值 ${peak} 超过设定的色阶上限 ${content.maxValue}：来源会把强度裁到 1，热力图就看不出高低差。请调大 maxValue 或改数值。`,
  };
  return {valid: true};
}

export function assertHeatmapGridProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !ACCENTS[theme]) {
    throw new Error(`组件位置、大小、底色或主题超出支持范围（大小 ${SIZE_RANGE.min}–${SIZE_RANGE.max}×，主题须为项目主题或四套预设）。`);
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("热力图至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = totalFillMs(content.cells.length, content.cells[0].length);
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`右下角最后一格要到 ${(endMs / 1000).toFixed(1)} 秒才填满，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请减少行列或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个热力图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.8–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便波前扫过整张网格。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertHeatmapGridProps({
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

// Synthetic, non-factual grid. Does not read or send the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-heatmap-grid-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-heatmap-grid-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: content ?? {
            cells: [
              [1, 3, 6, 8, 4, 2],
              [2, 5, 9, 7, 5, 3],
              [0, 2, 4, 9, 3, 1],
              [1, 1, 3, 5, 2, 0],
            ],
            rowLabels: ["周一", "周二", "周三", "周四"],
            columnLabels: ["9", "10", "11", "12", "13", "14"],
            showLegend: true,
          },
          position: {...position}, size, surface, theme: instanceTheme,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-heatmap-grid-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-heatmap-grid-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = {cellSize: 34, gap: 8, cornerRadius: 8, fillMs: 467, columnStaggerMs: 100, rowStaggerMs: 50};
export const SOURCE_TIMING = Object.freeze({fillMs: 467, columnStaggerMs: 100, rowStaggerMs: 50});
