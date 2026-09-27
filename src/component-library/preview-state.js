// 预览实例状态与能力说明（LIB-01 阶段 3）
//
// 三层职责（05 §8.4）：
//   Component Definition｜组件定义 —— 只读展示 + 修订入口；
//   Preview Instance｜预览实例    —— 本模块构造，只在本页生效、不落盘、不写 Project / Production State；
//   Project Instance｜项目实例    —— 不在组件库，属智能包装工作台。
//
// 控件由组件定义声明决定：声明了哪项能力才出现哪个控件，未声明的写明原因。
// 推导逻辑直接复用 `src/component-lab/control-plan.js`（只 import，不改它）。
//
// 本模块不含 JSX，Node 与浏览器都能直接导入。

import {
  buildControlPlan, buildFieldSchema, carrierFor, carrierPaths, instanceLocus, instanceOf,
  readPath, writePath,
} from "../component-lab/control-plan.js";

// 满额预览的填充上限：字幕这类定义的条目上限是 500，真按 500 填会让预览失去意义。
// 达到上限时在面板上写明「填到 N 条 / 上限 M 条」，不假装已经到顶。
export const FILL_CAP = 12;

// 详情页预览的默认口径（用户当前指令）：横屏 16:9、深色底。
// 组件样板自带的画幅不动，只在组件库的预览实例上套默认值。
export const PREVIEW_DEFAULT_ASPECT_RATIO = "16:9";
export const PREVIEW_DEFAULT_SIZE = {width: 1920, height: 1080};

export function withPreviewDefaults(state) {
  const next = structuredClone(state);
  next.product.aspectRatio = PREVIEW_DEFAULT_ASPECT_RATIO;
  next.technical = {...next.technical, ...PREVIEW_DEFAULT_SIZE};
  return next;
}

export const BOUNDARY_PRESETS = [
  {id: "sample", label: "样例内容", note: "组件自带的样板内容，等价于刚注册时的样子。"},
  {id: "full", label: "满额内容", note: "按定义上限把条目填满（时间轴类组件均分整段时间）。"},
  {id: "empty", label: "空内容", note: "清空条目与必填文字，用来查看组件的边界行为。"},
];

export const CAPABILITY_ROWS = [
  {id: "content", label: "内容编辑", key: "contentEditing"},
  {id: "position", label: "位置", key: "position"},
  {id: "size", label: "大小", key: "size"},
  {id: "theme", label: "主题", key: "theme"},
  {id: "variant", label: "变体", key: "variant"},
  {id: "assetReplace", label: "素材替换", key: "assetReplace"},
];

// 每个组件从定义新建一个独立的预览实例；页面之间互不影响。
export function createPreviewState(entry) {
  const state = entry.createState();
  if (entry.assertState) entry.assertState(state);
  return state;
}

export function previewInstance(state) {
  return instanceOf(state);
}

export function previewLocus(state) {
  return instanceLocus(state);
}

export function previewProps(state) {
  return instanceOf(state)?.props ?? {};
}

export function readPreviewPath(state, path) {
  return readPath(state, `${instanceLocus(state)}.props.${path}`);
}

export function writePreviewPath(state, path, value) {
  return writePath(state, `${instanceLocus(state)}.props.${path}`, value);
}

export function controlPlanFor(entry, state) {
  return buildControlPlan({
    componentId: entry.componentId,
    definition: entry.definition,
    contentSchema: entry.contentSchema,
    sampleState: state,
  });
}

export function fieldSchemaOf(entry) {
  return buildFieldSchema(entry.contentSchema, entry.contentSchema);
}

export function carrierPathsFor(entry, capability, state) {
  return carrierPaths(entry.componentId, capability, state);
}

export function carrierForCapability(entry, capability) {
  return carrierFor(entry.componentId, capability);
}

// 校验 + 投影：预览区只渲染「真实能渲染」的状态。
// 状态被组件拒绝时不渲染，而是把组件给出的原因原样显示出来（边界行为保持可见）。
export function previewProjection(entry, state, project) {
  try {
    entry.assertState(state);
  } catch (error) {
    return {ok: false, error: error.message, projection: null};
  }
  return {ok: true, error: null, projection: project(state)};
}

