// 组件配置栏：组件变体 / 内容素材 / 颜色布局 / 按资产声明出现的动画设置。
// 宿主传入实例快照和 onPatch；面板不持久化，也不决定预览或生产状态的写入位置。
import React, {useState, useEffect, useRef} from "react";
import {CircleHelp, Maximize, Minimize} from "lucide-react";
import "./component-config.css";
import {serializeContent, parseContent} from "./content-markdown.js";

const THEME_LABELS = {SOURCE: "来源原色（默认）", BLUE: "商务蓝", ORANGE: "强调橙", RED: "警告红", PURPLE: "贵气紫"};
const FIELD_LABELS = {
  title: "标题", subtitle: "副标题", kicker: "眉题", kickerZh: "眉题·中文", prefix: "前缀", value: "数值",
  suffix: "后缀", unit: "单位", label: "文字", text: "文字", term: "术语", definition: "一句话定义", en: "英文写法",
  lines: "行", author: "署名", caption: "图注", name: "名称", rows: "条目", items: "条目", steps: "步骤",
  chips: "标签", cues: "字幕", chapters: "章节", points: "数据点", branches: "分支", children: "子节点",
  center: "中心结论", media: "材料", source: "来源", publisher: "发布方", workTitle: "作品名", reference: "编号",
  date: "日期", url: "链接", kind: "类型", frame: "画框", fit: "填充方式", radius: "圆角", opacity: "不透明度",
  aspect: "宽高比", width: "宽度", x: "水平位置", y: "垂直位置", style: "牌面", sub: "小字", emphasis: "强调边",
  noteA: "侧注上行", noteB: "身份小字", decimals: "小数位", max: "上限", id: "标识 ID", translation: "英文小字",
  footEn: "脚注·英文", footZh: "脚注·中文", align: "对齐",
};
const POSITION_LABELS = {LEFT:"左侧", RIGHT:"右侧", CENTER:"居中", TOP_LEFT:"左上", TOP_RIGHT:"右上", BOTTOM_LEFT:"左下", BOTTOM_RIGHT:"右下"};

export function ComponentConfigPanel({plan, descriptor, props, onPatch, assetSlot, validateContent}) {
  const setPath = onPatch;
  const content = props?.content;
  return <>
    {plan.variant?.kind === "DIRECTION" && <section className="library-controls-section" data-config-section="direction">
      <h2>布局方向 <small>Layout Direction</small></h2>
      <Choice label="方向" field="variant" value={props[plan.variant.path.split(".").pop()]}
        options={plan.variant.options} labels={plan.variant.labels}
        onChange={value => setPath(plan.variant.path.replace(/^props\./, ""), value)}/>
    </section>}
    <section className="library-controls-section" data-config-section="content">
      <h2>内容素材 <small>Content &amp; Media</small></h2>
      {plan.contentEditing && descriptor
        ? <MarkdownEditor key={plan.componentId} descriptor={descriptor} content={content} validate={validateContent} onChange={value => setPath("content", value)}/>
        : <p className="library-control-note" data-library-blocked="content">此组件暂不支持内容编辑。</p>}
      {assetSlot}
      {plan.textRoles?.map(role => <Choice key={role.path} label={role.label} field={`textRole.${role.path}`}
        value={props[role.path] ?? role.default} options={role.options} labels={role.labels}
        onChange={value => setPath(role.path, value)}/>)}
    </section>
    <section className="library-controls-section" data-config-section="layout">
      <h2>颜色布局 <small>Color &amp; Layout</small></h2>
      {plan.position
        ? <PositionFields plan={plan} props={props} setPath={setPath}/>
        : <p className="library-control-note" data-library-blocked="position">{plan.blocked.position}</p>}
      {plan.size
        ? <SizeFields plan={plan} props={props} setPath={setPath}/>
        : <p className="library-control-note" data-library-blocked="size">{plan.blocked.size}</p>}
      <div className="config-theme">
        <div className="config-theme-head"><span>颜色主题</span><button type="button" onClick={() => setPath("theme", plan.theme?.default ?? "SOURCE")}>恢复默认</button></div>
        <div className="config-theme-tags" role="group" aria-label="颜色主题">
          {(plan.theme?.themes ?? ["BLUE", "ORANGE", "RED", "PURPLE"]).map(theme => <button key={theme} type="button"
            aria-pressed={props.theme === theme} className={props.theme === theme ? "is-active" : ""}
            data-library-field="theme.instance" data-value={theme} onClick={() => setPath("theme", theme)}>{THEME_LABELS[theme] ?? theme}</button>)}
        </div>
      </div>
      {plan.variant && plan.variant.kind !== "DIRECTION" && <Choice label="变体" field="variant" value={props[plan.variant.path.split(".").pop()]}
        options={plan.variant.options} labels={plan.variant.labels}
        onChange={value => setPath(plan.variant.path.replace(/^props\./, ""), value)}/>}
    </section>
    {plan.animation?.length > 0 && <section className="library-controls-section" data-config-section="animation">
      <h2>动画设置 <small>Animation</small></h2>
      {plan.animation.map(item => <label key={item.path}>{item.label}<output>{dot(props, item.path)}</output><input aria-label={item.label}
        data-library-field={`animation.${item.path}`} type="range" min={item.min} max={item.max}
        step={item.step ?? 1} value={Number(dot(props, item.path) ?? item.min)}
        style={rangeProgressStyle(dot(props, item.path), item.min, item.max)}
        onChange={event => setPath(item.path, Number(event.target.value))}/></label>)}
    </section>}
  </>;
}

