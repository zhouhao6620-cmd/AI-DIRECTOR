import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {
  CANDLE_RANGE, FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, VALUE_LIMIT, decimalsOf, ohlcViolations,
} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export {CANDLE_RANGE, FONT_FAMILY, VALUE_LIMIT};

// 色板与同批图表同源同口径。角色位：涨 = 第 2 位、跌 = 第 3 位、均线 = 第 1 位（与来源的
// #2dd4bf / #f472b6 / #e8b86d 三角色一致）。
export const PALETTES = {
  SOURCE: ["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b"],
  BLUE: ["#5fa0fa", "#38bdf8", "#6d8cf5", "#22d3ee", "#93c5fd"],
  ORANGE: ["#ef9a3d", "#fb923c", "#c2410c", "#fbbf24", "#f97316"],
  RED: ["#e88686", "#ef4444", "#f43f5e", "#fb7185", "#dc2626"],
  PURPLE: ["#a855f7", "#c084fc", "#7c3aed", "#d8b4fe", "#a78bfa"],
};

export const ROLE_INDEX = {average: 0, up: 1, down: 2};

export function candleColor(theme, candle) {
  return candle.rising ? PALETTES[theme][ROLE_INDEX.up] : PALETTES[theme][ROLE_INDEX.down];
}

export const SURFACE_TOKENS = {
  DARK: {grid: "rgba(250, 250, 250, 0.10)", label: "rgba(250, 250, 250, 0.55)"},
  LIGHT: {grid: "rgba(26, 37, 64, 0.14)", label: "rgba(26, 37, 64, 0.68)"},
};

export const LAST_PRICE_INK = "#0b0b10";
export const WICK_OPACITY = SOURCE_GEOMETRY.wickOpacity;
export const AVERAGE_OPACITY = SOURCE_GEOMETRY.averageOpacity;

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "CandlestickChartContent"},
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
      message: "请填写 5–24 根 K 线（每根需要稳定 ID 与 open / high / low / close 四个价格，high 为最高、low 为最低）。均线窗口与单位可留空。",
      details: structuredClone(checkContent.errors),
    };
  }
  if (new Set(content.candles.map((candle) => candle.id)).size !== content.candles.length) {
    return {valid: false, message: "K 线 ID 不能重复。"};
  }
  for (const candle of content.candles) {
    for (const field of ["open", "high", "low", "close"]) {
      if (decimalsOf(candle[field]) === null) {
        return {valid: false, message: `「${candle.id}」的 ${field} 最多保留 2 位小数；更精确的数值请先自行取整。`};
      }
    }
  }
  const violations = ohlcViolations(content.candles);
  if (violations.length) {
    return {valid: false, message: `OHLC 不成立：${violations[0].message}（high 必须是这一段最高价、low 必须是最低价）。`};
  }
  return {valid: true};
}

export function assertCandlestickChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !PALETTES[theme]) {
    throw new Error("组件位置、大小、底色或主题超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * SOURCE_MOTION.minDurationSeconds)) {
    throw new Error("K 线图至少显示 3 秒。");
  }
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) {
    throw new Error("组件样板只支持已验证的横竖画幅。");
  }
  const entranceFrames = (content.candles.length - 1) * SOURCE_MOTION.staggerFrames + SOURCE_MOTION.unitFrames;
  if (entranceFrames > durationInFrames) {
    throw new Error(
      `K 线要到第 ${entranceFrames} 帧（约 ${(entranceFrames / fps).toFixed(1)} 秒）才全部印完，超过当前显示时长 ${(durationInFrames / fps).toFixed(1)} 秒。请减少根数或延长显示时长。`,
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
    throw new Error("当前样板仅支持一个镜头中的一个 K 线图组件，不接受额外组件或全局包装。");
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
    throw new Error("组件至少显示 3 秒。");
  }
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) {
    throw new Error("组件结束时间不能超出样板总时长。");
  }
  if (instance.timing.startFrame > 110 || instance.timing.startFrame + instance.timing.durationInFrames <= 170) {
    throw new Error("样例实例必须覆盖实验页巡检帧（第 110 与 170 帧）。");
  }
  assertCandlestickChartProps(
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

export function themeColors(theme) {
  return [...PALETTES[theme]];
}

/** 本组件实际会画的主题色（涨 / 跌，加上均线——均线只在窗口完整时出现）。 */
export function themeUsedColors(theme, content) {
  const resolved = content.candles.map((candle) => candle.close >= candle.open);
  const used = new Set(resolved.map((rising) => PALETTES[theme][rising ? ROLE_INDEX.up : ROLE_INDEX.down]));
  const windowSize = Number.isInteger(content.averageWindow) ? content.averageWindow : SOURCE_MOTION.defaultAverageWindow;
  if (windowSize > 1 && content.candles.length >= windowSize) used.add(PALETTES[theme][ROLE_INDEX.average]);
  return [...used];
}

// 合成样例（不读取、不发送用户的视频或字幕）。
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0.5, y: 0.5}, candles = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-candlestick-sample",
      aspectRatio,
      theme,
      shots: [{
        directorShotId: "sample-shot-01",
        characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-candlestick-01",
          componentId: COMPONENT_ID,
          version: COMPONENT_VERSION,
          props: {
            content: {
              candles: candles ?? [
                {id: "candle-1", open: 100, high: 106, low: 98, close: 104, label: "上旬"},
                {id: "candle-2", open: 104, high: 109, low: 102, close: 107},
                {id: "candle-3", open: 107, high: 110, low: 103, close: 105},
                {id: "candle-4", open: 105, high: 108, low: 101, close: 103},
                {id: "candle-5", open: 103, high: 112, low: 102, close: 111, label: "中旬"},
                {id: "candle-6", open: 111, high: 116, low: 109, close: 113},
                {id: "candle-7", open: 113, high: 115, low: 108, close: 110},
                {id: "candle-8", open: 110, high: 118, low: 109, close: 117},
                {id: "candle-9", open: 117, high: 122, low: 115, close: 120},
                {id: "candle-10", open: 120, high: 126, low: 118, close: 125, label: "下旬"},
              ],
              averageWindow: 5,
              unit: "元",
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
      stateId: "cmp-06-candlestick-state",
      schemaVersion: "1.0.0",
      lifecycle: "DRAFT",
      revision: "cmp-06-candlestick-sample-v1",
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