// 边界预览：在样板状态上派生，绝不改动样板本身。
export function boundaryState(entry, preset, sampleState) {
  const state = structuredClone(sampleState);
  if (preset === "sample" || !entry.contentSchema) return state;
  const instance = instanceOf(state);
  if (!instance?.props || !("content" in instance.props)) return state;
  const durationMs = Math.round((instance.timing?.durationInFrames ?? 0) / (state.technical?.fps ?? 30) * 1000);
  if (preset === "full") {
    // 计数器跨整棵内容树共享：复制出来的条目在整棵树里都唯一（有些组件要求分支名、金句行不重复）。
    instance.props.content = fillValue(instance.props.content, entry.contentSchema, entry.contentSchema, durationMs, {next: 0});
  }
  if (preset === "empty") instance.props.content = emptyValue(instance.props.content, entry.contentSchema, entry.contentSchema);
  return state;
}

function fillValue(value, schema, root, durationMs, counter) {
  const descriptor = buildFieldSchema(schema, root);
  if (descriptor.kind === "object") {
    if (!value || typeof value !== "object") return value;
    for (const field of descriptor.fields) {
      if (field.key in value) value[field.key] = fillValue(value[field.key], field.schema, root, durationMs, counter);
    }
    return value;
  }
  if (descriptor.kind !== "array" || !Array.isArray(value)) return value;
  const max = Number.isFinite(descriptor.maxItems) ? descriptor.maxItems : value.length;
  const target = Math.max(value.length, Math.min(max, FILL_CAP));
  if (isTimeRanged(value)) {
    value.splice(0, value.length, ...fillTimeline(value, target, durationMs, counter));
  } else {
    while (value.length < target) value.push(cloneFresh(value.at(-1), descriptor.item.schema, root, counter));
  }
  for (const [index, item] of value.entries()) value[index] = fillValue(item, descriptor.item.schema, root, durationMs, counter);
  return value;
}

// 空内容：条目清空、文字清空。组件如果按定义拒绝（最少条目、必填文字），
// 预览区会原样显示拒绝原因，而不是假装渲染成功。
function emptyValue(value, schema, root) {
  const descriptor = buildFieldSchema(schema, root);
  if (descriptor.kind === "object") {
    if (!value || typeof value !== "object") return value;
    for (const field of descriptor.fields) {
      if (field.key in value) value[field.key] = emptyValue(value[field.key], field.schema, root);
    }
    return value;
  }
  if (descriptor.kind === "array") return [];
  if (descriptor.kind === "string") return "";
  return value;
}

const isTimeRanged = list => list.length > 0 && list.every(item => Number.isFinite(item?.startMs) && Number.isFinite(item?.endMs));

// 时间轴类条目不能靠复制最后一条来「填满」（会重叠、越界）：把整段时间均分，
// 文字沿用已有条目并循环取用，ID 换成新的唯一 ID。
function fillTimeline(list, target, durationMs, counter) {
  const fallbackEnd = list.at(-1)?.endMs ?? durationMs;
  const total = Math.max(1, Math.min(fallbackEnd, durationMs || fallbackEnd));
  const segment = total / target;
  return Array.from({length: target}, (_, index) => {
    const source = structuredClone(list[index % list.length]);
    const startMs = Math.round(index * segment);
    const endMs = index === target - 1 ? Math.round(total) : Math.round((index + 1) * segment);
    return {...source, id: freshId(source?.id, counter), startMs, endMs: Math.max(endMs, startMs + 1)};
  });
}

// 复制样例条目时同时换新 ID、给文字加序号：有些组件要求文案不完全重复
//（金句行、分支名），只复制文字会被定义判为无效。这里不编造新内容，只加区分序号。
function cloneFresh(item, itemSchema, root, counter) {
  const descriptor = itemSchema ? buildFieldSchema(itemSchema, root ?? itemSchema) : null;
  if (item == null) return templateFrom(descriptor, counter);
  if (typeof item === "string") return appendIndex(item, counter, descriptor?.maxLength);
  if (typeof item !== "object") return item;
  return uniquify(structuredClone(item), descriptor, counter);
}

function uniquify(value, descriptor, counter) {
  if (!descriptor) return value;
  if (descriptor.kind === "object") {
    if (!value || typeof value !== "object") return value;
    for (const field of descriptor.fields) {
      if (!(field.key in value)) continue;
      value[field.key] = field.key === "id" ? freshId(value[field.key], counter) : uniquify(value[field.key], field, counter);
    }
    return value;
  }
  if (descriptor.kind === "array") {
    return Array.isArray(value) ? value.map(entry => uniquify(entry, descriptor.item, counter)) : value;
  }
  return descriptor.kind === "string" ? appendIndex(value, counter, descriptor.maxLength) : value;
}

