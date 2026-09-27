import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, decimalsOf} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const POINT_RANGE = {min: 2, max: 6};
export const DRAW_MS_RANGE = SOURCE_MOTION.drawMsRange;
export const VALUE_LIMIT = 1000000000;
export {FONT_FAMILY};

// Source tokens: hud.css `.stage[data-theme="dark"]` / `[data-theme="light"]`, including the
// translucent glass gradient the `.gcv-box` always carries.
export const SURFACE_TOKENS = {
  DARK: {
    node: "#12121a",
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    glass: "linear-gradient(160deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.045))",
    glassBorder: "rgba(255, 255, 255, 0.22)",
    cardShadow: "0 30px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
  },
  LIGHT: {
    node: "#ece6e0",
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    glass: "linear-gradient(160deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.20))",
    glassBorder: "rgba(255, 255, 255, 0.85)",
    cardShadow: "0 22px 54px rgba(88, 70, 104, 0.16), 0 3px 10px rgba(88, 70, 104, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
  },
};

export const ACCENTS = {
  SOURCE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
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
  required: ["content", "position", "size", "surface", "theme", "drawMs"],
  properties: {
    content: {$ref: "GrowthCurveContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.8, maximum: 2},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    drawMs: {type: "integer", minimum: DRAW_MS_RANGE.min, maximum: DRAW_MS_RANGE.max},
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
    message: "请填写 2–6 个数据点（每个需要稳定 ID、1–8 字标签和 ±1,000,000,000 以内的数值）。kicker、单位与小注可留空。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.points.map(point => point.id)).size !== content.points.length) {
    return {valid: false, message: "数据点 ID 不能重复。"};
  }
  for (const point of content.points) {
    if (decimalsOf(point.value) === null) return {
      valid: false,
      message: `「${point.label}」的数值最多保留 2 位小数；更精确的数值请先自行取整。`,
    };
  }
  return {valid: true};
}

export function assertGrowthCurveProps({content, position, size, surface, theme, drawMs, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme, drawMs}) || !ACCENTS[theme]) {
    throw new Error("组件位置、大小、底色、主题或绘制时长超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("增长曲线至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = drawMs + SOURCE_MOTION.peakCountExtraMs;
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`曲线与峰值要到 ${(endMs / 1000).toFixed(1)} 秒才画完，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请缩短绘制时长或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个增长曲线组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.8–1.2，绘制时长 600–5000 ms，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便曲线画完。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertGrowthCurveProps({
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

// Synthetic, non-factual series. Does not read or send the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, points = null, drawMs = SOURCE_MOTION.defaultDrawMs,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-04a-growth-curve-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-growth-curve-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: {
            kicker: "GROWTH · 本机样例",
            kickerZh: "本机合成样例",
            points: points ?? [
              {id: "point-1", label: "一月", value: 12},
              {id: "point-2", label: "二月", value: 26},
              {id: "point-3", label: "三月", value: 45},
              {id: "point-4", label: "四月", value: 66},
            ],
            unit: "件",
            caption: "数值来自本机合成样例",
          },
          position: {...position}, size, surface, theme: instanceTheme, drawMs,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04a-growth-curve-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04a-growth-curve-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
