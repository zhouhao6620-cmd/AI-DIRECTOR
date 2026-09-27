// HyperFrames Adapter｜Composition 编译器（冒烟测试版）
//
// Role: Reference（冒烟测试件，不是基线）
// 作用：ProductionState → HyperFrames Composition 的「实例宿主」属性。
//
// 依据调研指南：
//   §14 时间映射：ProductionState.start/duration → data-start / data-duration（秒）
//   §15 层级映射：ProductionState.layer → CSS z-index（不用 data-track-index 承担层级）
//   §16 data-track-index 只作 Studio 兼容 / Debug / 时间线提示，不是产品轨道契约
//   §34 实例级覆盖：同一份 Sub-Composition 资产用 data-variable-values 承载每实例变量
//
// 事实源：assets/cmp-skl-001/definition.json（CMP-SKL-001 冻结定义的只读副本）。

import definition from "../assets/cmp-skl-001/definition.json" with {type: "json"};
import {toVariables} from "./hyper-config-mapper.mjs";

export const COMPONENT_ID = definition.identity.componentId;
export const COMPONENT_VERSION = definition.identity.version;
export const COMPOSITION_ENTRY = "compositions/skill-intro-card.html";

// 四轨 → z-index 的运行时内部映射（调研指南 §15 的示例值，不暴露给普通用户）。
export const LAYER_Z_INDEX = Object.freeze({
  BASE_VIDEO: 0,
  CHARACTER_LAYOUT: 10,
  MOTION_COMPONENT: 20,
  SUBTITLE: 100,
  CHAPTER_PROGRESS: 110,
});

// Studio 时间线提示位：Base Video 0 / Main Motion 1 / Global Packaging 2 / Audio 10。
export const TRACK_INDEX_HINT = Object.freeze({
  BASE_VIDEO: 0,
  MOTION_COMPONENT: 1,
  GLOBAL_PACKAGING: 2,
  AUDIO: 10,
});

const LIMITS = {
  minCards: definition.content.minCardinality,
  maxCards: definition.content.maxCardinality,
  skillMaxLength: definition.content.skillMaxLength,
  hookMaxLength: definition.content.hookMaxLength,
  bodyMaxLength: definition.content.bodyMaxLength,
  badgeMaxLength: definition.content.badgeMaxLength,
  accents: definition.content.accentModes,
  minSlotMs: 2600,
};

// 冒烟版子合成把卡槽时间写死为每张 4.0 秒（3 张卡 / 12 秒，即 CMP-SKL-001 样例的时长）。
// Remotion 版是按实例时长均分；HyperFrames 版要支持任意时长，需要由编译器生成卡槽，
// 这属于冒烟测试之后的正式化工作，所以在编译器里先明确挡住，避免产出合成渲染不了的绑定。
const SMOKE_SLOT_MS = 4000;

function assertCard(card, index) {
  const slot = index + 1;
  const label = `第 ${slot} 张卡`;
  if (typeof card?.skill !== "string" || !card.skill.trim()) throw new Error(`${label}缺少技能名。`);
  if (typeof card?.hook !== "string" || !card.hook.trim()) throw new Error(`${label}缺少钩子观点。`);
  if (typeof card?.body !== "string" || !card.body.trim()) throw new Error(`${label}缺少说明段。`);
  if ([...card.skill].length > LIMITS.skillMaxLength) throw new Error(`${label}技能名超过 ${LIMITS.skillMaxLength} 字符。`);
  if ([...card.hook].length > LIMITS.hookMaxLength) throw new Error(`${label}钩子观点超过 ${LIMITS.hookMaxLength} 字。`);
  if ([...card.body].length > LIMITS.bodyMaxLength) throw new Error(`${label}说明超过 ${LIMITS.bodyMaxLength} 字。`);
  if (card.badge && [...card.badge].length > LIMITS.badgeMaxLength) throw new Error(`${label}数据胶囊超过 ${LIMITS.badgeMaxLength} 字。`);
  if (card.accent && !LIMITS.accents.includes(card.accent)) throw new Error(`${label}强调色 ${card.accent} 不在支持范围。`);
}

// 内容树 → 变量；同时守住与 Remotion 版同源的容量上限（超出直接拒绝，不裁切、不缩字）。
export function compileContent({content, surface = "DARK", instanceTheme = "SOURCE", projectTheme = "BLUE", position}) {
  const cards = content?.cards;
  if (!Array.isArray(cards)) throw new Error("内容树缺少 cards 数组。");
  if (cards.length < LIMITS.minCards || cards.length > LIMITS.maxCards) {
    throw new Error(`技能介绍卡需要 ${LIMITS.minCards}–${LIMITS.maxCards} 张卡，当前 ${cards.length} 张。`);
  }
  cards.forEach(assertCard);
  return toVariables({content, surface, instanceTheme, projectTheme, position});
}

