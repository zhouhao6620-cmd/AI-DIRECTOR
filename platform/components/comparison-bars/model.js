import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, SOURCE_PALETTE, fallbackMeasure} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const ROW_RANGE = {min: contentSchema.properties.rows.minItems, max: contentSchema.properties.rows.maxItems};
export const GROW_MS_RANGE = SOURCE_MOTION.growMsRange;
export const VALUE_LIMIT = contentSchema.properties.rows.items.properties.after.maximum;
export const TITLE_MAX_LENGTH = contentSchema.properties.title.maxLength;
export const LABEL_MAX_LENGTH = contentSchema.properties.rows.items.properties.label.maxLength;
export const SERIES_LABEL_MAX_LENGTH = contentSchema.properties.beforeLabel.maxLength;
export const DELTA_MAX_LENGTH = contentSchema.properties.rows.items.properties.delta.maxLength;
export const UNIT_MAX_LENGTH = contentSchema.properties.unit.maxLength;
export const CAPTION_MAX_LENGTH = contentSchema.properties.caption.maxLength;
export {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, SOURCE_PALETTE};

// Source surfaces (registry/bases/default/primitives/comparison-bars.tsx):
//   beforeColor rgba(250,250,250,0.22) · afterColor #e8b86d · downColor #f472b6 · barInkColor #0b0b10
//   labelColor rgba(250,250,250,0.55)
export const SURFACE_TOKENS = {
  DARK: {ink: "#fafafa", label: "rgba(250, 250, 250, 0.55)", before: SOURCE_PALETTE.before, barInk: SOURCE_PALETTE.barInk},
  LIGHT: {ink: "#12131a", label: "rgba(18, 19, 26, 0.62)", before: "rgba(18, 19, 26, 0.16)", barInk: "#ffffff"},
};

export const ACCENTS = {
  SOURCE: {DARK: SOURCE_PALETTE.after, LIGHT: "#b9843a"},
  BLUE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  ORANGE: {DARK: "#f0a24f", LIGHT: "#d97a1c"},
  RED: {DARK: "#e88686", LIGHT: "#cf5555"},
  PURPLE: {DARK: "#8f86ea", LIGHT: "#6353d6"},
};

export const DOWNS = {
  SOURCE: {DARK: SOURCE_PALETTE.down, LIGHT: "#cf4f96"},
  BLUE: {DARK: "#7fb8ff", LIGHT: "#4b83d6"},
  ORANGE: {DARK: "#f6c177", LIGHT: "#d99a45"},
  RED: {DARK: "#f0a3a3", LIGHT: "#cf7070"},
  PURPLE: {DARK: "#a8a1f0", LIGHT: "#7b6ce0"},
};

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme", "growMs"],
  properties: {
    content: {$ref: "ComparisonBarsContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.4, maximum: 2},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    growMs: {type: "integer", minimum: GROW_MS_RANGE.min, maximum: GROW_MS_RANGE.max},
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
    message: `请填写 ${ROW_RANGE.min}–${ROW_RANGE.max} 个对比项（每个需要稳定 ID、1–${LABEL_MAX_LENGTH} 字标签以及前后两个 ±1,000,000,000 以内的数值）。标题最多 ${TITLE_MAX_LENGTH} 字，两列名称最多 ${SERIES_LABEL_MAX_LENGTH} 字，单位最多 ${UNIT_MAX_LENGTH} 字，自定幅度最多 ${DELTA_MAX_LENGTH} 字，小注最多 ${CAPTION_MAX_LENGTH} 字。`,
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.rows.map(row => row.id)).size !== content.rows.length) {
    return {valid: false, message: "对比项 ID 不能重复。"};
  }
  return {valid: true};
}

/** Every pair has to finish inside the instance, otherwise the last row never lands. */
export function motionEndMs({content, growMs}) {
  const lastRow = Math.max(0, content.rows.length - 1);
  return lastRow * SOURCE_MOTION.defaultStaggerMs + SOURCE_MOTION.defaultPairOffsetMs + growMs;
}

export function assertComparisonBarsProps({content, position, size, surface, theme, growMs, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme, growMs}) || !ACCENTS[theme]) {
    throw new Error("组件位置、大小、底色、主题或生长时长超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("对比条形至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = motionEndMs({content, growMs}) + 200;
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`最后一条对比要到 ${(endMs / 1000).toFixed(1)} 秒才长完，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请缩短生长时长、减少对比项或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个对比条形组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.4–2，生长时长 300–3000 ms，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便两组条形都长完。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertComparisonBarsProps({
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

export function accentOf(theme, surface = "DARK") {
  return ACCENTS[resolveTheme("BLUE", theme)][surface];
}

export function downOf(theme, surface = "DARK") {
  return DOWNS[resolveTheme("BLUE", theme)][surface];
}

/** Synthetic, non-factual rows. Does not read or send the user's video or subtitles. */
export function createContent({
  title = "本机合成样例", beforeLabel = "改造前", afterLabel = "改造后", unit = "件",
  caption = "数值来自本机合成样例",
  rows = [
    {id: "row-1", label: "单件耗时", before: 42, after: 18},
    {id: "row-2", label: "人工介入", before: 26, after: 7},
    {id: "row-3", label: "返工次数", before: 15, after: 3},
    {id: "row-4", label: "交付周期", before: 30, after: 21},
  ],
} = {}) {
  return {title, beforeLabel, afterLabel, unit, caption, rows: rows.map(row => ({...row}))};
}

export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null, growMs = SOURCE_MOTION.defaultGrowMs,
  durationSeconds = 8, fps = 30, startFrame = 0, durationInFrames = 240,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-comparison-bars-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-comparison-bars-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {content: content ?? createContent(), position: {...position}, size, surface, theme: instanceTheme, growMs},
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-comparison-bars-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-comparison-bars-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
export {fallbackMeasure};
