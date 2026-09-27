import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, lastChipRevealMs} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const ALIGNMENTS = ["LEFT", "RIGHT"];
// Source control range for `stepMs` (「每条落钉间隔(卡点用)」, min 1000 / max 15000 / step 250).
export const STEP_MS_RANGE = {min: 1000, max: 15000};
export {FONT_FAMILY};

// Source tokens: hud.css `.stage[data-theme="dark"]` / `[data-theme="light"]`.
export const SURFACE_TOKENS = {
  DARK: {
    node: "#12121a",
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    faint: "rgba(255, 255, 255, 0.44)",
    textShadow: "0 2px 12px rgba(0, 0, 0, 0.4)",
  },
  LIGHT: {
    node: "#ece6e0",
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    faint: "rgba(26, 37, 64, 0.42)",
    textShadow: "0 2px 10px rgba(0, 0, 0, 0.08)",
  },
};

// Source tokens: accent.ts ACCENT_VAR over the four project themes. SOURCE = the card's own
// default accent (`blue`), exactly like the ChapterProgress / SubtitleTrack components.
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
  required: ["content", "position", "size", "surface", "theme", "align", "stepMs"],
  properties: {
    content: {$ref: "PinBoardContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.8, maximum: 2},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    align: {enum: ALIGNMENTS},
    stepMs: {type: "integer", minimum: STEP_MS_RANGE.min, maximum: STEP_MS_RANGE.max},
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
    message: "请填写 1–24 字的章节标题和 2–5 个要点（每条 1–20 字，需要稳定 ID）。副题可留空。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.items.map(item => item.id)).size !== content.items.length) {
    return {valid: false, message: "要点 ID 不能重复。"};
  }
  return {valid: true};
}

export function assertPinBoardProps({content, position, size, surface, theme, align, stepMs, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme, align, stepMs}) || !ACCENTS[theme]) {
    throw new Error("组件位置、大小、底色、主题、对齐或落钉间隔超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("要点钉板至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  // Every point must actually be pinned before the instance ends; the source leaves this to
  // the author, so a too-long interval would silently drop the remaining points.
  const revealMs = lastChipRevealMs(content.items.length, stepMs);
  const durationMs = (durationInFrames / fps) * 1000;
  if (revealMs > durationMs + 0.5) {
    throw new Error(`每条落钉间隔过长：最后一条要点在 ${(revealMs / 1000).toFixed(1)} 秒才出现，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请缩短间隔或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个要点钉板组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.8–1.2，落钉间隔 1000–15000 ms，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便讲完全部要点。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertPinBoardProps({
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

// Synthetic, non-factual points. Does not read or send the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", count = 4, theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  align = "RIGHT", size = 1, position = {x: 1, y: 0}, stepMs = 1200,
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  const labels = ["确认目标", "组织要点", "突出重点", "检查结果", "记录来源"];
  return {
    product: {
      projectId: "cmp-04a-pin-board-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-pin-board-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: {
            title: "本段要点",
            subtitle: "讲解进度:",
            items: labels.slice(0, count).map((label, index) => ({id: `point-${index + 1}`, label})),
          },
          position: {...position}, size, surface, theme: instanceTheme, align, stepMs,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04a-pin-board-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04a-pin-board-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
