import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {
  DEFAULT_DIRECTION, DIRECTIONS, FONT_FAMILY, ICON_IDS, MAX_STAGES, MIN_STAGES, SOURCE_GEOMETRY, resolveSequence,
} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export {FONT_FAMILY, ICON_IDS};
export {DIRECTIONS, DEFAULT_DIRECTION};

// 令牌沿用本地 HUD 层级：阶段节点是轻卡 + 强调色编号，右侧展开面板是更弱的一层。
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.70)",
    faint: "rgba(255,255,255,0.34)",
    nodeFill: "linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.045))",
    panelFill: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.22)",
    panelBorder: "rgba(255,255,255,0.14)",
    cardShadow: "0 26px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.12)",
    panelShadow: "0 16px 40px rgba(0,0,0,0.26)",
    // 方向色固定（不跟主题）：暖黄在深底上最跳，同一色系也贴近 RemotionUI 自家连线默认描边 #E8B86D。
    arrow: "#FFD24A",
    arrowHalo: "rgba(6,8,16,0.50)",
  },
  LIGHT: {
    ink: "#1a2540",
    muted: "rgba(26,37,64,0.66)",
    faint: "rgba(26,37,64,0.30)",
    // 浅底是给浅色画布用的：填充保持高不透明度，避免叠在深色画面上变灰、文字掉对比。
    nodeFill: "linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.80))",
    panelFill: "rgba(255,255,255,0.88)",
    border: "rgba(255,255,255,0.95)",
    panelBorder: "rgba(120,140,180,0.40)",
    cardShadow: "0 20px 48px rgba(88,70,104,0.16), inset 0 1px 0 rgba(255,255,255,0.95)",
    panelShadow: "0 12px 30px rgba(88,70,104,0.12)",
    arrow: "#D98A00",
    arrowHalo: "rgba(255,255,255,0.9)",
  },
};

export const ACCENTS = {
  SOURCE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  BLUE: {DARK: "#5fa0fa", LIGHT: "#1e63d8"},
  ORANGE: {DARK: "#f0a24f", LIGHT: "#d97a1c"},
  RED: {DARK: "#e88686", LIGHT: "#cf5555"},
  PURPLE: {DARK: "#8f86ea", LIGHT: "#6353d6"},
};

export const DEFAULT_POSITION = Object.freeze({x: 0.5, y: 0.5});
export const DEFAULT_SIZE = 1;
export const ACTIVE_AUTO = -1;
export const TEXT_SIZE_LEVELS = Object.freeze(["SMALL", "MEDIUM", "LARGE"]);

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "variant", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "StageFlowContent"},
    variant: {enum: DIRECTIONS},
    position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
      x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
    }},
    size: {type: "number", minimum: 0.8, maximum: 2},
    surface: {enum: SURFACES},
    theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(ACCENTS)]},
    titleSize: {enum: TEXT_SIZE_LEVELS},
    stageLabelSize: {enum: TEXT_SIZE_LEVELS},
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

export const CONTENT_MESSAGE = `请填写 ${MIN_STAGES}–${MAX_STAGES} 个阶段（每个阶段标题 1–14 字，展开说明可选、最长 30 字）；标题可选、最长 18 字。`;

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: CONTENT_MESSAGE,
    details: structuredClone(checkContent.errors),
  };
  return {valid: true};
}

export function assertStageFlowProps({content, variant, position, size, surface, theme, durationInFrames, titleSize, stageLabelSize}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!DIRECTIONS.includes(variant)) throw new Error(`方向模式只支持 ${DIRECTIONS.join(" / ")}。`);
  const sizeLevelOk = value => value === undefined || TEXT_SIZE_LEVELS.includes(value);
  if (!sizeLevelOk(titleSize) || !sizeLevelOk(stageLabelSize)) throw new Error(`文字角色字号只支持 ${TEXT_SIZE_LEVELS.join(" / ")}。`);
  if (!checkProps({content, variant, position, size, surface, theme}) || !ACCENTS[theme]) throw new Error("组件位置、大小、底色或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("组件至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const stepMs = Number.isFinite(content.stepMs) ? content.stepMs : SOURCE_GEOMETRY.defaultStepMs;
  const sequence = resolveSequence({stageCount: content.stages.length, stepMs});
  const durationMs = (durationInFrames / fps) * 1000;
  if (durationMs < sequence.minimumDurationMs) throw new Error(
    `${content.stages.length} 个阶段按 ${Math.round(stepMs)} 毫秒一步需要 ${(sequence.minimumDurationMs / 1000).toFixed(1)} 秒（含收尾停留），当前只有 ${(durationMs / 1000).toFixed(1)} 秒；请延长片段或调小节奏。`,
  );
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps * 3 || meta.durationInFrames > meta.fps * 60) {
    throw new Error("阶段流程样板支持 24/25/30/60 fps，时长 3–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个阶段流程组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertStageFlowProps({
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

// 样例沿用用户 Demo 的 AKK 内容：标题在画面上，AKK 本身不做成节点。
// 第 4 个阶段是占位内容，用来展示「四排节点」这一版式（用户给的原 demo 只有 3 条），可在编辑面板直接替换。
export function createContent() {
  return {
    title: "AKK 四大流程",
    stages: [
      {title: "肠道屏障", detail: "帮助维持肠道屏障环境", icon: "shield"},
      {title: "饱腹信号", detail: "参与 GLP-1 等肠道信号调节", icon: "activity"},
      {title: "代谢稳态", detail: "参与整体代谢环境调节", icon: "trending-up"},
      {title: "免疫调节", detail: "参与肠道免疫环境调节（样例占位）", icon: "heart-pulse"},
    ],
    activeStageIndex: ACTIVE_AUTO,
    stepMs: SOURCE_GEOMETRY.defaultStepMs,
  };
}

export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", instanceTheme = "SOURCE", surface = "DARK",
  size = DEFAULT_SIZE, position = DEFAULT_POSITION, content, variant = DEFAULT_DIRECTION, durationSeconds = 12, fps = 30,
  titleSize = "MEDIUM", stageLabelSize = "MEDIUM",
} = {}) {
  const durationInFrames = Math.round(durationSeconds * fps);
  return {
    product: {
      projectId: "comp-02-stage-flow-sample", aspectRatio, theme,
      shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-stage-flow-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {content: content ?? createContent(), variant, position: {...position}, size, surface, theme: instanceTheme, titleSize, stageLabelSize},
          timing: {startFrame: 0, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "comp-02-stage-flow-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "comp-02-stage-flow-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames, width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
