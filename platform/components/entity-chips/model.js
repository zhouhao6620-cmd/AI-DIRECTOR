import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {SOURCE_GEOMETRY, resolveEntrance} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const POSITIONS = ["LEFT", "CENTER", "RIGHT"];
export const SURFACES = ["DARK", "LIGHT"];
export const CHIP_STYLES = ["LIGHT", "DARK"];
export const STAGGER_RANGE_MS = [0, 1500];

// Source tokens: hud.css `.stage[data-theme]` (hud-ink / hud-node) plus the
// hard-coded `.etc-note-*` colours the source itself uses on any surface.
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    faint: "rgba(255, 255, 255, 0.44)",
    node: "#12121a",
  },
  LIGHT: {
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    faint: "rgba(26, 37, 64, 0.42)",
    node: "#ece6e0",
  },
};

// Source accent tokens: accent.ts ACCENT_VAR → --hud-blue / --hud-alert / --hud-orange.
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
  required: ["content", "stepMs", "position", "theme"],
  properties: {
    content: {$ref: "EntityChipsContent"},
    stepMs: {type: "integer", minimum: STAGGER_RANGE_MS[0], maximum: STAGGER_RANGE_MS[1]},
    position: {enum: POSITIONS},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    size: {type: "number", minimum: 0.05, maximum: 2},
    positionOffset: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1}}},
  },
};
const instanceSchema = {
  type: "object", additionalProperties: false,
  required: ["instanceId", "componentId", "version", "props", "timing"],
  properties: {
    instanceId: {type: "string", minLength: 1},
    componentId: {const: COMPONENT_ID}, version: {const: COMPONENT_VERSION},
    props: propsSchema,
    timing: {
      type: "object", additionalProperties: false, required: ["startFrame", "durationInFrames"],
      properties: {startFrame: {type: "integer", minimum: 0}, durationInFrames: {type: "integer", minimum: 1}},
    },
  },
};
const checkInstance = ajv.compile(instanceSchema);
const checkProps = ajv.compile(propsSchema);

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 1–3 块名牌（每块 1–12 字名称、可选 16 字内身份行），侧注上/下行分别最多 10 / 14 字。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.chips.map(chip => chip.id)).size !== content.chips.length) {
    return {valid: false, message: "名牌 ID 不能重复。"};
  }
  return {valid: true};
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!ACCENTS[result]) throw new Error("未知主题。");
  return result;
}

// Source `.etc-chip--dark .etc-sub { color: var(--hud-acc) }`; light chips keep
// the source's fixed dark sub colour, so the accent only reaches dark nameplates.
// The source has no surface switch on this card (`.etc` colours are fixed), so the
// accent token is read from the source dark stage, which is the studio default.
export function subColorOf(style, theme, surface = "DARK") {
  return style === "DARK" ? ACCENTS[theme][surface] : SOURCE_GEOMETRY.lightSubColor;
}

export function assertEntityChipsProps({content, stepMs, position, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, stepMs, position, theme}) || !ACCENTS[theme]) throw new Error("实体名牌的落位、主题或逐块间隔超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 1)) throw new Error("实体名牌至少显示 1 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const entrance = resolveEntrance({chips: content.chips, note: Boolean(content.noteA || content.noteB), stepMs});
  const durationMs = (durationInFrames / fps) * 1000;
  if (entrance.settledAtMs > durationMs + 0.5) {
    throw new Error(`按当前间隔逐块滑入需要 ${(entrance.settledAtMs / 1000).toFixed(2)} 秒，超出组件时长 ${(durationMs / 1000).toFixed(2)} 秒；请缩短间隔或加长组件。`);
  }
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps || meta.durationInFrames > meta.fps * 60) {
    throw new Error("实体名牌样板支持 24/25/30/60 fps，时长 1–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个实体名牌组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertEntityChipsProps({
    ...instance.props,
    theme: resolveTheme(state.product.theme, instance.props.theme),
    durationInFrames: instance.timing.durationInFrames,
  }, meta);
  return state;
}

// Synthetic, non-factual nameplates. Nothing here reads the user's video or subtitles.
export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", position = "LEFT", instanceTheme = "SOURCE",
  stepMs = SOURCE_GEOMETRY.staggerMs, chips = [
    {id: "org-1", style: "LIGHT", name: "枝鸥实验室", sub: "ORG · STUDIO"},
    {id: "person-1", style: "DARK", name: "讲解人 A", sub: "主讲 · 第一作者"},
  ], noteA = "侧注上行", noteB = "代码 / 身份小字",
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-04c-entity-chips-sample", aspectRatio, theme, shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
          instanceId: "sample-entity-chips-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {size: 1, positionOffset: {x: 0.5, y: 0.5},
            content: {
              chips: chips.map(chip => ({...chip})),
              ...(noteA ? {noteA} : {}), ...(noteB ? {noteB} : {}),
            },
            stepMs, position, theme: instanceTheme,
          },
          timing: {startFrame, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04c-entity-chips-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04c-entity-chips-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: Math.round(durationSeconds * fps),
      width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
