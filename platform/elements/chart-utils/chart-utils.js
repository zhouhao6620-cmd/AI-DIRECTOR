// Element EL-UTIL-001｜图表工具（chart-utils）
//
// Adapted from the RemotionUI source library (source-copy library, MIT, commit 802a637):
//   source file: registry/bases/default/lib/chart-utils.ts
//   local copy : RemotionGit/registry/chart-utils.json → files[0].content
//
// Adaptations (recorded in docs/component-assets/CMP-06_DATA_CHARTS_ADAPTATION.md):
//   1. every source function and its maths are kept as-is, so all six charts in this batch
//      project their line / area / bars / ticks from one plot rectangle exactly like the source;
//   2. `formatCompactNumber` speaks the project's language by default — the source prints `124K`,
//      a Chinese-first video needs `12.4万`;
//   3. added `textWidth` / `fitTextToWidth`: CJK labels have no word boundaries and no source
//      helper measures them, so every label in this batch is measured against its own slot,
//      scaled down to a 12 px floor, and reported as an overflow instead of being clipped;
//   4. added the project canvas helpers `equalAreaScale` / `safeAreaOf` (05 基线 §1.4 安全区
//      约定：横向 84 px、纵向 8%) that all six charts share.

/**
 * @typedef {{label: string, value: number, color?: string, delta?: string}} ChartDatum
 * @typedef {{x: number, y: number, label?: string}} ChartPoint
 * @typedef {{min: number, max: number, span: number}} ChartDomain
 * @typedef {{left: number, top: number, right: number, bottom: number, width: number, height: number}} PlotArea
 * @typedef {{top?: number, right?: number, bottom?: number, left?: number}} PlotInsets
 * @typedef {{x: number, y: number, value: number, label?: string}} PlottedPoint
 */

const clamp01 = value => Math.min(1, Math.max(0, value));

/** Raw min/max of a series. `includeZero` anchors bar charts to a true zero. */
export function getChartDomain(values, {includeZero = false} = {}) {
  const finite = values.filter(value => Number.isFinite(value));
  if (finite.length === 0) return {min: 0, max: 1, span: 1};
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

/** Domain snapped outward to round numbers, with the ticks that land inside it. */
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

/** Inner rectangle of a chart. Insets are per-edge: the left gutter holds the axis labels. */
export function getPlotArea(width, height, insets = {}) {
  const top = insets.top ?? 24;
  const right = insets.right ?? 24;
  const bottom = insets.bottom ?? 24;
  const left = insets.left ?? 24;
  return {
    left, top, right: width - right, bottom: height - bottom,
    width: Math.max(1, width - left - right),
    height: Math.max(1, height - top - bottom),
  };
}

/** Projects data points into plot coordinates. */
export function plotPoints(points, plot, yDomain) {
  const xDomain = getChartDomain(points.map(point => point.x));
  return points.map(point => ({
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
 * Cardinal spline through the points, with control points clamped inside each segment's own y
 * range — an unclamped spline overshoots past local minima, which on a chart reads as data that
 * was never in the series.
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
    const clampY = value => Math.min(upperBound, Math.max(lowerBound, value));
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

/**
 * Compact number, in the project's language.
 *
 * Source behaviour (`en`): 124000 → `124K`. Adaptation: the workbench is Chinese-first, so the
 * default locale is `zh-CN` and the same value reads `12.4万`. Pass an explicit locale to get the
 * source behaviour back (the unit tests pin both).
 */
export function formatCompactNumber(value, maximumFractionDigits = 1, locale = "zh-CN") {
  return new Intl.NumberFormat(locale, {notation: "compact", maximumFractionDigits}).format(value);
}

/** Axis ticks drop the fraction `formatCompactNumber` keeps: `0 / 30万 / 60万` reads quieter. */
export function formatAxisValue(value, locale = "zh-CN") {
  return formatCompactNumber(value, Math.abs(value) < 10 ? 1 : 0, locale);
}

/** Splits a delta string into its direction and text so callers can colour it. */
export function readDelta(delta) {
  if (!delta) return {direction: "flat", text: ""};
  const trimmed = delta.trim();
  if (trimmed.startsWith("+")) return {direction: "up", text: trimmed};
  if (trimmed.startsWith("-") || trimmed.startsWith("−")) return {direction: "down", text: trimmed};
  return {direction: "flat", text: trimmed};
}

// ---------------------------------------------------------------------------
// Project adaptations (not in the source)
// ---------------------------------------------------------------------------

/** Source canvas reference: 1920 × 1080. Equal-area scaling keeps an element the same size. */
export const REFERENCE_CANVAS = Object.freeze({width: 1920, height: 1080});
/** Project safe area: 84 px horizontal at 1080 wide, 8% vertical. */
export const SAFE_X_RATIO = 84 / 1080;
export const SAFE_Y_RATIO = 0.08;
/** Below this the browser measurement is no longer a fair fit, so content is refused instead. */
export const MIN_TEXT_FONT_SIZE = 12;

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (REFERENCE_CANVAS.width * REFERENCE_CANVAS.height));
}

export function safeAreaOf(width, height) {
  const insetX = width * SAFE_X_RATIO;
  const insetY = height * SAFE_Y_RATIO;
  return {insetX, insetY, width: width - insetX * 2, height: height - insetY * 2};
}

/**
 * Places a box of `boxWidth × boxHeight` inside the safe area.
 * `position` is the project's 0–1 ratio on both axes. When the box is larger than the safe area
 * (which the 3.0× size ceiling allows on purpose) the free travel becomes 0 instead of negative,
 * so the box still moves with the ratio and never inverts.
 */
export function placeInSafeArea({boxWidth, boxHeight, position = {x: 0, y: 0}, width, height}) {
  const safe = safeAreaOf(width, height);
  return {
    safe,
    x: safe.insetX + Math.max(0, safe.width - boxWidth) * position.x,
    y: safe.insetY + Math.max(0, safe.height - boxHeight) * position.y,
  };
}

/**
 * Width of a text run as measured by the caller's `measure(text, fontSize, fontWeight, letterSpacing)`,
 * plus the letter-spacing the source applies (which `measure` does not know about).
 */
export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight, 0) + [...text].length * letterSpacing;
}

/**
 * Fits one line of text into `maxWidth`.
 *
 * Returns the font size to draw at (never below `minFontSize`) and whether the text still does not
 * fit — a caller turns that flag into a refusal with a reason, so a Chinese label is never silently
 * clipped by the SVG viewport the way the source lets it be.
 */
export function fitTextToWidth(measure, text, {
  fontSize, fontWeight = 400, letterSpacing = 0, maxWidth, minFontSize = MIN_TEXT_FONT_SIZE,
}) {
  const natural = textWidth(measure, text, fontSize, fontWeight, letterSpacing);
  if (natural <= maxWidth) return {fontSize, letterSpacing, width: natural, fits: true};
  const scaled = Math.max(minFontSize, fontSize * (maxWidth / natural));
  const ratio = scaled / fontSize;
  const width = textWidth(measure, text, scaled, fontWeight, letterSpacing * ratio);
  return {fontSize: scaled, letterSpacing: letterSpacing * ratio, width, fits: width <= maxWidth + 0.5};
}

/** Formats a number with a fixed number of decimals, tabular figures friendly. */
export function formatNumber(value, decimals = 0, locale = "en-US") {
  return value.toLocaleString(locale, {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

function round(value) {
  return Math.round(value * 100) / 100;
}
