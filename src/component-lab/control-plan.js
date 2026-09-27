// 组件实验页的轻编辑能力计划（LAB-01）
//
// 单一事实源：`definition.workbench` 声明组件开放哪些能力，`content.schema.json`
// 声明内容树有哪些字段。本模块把两者翻译成实验页真正渲染的控件，以及每个能力在
// 实例状态里的落点。实验页面板、自动巡检（scripts/components-lab-verify.mjs）和
// 单测共用这一份计划，避免出现「面板上有控件但改不动画面」或「声明了能力却没有控件」。
//
// 本模块不含 JSX，Node 与浏览器都能直接导入。

export const LAB_CATEGORIES = ["全局层", "数据与数字", "文字与观点", "结构媒体", "导航"];

// 分组依据组件定义的语义族（CMP-04A 数据与数字 / 04B 文字与观点 / 04C 结构媒体），
// 全局包装层与逐项导航单独成组。唯一来源是 definition.semantic.type。
const CATEGORY_BY_TYPE = {
  CHAPTER_PROGRESS: "全局层",
  SUBTITLE: "全局层",
  PROGRESSIVE_NAVIGATION: "导航",
  MULTI_POINT_PINBOARD: "数据与数字",
  KPI_STATEMENT: "数据与数字",
  KPI_INTEGER_COUNTER: "数据与数字",
  DATA_RANKING: "数据与数字",
  KPI_RATIO: "数据与数字",
  DATA_TREND: "数据与数字",
  COMPARISON: "文字与观点",
  KEY_STATEMENT: "文字与观点",
  ANNOTATION: "文字与观点",
  CHECKLIST: "结构媒体",
  STEP_TIMELINE: "结构媒体",
  ENTITY_CHIPS: "结构媒体",
  LOGIC_NODE_GRAPH: "结构媒体",
  EVIDENCE_MEDIA_CARD: "结构媒体",
  FREE_MEDIA: "结构媒体",
};

export function categoryOf(definition) {
  const type = definition?.semantic?.type;
  return CATEGORY_BY_TYPE[type] ?? "其他";
}

// 按左栏顺序分组；组内保持目录顺序，保证输出稳定。
// 语义类型还没归入五类的组件落到「其他」，不会从列表里消失。
export function groupCatalog(entries) {
  // 草稿单独成组，永远排在最前，避免和正式资产混在一起。
  const drafts = entries.filter(entry => entry.draft === true);
  const groups = LAB_CATEGORIES
    .map(category => ({category, entries: entries.filter(entry => entry.draft !== true && categoryOf(entry.definition) === category)}));
  const rest = entries.filter(entry => entry.draft !== true && !LAB_CATEGORIES.includes(categoryOf(entry.definition)));
  if (rest.length) groups.push({category: "其他", entries: rest});
  return [
    ...(drafts.length ? [{category: "草稿", entries: drafts}] : []),
    ...groups.filter(group => group.entries.length > 0),
  ];
}

// 每个能力在实例状态里的落点。位置与大小默认落在实例 props；
// 自由媒体按自己的定义把位置与大小挂在每个媒体项上
//（positionRange.space = CANVAS、sizeRange.unit = CANVAS_WIDTH_SHARE 就是这么声明的），
// 变体在 type-shift 上是来源的「玻璃底」开关 background。
const DEFAULT_CARRIERS = {
  position: {carrier: "PROPS", path: "position"},
  size: {carrier: "PROPS", path: "size"},
  variant: {carrier: "PROPS", path: "variant"},
};
const CARRIER_OVERRIDES = {
  "CMP-MED-001": {
    asset: {carrier: "CONTENT_ITEM", listPath: "content.items", path: "src"},
  },
  "CMP-CHK-001": {position: {carrier: "PROPS", path: "positionOffset"}},
  "CMP-ENT-001": {position: {carrier: "PROPS", path: "positionOffset"}},
  "CMP-EVD-001": {position: {carrier: "PROPS", path: "positionOffset"}, asset: {carrier: "PROPS_BODY", path: "content.media.src"}},
  "CMP-STP-001": {position: {carrier: "PROPS", path: "positionOffset"}},
  "CMP-TYP-001": {variant: {carrier: "PROPS", path: "background", note: "来源的玻璃底开关就是变体：NONE 无底、GLASS 复用来源底板。"}},
};