export function Choice({label, field, value, options, labels = {}, onChange, capsule = false}) {
  if (!capsule && options.length > 3) return <label>{label}<select aria-label={label} data-library-field={field} value={value}
    onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>;
  return <div className="config-choice"><span>{label}</span><div className="segmented-control" role="group" aria-label={label}>
    {options.map(option => <button key={option} type="button" aria-pressed={value === option}
      className={value === option ? "is-active" : ""} data-library-field={field} data-value={option}
      onClick={() => onChange(option)}>{labels[option] ?? option}</button>)}
  </div></div>;
}
function MarkdownEditor({descriptor, content, onChange, validate}) {
  const serialized = serializeContent(content ?? {}, descriptor);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [help, setHelp] = useState(false);
  const published = useRef(serialized);
  const timer = useRef(null);
  useEffect(() => {if(serialized !== published.current) {setText(serialized);setError("");published.current = serialized;}}, [serialized]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const edit = value => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {const parsed = parseContent(value, descriptor, content);validate?.(parsed);published.current = serializeContent(parsed, descriptor);setError("");onChange(parsed);}
      catch (reason) {setError(reason.message);}
    }, 450);
  };
  const editor = <>
    <div className="config-editor-frame">
      <textarea aria-label="内容编辑" data-library-field="content.markdown" value={text} spellCheck={false}
        onChange={event => edit(event.target.value)} aria-invalid={Boolean(error)} aria-describedby="content-edit-status"/>
      <div className="config-editor-actions">
        <button type="button" aria-label="查看写法" aria-expanded={help} onClick={() => setHelp(!help)}><CircleHelp size={15}/>说明</button>
        <button type="button" aria-label={expanded ? "收起编辑" : "放大编辑"} title={expanded ? "收起编辑" : "全屏编辑"}
          onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize size={15}/> : <Maximize size={15}/>}</button>
      </div>
    </div>
    {help && <p className="library-control-note"># 标题 · ## 内容分组 · - 每行一条。表格每行一组数据，增加或删除整行即可增删条目。保留分组和列名。</p>}
    <p id="content-edit-status" role={error ? "alert" : "status"} className={`config-editor-status ${error ? "is-warn" : ""}`}>
      {error || "修改文字+增删节点，直接修改Markdown"}</p>
  </>;
  return <div className="config-markdown-editor">
    {expanded ? <div className="config-editor-overlay" role="dialog" aria-modal="true" aria-label="放大内容编辑"
      onKeyDown={event => {if(event.key === "Escape") setExpanded(false);}}><div className="config-editor-dialog"><h2>内容编辑</h2>{editor}</div></div> : editor}
  </div>;
}

