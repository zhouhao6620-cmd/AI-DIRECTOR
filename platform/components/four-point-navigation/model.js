import Ajv from "ajv/dist/2020.js";
import contentSchema from "./content.schema.json" with {type: "json"};
import productionSchema from "../../contracts/schemas/production-state.schema.json" with {type: "json"};
import definition from "./definition.json" with {type: "json"};

export const COMPONENT_ID = definition.identity.componentId;
export const PROJECT_THEMES = ["BLUE", "ORANGE", "RED", "PURPLE"];
export const THEMES = {
  SOURCE: {accent: "#67e8f9", active: "rgba(8,145,178,0.92)", pale: "#ecfeff", ink: "#0e7490", shadow: "rgba(8,145,178,0.34)"},
  BLUE: {accent: "#93c5fd", active: "rgba(37,99,235,0.92)", pale: "#eff6ff", ink: "#1d4ed8", shadow: "rgba(37,99,235,0.34)"},
  ORANGE: {accent: "#fdba74", active: "rgba(234,88,12,0.92)", pale: "#fff7ed", ink: "#c2410c", shadow: "rgba(234,88,12,0.34)"},
  RED: {accent: "#fca5a5", active: "rgba(220,38,38,0.92)", pale: "#fef2f2", ink: "#b91c1c", shadow: "rgba(220,38,38,0.34)"},
  PURPLE: {accent: "#d8b4fe", active: "rgba(147,51,234,0.92)", pale: "#faf5ff", ink: "#7e22ce", shadow: "rgba(147,51,234,0.34)"},
};

const ajv = new Ajv({allErrors: true, strict: true});
const checkContent = ajv.compile(contentSchema);
const checkState = ajv.compile(productionSchema);
const instanceSchema = {
  type: "object", additionalProperties: false,
  required: ["instanceId", "componentId", "version", "props", "timing"],
  properties: {
    instanceId: {type: "string", minLength: 1},
    componentId: {const: COMPONENT_ID}, version: {const: "1.0.0"},
    props: {
      type: "object", additionalProperties: false, required: ["content", "position", "size", "theme"],
      properties: {
        content: {$ref: "FourPointNavigationContent"},
        position: {type: "object", additionalProperties: false, required: ["x", "y"], properties: {
          x: {type: "number", minimum: 0, maximum: 1}, y: {type: "number", minimum: 0, maximum: 1},
        }},
        size: {type: "number", minimum: 0.8, maximum: 2},
        theme: {enum: ["FOLLOW_PROJECT", ...Object.keys(THEMES)]},
      },
    },
    timing: {type: "object", additionalProperties: false, required: ["startFrame", "durationInFrames"], properties: {
      startFrame: {type: "integer", minimum: 0}, durationInFrames: {type: "integer", minimum: 1},
    }},
  },
};
const checkInstance = ajv.compile(instanceSchema);
const checkProps = ajv.compile(instanceSchema.properties.props);

export function assertNavigationProps({content,position,size,theme,durationInFrames}, {fps,width,height}) {
  const result = validateContent(content);
  if (!result.valid) throw new Error(result.message);
  if (!checkProps({content,position,size,theme}) || !THEMES[theme]) throw new Error("组件位置、大小或主题超出支持范围。");
  if (!Number.isInteger(durationInFrames) || durationInFrames < Math.ceil(fps * 3)) throw new Error("组件至少显示 3 秒。");
  if (!((width === 1080 && height === 1920) || (width === 1920 && height === 1080))) throw new Error("组件样板只支持已验证的横竖画幅。");
}

export function validateContent(content) {
  if (!checkContent(content)) return {
    valid: false,
    message: "请填写标题（1–40 字）和 3–5 个要点（每项 1–48 字），每项需有有效 ID。",
    details: structuredClone(checkContent.errors),
  };
  if (new Set(content.items.map(item => item.id)).size !== content.items.length) {
    return {valid: false, message: "要点 ID 不能重复。"};
  }
  return {valid: true};
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
    throw new Error("当前样板仅支持一个镜头中的一个逐项导航组件，不接受额外组件或全局包装。");
  }
  const layout = state.product.shots[0].characterLayoutInstance;
  if (Object.keys(layout).length) throw new Error("当前样板不渲染人物布局，请保留空的人物布局实例。");
  const instance = state.product.shots[0].componentInstances[0];
  const contentResult = validateContent(instance?.props?.content);
  if (!contentResult.valid) throw new Error(contentResult.message);
  if (!checkInstance(instance)) throw new Error("组件参数超出范围：位置 0–1，大小 0.8–1.2，主题须为项目主题或四套预设。" + ajv.errorsText(checkInstance.errors));
  if (instance.timing.durationInFrames < Math.ceil(meta.fps * 3)) throw new Error("组件至少显示 3 秒，以便依次讲完全部要点。");
  if (instance.timing.startFrame + instance.timing.durationInFrames > meta.durationInFrames) throw new Error("组件结束时间不能超出样板总时长。");
  return state;
}

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!THEMES[result]) throw new Error("未知主题。");
  return result;
}

// Synthetic, non-factual text. Does not read or send the user's video/subtitles.
export function createSampleState({aspectRatio = "9:16", count = 4, theme = "BLUE"} = {}) {
  const labels = ["确认目标", "组织要点", "突出重点", "检查结果", "记录来源"];
  return {
    product: {
      projectId: "cmp-02-sample", aspectRatio, theme,
      shots: [{directorShotId: "sample-shot-01", characterLayoutInstance: {}, componentInstances: [{
        instanceId: "sample-nav-01", componentId: COMPONENT_ID, version: "1.0.0",
        props: {content: {title: "制作要点导航", items: labels.slice(0, count).map((label, i) => ({id: `point-${i + 1}`, label}))}, position: {x: 0, y: 0.299031798}, size: 1, theme: "SOURCE"},
        timing: {startFrame: 15, durationInFrames: 210},
      }]}], globalPackaging: [],
    },
    technical: {stateId: "cmp-02-state", schemaVersion: "1.0.0", lifecycle: "DRAFT", revision: "cmp-02-sample-v1", directorPlanVersion: "synthetic-no-director-plan", fps: 30, durationInFrames: 240, width: aspectRatio === "9:16" ? 1080 : 1920, height: aspectRatio === "9:16" ? 1920 : 1080},
  };
}
