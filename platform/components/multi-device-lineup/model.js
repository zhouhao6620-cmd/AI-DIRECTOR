import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {
  DEVICE_RANGE, FONT_FAMILY, LABEL_MAX_LENGTH, ROW_MAX_LENGTH, ROW_RANGE, SOURCE_GEOMETRY, SOURCE_MOTION,
  TITLE_MAX_LENGTH,
} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK"];
export {
  DEVICE_RANGE, FONT_FAMILY, LABEL_MAX_LENGTH, ROW_MAX_LENGTH, ROW_RANGE, TITLE_MAX_LENGTH,
};

// 来源没有配色主题（只有硬件灰）；主题色用在屏幕里的强调条上，是画面里唯一的彩色元素。
// 四套主题色板与来源色板互不重叠（最小同通道色差 27），QA 用像素取证。
export const PALETTES = {
  SOURCE: ["#e8b86d", "#2dd4bf", "#f472b6", "#8b8bf5", "#f59e0b"],
  BLUE: ["#5fa0fa", "#38bdf8", "#6d8cf5", "#22d3ee", "#93c5fd"],
  ORANGE: ["#ef9a3d", "#fb923c", "#c2410c", "#fbbf24", "#f97316"],
  RED: ["#e88686", "#ef4444", "#f43f5e", "#fb7185", "#dc2626"],
  PURPLE: ["#a855f7", "#c084fc", "#7c3aed", "#d8b4fe", "#a78bfa"],
};

export const SURFACE_TOKENS = {
  DARK: {
    bezel: SOURCE_GEOMETRY.bezelColor,
    screen: SOURCE_GEOMETRY.screenColor,
    label: SOURCE_GEOMETRY.labelColor,
    title: SOURCE_GEOMETRY.titleColor,
    row: SOURCE_GEOMETRY.rowColor,
    base: SOURCE_GEOMETRY.baseGradient,
    frameBorder: SOURCE_GEOMETRY.frameBorderColor,
    bezelInset: SOURCE_GEOMETRY.bezelInsetColor,
    camera: SOURCE_GEOMETRY.cameraColor,
    notch: SOURCE_GEOMETRY.notchColor,
    hinge: SOURCE_GEOMETRY.hingeColor,
  },
};

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "MultiDeviceLineupContent"},
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
      message: "请填写一份屏幕内容（1–7 字标题、0–4 条 8 字以内的行）和三台设备（phone / tablet / laptop 各一台、标签 8 字以内）。",
      details: structuredClone(checkContent.errors),
    };
  }
  const kinds = content.devices.map((device) => device.kind);
  if (new Set(kinds).size !== 3) {
    return {valid: false, message: "三台设备必须是 phone / tablet / laptop 各一台，不能重复。"};
  }
  if (new Set(content.devices.map((device) => device.id)).size !== content.devices.length) {
    return {valid: false, message: "设备 ID 不能重复。"};
  }
  if (new Set(content.screen.rows.map((row) => row.id)).size !== content.screen.rows.length) {
    return {valid: false, message: "屏幕行 ID 不能重复。"};
  }
  return {valid: true};
}

export function assertMultiDeviceLineupProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !PALETTES[theme]) {
    throw new Error("组件位置、大小、底色或主题超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * SOURCE_MOTION.minDurationSeconds)) {
    throw new Error("多设备排列至少显示 3 秒。");
  }
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) {
    throw new Error("组件样板只支持已验证的横竖画幅。");
  }
  // 入场窗口：最后一台在 delay + 2 × stagger 起跳，spring 落定按 30 帧估计。
  const entranceFrames = SOURCE_MOTION.delayFrames + (content.devices.length - 1) * SOURCE_MOTION.staggerFrames + 30;
  if (entranceFrames > durationInFrames) {
    throw new Error(
      `设备要到第 ${entranceFrames} 帧（约 ${(entranceFrames / fps).toFixed(1)} 秒）才全部落定，超过当前显示时长 ${(durationInFrames / fps).toFixed(1)} 秒。请延长显示时长。`,
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
    throw new Error("当前样板仅支持一个镜头中的一个多设备排列组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) {
    throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  }
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) {
    throw new Error(
      "组件参数超出范围：位置 0–1，大小 1–2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors),
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
  assertMultiDeviceLineupProps(
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

/** 本组件实际会画的主题色：只有屏幕里那条强调条。 */
export function themeUsedColors(theme) {
  return [PALETTES[theme][0]];
}

// 合成样例（不读取、不发送用户的视频或字幕）。
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0.5, y: 0.5}, screen = null, devices = null,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-multi-device-sample",
      aspectRatio,
      theme,
      shots: [{
        directorShotId: "sample-shot-01",
        characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-multi-device-01",
          componentId: COMPONENT_ID,
          version: COMPONENT_VERSION,
          props: {
            content: {
              screen: screen ?? {
                title: "同一个界面",
                rows: [
                  {id: "row-1", text: "手机竖屏"},
                  {id: "row-2", text: "平板宽屏"},
                  {id: "row-3", text: "桌面全屏"},
                ],
              },
              devices: devices ?? [
                {id: "device-phone", kind: "phone", label: "手机"},
                {id: "device-tablet", kind: "tablet", label: "平板"},
                {id: "device-laptop", kind: "laptop", label: "笔记本"},
              ],
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
      stateId: "cmp-06-multi-device-state",
      schemaVersion: "1.0.0",
      lifecycle: "DRAFT",
      revision: "cmp-06-multi-device-sample-v1",
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