function appendIndex(text, counter, maxLength) {
  const suffix = ` ${++counter.next}`;
  const limit = Number.isFinite(maxLength) ? Math.max(1, maxLength - suffix.length) : Infinity;
  return `${String(text).slice(0, limit)}${suffix}`;
}

// ID 保持定义要求的字符集（字母 / 数字 / - / _），并在同一条列表里唯一。
function freshId(base, counter, used = new Set()) {
  const cleaned = String(base ?? "item").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "item";
  const sequence = ++counter.next;
  let candidate = `${cleaned}-full${sequence}`;
  let attempt = 1;
  while (used.has(candidate)) { candidate = `${cleaned}-full${sequence}-${attempt++}`; }
  used.add(candidate);
  return candidate;
}

// 新增条目按 schema 生成合法初值：ID 必须符合定义的字符集，其余文字用中文占位。
function templateFrom(descriptor, counter, key = null) {
  if (!descriptor) return {};
  if (descriptor.kind === "object") {
    return Object.fromEntries(descriptor.fields.map(field => [field.key, templateFrom(field, counter, field.key)]));
  }
  if (descriptor.kind === "array") return [];
  if (descriptor.kind === "enum") return descriptor.values[0];
  if (descriptor.kind === "boolean") return false;
  if (descriptor.kind === "number") return descriptor.minimum ?? 0;
  if (descriptor.kind === "string") {
    if (isIdentifierField(key, descriptor)) return `item-full${++counter.next}`;
    return descriptor.minLength ? "新条目" : "";
  }
  return null;
}

function isIdentifierField(key, descriptor) {
  return key === "id" || /\[A-Za-z0-9_-\]/.test(String(descriptor.schema?.pattern ?? ""));
}

// 组件信息面板的只读行：全部取自五层定义，页面不加工语义。
export function capabilityRows(entry) {
  const definition = entry.definition;
  const workbench = definition.workbench ?? {};
  return CAPABILITY_ROWS.map(row => ({
    ...row,
    supported: workbench[row.key] === true,
    detail: capabilityDetail(row, workbench),
  }));
}

function capabilityDetail(row, workbench) {
  if (row.id === "content") return workbench.contentEditing ? "可增删条目、逐字段编辑" : "定义未声明内容编辑";
  if (row.id === "position") {
    if (!workbench.position) return null;
    if (Array.isArray(workbench.positionModes)) return `固定落位：${workbench.positionModes.join(" / ")}`;
    const range = workbench.positionRange ?? {min: 0, max: 1};
    return `自由落位 ${range.min}–${range.max}（${range.space ?? "可用安全区"}）`;
  }
  if (row.id === "size") {
    if (!workbench.size) return null;
    const range = workbench.sizeRange ?? {min: 0.8, max: 1.2};
    return `缩放 ${range.min}–${range.max}（${range.unit === "CANVAS_WIDTH_SHARE" ? "画布宽度占比" : "相对来源尺寸"}）`;
  }
  if (row.id === "theme") {
    if (!workbench.theme) return null;
    return `${(workbench.themes ?? []).length} 套主题 · ${(workbench.themeModes ?? []).length} 种模式`;
  }
  if (row.id === "variant") return workbench.variant ? (workbench.variants ?? []).join(" / ") : null;
  if (row.id === "assetReplace") return workbench.assetReplace ? (workbench.assetKinds ?? []).join(" / ") : null;
  return null;
}

// 本机素材候选：目录里的静态示意图。组件演示由播放器运行代码，不把预渲染视频当素材。
export function localAssetCandidates(entries, kind) {
  return entries.flatMap(entry => {
    const id = entry.componentId;
    const poster = {src: `component-previews/${id}/poster.png`, kind: "IMAGE", label: `${id} 示意图`};
    return [poster].filter(candidate => !kind || candidate.kind === kind || (kind === "LOGO" && candidate.kind === "IMAGE"));
  });
}

export function assetUrlOf(src) {
  if (!src) return null;
  return `/${String(src).replace(/^\/+/, "").replace(/^public\//, "")}`;
}