export function carrierFor(componentId, capability) {
  return CARRIER_OVERRIDES[componentId]?.[capability] ?? DEFAULT_CARRIERS[capability] ?? null;
}

// 实例在样板状态里的位置：全局包装层组件在 product.globalPackaging[0]，
// 其余在 product.shots[0].componentInstances[0]。
export function instanceLocus(state) {
  if (state?.product?.globalPackaging?.[0]?.componentId) return "product.globalPackaging.0";
  return "product.shots.0.componentInstances.0";
}

export function instanceOf(state) {
  return readPath(state, instanceLocus(state));
}

export function readPath(object, path) {
  return String(path).split(".").reduce((current, key) => (current == null ? undefined : current[key]), object);
}

export function writePath(object, path, value) {
  const keys = String(path).split(".");
  const last = keys.pop();
  const parent = keys.reduce((current, key) => {
    if (current == null) return undefined;
    if (current[key] == null) current[key] = {};
    return current[key];
  }, object);
  if (parent == null) throw new Error(`写入失败：状态里没有这条路径 → ${path}`);
  if (value === undefined) delete parent[last];
  else parent[last] = value;
  return object;
}

// 能力路径统一写成「实例相对路径」，例如 props.position.x、props.content.items.0.x。
// 自由媒体的落点由列表 + 选中项决定，所以要按当前状态算出真实路径。
export function carrierPaths(componentId, capability, state) {
  const carrier = carrierFor(componentId, capability);
  if (!carrier) return null;
  const props = instanceOf(state)?.props ?? {};
  if (carrier.carrier === "CONTENT_ITEM") {
    const items = readPath(props, carrier.listPath) ?? [];
    return items.map((item, index) => ({
      index,
      id: item?.id ?? String(index),
      x: carrier.x ? `props.${carrier.listPath}.${index}.${carrier.x}` : undefined,
      y: carrier.y ? `props.${carrier.listPath}.${index}.${carrier.y}` : undefined,
      value: carrier.path ? `props.${carrier.listPath}.${index}.${carrier.path}` : undefined,
    }));
  }
  // 比例落点（positionRange）落在 props.position 的 x / y 上，大小是单个数值。
  if (capability === "position") {
    return [{index: 0, id: null, value: `props.${carrier.path}`, x: `props.${carrier.path}.x`, y: `props.${carrier.path}.y`}];
  }
  return [{index: 0, id: null, value: `props.${carrier.path}`}];
}

// 内容字段：按 content.schema.json 自动生成。字符串→文本框、数字→数字框、
// 布尔→开关、枚举→下拉、对象→分组、数组→可增删的条目列表。
export function buildFieldSchema(schema, root = schema) {
  if (!schema || typeof schema !== "object") return {kind: "unknown", schema};
  if (schema.$ref) return buildFieldSchema(resolveRef(root, schema.$ref), root);
  if (schema.enum) return {kind: "enum", values: [...schema.enum], schema};
  if (schema.type === "boolean") return {kind: "boolean", schema};
  if (schema.type === "integer" || schema.type === "number") {
    return {kind: "number", integer: schema.type === "integer", minimum: schema.minimum, maximum: schema.maximum, schema};
  }
  if (schema.type === "string") {
    return {kind: "string", minLength: schema.minLength, maxLength: schema.maxLength, schema};
  }
  if (schema.type === "array") {
    return {kind: "array", minItems: schema.minItems ?? 0, maxItems: schema.maxItems ?? Infinity, item: buildFieldSchema(schema.items, root), schema};
  }
  if (schema.type === "object") {
    return {kind: "object", fields: Object.entries(schema.properties ?? {}).map(([key, value]) => ({key, ...buildFieldSchema(value, root)})), schema};
  }
  return {kind: "unknown", schema};
}

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`只支持文档内 $ref：${ref}`);
  return ref.slice(2).split("/").reduce((current, key) => current?.[key], root);
}

