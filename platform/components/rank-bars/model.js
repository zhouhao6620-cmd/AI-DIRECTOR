import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, decimalsOf, rampEndMs} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const ROW_RANGE = {min: 2, max: SOURCE_GEOMETRY.maxRows};
export const VALUE_LIMIT = 1000000000;
export {FONT_FAMILY};

// Source tokens: hud.css `.stage[data-theme="dark"]` / `[data-theme="light"]`.
export const SURFACE_TOKENS = {
  DARK: {
    node: "#12121a",
    ink: "#ffffff",
    muted: "rgba(255, 255, 255, 0.70)",
    track: "rgba(255, 255, 255, 0.16)",
    lav: "#b9b2ee",
  },
  LIGHT: {
    node: "#ece6e0",
    ink: "#1a2540",
    muted: "rgba(26, 37, 64, 0.66)",
    track: "rgba(26, 37, 64, 0.13)",
    lav: "#837bc4",
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
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "RankBarsContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.8, maximum: 2},
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

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: `请填写 2–6 条数据（每条需要稳定 ID、1–16 字名称和 0–1,000,000,000 的数值），标题与后缀可留空。`,
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.rows.map(row => row.id)).size !== content.rows.length) {
    return {valid: false, message: "数据条目 ID 不能重复。"};
  }
  // The source rounds to whole numbers; here anything finer than two decimals is refused instead.
  for (const row of content.rows) {
    if (decimalsOf(row.value) === null) return {
      valid: false,
      message: `「${row.name}」的数值最多保留 2 位小数；更精确的数值请先自行取整。`,
    };
  }
  return {valid: true};
}

export function assertRankBarsProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !ACCENTS[theme]) {
    throw new Error("组件位置、大小、底色或主题超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("排名条形图至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = rampEndMs(content.rows.length);
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`条形与数值要到 ${(endMs / 1000).toFixed(1)} 秒才走完，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请减少条目或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个排名条形图组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.8–1.2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便条形走完。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertRankBarsProps({
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
  size = 1, position = {x: 0, y: 0.5}, rows = null, title = "本机样例 · 对比排名", suffix = "%",
  durationSeconds = 8, fps = 30, startFrame = 15, durationInFrames = 210,
} = {}) {
  return {
    product: {
      projectId: "cmp-04a-rank-bars-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-rank-bars-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {
          content: {
            title,
            rows: rows ?? [
              {id: "row-1", name: "样本甲", value: 42},
              {id: "row-2", name: "样本乙", value: 21},
              {id: "row-3", name: "样本丙", value: 9.5},
            ],
            suffix,
          },
          position: {...position}, size, surface, theme: instanceTheme,
        },
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-04a-rank-bars-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-04a-rank-bars-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
