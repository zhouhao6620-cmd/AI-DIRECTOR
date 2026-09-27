import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, fallbackMeasure, decimalsOf} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const POINT_RANGE = {min: contentSchema.properties.points.minItems, max: contentSchema.properties.points.maxItems};
export const DRAW_MS_RANGE = SOURCE_MOTION.drawMsRange;
export const VALUE_LIMIT = contentSchema.properties.points.items.properties.value.maximum;
export const TITLE_MAX_LENGTH = contentSchema.properties.title.maxLength;
export const LABEL_MAX_LENGTH = contentSchema.properties.points.items.properties.label.maxLength;
export const UNIT_MAX_LENGTH = contentSchema.properties.unit.maxLength;
export const CAPTION_MAX_LENGTH = contentSchema.properties.caption.maxLength;
export {FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION};

// Source chart palette. `registry/bases/default/primitives/line-chart-draw.tsx` ships a single
// series colour (`#e8b86d`) and reads its labels off the surface it is dropped on
// (`labelColor rgba(250,250,250,0.52)`, `gridColor rgba(250,250,250,0.10)`,
// `surfaceColor #080810` for the ink behind the dots).
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#fafafa",
    muted: "rgba(250, 250, 250, 0.55)",
    label: "rgba(250, 250, 250, 0.52)",
    grid: "rgba(250, 250, 250, 0.10)",
    surface: "#080810",
  },
  LIGHT: {
    ink: "#12131a",
    muted: "rgba(18, 19, 26, 0.62)",
    label: "rgba(18, 19, 26, 0.58)",
    grid: "rgba(18, 19, 26, 0.12)",
    surface: "#f7f4ef",
  },
};

/** SOURCE = the source's own single-series colour; the four themes are the project's opt-ins. */
export const ACCENTS = {
  SOURCE: {DARK: "#e8b86d", LIGHT: "#b9843a"},
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
    content: {$ref: "LineChartDrawContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.4, maximum: 2},
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
    message: `请填写 ${POINT_RANGE.min}–${POINT_RANGE.max} 个数据点（每个需要稳定 ID、1–${LABEL_MAX_LENGTH} 字标签和 ±1,000,000,000 以内的数值）。标题最多 ${TITLE_MAX_LENGTH} 字，单位最多 ${UNIT_MAX_LENGTH} 字，小注最多 ${CAPTION_MAX_LENGTH} 字。`,
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.points.map(point => point.id)).size !== content.points.length) {
    return {valid: false, message: "数据点 ID 不能重复。"};
  }
  return {valid: true};
}

export function assertLineChartDrawProps({content, position, size, surface, theme, drawMs, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme, drawMs}) || !ACCENTS[theme]) {
    throw new Error("组件位置、大小、底色、主题或描绘时长超出支持范围。");
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("折线图描绘至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const endMs = drawMs + 500;
  const durationMs = (durationInFrames / fps) * 1000;
  if (endMs > durationMs + 0.5) {
    throw new Error(`曲线与末点数值要到 ${(endMs / 1000).toFixed(1)} 秒才落定，超过当前显示时长 ${(durationMs / 1000).toFixed(1)} 秒。请缩短描绘时长或延长显示时长。`);
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
    throw new Error("当前样板仅支持一个镜头中的一个折线图描绘组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.4–2，描绘时长 600–6000 ms，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便曲线画完。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertLineChartDrawProps({
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

/** Synthetic, non-factual series. Does not read or send the user's video or subtitles. */
export function createContent({
  title = "本机合成样例", unit = "万", caption = "数值来自本机合成样例",
  values = [12, 26, 45, 66, 71], labels = ["一月", "二月", "三月", "四月", "五月"],
} = {}) {
  return {
    title, unit, caption,
    points: values.map((value, index) => ({
      id: `point-${index + 1}`, label: labels[index] ?? `第${index + 1}期`, value,
    })),
  };
}

export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", surface = "DARK", instanceTheme = "SOURCE",
  size = 1, position = {x: 0, y: 0.5}, content = null,
  drawMs = SOURCE_MOTION.defaultDrawMs, durationSeconds = 8, fps = 30, startFrame = 0, durationInFrames = 240,
} = {}) {
  return {
    product: {
      projectId: "cmp-06-line-chart-draw-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-line-chart-draw-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {content: content ?? createContent(), position: {...position}, size, surface, theme: instanceTheme, drawMs},
        timing: {startFrame, durationInFrames},
      }]}],
      globalPackaging: [],
    },
    technical: {
      stateId: "cmp-06-line-chart-draw-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-06-line-chart-draw-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames: durationSeconds * fps, width: aspectRatio === "9:16" ? 1080 : 1920,
      height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
export const SOURCE_TIMING = SOURCE_MOTION;
export {decimalsOf, fallbackMeasure};
