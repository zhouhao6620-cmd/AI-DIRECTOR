// 通用轻编辑面板（LAB-01）
//
// 全部控件由组件定义生成：
//   definition.workbench  → 开放哪些能力（内容 / 位置 / 大小 / 主题 / 变体 / 素材）
//   content.schema.json   → 内容树有哪些字段、字段类型与取值范围
// 声明了才有控件，没声明就在面板上写明原因（不伪造能力）。
// 每个控件带 data-lab-field，自动巡检脚本用同一套字段名驱动真实控件。

import React, {useEffect, useMemo, useState} from "react";
import {buildFieldSchema, instanceLocus, readPath, writePath} from "./control-plan.js";

export const THEME_LABELS = {SOURCE: "来源原色（默认）", BLUE: "蓝", ORANGE: "橙", RED: "红", PURPLE: "紫"};

// 常见字段名的中文标签，未收录的字段直接显示 schema 里的字段名。
const FIELD_LABELS = {
  title: "标题", subtitle: "副标题", kicker: "眉题", kickerZh: "眉题·中文", prefix: "前缀", value: "数值",
  suffix: "后缀", unit: "单位", label: "文字", text: "文字", term: "术语", definition: "一句话定义", en: "英文写法",
  lines: "行", author: "署名", caption: "图注", name: "名称", rows: "条目", items: "条目", steps: "步骤",
  chips: "标签", cues: "字幕", chapters: "章节", points: "数据点", branches: "分支", children: "子节点",
  center: "中心结论", media: "材料", source: "来源", publisher: "发布方", workTitle: "作品名", reference: "编号",
  date: "日期", url: "链接", kind: "类型", frame: "画框", fit: "填充方式", radius: "圆角", opacity: "不透明度",
  aspect: "宽高比", width: "宽度", x: "水平位置", y: "垂直位置", style: "牌面", sub: "小字", emphasis: "强调边",
  noteA: "侧注上行", noteB: "身份小字", decimals: "小数位", max: "上限", id: "ID", translation: "英文小字",
  footEn: "脚注·英文", footZh: "脚注·中文", align: "对齐",
};
const labelOf = key => FIELD_LABELS[key] ?? key;
const RATIO_OPTIONS = ["9:16", "16:9"];
const ASSET_KINDS = {IMAGE: "图片", VIDEO: "视频", LOGO: "标识"};

