// Source geometry is copied from the Overlay Studio HUD UICallout source:
//   src/effects/hud/UICallout.tsx → `.uc` markup, the `LINE = 130` leader, the
//     `box.w = ringW + LINE + 60` box, the ring at `ringX`, and the tag anchored to
//     the chosen side of the ring
//   src/effects/hud/hud.css      → .uc-box / .uc-ring (2.5 px accent border, 14 px
//     radius) / .uc-line (2.5 px accent stroke, dash-draw 620 ms after 220 ms) /
//     .uc-tag (14 / 26 px padding, 14 px radius, glass fill, 4 px accent left rule,
//     27 px / 600 nowrap label)
//   src/effects/hud/accent.ts    → ACCENT_VAR + offsetVars
// Adaptation inside layout.js: the ring keeps the exact canvas pixel size the user
// picks (it must match the UI element it circles), so the component does NOT scale
// the ring. Instead the tag is measured and the block is widened / refused, so a
// long label stays on canvas where the source's nowrap tag would run off it.

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  lineLength: 130,
  tailOffset: 60,
  boxMinHeight: 80,
  ringBorder: 2.5,
  ringRadius: 14,
  lineWidth: 2.5,
  tagPaddingX: 26,
  tagPaddingY: 14,
  tagRadius: 14,
  tagAccentBorder: 4,
  tagBorder: 1,
  tagFontSize: 27,
  tagFontWeight: 600,
  tagLineHeight: 1.2,
  tagGap: 14,
  defaultRingWidth: 300,
  defaultRingHeight: 170,
  minRingWidth: 80,
  maxRingWidth: 800,
  minRingHeight: 60,
  maxRingHeight: 600,
  ringEnterMs: 460,
  ringScaleFrom: 1.12,
  lineGrowMs: 620,
  lineDelayMs: 220,
  tagEnterMs: 460,
  tagDelayMs: 620,
  tagOffsetY: 12,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const SIDES = ["RIGHT", "LEFT"];
export const SAFE_SIDE_RATIO = 0.0625;
export const SAFE_VERTICAL_RATIO = 0.08;

const round = value => Number(value.toFixed(3));

export function tagOuterWidth(measure, label) {
  const g = SOURCE_GEOMETRY;
  const textWidth = measure(label, g.tagFontSize, g.tagFontWeight, 0);
  return g.tagPaddingX * 2 + g.tagAccentBorder + g.tagBorder * 2 + textWidth;
}

export function buildCalloutGeometry({ring, side, label, measure}) {
  const g = SOURCE_GEOMETRY;
  const boxHeight = Math.max(ring.height, g.boxMinHeight);
  const boxWidth = ring.width + g.lineLength + g.tailOffset;
  const tagWidth = tagOuterWidth(measure, label);
  const midY = boxHeight / 2;
  const tagAnchorX = g.tailOffset - g.tagGap;
  const leftExtent = side === "RIGHT" ? 0 : Math.min(0, tagAnchorX - tagWidth);
  const rightExtent = side === "RIGHT" ? Math.max(boxWidth, ring.width + g.lineLength + g.tagGap + tagWidth) : boxWidth;
  const ringLeft = (side === "RIGHT" ? 0 : g.lineLength + g.tailOffset) - leftExtent;
  const tagLeft = side === "RIGHT" ? ringLeft + ring.width + g.lineLength + g.tagGap : tagAnchorX - tagWidth - leftExtent;
  const lineFrom = side === "RIGHT" ? ringLeft + ring.width : ringLeft;
  const lineTo = side === "RIGHT" ? ringLeft + ring.width + g.lineLength : g.tailOffset - leftExtent;
  return {
    boxWidth, boxHeight, tagWidth, tagAnchorX, leftExtent, rightExtent, midY,
    ringLeft, ringTop: midY - ring.height / 2, tagLeft, lineFrom, lineTo,
    blockWidth: rightExtent - leftExtent,
    blockHeight: boxHeight,
  };
}

export function calculateUICalloutLayout({content, ring, side, position, width, height}, measure) {
  const g = SOURCE_GEOMETRY;
  const geometry = buildCalloutGeometry({ring, side, label: content.label, measure});
  const safeX = width * SAFE_SIDE_RATIO;
  const safeY = height * SAFE_VERTICAL_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  if (geometry.blockWidth > availableWidth + 1e-6) return {
    overflow: true,
    reason: `标注超出安全区：圈选区域 ${ring.width}×${ring.height} px 加标签需要 ${Math.ceil(geometry.blockWidth)} px，超过可用的 ${Math.floor(availableWidth)} px。请调小圈宽或缩短标签。`,
  };
  if (geometry.blockHeight > availableHeight + 1e-6) return {
    overflow: true,
    reason: `标注超出安全区：圈选高度 ${ring.height} px 超过可用的 ${Math.floor(availableHeight)} px，请调小圈高。`,
  };
  // The ring itself is never scaled: it has to keep matching the UI element it
  // circles on the video. Only its placement inside the safe area changes.
  const blockWidth = round(geometry.blockWidth);
  const blockHeight = round(geometry.blockHeight);
  return {
    overflow: false,
    scale: 1,
    ring: {...ring},
    geometry,
    blockWidth,
    blockHeight,
    x: round(safeX + (availableWidth - blockWidth) * position.x),
    y: round(safeY + (availableHeight - blockHeight) * position.y),
    lineLength: g.lineLength,
  };
}
