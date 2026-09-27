// 元素零件（组件私有副本）｜chart-utils
// 来源：RemotionUI registry/bases/default/lib/chart-utils.ts
//       RemotionGit/registry/chart-utils.json（MIT · commit 802a637）
// 适配：TypeScript → 本项目 ESM（去类型标注）；几何算法逐行保留，未改数值口径。
// 说明：本批 5 个图表组件的私有副本字节一致；第 2 次被复制前应由总控提升为
//       platform/elements/chart-utils/ 共享零件（技能 V1.4 护栏第 12 条）。

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Raw min/max of a series. `includeZero` anchors bar charts to a true zero. */
export function getChartDomain(values, {includeZero = false} = {}) {
  const finite = values.filter((value) => Number.isFinite(value));

  if (finite.length === 0) {
    return {min: 0, max: 1, span: 1};
  }

  const min = Math.min(...finite, includeZero ? 0 : Infinity);
  const max = Math.max(...finite, includeZero ? 0 : -Infinity);

  // A flat series still needs a span, otherwise every point lands on one line.
  if (min === max) {
    const padding = Math.abs(max) || 1;
    return {min: min - padding, max: max + padding, span: padding * 2};
  }

  return {min, max, span: max - min};
}

/** Rounds a raw step up to the nearest 1 / 2 / 5 × 10ⁿ so ticks read cleanly. */
function niceStep(rawStep) {
  if (rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Domain snapped outward to round numbers, with the tick values that land
 * inside it. Charts read as measured rather than arbitrary when the axis stops
 * at 60K instead of 58.4K.
 */
export function niceDomain(values, {includeZero = true, tickCount = 4} = {}) {
  const raw = getChartDomain(values, {includeZero});
  const step = niceStep(raw.span / Math.max(1, tickCount));
  const min = Math.floor(raw.min / step) * step;
  const max = Math.ceil(raw.max / step) * step;
  const ticks = [];

  // Float steps accumulate error, so walk an integer index instead.
  for (let index = 0; min + index * step <= max + step * 1e-6; index += 1) {
    ticks.push(Number((min + index * step).toPrecision(12)));
  }

  return {min, max, span: max - min || 1, ticks};
}

/** Normalized 0→1 position of a value inside a domain. */
export function scaleValue(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Inner rectangle of a chart. Insets are per-edge because the left gutter has
 * to hold axis labels while the right edge only needs room for the line cap.
 */
export function getPlotArea(width, height, insets = {}) {
  const top = insets.top ?? 24;
  const right = insets.right ?? 24;
  const bottom = insets.bottom ?? 24;
  const left = insets.left ?? 24;

  return {
    left,
    top,
    right: width - right,
    bottom: height - bottom,
    width: Math.max(1, width - left - right),
    height: Math.max(1, height - top - bottom),
  };
}

/**
 * Projects data points into plot coordinates.
 *
 * The x domain is the index range rather than the x values when points are
 * evenly spaced categories — pass real x values and they are honoured.
 */
export function plotPoints(points, plot, yDomain) {
  const xDomain = getChartDomain(points.map((point) => point.x));

  return points.map((point) => ({
    x: plot.left + scaleValue(point.x, xDomain.min, xDomain.max) * plot.width,
    y: plot.bottom - clamp01(scaleValue(point.y, yDomain.min, yDomain.max)) * plot.height,
    value: point.y,
    label: point.label,
  }));
}

/** Straight polyline through the projected points. */
export function buildLinePath(points) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`).join(" ");
}

/**
 * Cardinal spline through the points, with control points clamped inside each
 * segment's own y range. Unclamped splines overshoot past local minima, which
 * on a chart reads as data that was never in the series.
 */
export function buildSmoothPath(points, tension = 0.42) {
  if (points.length < 3) return buildLinePath(points);

  const parts = [`M ${round(points[0].x)} ${round(points[0].y)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;

    const lowerBound = Math.min(current.y, next.y);
    const upperBound = Math.max(current.y, next.y);
    const clampY = (value) => Math.min(upperBound, Math.max(lowerBound, value));

    const c1x = current.x + ((next.x - previous.x) / 6) * tension * 2;
    const c1y = clampY(current.y + ((next.y - previous.y) / 6) * tension * 2);
    const c2x = next.x - ((after.x - current.x) / 6) * tension * 2;
    const c2y = clampY(next.y - ((after.y - current.y) / 6) * tension * 2);

    parts.push(`C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(next.x)} ${round(next.y)}`);
  }

  return parts.join(" ");
}

/** Closes a line path down to a baseline so it can be filled. */
export function buildAreaPath(linePath, points, baselineY) {
  if (points.length === 0 || linePath === "") return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${round(last.x)} ${round(baselineY)} L ${round(first.x)} ${round(baselineY)} Z`;
}

/** `124000` → `"124K"`. The default label format across the chart layer. */
export function formatCompactNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en", {notation: "compact", maximumFractionDigits}).format(value);
}

/**
 * Axis ticks drop the fraction that `formatCompactNumber` keeps — an axis
 * reading 0 / 30K / 60K is quieter than 0 / 30.0K / 60.0K.
 */
export function formatAxisValue(value) {
  return formatCompactNumber(value, Math.abs(value) < 10 ? 1 : 0);
}

/**
 * Splits a delta string into its direction and text so callers can colour it.
 * Anything that is not clearly signed stays neutral rather than guessing.
 */
export function readDelta(delta) {
  if (!delta) return {direction: "flat", text: ""};
  const trimmed = delta.trim();
  if (trimmed.startsWith("+")) return {direction: "up", text: trimmed};
  if (trimmed.startsWith("-") || trimmed.startsWith("−")) return {direction: "down", text: trimmed};
  return {direction: "flat", text: trimmed};
}

function round(value) {
  return Math.round(value * 100) / 100;
}