export function GenericInspector({entry, state, plan, catalog, update, nodeCounter}) {
  const locus = instanceLocus(state);
  const props = readPath(state, `${locus}.props`);
  const [itemIndex, setItemIndex] = useState(0);
  const itemBound = plan.position?.control === "ITEM_SLIDERS" || plan.size?.control === "ITEM_SLIDER";
  const boundList = plan.position?.carrier?.listPath ?? plan.size?.carrier?.listPath;
  const boundItems = itemBound ? (readPath(props, boundList) ?? []) : [];
  const activeItem = Math.min(itemIndex, Math.max(0, boundItems.length - 1));
  const setPath = (path, value) => update(next => writePath(next, `${locus}.props.${path}`, value));

  return <>
    <h2>内容</h2>
    {plan.contentEditing
      ? <ContentFields descriptor={buildFieldSchema(entry.contentSchema, entry.contentSchema)} value={props.content} path="" root={entry.contentSchema} setPath={setPath} nodeCounter={nodeCounter}/>
      : <p className="field-note">组件定义未声明 contentEditing，本页不提供内容字段。</p>}

    <h2>位置</h2>
    {plan.position
      ? <PositionFields plan={plan} props={props} setPath={setPath} items={boundItems} itemIndex={activeItem} onItemChange={setItemIndex}/>
      : <p className="field-note" data-lab-blocked="position">{plan.blocked.position}</p>}

    <h2>大小</h2>
    {plan.size
      ? <SizeFields plan={plan} props={props} setPath={setPath} items={boundItems} itemIndex={activeItem} onItemChange={setItemIndex}/>
      : <p className="field-note" data-lab-blocked="size">{plan.blocked.size}</p>}

    <h2>样式</h2>
    <label>画幅<select aria-label="画幅" data-lab-field="aspectRatio" value={state.product.aspectRatio} onChange={event => update(next => {
      next.product.aspectRatio = event.target.value;
      next.technical = {...next.technical, ...ratioOf(event.target.value)};
    })}>{RATIO_OPTIONS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}</select></label>
    {plan.variant && <label>组件变体<select aria-label="组件变体" data-lab-field="variant" value={readPath(props, plan.variant.path.replace(/^props\./, ""))} onChange={event => setPath(plan.variant.path.replace(/^props\./, ""), event.target.value)}>{plan.variant.options.map(option => <option key={option} value={option}>{plan.variant.labels?.[option] ?? option}</option>)}</select></label>}
    {plan.variant?.note && <p className="field-note">{plan.variant.note}</p>}
    <label>项目主题<select aria-label="项目主题" data-lab-field="theme.project" value={state.product.theme} onChange={event => update(next => {next.product.theme = event.target.value;})}>{(plan.theme?.themes ?? ["BLUE", "ORANGE", "RED", "PURPLE"]).map(theme => <option key={theme} value={theme}>{THEME_LABELS[theme] ?? theme}</option>)}</select></label>
    <label>组件主题<select aria-label="组件主题" data-lab-field="theme.instance" value={readPath(props, "theme")} onChange={event => setPath("theme", event.target.value)}>
      {(plan.theme?.modes ?? ["SOURCE"]).filter(mode => mode !== "INSTANCE_OVERRIDE" && mode !== "FOLLOW_PROJECT").concat(plan.theme?.themes ?? []).map(theme => <option key={theme} value={theme}>{THEME_LABELS[theme] ?? theme}</option>)}
    </select></label>

    {plan.asset && <AssetFields plan={plan} props={props} catalog={catalog} setPath={setPath} itemIndex={activeItem}/>}
    <p className="lab-note">轻编辑：快速改内容、位置、大小、变体、主题与素材。完整生产编辑在 Stage 2 生产轨道的 Inspector。</p>
  </>;
}

function ratioOf(aspectRatio) {
  return aspectRatio === "16:9" ? {width: 1920, height: 1080} : {width: 1080, height: 1920};
}

