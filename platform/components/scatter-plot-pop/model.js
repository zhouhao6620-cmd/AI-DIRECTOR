import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {
  FONT_FAMILY, POINT_RANGE, SOURCE_GEOMETRY, SOURCE_MOTION, VALUE_LIMIT, decimalsOf,
} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export {FONT_FAMILY, POINT_RANGE, VALUE_LIMIT};

// 色板与气泡图同源同口径：SOURCE = 来源原色，四套主题取各自色板（本组件只用第 1 位作为点色）。
// 五套色板之间任意两色的同通道色差都 > 24；墨色 × 色板的混色线到其他主题色的最小距离是 14.9，
// 因此 QA 用容差 6 做像素取证：命中自己的颜色、其他主题命中为 0。
export const PALETTES = {
  SOURCE: ["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b"],
  BLUE: ["#5fa0fa", "#38bdf8", "#6d8cf5", "#22d3ee", "#93c5fd"],
  ORANGE: ["#ef9a3d", "#fb923c", "#c2410c", "#fbbf24", "#f97316"],
  RED: ["#e88686", "#ef4444", "#f43f5e", "#fb7185", "#dc2626"],
  PURPLE: ["#a855f7", "#c084fc", "#7c3aed", "#d8b4fe", "#a78bfa"],
};

// 来源：gridColor rgba(250,250,250,0.10)、labelColor rgba(250,250,250,0.52)、trendColor rgba(250,250,250,0.42)。
export const SURFACE_TOKENS = {
  DARK: {grid: "rgba(250, 250, 250, 0.10)", label: "rgba(250, 250, 250, 0.52)", trend: "rgba(250, 250, 250, 0.42)"},
  LIGHT: {grid: "rgba(26, 37, 64, 0.14)", label: "rgba(26, 37, 64, 0.66)", trend: "rgba(26, 37, 64, 0.50)"},
};

export const DOT_OPACITY = SOURCE_GEOMETRY.dotOpacity;
export const GLOW_OPACITY = SOURCE_GEOMETRY.glowOpacity;

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "ScatterPlotPopContent"},
    position: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y"],
      properties: {x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1}},
    },
    size: {type: "number", minimum: SOURCE_MOTION.sizeRange.min, maximum: SOURCE_MOTION.sizeRange.max},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(PALETTES)]},
  },
};
const instanceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["instanceId", "componentId", "version", "props", "timing"],
  properties: {
    instanceId: {type: "string", minLength: 1},
    componentId: {const: COMPONENT_ID},
    version: {const: COMPONENT_VERSION},
    props: propsSchema,
    timing: {
      type: "object",
      additionalProperties: false,
      required: ["startFrame", "durationInFrames"],
      properties: {
        startFrame: {type: "integer", minimum: 0},
        durationInFrames: {type: "integer", minimum: 1},
      },
    },
  },
};
const checkInstance = ajv.compile(instanceSchema);
const checkProps = ajv.compile(propsSchema);

export function validateContent(content) {
  if (!checkContent(content)) {
    return {
      valid: false,
      message: "请填写 3–12 个散点（每个需要稳定 ID、x 与 y 两个数值）。轴标题可留空。",
      details: structuredClone(checkContent.errors),
    };
  }
  if (new Set(content.points.map((point) => point.id)).size !== content.points.length) {
    return {valid: false, message: "散点 ID 不能重复。"};
  }
  for (const point of content.points) {
    if (decimalsOf(point.x) === null || decimalsOf(point.y) === null) {
      return {valid: false, message: `散点「${point.id}」的 x / y 最多保留 2 位小数；更精确的数值请先自行取整。`};
    }
  }
  // x 全部相同会让散点退化成一条竖线，趋势线也没有意义（来源会画成一条压扁的线）。
  if (new Set(content.points.map((point) => point.x)).size < 2) {
    return {valid: false, message: "散点的 x 值不能全部相同，否则横轴没有跨度、趋势线也没有意义。"};
  }
  return {valid: true};
}

