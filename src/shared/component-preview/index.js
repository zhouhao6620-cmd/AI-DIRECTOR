// 预览内核出口（LIB-01 阶段 5）
//
// 四类消费方统一从这里 import：
//   import {ComponentPreview, resolveComposition, SURFACE_PRESETS} from "../../shared/component-preview/index.js";
// 不允许任何页面再写第二份预览实现。
export {ComponentPreview, SafeAreaOverlay} from "./ComponentPreview.jsx";
export {
  DEFAULT_BACKGROUND, DEFAULT_INITIAL_FRAME, PLAYBACK_RATES, PREVIEW_BACKGROUNDS, SURFACE_PRESETS,
  previewPlayerApi, registerQaHandles, resolveComposition, resolveInitialFrame, resolvePlaybackRate,
  shouldFallbackAspect, surfaceClassName, surfacePresetOf, surfaceStyle,
} from "./resolve.js";
