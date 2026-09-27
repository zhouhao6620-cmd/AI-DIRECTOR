import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, hasTooManyDecimals} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const COUNT_MS_RANGE = SOURCE_MOTION.countMsRange;
export const VALUE_LIMIT = 1000000000000;
export {FONT_FAMILY};

// Source tokens: hud.css `.stage[data-theme="dark"]` / `[data-theme="light"]`.
export const SURFACE_TOKENS = {
  DARK: {
    node: "#12121a",
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    faint: "rgba(255, 255, 255, 0.44)",
  },
  LIGHT: {
    node: "#ece6e0",
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    faint: "rgba(26, 37, 64, 0.42)",
  },
};

// Source tokens: accent.ts ACCENT_VAR over the four project themes; SOURCE is the card's own
// default accent (`blue`).
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
  required: ["content", "position", "size", "surface", "theme", "countMs"],
  properties: {
    content: {$ref: "StatProofContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.8, maximum: 2},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    countMs: {type: "integer", minimum: COUNT_MS_RANGE.min, maximum: COUNT_MS_RANGE.max},
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
    message: "请填写 1–32 字的 kicker 和一个有效数值（±1,000,000,000,000 以内）。中文小注、前后缀与双语注脚可留空。",
    details: structuredClone(checkContent.errors),
  };
  // The source's formatter has 0 or 1 decimal place; finer values would be silently rounded.
  if (hasTooManyDecimals(content.value)) return {
    valid: false,
    message: "核心数字最多保留 1 位小数；更精确的数值请先自行取整，或改用能承载更多位数的组件。",
  };
  return {valid: true};
}

export function assertStatProofProps({content, position, size, surface, theme, countMs, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme, countMs}) || !ACCENTS[theme]) {
    throw new Error("组件位置、大小、底色、主题或计数时长超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("数据实证卡至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  // A count that cannot finish inside the instance would freeze on a wrong number mid-ramp.
  const durationMs = (durationInFrames / fps) * 1000;
  if (countMs > durationMs + 0.5) {
    throw new Error(`计数时长 ${(countMs / 1000).toFixed(1)} 秒超过显示时长 ${(durationMs / 1000).toFixed(1)} 秒：数字在组件结束前无法到达目标值。请缩短计数时长或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个数据实证组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.8–1.2，计数时长 400–5000 ms，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便计数落定。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertStatProofProps({
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

// Synthetic, non-factual figures. Does not read or send the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, countMs = 1600,
  value = 42, content = null, durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-04a-stat-proof-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-stat-proof-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: content ?? {
            kicker: "SAMPLES · 本机台账",
            kickerZh: "本机合成样例，不代表真实数据",
            prefix: "",
            value,
            suffix: "%",
            footEn: "SOURCE · LOCAL FIXTURE",
            footZh: "数字来自本机合成样例",
          },
          position: {...position}, size, surface, theme: instanceTheme, countMs,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04a-stat-proof-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04a-stat-proof-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
