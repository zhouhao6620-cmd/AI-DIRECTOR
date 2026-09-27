// Element EL-UTIL-002｜动效令牌（motion-tokens）
//
// Adapted from the RemotionUI source library (MIT, commit 802a637):
//   registry/bases/default/lib/motion-tokens.ts   → DURATION / DELAY / STAGGER / EMPHASIS / EASING
//   registry/bases/default/lib/timing.ts          → EASING_ENTER / EASING_EXIT (imported by the above)
//
// Adaptations:
//   1. token values are unchanged — 0.4 / 0.8 / 1.2 s, stagger 4 / 8 / 12 frames, emphasis ramp;
//   2. the source folds seconds into frames at a fixed 30 fps. This project renders at 24/25/30/60,
//      so each token keeps its seconds and `framesFor(seconds, fps)` resolves it per composition
//      (§4.1 requires the interpolate input range to be able to use fps);
//   3. `Easing.in(Easing.cubic)` is expressed as the equivalent CSS bezier
//      cubic-bezier(0.32, 0, 0.67, 1), so every curve in the batch is a plain bezier that can be
//      inlined with `Easing.bezier(...)`.

/** Bezier control points, ready for `Easing.bezier(...)` inside an inlined `interpolate`. */
export const EASING = Object.freeze({
  /** Strong ease-out — entrances, decelerates into place (source EASING_ENTER). */
  enter: Object.freeze([0.16, 1, 0.3, 1]),
  /** Ease-in — exits accelerate away. Never ease-out an exit (source EASING_EXIT). */
  exit: Object.freeze([0.32, 0, 0.67, 1]),
  /** Balanced ease-in-out — editorial holds. */
  editorial: Object.freeze([0.45, 0, 0.55, 1]),
  /** Slight overshoot — emphasis pops. */
  pop: Object.freeze([0.34, 1.56, 0.64, 1]),
});

export const DEFAULT_FPS = 30;

export const DURATION_SECONDS = Object.freeze({fast: 0.4, normal: 0.8, slow: 1.2});
export const DELAY_SECONDS = Object.freeze({none: 0, short: 0.15, medium: 0.3});

/** Source frame counts at its own 30 fps reference (kept so the source maths stays checkable). */
export const DURATION = Object.freeze({fast: 12, normal: 24, slow: 36});
export const DELAY = Object.freeze({none: 0, short: 5, medium: 9});
export const STAGGER = Object.freeze({tight: 4, normal: 8, relaxed: 12});

export const EMPHASIS = Object.freeze({
  /** Type-level accent: a highlighted word inside running copy. */
  subtle: 1.05,
  /** Standalone element that owns its own line. */
  medium: 1.1,
  /** Hero beat — one scene at most. */
  strong: 1.18,
});

export function framesFor(seconds, fps = DEFAULT_FPS) {
  return Math.round(seconds * fps);
}

/** The named durations resolved for the composition actually being rendered. */
export function durationsFor(fps = DEFAULT_FPS) {
  return {
    fast: framesFor(DURATION_SECONDS.fast, fps),
    normal: framesFor(DURATION_SECONDS.normal, fps),
    slow: framesFor(DURATION_SECONDS.slow, fps),
  };
}

export function delaysFor(fps = DEFAULT_FPS) {
  return {
    none: 0,
    short: framesFor(DELAY_SECONDS.short, fps),
    medium: framesFor(DELAY_SECONDS.medium, fps),
  };
}

/** Source spring configs (registry/bases/default/lib/springs.ts) used by the bar scene. */
export const SPRINGS = Object.freeze({
  smooth: Object.freeze({damping: 200, mass: 1, stiffness: 100, overshootClamping: true}),
  snappy: Object.freeze({damping: 20, mass: 0.8, stiffness: 200, overshootClamping: true}),
  bouncy: Object.freeze({damping: 12, mass: 0.9, stiffness: 180, overshootClamping: false}),
});

/** The bar scene's own spring, kept verbatim from the source so the motion is the source's. */
export const BAR_SPRING = Object.freeze({damping: 20, stiffness: 110, mass: 0.9});
