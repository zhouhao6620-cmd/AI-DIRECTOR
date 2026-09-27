// Element EL-UTIL-003｜路径工具（path-utils）
//
// Adapted from the RemotionUI source library (MIT, commit 802a637):
//   registry/bases/default/lib/path-utils.ts
//
// The source delegates to `@remotion/paths`. That package is **not** a declared dependency of this
// project — it is only present as a transitive dependency of @remotion/shapes / @remotion/transitions
// and it is absent from package-lock.json — so importing it would be a hidden dependency. The three
// primitives this batch needs are reimplemented here instead:
//
//   pathLength(d)            弧长（按 M / L / C / Z 解析，三次贝塞尔按 24 段采样累加）
//   pointAtLength(d, at)     弧长处的点（画线笔尖沿真实曲线走，而不是按进度插值）
//   getPathDrawStyles(p, d)  与 @remotion/paths 的 evolvePath 相同的 strokeDasharray / dashoffset
//
// Only M / L / C / Z occur here, because every path in this batch is produced by chart-utils
// (buildLinePath / buildSmoothPath / buildAreaPath). The source's fitViewBox / waypointsToPath /
// waypointProgress are not taken — no chart in this batch needs them.

const SAMPLES_PER_CURVE = 24;
const lengthCache = new Map();
const pointCache = new Map();

const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function numbers(text) {
  return (text.match(NUMBER) ?? []).map(Number);
}

/**
 * Splits a `d` string into subpaths of line / cubic segments. Anything else (quadratic, arc) is
 * skipped rather than approximated silently — this batch never emits it, and a wrong curve is worse
 * than a missing one.
 */
function parsePath(d) {
  const cached = pointCache.get(d);
  if (cached) return cached;
  const subpaths = [];
  let current = null;
  let cursor = {x: 0, y: 0};
  const tokens = String(d).match(/[MLCZmlcz][^MLCZmlcz]*/g) ?? [];
  for (const token of tokens) {
    const command = token[0].toUpperCase();
    const values = numbers(token.slice(1));
    if (command === "M") {
      cursor = {x: values[0] ?? cursor.x, y: values[1] ?? cursor.y};
      current = {start: {...cursor}, segments: []};
      subpaths.push(current);
      continue;
    }
    if (!current) {
      current = {start: {...cursor}, segments: []};
      subpaths.push(current);
    }
    if (command === "L") {
      for (let index = 0; index + 1 < values.length; index += 2) {
        const to = {x: values[index], y: values[index + 1]};
        current.segments.push({kind: "line", from: {...cursor}, to});
        cursor = to;
      }
      continue;
    }
    if (command === "C") {
      for (let index = 0; index + 5 < values.length; index += 6) {
        const segment = {
          kind: "curve",
          from: {...cursor},
          c1: {x: values[index], y: values[index + 1]},
          c2: {x: values[index + 2], y: values[index + 3]},
          to: {x: values[index + 4], y: values[index + 5]},
        };
        current.segments.push(segment);
        cursor = segment.to;
      }
      continue;
    }
    if (command === "Z") {
      if (current && (cursor.x !== current.start.x || cursor.y !== current.start.y)) {
        current.segments.push({kind: "line", from: {...cursor}, to: {...current.start}});
        cursor = {...current.start};
      }
    }
  }
  pointCache.set(d, subpaths);
  return subpaths;
}

function curvePoint(segment, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * segment.from.x + b * segment.c1.x + c * segment.c2.x + d * segment.to.x,
    y: a * segment.from.y + b * segment.c1.y + c * segment.c2.y + d * segment.to.y,
  };
}

function measure(subpath) {
  const stops = [{at: 0, point: {...subpath.start}}];
  let total = 0;
  for (const segment of subpath.segments) {
    if (segment.kind === "line") {
      total += Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
      stops.push({at: total, point: {...segment.to}});
      continue;
    }
    let previous = {...segment.from};
    for (let step = 1; step <= SAMPLES_PER_CURVE; step += 1) {
      const point = curvePoint(segment, step / SAMPLES_PER_CURVE);
      total += Math.hypot(point.x - previous.x, point.y - previous.y);
      stops.push({at: total, point});
      previous = point;
    }
  }
  return {stops, length: total};
}

/** Total arc length of the `d` string. Parsing is cached per string, since a `d` never changes. */
export function pathLength(d) {
  if (!d) return 0;
  const cached = lengthCache.get(d);
  if (cached !== undefined) return cached;
  const length = parsePath(d).reduce((sum, subpath) => sum + measure(subpath).length, 0);
  lengthCache.set(d, length);
  return length;
}

export function clampProgress(progress) {
  return Math.min(1, Math.max(0, progress));
}

/** Point at `at` units along the path (across subpaths, in order). */
export function pointAtLength(d, at) {
  if (!d) return null;
  const target = Math.max(0, at);
  let travelled = 0;
  for (const subpath of parsePath(d)) {
    const {stops, length} = measure(subpath);
    if (target > travelled + length) {
      travelled += length;
      continue;
    }
    const wanted = target - travelled;
    let low = 0;
    let high = stops.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (stops[middle].at < wanted) low = middle + 1;
      else high = middle;
    }
    const after = stops[Math.max(1, low)];
    const before = stops[low - 1] ?? stops[0];
    const span = after.at - before.at;
    const ratio = span === 0 ? 0 : (wanted - before.at) / span;
    return {
      x: before.point.x + (after.point.x - before.point.x) * ratio,
      y: before.point.y + (after.point.y - before.point.y) * ratio,
    };
  }
  const last = parsePath(d).at(-1);
  return last ? {...measure(last).stops.at(-1).point} : null;
}

/** Same contract as `@remotion/paths`' evolvePath: dash the path and walk the offset back. */
export function getPathDrawStyles(progress, d) {
  const length = pathLength(d);
  const clamped = clampProgress(progress);
  return {
    strokeDasharray: `${length} ${length}`,
    strokeDashoffset: length * (1 - clamped),
  };
}