// 实例时长均分给每张卡；每张卡低于可读下限时明确拒绝（与 layout.js resolveCardTimeline 同源）。
export function compileTimeline({startFrame, durationInFrames, cardCount, fps}) {
  const start = startFrame / fps;
  const duration = durationInFrames / fps;
  const slotMs = (durationInFrames / fps) * 1000 / cardCount;
  if (slotMs < LIMITS.minSlotMs) {
    const need = (LIMITS.minSlotMs * cardCount) / 1000;
    throw new Error(`${cardCount} 张卡每张至少需要 ${(LIMITS.minSlotMs / 1000).toFixed(1)} 秒，当前总时长只有 ${duration.toFixed(1)} 秒；请延长片段到 ${need.toFixed(1)} 秒以上或减少卡数。`);
  }
  if (Math.abs(slotMs - SMOKE_SLOT_MS) > 1) {
    throw new Error(
      `冒烟版子合成的卡槽写死为每张 ${SMOKE_SLOT_MS / 1000} 秒：当前 ${cardCount} 张卡 / 总时长 ${duration.toFixed(1)} 秒`
      + ` → 每张 ${(slotMs / 1000).toFixed(1)} 秒，合成渲染不出来。`
      + ` 要支持任意时长，需要由编译器按实例时长生成 ${cardCount} 段卡槽（冒烟测试之后的正式化工作）。`,
    );
  }
  return {start, duration, slotSeconds: duration / cardCount, slotMs};
}

// ProductionState 里的单个组件实例 → HyperFrames 宿主元素属性。
export function compileInstance({instance, meta, projectTheme = "BLUE"}) {
  if (instance.componentId !== COMPONENT_ID) {
    throw new Error(`只接受 ${COMPONENT_ID}，当前为 ${instance.componentId}。`);
  }
  const compiled = compileContent({
    content: instance.props.content,
    surface: instance.props.surface,
    instanceTheme: instance.props.theme,
    projectTheme,
    position: instance.props.position,
    size: instance.props.size ?? 1,
    durationSeconds: instance.timing.durationInFrames / meta.fps,
  });
  const timing = compileTimeline({
    startFrame: instance.timing.startFrame,
    durationInFrames: instance.timing.durationInFrames,
    cardCount: instance.props.content.cards.length,
    fps: meta.fps,
  });
  const layer = instance.layer ?? "MOTION_COMPONENT";
  return {
    instanceId: instance.instanceId,
    componentId: COMPONENT_ID,
    version: COMPONENT_VERSION,
    entry: COMPOSITION_ENTRY,
    theme: compiled.theme,
    surface: compiled.surface,
    timing,
    attributes: {
      "data-start": String(timing.start),
      "data-duration": String(timing.duration),
      // 只作 Studio / Debug 提示，不承担渲染层级（层级走 z-index）。
      "data-track-index": String(TRACK_INDEX_HINT.MOTION_COMPONENT),
      style: `z-index:${LAYER_Z_INDEX[layer] ?? LAYER_Z_INDEX.MOTION_COMPONENT}`,
      "data-variable-values": JSON.stringify(compiled.variables),
    },
    variables: compiled.variables,
  };
}

// 冒烟测试用的最小 ProductionState（结构与 createSampleState 同源，字段按组件契约收窄）。
export function createSampleState({content, durationSeconds = 12, fps = 30, aspectRatio = "16:9"} = {}) {
  return {
    product: {
      projectId: "cmp-skl-001-hyperframes-smoke",
      aspectRatio,
      theme: "BLUE",
      shots: [{
        directorShotId: "sample-shot-01",
        characterLayoutInstance: {},
        componentInstances: [{
          instanceId: "sample-skill-intro-card-01",
          componentId: COMPONENT_ID,
          version: COMPONENT_VERSION,
          layer: "MOTION_COMPONENT",
          props: {
            content,
            position: {x: 0.5, y: 0.5},
            size: 1,
            surface: "DARK",
            theme: "SOURCE",
          },
          timing: {startFrame: 0, durationInFrames: Math.round(durationSeconds * fps)},
        }],
      }],
      globalPackaging: [],
    },
    technical: {fps, durationInFrames: Math.round(durationSeconds * fps), width: 1920, height: 1080},
  };
}
