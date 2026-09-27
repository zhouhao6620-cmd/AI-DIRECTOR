import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {
  BUBBLE_RANGE, FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, VALUE_LIMIT, decimalsOf,
} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK"];
export {BUBBLE_RANGE, FONT_FAMILY, VALUE_LIMIT};

// 色板：SOURCE = RemotionUI `bubble-chart-pack` 的 DEFAULT_COLORS（原样保留）；
// BLUE / ORANGE / RED / PURPLE 是项目四套主题色板，角色位与来源一致
// （[0] 主题主色 / [1] 上行或第一序列 / [2] 下行或第二序列 / [3][4] 后续序列）。
// 四套主题色板与来源色板彼此不重叠（任意两套之间同通道色差 > 24），QA 用像素取证。
export const PALETTES = {
  SOURCE: ["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b"],
  BLUE: ["#5fa0fa", "#38bdf8", "#6d8cf5", "#22d3ee", "#93c5fd"],
  ORANGE: ["#ef9a3d", "#fb923c", "#c2410c", "#fbbf24", "#f97316"],
  RED: ["#e88686", "#ef4444", "#f43f5e", "#fb7185", "#dc2626"],
  PURPLE: ["#a855f7", "#c084fc", "#7c3aed", "#d8b4fe", "#a78bfa"],
};

export const SURFACE_TOKENS = {
  DARK: {ink: SOURCE_GEOMETRY.inkColor, fillOpacity: SOURCE_GEOMETRY.fillOpacity},
};

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "BubbleChartPackContent"},
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
      message: "请填写 2–7 个气泡（每个需要稳定 ID、1–6 字标签和大于 0 的数值）。单位可留空。",
      details: structuredClone(checkContent.errors),
    };
  }
  if (new Set(content.bubbles.map((bubble) => bubble.id)).size !== content.bubbles.length) {
    return {valid: false, message: "气泡 ID 不能重复。"};
  }
  for (const bubble of content.bubbles) {
    if (decimalsOf(bubble.value) === null) {
      return {
        valid: false,
        message: `「${bubble.label}」的数值最多保留 2 位小数；更精确的数值请先自行取整。`,
      };
    }
  }
  return {valid: true};
}

export function assertBubbleChartPackProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !PALETTES[theme]) {
    throw new Error("组件位置、大小、底色或主题超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * SOURCE_MOTION.minDurationSeconds)) {
    throw new Error("气泡图至少显示 3 秒。");
  }
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) {
    throw new Error("组件样板只支持已验证的横竖画幅。");
  }
  // 来源的入场窗口：最后一颗（半径最小）在 (n−1) × stagger 起、26 帧内落定。
  const entranceFrames = (content.bubbles.length - 1) * SOURCE_MOTION.staggerFrames + SOURCE_MOTION.unitFrames;
  if (entranceFrames > durationInFrames) {
    throw new Error(
      `气泡入场要到第 ${entranceFrames} 帧（约 ${(entranceFrames / fps).toFixed(1)} 秒）才全部落定，超过当前显示时长 ${(durationInFrames / fps).toFixed(1)} 秒。请减少条目或延长显示时长。`,
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
    throw new Error("当前样板仅支持一个镜头中的一个气泡图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) {
    throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  }
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) {
    throw new Error(
      "组件参数超出范围：位置 0–1，大小 0.5–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors),
    );
  }
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * SOURCE_MOTION.minDurationSeconds)) {
    throw new Error("组件至少显示 3 秒，以便气泡全部落定。");
  }
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) {
    throw new Error("组件结束时间不能超出样板总时长。");
  }
  // 实验页巡检固定在第 110 / 170 帧取帧：样例必须让组件覆盖这两帧，否则轻编辑会挑到不显示的帧。
  if (instance.timing.startFrame > 110 || instance.timing.startFrame + instance.timing.durationInFrames <= 170) {
    throw new Error("样例实例必须覆盖实验页巡检帧（第 110 与 170 帧）。");
  }
  assertBubbleChartPackProps(
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

/** 该主题会用到的全部颜色（QA 像素取证用：自己的命中 > 0，其他主题命中 = 0）。 */
export function themeColors(theme) {
  return [...PALETTES[theme]];
}

// 合成样例（不读取、不发送用户的视频或字幕）。
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0.5, y: 0.5}, bubbles = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-bubble-chart-sample",
      aspectRatio,
      theme,
      shots: [{
        directorShotId: "sample-shot-01",
        characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-bubble-chart-01",
          componentId: COMPONENT_ID,
          version: COMPONENT_VERSION,
          props: {
            content: {
              bubbles: bubbles ?? [
                {id: "bubble-1", label: "搜索", value: 42},
                {id: "bubble-2", label: "推荐", value: 26},
                {id: "bubble-3", label: "直播", value: 18},
                {id: "bubble-4", label: "社群", value: 12},
                {id: "bubble-5", label: "私域", value: 8},
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
      stateId: "cmp-06-bubble-chart-state",
      schemaVersion: "1.0.0",
      lifecycle: "DRAFT",
      revision: "cmp-06-bubble-chart-sample-v1",
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