// 遍历真实内容树，给出每个可编辑字段的具体路径。数组下标来自当前状态，
// 所以这里的输出直接对应页面上渲染出来的控件。
export function contentFieldPaths(content, schema, root = schema, path = []) {
  const descriptor = buildFieldSchema(schema, root);
  const current = readPath(content, path.join("."));
  if (descriptor.kind === "object") {
    return descriptor.fields.flatMap(field => contentFieldPaths(content, field.schema, root, [...path, field.key]));
  }
  if (descriptor.kind === "array") {
    const list = Array.isArray(current) ? current : [];
    return [{path: path.join("."), kind: "array", descriptor, length: list.length}]
      .concat(list.flatMap((_, index) => contentFieldPaths(content, descriptor.item.schema, root, [...path, index])));
  }
  const key = String(path.at(-1));
  return [{path: path.join("."), kind: descriptor.kind, descriptor, identity: key === "id", value: current}];
}

// 内容树里「改了应该能在画面上看见」的字段：稳定 ID 不参与渲染，素材路径走替换流程，
// 数组本身不直接编辑。巡检与单测用这个列表挑可视字段。
export function visibleContentFields(content, schema) {
  return contentFieldPaths(content, schema).filter(field => {
    if (field.kind === "array" || field.identity) return false;
    if (/^(src|url)$/.test(String(field.path).split(".").pop() ?? "")) return false;
    return ["string", "number", "enum", "boolean"].includes(field.kind);
  });
}

function blockedReason(capability, workbench) {
  const declared = workbench?.[`${capability}Support`];
  if (typeof declared === "string" && declared.length) return declared;
  return capability === "position"
    ? "组件定义声明 position = false：这个组件没有单实例位移，落位由组件自身或全局包装层决定。"
    : "组件定义声明 size = false：这个组件没有整块缩放，尺寸由组件自身的排版与画布决定。";
}

// CL-07：横向／纵向等方向类取值属于「布局方向」组；其余变体按 CL-09 留在「颜色布局」组。
const DIRECTION_VARIANT_VALUES = new Set(["HORIZONTAL", "VERTICAL"]);

