// 元素零件（组件私有副本）｜timing
// 来源：RemotionUI registry/bases/default/lib/timing.ts
//       RemotionGit/registry/timing.json（MIT · commit 802a637 · 2026-09-11）
// 适配：TypeScript → 本项目 ESM（仅去掉类型标注，曲线与常量逐行保留）。
// 说明：本批 6 个组件的 3 份私有副本字节一致（见各自 QA 报告的 sha256 取证）；
//       第 2 次被复制前应由总控提升为 platform/elements/timing/ 共享零件（技能 V1.4 护栏第 12 条）。
import {Easing, interpolate} from "remotion";

export const DEFAULT_FPS = 30;

/** Crisp UI entrance curve from Remotion timing best practices */
export const EASING_ENTER = Easing.bezier(0.16, 1, 0.3, 1);

/** Exit curve — accelerates away (Easing.in) */
export const EASING_EXIT = Easing.in(Easing.cubic);

export function secondsToFrames(seconds, fps = DEFAULT_FPS) {
  return Math.round(seconds * fps);
}

export function framesToSeconds(frames, fps = DEFAULT_FPS) {
  return frames / fps;
}

export function staggerDelay(index, staggerInFrames, baseDelayInFrames = 0) {
  return baseDelayInFrames + index * staggerInFrames;
}

/** Normalized 0→1 enter progress with default ease-out curve */
export function enterProgress(frame, delayInFrames, durationInFrames, easing = EASING_ENTER) {
  return interpolate(frame, [delayInFrames, delayInFrames + durationInFrames], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Normalized 0→1 exit progress with default ease-in curve */
export function exitProgress(frame, delayInFrames, durationInFrames, easing = EASING_EXIT) {
  return interpolate(frame, [delayInFrames, delayInFrames + durationInFrames], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
