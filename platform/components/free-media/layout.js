// 补建组件（来源不足）：枝鸥 / Overlay Studio 的 20 个效果里没有自由媒体组件，
// RemotionUI 的 Media Frame / Media Sequence 只核验过目录记录、未安装也未复制
// （见 CMP-01 证据表）。因此本组件的内容结构（自由放置的媒体项）与版式由本项目自建：
//   - 内容：1–4 个媒体项，每项有归一化中心点 x / y、画布宽度占比 width、画框比例
//     aspect、填充方式 fit（CONTAIN 不裁切 / COVER 铺满）、圆角 radius 与透明度 opacity；
//   - 版式：媒体框按各自归一化位置自由放置，允许互相叠放（自由媒体本身允许分层），
//     但必须完全落在画布安全区内，否则明确拒绝；
//   - 素材：项目内 publicDir 相对路径，图片与视频都走 Remotion 的真实加载通道。

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  safeMarginRatio: 0.02,
  logoDefaultAspect: 1,
  mediaDefaultAspect: 16 / 9,
  maxRadius: 48,
  staggerMs: 400,
  enterMs: 460,
});

export const KINDS = ["IMAGE", "VIDEO", "LOGO"];
export const FITS = ["CONTAIN", "COVER"];
export const VARIANTS = ["BARE", "FRAMED"];
export const FRAME_BORDER_WIDTH = 2;

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function defaultAspectFor(kind) {
  return kind === "LOGO" ? SOURCE_GEOMETRY.logoDefaultAspect : SOURCE_GEOMETRY.mediaDefaultAspect;
}

export function calculateFreeMediaLayout({content, variant, width, height, stepMs = SOURCE_GEOMETRY.staggerMs}) {
  const scale = equalAreaScale(width, height);
  const marginX = width * SOURCE_GEOMETRY.safeMarginRatio;
  const marginY = height * SOURCE_GEOMETRY.safeMarginRatio;
  const overflow = [];

  const items = content.items.map((item, index) => {
    const boxWidth = item.width * width;
    const boxHeight = boxWidth / item.aspect;
    const centerX = item.x * width;
    const centerY = item.y * height;
    const left = centerX - boxWidth / 2;
    const top = centerY - boxHeight / 2;
    const radius = Math.min(item.radius ?? 0, SOURCE_GEOMETRY.maxRadius) * scale;
    const opacity = item.opacity ?? 1;
    const entry = {
      id: item.id, kind: item.kind, src: item.src, fit: item.fit,
      x: left, y: top, width: boxWidth, height: boxHeight,
      centerX, centerY, radius, opacity,
      borderWidth: variant === "FRAMED" ? FRAME_BORDER_WIDTH * scale : 0,
      enterAtMs: index * stepMs,
      index,
    };
    if (left < marginX - 0.5 || top < marginY - 0.5 || left + boxWidth > width - marginX + 0.5 || top + boxHeight > height - marginY + 0.5) {
      overflow.push({type: "ITEM_OUT_OF_SAFE_AREA", id: item.id, x: left, y: top, width: boxWidth, height: boxHeight});
    }
    return entry;
  });

  return {scale, marginX, marginY, items, overflow};
}

export function resolveEntrance({items, stepMs}) {
  const lastEnterAtMs = Math.max(0, items.length - 1) * stepMs;
  return {
    lastEnterAtMs,
    settledAtMs: lastEnterAtMs + SOURCE_GEOMETRY.enterMs,
    enteredCountAt: timeMs => items.filter((_, index) => timeMs >= index * stepMs).length,
  };
}

// Largest width share an item can take while staying inside the safe area at x / y.
export function maxWidthFor({x, y, aspect, width, height}) {
  const marginX = width * SOURCE_GEOMETRY.safeMarginRatio;
  const marginY = height * SOURCE_GEOMETRY.safeMarginRatio;
  const centerX = x * width;
  const centerY = y * height;
  const byWidth = 2 * Math.min(centerX - marginX, width - marginX - centerX) / width;
  const byHeight = (2 * Math.min(centerY - marginY, height - marginY - centerY) * aspect) / width;
  return Math.max(0, Math.min(1, byWidth, byHeight));
}