export function buildControlPlan({componentId, definition, contentSchema, sampleState}) {
  const workbench = definition?.workbench ?? {};
  const instance = instanceOf(sampleState);
  const content = instance?.props?.content;
  const plan = {
    componentId,
    category: categoryOf(definition),
    workbench,
    contentEditing: Boolean(workbench.contentEditing),
    contentFields: content ? contentFieldPaths(content, contentSchema) : [],
    position: null,
    size: null,
    theme: null,
    variant: null,
    textRoles: [],
    asset: null,
    animation: [],
    blocked: {position: null, size: null},
  };

  if (workbench.theme) {
    plan.theme = {
      path: "props.theme",
      default: workbench.themeDefault ?? "SOURCE",
      themes: workbench.themes ?? ["BLUE", "ORANGE", "RED", "PURPLE"],
      modes: (workbench.themeModes ?? ["SOURCE", "INSTANCE_OVERRIDE"]).filter(mode => mode !== "FOLLOW_PROJECT"),
    };
  }

  if (workbench.position) {
    if (!workbench.positionRange && Array.isArray(workbench.positionModes) && workbench.positionModes.length) {
      plan.position = {
        control: "SELECT", path: "props.position",
        modes: [...workbench.positionModes], default: workbench.positionDefault ?? workbench.positionModes[0],
        note: workbench.positionNote ?? null,
      };
    } else {
      const carrier = carrierFor(componentId, "position");
      const range = workbench.positionRange ?? {min: 0, max: 1};
      plan.position = {
        control: carrier.carrier === "CONTENT_ITEM" ? "ITEM_SLIDERS" : "SLIDERS",
        carrier, min: range.min ?? 0, max: range.max ?? 1, step: 0.01,
        space: range.space ?? "AVAILABLE_SAFE_AREA",
        modes: workbench.positionModes ?? [],
        note: carrier.note ?? workbench.positionSupport ?? null,
      };
    }
  } else {
    plan.blocked.position = blockedReason("position", workbench);
  }

  if (workbench.size) {
    const carrier = carrierFor(componentId, "size");
    const range = workbench.sizeRange ?? {min: 0.8, max: 1.2};
    plan.size = {
      control: carrier.carrier === "CONTENT_ITEM" ? "ITEM_SLIDER" : "SLIDER",
      carrier, min: range.min, max: range.max, step: 0.01,
      unit: range.unit ?? null, note: carrier.note ?? null,
    };
  } else {
    plan.blocked.size = blockedReason("size", workbench);
  }

  if (workbench.variant && Array.isArray(workbench.variants) && workbench.variants.length > 1) {
    const carrier = carrierFor(componentId, "variant");
    plan.variant = {
      path: `props.${carrier.path}`, options: [...workbench.variants],
      labels: workbench.variantLabels ?? {},
      default: workbench.variantDefault ?? workbench.variants[0], note: carrier.note ?? null,
      kind: workbench.variants.every(value => DIRECTION_VARIANT_VALUES.has(value)) ? "DIRECTION" : "VARIANT",
    };
  }

  if (workbench.assetReplace) {
    const carrier = carrierFor(componentId, "asset");
    plan.asset = {
      carrier, kinds: workbench.assetKinds ?? [],
      note: carrier.note ?? "素材路径相对于 public/，只使用本机素材，不联网。",
    };
  }

  // CL-08：按文字角色字号（可选声明，小／中／大离散档位）；未声明不出现控件。
  plan.textRoles = (workbench.textRoles ?? [])
    .filter(role => typeof role?.path === "string" && typeof role?.label === "string" &&
      Array.isArray(role.options) && role.options.length > 1)
    .map(role => ({
      path: role.path, label: role.label, options: [...role.options],
      labels: role.labels ?? {}, default: role.default ?? role.options[0], note: role.note ?? null,
    }));

  // 只有资产明确开放且实例确有对应参数时才显示动画设置。
  // 镜头起止时间属于生产轨道，不进入这个列表。
  plan.animation = (workbench.animationControls ?? []).filter(field =>
    typeof field.path === "string" && typeof field.label === "string" &&
    Number.isFinite(field.min) && Number.isFinite(field.max) &&
    readPath(instance?.props, field.path) !== undefined);

  return plan;
}

// 一个组件在页面上应该出现的控件字段名（data-lab-field）。实验页按这份清单渲染，
// 自动巡检按同一份清单驱动控件，单测据此断言「声明了能力就必须有控件、没有声明就不能有」。
export function controlFieldIds(plan) {
  const ids = ["aspectRatio", "theme.project", "theme.instance"];
  for (const field of plan.contentFields) if (field.kind !== "array") ids.push(`content.${field.path}`);
  if (plan.position) {
    ids.push(...plan.position.control === "SELECT" ? ["position"]
      : plan.position.control === "ITEM_SLIDERS" ? ["position.item", "position.x", "position.y"]
        : ["position.x", "position.y"]);
  }
  if (plan.size) {
    ids.push("size");
    if (plan.size.control === "ITEM_SLIDER" && plan.position?.control !== "ITEM_SLIDERS") ids.push("size.item");
  }
  if (plan.variant) ids.push("variant");
  if (plan.asset) ids.push("asset.src", "asset.pick");
  return ids;
}
