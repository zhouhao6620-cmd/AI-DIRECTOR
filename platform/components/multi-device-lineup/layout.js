// 版式与测量｜多设备排列（MultiDeviceLineup）
//
// 来源几何（RemotionUI `multi-device-lineup`，registry/bases/default/primitives/multi-device-lineup.tsx，
// MIT · commit 802a637）：
//   HARDWARE = phone 148 × 320 / bezel 8 / radius 26、tablet 236 × 316 / bezel 11 / radius 20、
//   laptop 396 × 248 / bezel 9 / radius 12；设备间距 26、设备内标签间距 10；
//   笔记本底座 = 机宽 + 52、高 9、上移 8（重叠），中点有 74 × 3 的铰链缺口；
//   手机顶部有 44 × 9 的听筒条、平板顶部 4 × 4 的摄像头；bezel #15171D、screen #0B0C11、label #7A828F；
//   入场：phone → tablet → laptop，delayInFrames 4、staggerInFrames 9，spring(damping 17 / stiffness 150 / mass 0.75 /
//   overshootClamping)，位移 26 px 上浮 + 0.94 → 1 的 scale（output: "perceptual-scale"）、10 帧淡入；
//   exit：16 帧淡出 + 整体下移 26 px（几何不变）。
//
// 本项目适配差异（逐条记录）：
//   1. 来源只提供容器（屏幕内容由调用方传 ReactNode），本项目把「一套设计在三档宽度上」落成可编辑内容树：
//      一份 screen{title, rows[]} + 每台设备的 label，屏幕内按各自宽度渲染同一份设计（响应式，不缩放字号）；
//   2. 来源画布尺寸由内容决定，本项目定义成来源三台设备的固定排布 = 默认大小（size = 1），缩放为整组件等比缩放；
//   3. 落位改为安全区 0–1 比例；
//   4. 屏幕标题、行文本、设备标签按最窄的一台（手机 148 px 屏宽）做真实字宽校验，放不下就拒绝并说明；
//   5. 主题色：来源没有配色主题（只有硬件灰），本项目用主题色画屏幕里的强调条（唯一的彩色元素）。
import {EASING} from "./elements/motion-tokens/index.js";

export const HARDWARE = Object.freeze({
  phone: {screenW: 148, screenH: 320, bezel: 8, radius: 26},
  tablet: {screenW: 236, screenH: 316, bezel: 11, radius: 20},
  laptop: {screenW: 396, screenH: 248, bezel: 9, radius: 12},
});

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  devices: HARDWARE,
  deviceOrder: ["phone", "tablet", "laptop"],
  deviceGap: 26,
  labelGap: 10,
  laptopBaseExtra: 52,
  laptopBaseHeight: 9,
  laptopBaseOverlap: 8,
  laptopHingeWidth: 74,
  laptopHingeHeight: 3,
  phoneNotchWidth: 44,
  phoneNotchHeight: 9,
  phoneNotchOffset: 5,
  tabletCameraSize: 4,
  bezelColor: "#15171D",
  screenColor: "#0B0C11",
  labelColor: "#7A828F",
  screenPadX: 12,
  screenPadY: 14,
  titleFontSize: 16,
  titleFontWeight: 700,
  rowFontSize: 12,
  rowFontWeight: 500,
  rowGap: 6,
  dividerMarginY: 8,
  dividerHeight: 1,
  accentHeight: 3,
  accentRadius: 2,
  labelFontSize: 12,
  labelLetterSpacingEm: 0.08,
  frameBorder: 1,
  screenRadiusMin: 4,
  bezelInsetShadow: 1,
  shadowY: 18,
  shadowBlur: 44,
  shadowOpacity: 0.55,
  baseGradient: "linear-gradient(180deg, #23262E 0%, #14161B 100%)",
  hingeColor: "rgba(0, 0, 0, 0.55)",
  frameBorderColor: "rgba(255, 255, 255, 0.10)",
  bezelInsetColor: "rgba(255, 255, 255, 0.10)",
  cameraColor: "rgba(255, 255, 255, 0.28)",
  notchColor: "#05060A",
  titleColor: "#F2F5FA",
  rowColor: "rgba(242, 245, 250, 0.62)",
});

export const SOURCE_MOTION = Object.freeze({
  delayFrames: 4,
  staggerFrames: 9,
  fadeFrames: 10,
  exitFrames: 16,
  exitShift: 26,
  riseScaleFrom: 0.94,
  riseScaleTo: 1,
  risePx: 26,
  spring: {damping: 17, stiffness: 150, mass: 0.75, overshootClamping: true},
  minDurationSeconds: 3,
  defaultSize: 1,
  sizeRange: {min: 1, max: 2},
});

