// Element｜motion-tokens（Adapted｜组件私有副本）
//
// Source: RemotionGit/registry/motion-tokens.json →
//         registry/bases/default/lib/motion-tokens.ts（MIT，commit 802a637）
// 上游连带来源：registryDependencies = timing + layout；本适配只取环形图真正用到的令牌
//（缓动曲线、时长 / 延迟 / 错峰档位），其余令牌留给后续组件按需取用。
//
// 适配差异：
//   1. 来源用 `Easing` 对象直出；这里同样导出 Remotion 的 `Easing.bezier()` 结果，
//      但把「秒」换算成帧的参考帧率固定为 30（来源 DEFAULT_FPS），保证与来源数值一致；
//   2. 来源 DURATION / DELAY 用 secondsToFrames() 运行时换算，这里换成换算后的常量帧数，
//      数值与来源完全相同（0.4 / 0.8 / 1.2 秒 → 12 / 24 / 36 帧；0.15 / 0.3 秒 → 5 / 9 帧）。
import {Easing} from "remotion";

/** 来源 `motion-tokens.ts` 的 EASING：入场 / 退场 / 编排 / 强调四条曲线。 */
export const EASING = {
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.in(Easing.cubic),
  editorial: Easing.bezier(0.45, 0, 0.55, 1),
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
};

/** 来源 DURATION（secondsToFrames，参考 30 fps）。 */
export const DURATION = {fast: 12, normal: 24, slow: 36};

/** 来源 DELAY。 */
export const DELAY = {none: 0, short: 5, medium: 9};

/** 来源 STAGGER。 */
export const STAGGER = {tight: 4, normal: 8, relaxed: 12};

/** 来源 EMPHASIS。 */
export const EMPHASIS = {subtle: 1.05, medium: 1.1, strong: 1.18};

export const REFERENCE_FPS = 30;

export function secondsToFrames(seconds, fps = REFERENCE_FPS) {
  return Math.round(seconds * fps);
}