// 位置：声明 positionModes 的组件用落位枚举；声明自由落位的用 0–1 比例滑块；
// 自由媒体按定义把位置挂在每个媒体项上，所以先选媒体项。
function PositionFields({plan, props, setPath}) {
  const [itemIndex, setItemIndex] = useState(0);
  if (plan.position.control === "SELECT") {
    return <>
      <Choice label="落位" field="position" value={props.position} options={plan.position.modes} labels={POSITION_LABELS} capsule
        onChange={value => setPath("position", value)}/>
    </>;
  }
  const listPath = plan.position.carrier.listPath;
  const items = plan.position.control === "ITEM_SLIDERS" ? (props[listPath] ?? []) : [];
  const active = Math.min(itemIndex, Math.max(0, items.length - 1));
  const target = key => plan.position.control === "ITEM_SLIDERS"
    ? `${listPath}.${active}.${plan.position.carrier[key]}`
    : `${plan.position.carrier.path}.${key}`;
  const valueOf = key => Number(dot(props, target(key)) ?? 0.5);
  return <>
    {plan.position.modes?.length > 0 && <Choice label="落位预设" field="position" value={props.position}
      options={plan.position.modes} labels={POSITION_LABELS} capsule onChange={value => setPath("position", value)}/>}
    {plan.position.control === "ITEM_SLIDERS" && <ItemPicker items={items} itemIndex={active} onItemChange={setItemIndex}/>}
    {[["x", "水平位置"], ["y", "垂直位置"]].map(([key, label]) => <label key={key}>{label} <output>{valueOf(key).toFixed(2)}</output>
      <input aria-label={label} data-library-field={`position.${key}`} type="range" min={plan.position.min}
        max={plan.position.max} step={plan.position.step} value={valueOf(key)}
        style={rangeProgressStyle(valueOf(key), plan.position.min, plan.position.max)}
        onChange={event => setPath(target(key), Number(event.target.value))}/>
    </label>)}
  </>;
}

function SizeFields({plan, props, setPath}) {
  const [itemIndex, setItemIndex] = useState(0);
  const listPath = plan.size.carrier.listPath;
  const items = plan.size.control === "ITEM_SLIDER" ? (props[listPath] ?? []) : [];
  const active = Math.min(itemIndex, Math.max(0, items.length - 1));
  const path = plan.size.control === "ITEM_SLIDER" ? `${listPath}.${active}.${plan.size.carrier.path}` : "size";
  const value = Number(dot(props, path) ?? 1);
  const showPicker = plan.size.control === "ITEM_SLIDER" && plan.position?.control !== "ITEM_SLIDERS";
  return <>
    {showPicker && <ItemPicker items={items} itemIndex={active} onItemChange={setItemIndex} field="size.item"/>}
    <label>大小 <output>{value.toFixed(2)}{plan.size.unit === "CANVAS_WIDTH_SHARE" ? " × 画布宽" : "×"}</output>
      <input aria-label="大小" data-library-field="size" type="range" min={plan.size.min} max={plan.size.max}
        step={plan.size.step} value={value} style={rangeProgressStyle(value, plan.size.min, plan.size.max)}
        onChange={event => setPath(path, Number(event.target.value))}/>
    </label>

  </>;
}

export function ItemPicker({items, itemIndex, onItemChange, field = "position.item"}) {
  return <label>媒体项<select aria-label="媒体项" data-library-field={field} value={itemIndex}
    onChange={event => onItemChange(Number(event.target.value))}>
    {items.map((item, index) => <option key={item?.id ?? index} value={index}>{index + 1} · {item?.id ?? "未命名"}</option>)}
  </select></label>;
}

export function dot(object, path) {
  return String(path).split(".").reduce((current, key) => (current == null ? undefined : current[key]), object);
}

function rangeProgressStyle(value, min, max) {
  const numeric = Number(value);
  const floor = Number(min);
  const ceiling = Number(max);
  const progress = ceiling === floor ? 0 : ((numeric - floor) / (ceiling - floor)) * 100;
  return {"--range-progress": `${Math.max(0, Math.min(100, progress))}%`};
}
