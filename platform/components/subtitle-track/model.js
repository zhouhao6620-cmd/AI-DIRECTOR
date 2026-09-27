import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, SOURCE_GEOMETRY, highlightSegments} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const VARIANTS = ["BILINGUAL", "ZH_ONLY"];
export const DEFAULT_POSITION = Object.freeze({x: 0.5, y: 1});
export {FONT_FAMILY};

// Source keyword colour is `var(--hud-acc)` on the source dark stage (accent.ts →
// hud.css dark tokens). The track sits over the user's video, so the dark-canvas
// token values are the source default; project themes map onto the same palette.
export const ACCENTS = {
  SOURCE: {keyword: "#5fa0fa"},
  BLUE: {keyword: "#5fa0fa"},
  ORANGE: {keyword: "#f0a24f"},
  RED: {keyword: "#e88686"},
  PURPLE: {keyword: "#8f86ea"},
};
export const STROKE_WIDTH = SOURCE_GEOMETRY.strokeWidth;
export const STROKE_COLOR = SOURCE_GEOMETRY.strokeColor;

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "variant", "stroke", "theme"],
  properties: {
    content: {$ref: "SubtitleTrackContent"},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    variant: {enum: VARIANTS},
    stroke: {type: "boolean"},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    size: {type: "number", minimum: 0.05, maximum: 2},
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

export function durationMsOf({durationInFrames, fps}) {
  return (durationInFrames / fps) * 1000;
}

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写 1–500 条字幕，每条需要有效 ID、真实起止毫秒和 1–80 字中文主行（英文小字可选）。",
    details: structuredClone(checkContent.errors),
  };
  const cues = content.cues;
  if (new Set(cues.map(cue => cue.id)).size !== cues.length) return {valid: false, message: "字幕条 ID 不能重复。"};
  for (const [index, cue] of cues.entries()) {
    if (cue.endMs <= cue.startMs) return {valid: false, message: `第 ${index + 1} 条字幕的结束时间必须晚于开始时间。`};
    if (index > 0 && cue.startMs < cues[index - 1].endMs) return {valid: false, message: `第 ${index + 1} 条字幕与上一条时间重叠，请按真实字幕时间轴重新对齐。`};
    const zh = highlightSegments(cue.text);
    if (zh.error) return {valid: false, message: `第 ${index + 1} 条字幕：${zh.error}`};
    if (cue.translation && highlightSegments(cue.translation).error) return {valid: false, message: `第 ${index + 1} 条英文小字不能使用 * 标记，或请补全标记。`};
  }
  return {valid: true};
}

export function assertSubtitleTrackProps({content, position, variant, stroke, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, variant, stroke, theme}) || !ACCENTS[theme]) throw new Error("组件位置、变体、描边或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 1)) throw new Error("字幕轨至少覆盖 1 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const durationMs = durationMsOf({durationInFrames, fps});
  const last = content.cues.at(-1);
  if (last.endMs > durationMs + 0.5) throw new Error("字幕时间轴不能超出视频总时长；请按真实字幕时间轴重新对齐。");
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps * 1 || meta.durationInFrames > meta.fps * 60) {
    throw new Error("字幕轨样板支持 24/25/30/60 fps，时长 1–60 秒。");
  }
  if (state.product.shots.length || state.product.globalPackaging.length !== 1) {
    throw new Error("字幕轨是全局包装层：样板只接受一个全局实例，不接受镜头组件。");
  }
  const instance = state.product.globalPackaging[0];
  if (instance.componentId !== COMPONENT_ID) throw new Error("全局实例的组件 ID 与字幕轨不一致。");
  if (instance.timing.startFrame !== 0 || instance.timing.durationInFrames !== meta.durationInFrames) {
    throw new Error("全局包装实例必须覆盖整片：startFrame 为 0，时长等于视频总时长。");
  }
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  assertSubtitleTrackProps({
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

export function createContent({count = 6, durationMs = 12000, cues} = {}) {
  if (cues) return {cues: structuredClone(cues)};
  const samples = [
    {text: "先确认*目标*，再动手。", translation: "Confirm the goal before building."},
    {text: "把要点拆成*可验证*的小步。", translation: "Split the work into verifiable steps."},
    {text: "字幕按真实时间轴切换。", translation: "Captions follow the real timeline."},
    {text: "关键词用强调色*点亮*。", translation: "Keywords light up in the accent colour."},
    {text: "空档时间不显示字幕。", translation: "Nothing is drawn between cues."},
    {text: "结尾保留一行*收束*句。", translation: "The last line closes the track."},
  ];
  return {cues: Array.from({length: count}, (_, index) => ({
    id: `cue-${String(index + 1).padStart(4, "0")}`,
    startMs: Math.round((durationMs * index) / count),
    endMs: Math.round((durationMs * (index + 1)) / count),
    text: samples[index % samples.length].text,
    translation: samples[index % samples.length].translation,
  }))};
}

// Synthetic, non-factual captions. The cue timeline is derived from the real
// sample duration, and QA additionally drives the track from a real project SRT.
export function createSampleState({
  aspectRatio = "9:16", count = 6, theme = "BLUE", variant = "BILINGUAL", stroke = false,
  position = DEFAULT_POSITION, instanceTheme = "SOURCE", durationSeconds = 12, fps = 30, cues,
} = {}) {
  const durationInFrames = Math.round(durationSeconds * fps);
  const durationMs = durationMsOf({durationInFrames, fps});
  return {
    product: {
      projectId: "cmp-03-subtitle-track-sample", aspectRatio, theme,
      shots: [],
      globalPackaging: [{
        instanceId: "sample-subtitle-track-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
        props: {size: 1, content: createContent({count, durationMs, cues}), position: {...position}, variant, stroke, theme: instanceTheme},
        timing: {startFrame: 0, durationInFrames},
      }],
    },
    technical: {
      stateId: "cmp-03-subtitle-track-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "cmp-03-subtitle-track-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames, width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}
