import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {
  FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, STEP_RANGE, VALUE_LIMIT, decimalsOf, resolveSteps,
} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export {FONT_FAMILY, STEP_RANGE, VALUE_LIMIT};

// 色板与同批图表同源同口径。角色位沿用来源：上行 = 第 2 位、下行 = 第 3 位、合计 = 第 1 位。
export const PALETTES = {
  SOURCE: ["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b"],
  BLUE: ["#5fa0fa", "#38bdf8", "#6d8cf5", "#22d3ee", "#93c5fd"],
  ORANGE: ["#ef9a3d", "#fb923c", "#c2410c", "#fbbf24", "#f97316"],
  RED: ["#e88686", "#ef4444", "#f43f5e", "#fb7185", "#dc2626"],
  PURPLE: ["#a855f7", "#c084fc", "#7c3aed", "#d8b4fe", "#a78bfa"],
};

export const ROLE_INDEX = {total: 0, up: 1, down: 2};

export function stepColor(theme, step) {
  const palette = PALETTES[theme];
  if (step.isTotal) return palette[ROLE_INDEX.total];
  return step.to >= step.from ? palette[ROLE_INDEX.up] : palette[ROLE_INDEX.down];
}

export const SURFACE_TOKENS = {
  DARK: {grid: "rgba(250, 250, 250, 0.10)", label: "rgba(250, 250, 250, 0.55)", ink: "#fafafa"},
  LIGHT: {grid: "rgba(26, 37, 64, 0.14)", label: "rgba(26, 37, 64, 0.68)", ink: "#1a2540"},
};

export const BAR_OPACITY = SOURCE_GEOMETRY.barOpacity;

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "WaterfallChartContent"},
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
      message: "请填写 3–7 个步骤（每个需要稳定 ID、1–6 字步骤名和带符号的数值；合计步勾选 isTotal）。单位可留空。",
      details: structuredClone(checkContent.errors),
    };
  }
  if (new Set(content.steps.map((step) => step.id)).size !== content.steps.length) {
    return {valid: false, message: "步骤 ID 不能重复。"};
  }
  for (const step of content.steps) {
    if (decimalsOf(step.value) === null) {
      return {valid: false, message: `「${step.label}」的数值最多保留 2 位小数；更精确的数值请先自行取整。`};
    }
  }
  // 首步若是合计（从 0 起的起始水位），水位序列必须能被画出来：来源语义允许，但要求它不是 0 值合计。
  const resolved = resolveSteps(content.steps);
  if (resolved.every((step) => step.from === 0 && step.to === 0)) {
    return {valid: false, message: "全部步骤的水位都是 0，瀑布图没有可画的桥。"};
  }
  return {valid: true};
}

export function assertWaterfallChartProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !PALETTES[theme]) {
    throw new Error("组件位置、大小、底色或主题超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * SOURCE_MOTION.minDurationSeconds)) {
    throw new Error("瀑布图至少显示 3 秒。");
  }
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) {
    throw new Error("组件样板只支持已验证的横竖画幅。");
  }
  const entranceFrames = (content.steps.length - 1) * SOURCE_MOTION.staggerFrames + SOURCE_MOTION.unitFrames;
  if (entranceFrames > durationInFrames) {
    throw new Error(
      `瀑布柱要到第 ${entranceFrames} 帧（约 ${(entranceFrames / fps).toFixed(1)} 秒）才全部落定，超过当前显示时长 ${(durationInFrames / fps).toFixed(1)} 秒。请减少步数或延长显示时长。`,
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
    throw new Error("当前样板仅支持一个镜头中的一个瀑布图组件，不接受额外组件或全局包装。");
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
  assertWaterfallChartProps(
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

/** 本组件实际会画的主题色（上行 / 下行 / 合计三色；数据里没有上行或下行时段该类不出现在画面）。 */
export function themeUsedColors(theme, content) {
  const resolved = resolveSteps(content.steps);
  const used = new Set();
  for (const step of resolved) {
    if (step.isTotal) used.add(PALETTES[theme][ROLE_INDEX.total]);
    else used.add(step.to >= step.from ? PALETTES[theme][ROLE_INDEX.up] : PALETTES[theme][ROLE_INDEX.down]);
  }
  return [...used];
}

// 合成样例（不读取、不发送用户的视频或字幕）。
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0.5, y: 0.5}, steps = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-waterfall-sample",
      aspectRatio,
      theme,
      shots: [{
        directorShotId: "sample-shot-01",
        characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-waterfall-01",
          componentId: COMPONENT_ID,
          version: COMPONENT_VERSION,
          props: {
            content: {
              steps: steps ?? [
                {id: "step-1", label: "期初", value: 120, isTotal: true},
                {id: "step-2", label: "新签", value: 48},
                {id: "step-3", label: "续费", value: 26},
                {id: "step-4", label: "退款", value: -18},
                {id: "step-5", label: "成本", value: -32},
                {id: "step-6", label: "期末", value: 144, isTotal: true},
              ],
              unit: "万",
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
      stateId: "cmp-06-waterfall-state",
      schemaVersion: "1.0.0",
      lifecycle: "DRAFT",
      revision: "cmp-06-waterfall-sample-v1",
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
