import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};
import {FONT_FAMILY, MAX_CARDS, MIN_CARDS, SOURCE_GEOMETRY, resolveCardTimeline} from "./layout.js";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export {FONT_FAMILY};

// 参考图实测色（DARK）。浅底是同一套层级在浅色画布上的映射，不是参考图自带的状态。
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#F4F8FF",
    body: "#C7CDDF",
    muted: "rgba(199,205,223,0.72)",
    card: "linear-gradient(155deg, #26334F 0%, #1A2338 46%, #101728 100%)",
    grid: "rgba(255,255,255,0.022)",
    cardBorder: "rgba(122,160,255,0.18)",
    divider: "rgba(199,205,223,0.16)",
    cardShadow: "0 34px 80px rgba(4,8,20,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  LIGHT: {
    ink: "#16203A",
    body: "rgba(22,32,58,0.78)",
    muted: "rgba(22,32,58,0.62)",
    card: "linear-gradient(155deg, #FFFFFF 0%, #F2F5FC 46%, #E6EBF7 100%)",
    grid: "rgba(22,32,58,0.05)",
    cardBorder: "rgba(30,99,216,0.20)",
    divider: "rgba(22,32,58,0.14)",
    cardShadow: "0 24px 60px rgba(88,110,160,0.20), inset 0 1px 0 rgba(255,255,255,0.90)",
  },
};

// 参考图的强调蓝是 #538BFE；其余三套沿用项目既有主题色，只在主动跟随项目或单实例主题时映射。
export const ACCENTS = {
  SOURCE: {DARK: "#538BFE", LIGHT: "#1E63D8"},
  BLUE: {DARK: "#538BFE", LIGHT: "#1E63D8"},
  ORANGE: {DARK: "#F0A24F", LIGHT: "#D97A1C"},
  RED: {DARK: "#E88686", LIGHT: "#CF5555"},
  PURPLE: {DARK: "#8F86EA", LIGHT: "#6353D6"},
};

export const DEFAULT_POSITION = Object.freeze({x: 0.5, y: 0.5});
export const DEFAULT_SIZE = 1;

// 多卡组：每张卡可以单独取一套项目主题色；INHERIT 表示跟随本实例 / 项目主题
//（默认 SOURCE，即参考图原色蓝）。
export const CARD_ACCENT_MODES = ["INHERIT", "BLUE", "ORANGE", "RED", "PURPLE"];

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const propsSchema = {
  type: "object", additionalProperties: false,
  required: ["content", "position", "size", "surface", "theme"],
  properties: {
    content: {$ref: "SkillIntroCardContent"},
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

export const CONTENT_MESSAGE = `请填写 ${MIN_CARDS}–${MAX_CARDS} 张技能卡；每张至少要有技能名（1–20 字符）、钩子观点（1–24 字）和说明（1–51 字），数据胶囊可选、最长 18 字，每张卡还可以单独选强调色（INHERIT / BLUE / ORANGE / RED / PURPLE）。`;

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: CONTENT_MESSAGE,
    details: structuredClone(checkContent.errors),
  };
  return {valid: true};
}

export function assertSkillIntroCardProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content, position, size, surface, theme}) || !ACCENTS[theme]) throw new Error("组件位置、大小、底色或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("组件至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
  const timeline = resolveCardTimeline({cardCount: content.cards.length, durationInFrames, fps});
  if (timeline.tooShort) throw new Error(timeline.reason);
}

export function assertSampleState(state) {
  if (!checkState(state)) throw new Error("生产状态格式无效：" + ajv.errorsText(checkState.errors));
  const meta = state.technical;
  const portrait = state.product.aspectRatio === "9:16";
  if (meta.width !== (portrait ? 1080 : 1920) || meta.height !== (portrait ? 1920 : 1080)) {
    throw new Error("样板支持 1080×1920 或 1920×1080，画布需与比例一致。");
  }
  if (![24, 25, 30, 60].includes(meta.fps) || meta.durationInFrames < meta.fps * 3 || meta.durationInFrames > meta.fps * 60) {
    throw new Error("技能介绍卡样板支持 24/25/30/60 fps，时长 3–60 秒。");
  }
  if (state.product.shots.length !== 1 || state.product.shots[0].componentInstances.length !== 1 || state.product.globalPackaging.length) {
    throw new Error("当前样板仅支持一个镜头中的一个技能介绍卡组件，不接受额外组件或全局包装。");
  }
  if (Object.keys(state.product.shots[0].characterLayoutInstance).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  assertSkillIntroCardProps({
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

// 单张卡的强调色：没写或写 INHERIT 就跟随实例主题，其余按四套项目主题取色。
export function resolveCardAccent(card, instanceTheme = "SOURCE") {
  const declared = card?.accent ?? "INHERIT";
  if (!CARD_ACCENT_MODES.includes(declared)) throw new Error(`未知的单卡强调色：${declared}`);
  return declared === "INHERIT" ? instanceTheme : declared;
}

// 样例沿用用户参考图里的 find-skills 卡，再补两张同结构卡证明「一张说完自动切下一张」。
export function createContent() {
  return {cards: [
    {
      skill: "find-skills",
      hook: "不知道装什么？直接说你想干嘛",
      body: "几万个技能里，它帮你挑最合适的那个。把需求说出来，它给你答案。",
      badge: "全网 300 万+ 安装",
      accent: "INHERIT",
    },
    {
      skill: "video-dubbing",
      hook: "一条片子，讲给所有人听",
      body: "保留原来的音色，把口播换成另一种语言，字幕和口型一起对齐。",
      badge: "覆盖 12 种语言",
      accent: "ORANGE",
    },
    {
      skill: "skill-authoring",
      hook: "从一张参考图，到一个能用的组件",
      body: "读懂参考里的版式与动效，产出能预览、能编辑、能导出的真实组件。",
      badge: "已产出 21 个组件",
      accent: "PURPLE",
    },
  ]};
}

export function createSampleState({
  aspectRatio = "9:16", theme = "BLUE", instanceTheme = "SOURCE", surface = "DARK",
  size = DEFAULT_SIZE, position = DEFAULT_POSITION, content, durationSeconds = 12, fps = 30,
} = {}) {
  const durationInFrames = Math.round(durationSeconds * fps);
  return {
    product: {
      projectId: "comp-01-skill-intro-card-sample", aspectRatio, theme,
      shots: [{
        directorShotId: "sample-shot-01", characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-skill-intro-card-01", componentId: COMPONENT_ID, version: COMPONENT_VERSION,
          props: {content: content ?? createContent(), position: {...position}, size, surface, theme: instanceTheme},
          timing: {startFrame: 0, durationInFrames},
        }],
      }],
      globalPackaging: [],
    },
    technical: {
      stateId: "comp-01-skill-intro-card-state", schemaVersion: "1.0.0", lifecycle: "DRAFT",
      revision: "comp-01-skill-intro-card-sample-v1", directorPlanVersion: "synthetic-no-director-plan",
      fps, durationInFrames, width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080,
    },
  };
}

export const SOURCE_METRICS = SOURCE_GEOMETRY;
