// 预览专用垫片（由 scripts/remotionui-preview-build.mjs 生成）
// 代替 @remotion/google-fonts/<Family>：不下载字体，直接给系统字体栈，让组件能渲染。
const FONT_FAMILY = '"PingFang SC", "Noto Sans CJK SC", Inter, system-ui, sans-serif';
export const loadFont = () => ({fontFamily: FONT_FAMILY, fonts: {}, unicodeRanges: {}, waitUntilDone: () => Promise.resolve()});
export const loadFontFromInfo = () => loadFont();
export const getAvailableFonts = () => [];
export const getInfo = () => ({});
export default loadFont;