// 位置：声明 positionModes 的组件用落位下拉；声明 positionRange 的用 0–1 比例滑块；
// 自由媒体按定义把位置放在每个媒体项上，所以先选媒体项。
function PositionFields({plan, props, setPath, items, itemIndex, onItemChange}) {
  if (plan.position.control === "SELECT") {
    return <>
      <label>落位<select aria-label="落位" data-lab-field="position" value={readPath(props, "position")} onChange={event => setPath("position", event.target.value)}>{plan.position.modes.map(mode => <option key={mode} value={mode}>{mode}</option>)}</select></label>
      {plan.position.note && <p className="field-note">{plan.position.note}</p>}
      <p className="field-note">来源只提供这几处固定落位，按定义以落位枚举开放，不改成自由坐标。</p>
    </>;
  }
  const listPath = plan.position.carrier.listPath;
  const target = plan.position.control === "ITEM_SLIDERS"
    ? {x: `${listPath}.${itemIndex}.${plan.position.carrier.x}`, y: `${listPath}.${itemIndex}.${plan.position.carrier.y}`}
    : {x: `${plan.position.carrier.path}.x`, y: `${plan.position.carrier.path}.y`};
  const value = key => Number(readPath(props, target[key]) ?? 0.5);
  return <>
    {plan.position.modes?.length > 0 && <label>落位预设<select aria-label="落位" data-lab-field="position"
      value={readPath(props, "position")} onChange={event => setPath("position", event.target.value)}>
      {plan.position.modes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
    </select></label>}
    {plan.position.control === "ITEM_SLIDERS" && <ItemPicker items={items} itemIndex={itemIndex} onItemChange={onItemChange}/>}
    {[["x", "水平位置"], ["y", "垂直位置"]].map(([key, label]) => <label key={key}>{label} <output>{value(key).toFixed(2)}</output>
      <input aria-label={label} data-lab-field={`position.${key}`} type="range" min={plan.position.min} max={plan.position.max} step={plan.position.step} value={value(key)} onChange={event => setPath(target[key], Number(event.target.value))}/>
    </label>)}
    {plan.position.note && <p className="field-note">{plan.position.note}</p>}
  </>;
}

function SizeFields({plan, props, setPath, items, itemIndex, onItemChange}) {
  const path = plan.size.control === "ITEM_SLIDER" ? `${plan.size.carrier.listPath}.${itemIndex}.${plan.size.carrier.path}` : "size";
  const value = Number(readPath(props, path) ?? 1);
  // 位置区已经选过媒体项时不再重复一个同样的下拉，避免同一字段出现两个控件。
  const showPicker = plan.size.control === "ITEM_SLIDER" && plan.position?.control !== "ITEM_SLIDERS";
  return <>
    {showPicker && <ItemPicker items={items} itemIndex={itemIndex} onItemChange={onItemChange} field="size.item"/>}
    <label>大小 <output>{value.toFixed(2)}{plan.size.unit === "CANVAS_WIDTH_SHARE" ? " × 画布宽" : "×"}</output>
      <input aria-label="大小" data-lab-field="size" type="range" min={plan.size.min} max={plan.size.max} step={plan.size.step} value={value} onChange={event => setPath(path, Number(event.target.value))}/>
    </label>
    <p className="field-note">范围 {plan.size.min}–{plan.size.max}{plan.size.unit === "CANVAS_WIDTH_SHARE" ? "（画布宽度占比）" : "（相对来源尺寸的倍数）"}。{plan.size.note ?? ""}</p>
  </>;
}

function ItemPicker({items, itemIndex, onItemChange, field = "position.item"}) {
  return <label>媒体项<select aria-label="媒体项" data-lab-field={field} value={itemIndex} onChange={event => onItemChange(Number(event.target.value))}>
    {items.map((item, index) => <option key={item?.id ?? index} value={index}>{index + 1} · {item?.id ?? "未命名"}</option>)}
  </select></label>;
}

// 素材：只使用本机素材，不联网。路径按组件定义写回内容树（证据媒体卡 media.src、
// 自由媒体每个媒体项的 src），可手填工程内相对 public/ 的路径，也可从本机素材列表替换。
function AssetFields({plan, props, catalog, setPath, itemIndex}) {
  const carrier = plan.asset.carrier;
  const itemBase = carrier.carrier === "CONTENT_ITEM" ? `${carrier.listPath}.${itemIndex}` : null;
  const path = carrier.carrier === "CONTENT_ITEM" ? `${itemBase}.${carrier.path}` : "content.media.src";
  const kind = carrier.carrier === "CONTENT_ITEM" ? readPath(props, `${itemBase}.kind`) : readPath(props, "content.media.kind");
  const value = readPath(props, path) ?? "";
  const candidates = useMemo(() => localAssetCandidates(catalog, kind), [catalog, kind]);
  const missing = useAssetAvailability(candidates);
  const status = useLocalAssetStatus(value);
  return <>
    <h2>素材</h2>
    <label>素材路径（相对 public/）<input aria-label="素材路径" data-lab-field="asset.src" value={value} onChange={event => setPath(path, event.target.value)}/></label>
    <p className={status.ok ? "field-note" : "field-note is-warn"} data-lab-asset-status={status.state}>{status.message}</p>
    <label>本机素材替换<select aria-label="本机素材替换" data-lab-field="asset.pick" value="" onChange={event => {if (event.target.value) setPath(path, event.target.value);}}>
      <option value="">选择本机素材…</option>
      {candidates.map(candidate => <option key={candidate.src} value={candidate.src} disabled={missing.has(candidate.src)}>{candidate.label}{missing.has(candidate.src) ? "（未就位）" : ""}</option>)}
    </select></label>
    <p className="field-note">可用类型：{plan.asset.kinds.map(assetKind => ASSET_KINDS[assetKind] ?? assetKind).join(" / ")}。{plan.asset.note}</p>
  </>;
}

// 本机素材候选：目录里每个已注册组件的静态示意图；演示动画由播放器运行代码。
// 缺失的文件探测后标为未就位并禁用，不假装可用。
export function localAssetCandidates(catalog, kind) {
  return catalog.flatMap(entry => {
    const id = entry.componentId;
    const poster = {src: `component-previews/${id}/poster.png`, kind: "IMAGE", label: `${id} 预览图`};
    return [poster].filter(candidate => !kind || candidate.kind === kind || (kind === "LOGO" && candidate.kind === "IMAGE"));
  });
}

// 候选素材逐个探测可达性（本机请求，不联网），不可达的标为未就位并禁用，不假装可用。
const assetProbeCache = new Map();
function probeAsset(src) {
  if (!assetProbeCache.has(src)) {
    const url = `/${String(src).replace(/^\/+/, "")}`;
    assetProbeCache.set(src, fetch(url, {method: "HEAD"})
      .then(response => response.ok || response.status === 405)
      .catch(() => false));
  }
  return assetProbeCache.get(src);
}

function useAssetAvailability(candidates) {
  const [missing, setMissing] = useState(() => new Set());
  useEffect(() => {
    let cancelled = false;
    Promise.all(candidates.map(candidate => probeAsset(candidate.src).then(ok => [candidate.src, ok])))
      .then(results => {
        if (cancelled) return;
        setMissing(new Set(results.filter(([, ok]) => !ok).map(([src]) => src)));
      });
    return () => {cancelled = true;};
  }, [candidates]);
  return missing;
}

function useLocalAssetStatus(src) {
  const [status, setStatus] = useState({state: "CHECKING", ok: false, message: "正在检查素材…"});
  useEffect(() => {
    if (!src) { setStatus({state: "EMPTY", ok: false, message: "尚未设置素材路径。"}); return undefined; }
    let cancelled = false;
    const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(src);
    const url = `/${String(src).replace(/^\/+/, "")}`;
    const done = result => { if (!cancelled) setStatus(result); };
    if (isVideo) {
      fetch(url, {method: "HEAD"}).then(response => done(response.ok
        ? {state: "OK", ok: true, message: `素材可达 · ${src}`}
        : {state: "MISSING", ok: false, message: `本页读不到该视频（${response.status}）· ${src}`}))
        .catch(() => done({state: "MISSING", ok: false, message: `本页读不到该视频 · ${src}`}));
    } else {
      const image = new Image();
      image.onload = () => done({state: "OK", ok: true, message: `素材可达 · ${src}（${image.naturalWidth} × ${image.naturalHeight}）`});
      image.onerror = () => done({state: "MISSING", ok: false, message: `本页读不到该图片 · ${src}`});
      image.src = url;
    }
    return () => {cancelled = true;};
  }, [src]);
  return status;
}

// 内容字段：按 schema 递归生成控件。数组可增删条目，条目字段继续递归，
// 数量上下限来自 schema，不额外造限制。
function ContentFields({descriptor, value, path, root, setPath, nodeCounter}) {
  // path 是内容树内的相对路径（如 items.0.label）；写回状态时要带上 content 段。
  const writePath = path === "" ? "content" : `content.${path}`;
  if (descriptor.kind === "object") {
    return descriptor.fields.map(field => <ContentFields key={field.key} descriptor={field} value={value?.[field.key]} path={join(path, field.key)} root={root} setPath={setPath} nodeCounter={nodeCounter}/>);
  }
  if (descriptor.kind === "array") {
    const list = Array.isArray(value) ? value : [];
    const itemDescriptor = descriptor.item;
    const canAdd = list.length < descriptor.maxItems;
    const canRemove = list.length > descriptor.minItems;
    const key = String(path).split(".").pop();
    return <div className="lab-array">
      <div className="items-heading"><span>{labelOf(key)} · {list.length} / {descriptor.maxItems}</span>
        <button disabled={!canAdd} data-lab-add={path} onClick={() => setPath(writePath, [...list, templateFor(itemDescriptor, path, list, nodeCounter)])}>添加{labelOf(key)}</button></div>
      {list.map((item, index) => <div className="lab-item-card" key={item?.id ?? index}>
        <div className="lab-item-head"><span>{index + 1}</span>
          <button aria-label={`删除${labelOf(key)} ${index + 1}`} data-lab-remove={`${path}.${index}`} disabled={!canRemove} onClick={() => setPath(writePath, list.filter((_, position) => position !== index))}>×</button></div>
        <ContentFields descriptor={itemDescriptor} value={item} path={join(path, index)} root={root} setPath={setPath} nodeCounter={nodeCounter}/>
      </div>)}
      {!canAdd && <p className="field-note">已达定义上限 {descriptor.maxItems} 条，超出会被组件拒绝。</p>}
    </div>;
  }
  return <SingleField descriptor={descriptor} value={value} path={path} writePath={writePath} setPath={setPath}/>;
}

function SingleField({descriptor, value, path, writePath, setPath}) {
  const key = String(path).split(".").pop();
  const label = labelOf(key);
  const field = `content.${path}`;
  if (descriptor.kind === "enum") {
    return <label>{label}<select aria-label={label} data-lab-field={field} value={value ?? descriptor.values[0]} onChange={event => setPath(writePath, enumValue(descriptor, event.target.value))}>{descriptor.values.map(option => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></label>;
  }
  if (descriptor.kind === "boolean") {
    return <label className="inline"><input aria-label={label} data-lab-field={field} type="checkbox" checked={Boolean(value)} onChange={event => setPath(writePath, event.target.checked)}/> {label}</label>;
  }
  if (descriptor.kind === "number") {
    return <label>{label}<input aria-label={label} data-lab-field={field} type="number" step={descriptor.integer ? 1 : "any"} min={descriptor.minimum} max={descriptor.maximum} value={value ?? ""} onChange={event => {
      const parsed = Number(event.target.value);
      if (event.target.value === "" || Number.isNaN(parsed)) return;
      setPath(writePath, clampNumber(descriptor, parsed));
    }}/></label>;
  }
  if (descriptor.kind === "string") {
    const identity = key === "id";
    return <label>{label}<input aria-label={label} data-lab-field={field} value={value ?? ""} maxLength={descriptor.maxLength} placeholder={identity ? "稳定 ID（字母/数字/-/_）" : ""} onChange={event => setPath(writePath, identity ? event.target.value.replace(/[^A-Za-z0-9_-]/g, "") : event.target.value)}/></label>;
  }
  return null;
}

function enumValue(descriptor, raw) {
  const matched = descriptor.values.find(option => String(option) === raw);
  return matched ?? raw;
}

function clampNumber(descriptor, value) {
  const bounded = Math.min(descriptor.maximum ?? value, Math.max(descriptor.minimum ?? value, value));
  return descriptor.integer ? Math.round(bounded) : bounded;
}

// 新增条目：按 schema 生成合法初值，避免刚添加就因空值让组件拒绝。
function templateFor(descriptor, path, list, nodeCounter) {
  if (descriptor.kind === "object") {
    return Object.fromEntries(descriptor.fields.map(field => [field.key, templateFor(field, join(path, field.key), list, nodeCounter)]));
  }
  if (descriptor.kind === "array") return [];
  if (descriptor.kind === "enum") return descriptor.values[0];
  if (descriptor.kind === "boolean") return false;
  if (descriptor.kind === "number") return clampNumber(descriptor, descriptor.minimum ?? 0);
  if (descriptor.kind === "string") {
    if (descriptor.key === "id") {
      const used = new Set((list ?? []).map(item => item?.id));
      let candidate;
      do { candidate = `new-${path.replace(/\W+/g, "-")}-${nodeCounter.current++}`; } while (used.has(candidate));
      return candidate.slice(0, descriptor.maxLength ?? 64);
    }
    const proposed = ["新条目", "新建", "新"].find(text => text.length <= (descriptor.maxLength ?? 99) && text.length >= (descriptor.minLength ?? 1));
    return proposed ?? "新";
  }
  return null;
}

function join(path, key) {
  return path === "" ? String(key) : `${path}.${key}`;
}