export function assertScatterPlotPopProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !PALETTES[theme]) {
    throw new Error("组件位置、大小、底色或主题超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * SOURCE_MOTION.minDurationSeconds)) {
    throw new Error("散点图至少显示 3 秒。");
  }
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) {
    throw new Error("组件样板只支持已验证的横竖画幅。");
  }
  // 来源的入场窗口 + 趋势线窗口：最后一点落定后 26 帧内画出趋势线。
  const lastStart = (content.points.length - 1) * SOURCE_MOTION.staggerFrames;
  const entranceFrames = Math.ceil(lastStart + SOURCE_MOTION.unitFrames * SOURCE_GEOMETRY.trendDelayFactor + SOURCE_GEOMETRY.trendDrawFrames);
  if (entranceFrames > durationInFrames) {
    throw new Error(
      `散点与趋势线要到第 ${entranceFrames} 帧（约 ${(entranceFrames / fps).toFixed(1)} 秒）才画完，超过当前显示时长 ${(durationInFrames / fps).toFixed(1)} 秒。请减少散点或延长显示时长。`,
    );
  }
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames > meta.fps * 30) {
    throw new Error("样板支持 24/25/30/60 fps，最长 30 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个散点图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) {
    throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  }
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) {
    throw new Error(
      "组件参数超出范围：位置 0–1，大小 0.65–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors),
    );
  }
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * SOURCE_MOTION.minDurationSeconds)) {
    throw new Error("组件至少显示 3 秒，以便散点与趋势线画完。");
  }
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) {
    throw new Error("组件结束时间不能超出样板总时长。");
  }
  if (instance.timing.startFrame > 110 || instance.timing.startFrame + instance.timing.durationInFrames <= 170) {
    throw new Error("样例实例必须覆盖实验页巡检帧（第 110 与 170 帧）。");
  }
  assertScatterPlotPopProps(
    {
      ...instance.props,
      theme: resolveTheme(state.product.theme, instance.props.theme),
      durationInFrames: instance.timing.durationInFrames,
    },
    meta,
  );
  return state;
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!PALETTES[result]) throw new Error("未知主题。");
  return result;
}

/** 该主题会用到的全部颜色（QA 反证用：其他主题的色板不得出现）。 */
export function themeColors(theme) {
  return [...PALETTES[theme]];
}

/** 本组件实际会画的主题色（只有点色一位）。 */
export function themeUsedColors(theme) {
  return [PALETTES[theme][0]];
}

// 合成样例（不读取、不发送用户的视频或字幕）。
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0.5, y: 0.5}, points = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-scatter-plot-sample",
      aspectRatio,
      theme,
      shots: [{
        directorShotId: "sample-shot-01",
        characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-scatter-plot-01",
          componentId: COMPONENT_ID,
          version: COMPONENT_VERSION,
          props: {
            content: {
              points: points ?? [
                {id: "point-1", x: 38, y: 12, weight: 1.2},
                {id: "point-2", x: 52, y: 18, weight: 1},
                {id: "point-3", x: 64, y: 22, weight: 1.6},
                {id: "point-4", x: 75, y: 26, weight: 0.8},
                {id: "point-5", x: 88, y: 31, weight: 1.1},
                {id: "point-6", x: 96, y: 38, weight: 1.4},
              ],
              xLabel: "客单价（元）",
              yLabel: "复购率（%）",
            },
            position: {...position},
            size,
            surface,
            theme: instanceTheme,
          },
          timing: {startFrame, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-scatter-plot-state",
      schemaVersion: "1.0.0",
      lifecycle: "DRAFT",
      revision: "cmp-06-scatter-plot-sample-v1",
      directorPlanVersion: "synthetic-no-director-plan",
      fps,
      durationInFrames: durationSeconds * fps,
      width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