export const DEVICE_RANGE = Object.freeze({min: 3, max: 3});
export const ROW_RANGE = Object.freeze({min: 0, max: 4});
export const TITLE_MAX_LENGTH = 7;
export const ROW_MAX_LENGTH = 8;
export const LABEL_MAX_LENGTH = 8;
export const MIN_TEXT_FONT_SIZE = 12;
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const MONO_FONT_FAMILY = '"IBM Plex Mono", ui-monospace, monospace';
export const EASE_ENTER = EASING.enter;
export const EASE_EXIT = EASING.exit;

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, letterSpacing);
}

/** 来源的机身尺寸（屏幕 + 两侧边框）。 */
export function frameOf(kind) {
  const spec = HARDWARE[kind];
  return {
    ...spec,
    width: spec.screenW + spec.bezel * 2,
    height: spec.screenH + spec.bezel * 2,
    screenRadius: Math.max(SOURCE_GEOMETRY.screenRadiusMin, spec.radius - spec.bezel),
    // 来源的笔记本底座比机身宽 52 px（flex 列宽取子元素最大值，所以它决定笔记本那一列的宽度）。
    columnWidth: spec.screenW + spec.bezel * 2 + (kind === "laptop" ? SOURCE_GEOMETRY.laptopBaseExtra : 0),
  };
}

/** 来源的排布：phone → tablet → laptop，间距 26；宽高决定整块的默认大小。 */
export function calculateMultiDeviceLineupLayout({content, width, height, size = 1, position = {x: 0.5, y: 0.5}, measure}) {
  const canvasScale = equalAreaScale(width, height);
  const factor = canvasScale * size;
  const source = SOURCE_GEOMETRY;
  const byKind = new Map(content.devices.map((device) => [device.kind, device]));
  const overflow = [];

  const devices = source.deviceOrder.map((kind, index) => {
    const device = byKind.get(kind);
    const frame = frameOf(kind);
    const labelWidth = device.label
      ? textWidth(measure, device.label, source.labelFontSize, 600, source.labelFontSize * source.labelLetterSpacingEm)
      : 0;
    if (device.label && labelWidth > frame.width + 0.5) {
      overflow.push({kind: "设备标签", text: device.label, available: frame.width, required: labelWidth});
    }
    return {id: device.id, kind, label: device.label, frame, labelWidth, order: index};
  });

  const lineupWidth = devices.reduce((sum, device) => sum + device.frame.columnWidth, 0) + source.deviceGap * (devices.length - 1);
  const tallest = Math.max(...devices.map((device) => (
    device.kind === "laptop"
      ? device.frame.height + source.laptopBaseHeight - source.laptopBaseOverlap
      : device.frame.height
  )));
  const lineupHeight = tallest + source.labelGap + source.labelFontSize * 1.2 + (source.labelFontSize * 0.2);

  // 屏幕内容：一套设计在三档宽度上；手机屏最窄，所以按它校验容量。
  const phoneScreen = source.devices.phone;
  const phoneInner = phoneScreen.screenW - source.screenPadX * 2;
  const titleWidth = textWidth(measure, content.screen.title, source.titleFontSize, source.titleFontWeight);
  if (titleWidth > phoneInner + 0.5) {
    overflow.push({kind: "屏幕标题", text: content.screen.title, available: phoneInner, required: titleWidth});
  }
  const rows = content.screen.rows.map((row) => {
    const rowWidth = textWidth(measure, row.text, source.rowFontSize, source.rowFontWeight);
    if (rowWidth > phoneInner + 0.5) {
      overflow.push({kind: "屏幕行文本", text: row.text, available: phoneInner, required: rowWidth});
    }
    return {id: row.id, text: row.text, width: rowWidth};
  });

  let rejection = null;
  if (overflow.length) {
    rejection = `以下文字在版式里放不下：${overflow
      .map((item) => `${item.kind}「${item.text}」（需要 ${Math.round(item.required)} px，可用 ${Math.round(item.available)} px）`)
      .join("；")}。屏幕里的文字按最窄的一台（手机屏宽 ${phoneScreen.screenW} px）校验：请缩短文字或减少条目。`;
  }

  const boxWidth = lineupWidth * factor;
  const boxHeight = lineupHeight * factor;
  const safeX = width * SAFE_X_RATIO;
  const safeY = height * SAFE_Y_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const fitsSafeArea = boxWidth <= availableWidth + 0.5 && boxHeight <= availableHeight + 0.5;

  return {
    canvasScale,
    factor,
    sourceWidth: lineupWidth,
    sourceHeight: lineupHeight,
    drawWidth: boxWidth,
    drawHeight: boxHeight,
    boxWidth,
    boxHeight,
    fitsSafeArea,
    availableWidth,
    availableHeight,
    devices,
    rows,
    titleWidth,
    phoneInner,
    lineupWidth,
    lineupHeight,
    overflow,
    rejection,
    x: safeX + (availableWidth - boxWidth) * position.x,
    y: safeY + (availableHeight - boxHeight) * position.y,
  };
}
