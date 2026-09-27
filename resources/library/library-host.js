// 组件库内壳页（HyperFrames 版）· 三级链路
//
// Role: Reference（改造件，不是基线）
//
//   ① 左栏导航   只列清单内的组件（components.js）；二级入口可点 → 进频道页，全局包装层是叶子入口
//   ② 频道页     复用真实工作台卡片海报，点卡片进详情
//   ③ 详情页     HyperFrames 预览 + 组件信息 + 右栏配置（内容 / 位置 / 大小 / 底色 / 主题 / 变体 / 动画参数）
//
// 预览内核是 HyperFrames；外壳是我们自己的播放器（player/preview-chrome.js）。
// 配置改值走 {content, options} 补丁（契约 v2），只做即时预览、刷新回默认。

import {createPreviewChrome} from "../player/preview-chrome.js";
import {toVariables} from "../adapter/hyper-config-mapper.mjs";
import {buildControlPlan, buildFieldSchema} from "/shared-ui/component-lab/control-plan.js";
import {serializeContent, parseContent} from "/shared-ui/shared/component-config/content-markdown.js";
// 真实工作台生成的横版海报清单：有清单才用 16:9，否则回退竖版（避免探测式 404）
import {LANDSCAPE_PREVIEWS} from "/shared-ui/component-library/landscape-previews.js";
import {COMPOSITIONS, INSTANCE, PORTED_GROUPS, subgroupOf} from "./components.js";

const THEME_LABELS = {SOURCE: "来源原色", BLUE: "商务蓝", ORANGE: "强调橙", RED: "警告红", PURPLE: "贵气紫"};
const THEME_TAGS = ["BLUE", "ORANGE", "RED", "PURPLE"];
const SURFACE_LABELS = {DARK: "深色", LIGHT: "浅色"};
const PRESET_LABELS = {LEFT: "左侧", RIGHT: "右侧", CENTER: "居中", TOP_LEFT: "左上", TOP_RIGHT: "右上", BOTTOM_LEFT: "左下", BOTTOM_RIGHT: "右下",
  FILL: "填充进度", LINE: "线条进度", BILINGUAL: "双语字幕", ZH_ONLY: "中文字幕", NONE: "无底", GLASS: "玻璃底"};
const ANIMATION_FIELDS = [
  {key: "countMs", label: "数起时长", min: 400, max: 5000, step: 50, unit: "ms"},
  {key: "drawMs", label: "绘制时长", min: 600, max: 5000, step: 50, unit: "ms"},
  {key: "growMs", label: "生长时长", min: 300, max: 3000, step: 50, unit: "ms"},
  {key: "stepMs", label: "逐步节奏", min: 60, max: 1600, step: 20, unit: "ms"},
  {key: "shiftAtMs", label: "重排时刻", min: 800, max: 4000, step: 50, unit: "ms"},
  {key: "checkedCount", label: "已勾条数", min: 0, max: 8, step: 1, unit: ""},
  {key: "revealed", label: "已揭示步数", min: 1, max: 8, step: 1, unit: ""},
  {key: "glassAlpha", label: "底板不透明度", min: 0, max: 1, step: 0.01, unit: ""},
];
const TOGGLE_FIELDS = [
  {key: "showProgress", label: "显示进度"},
  {key: "stroke", label: "字幕描边"},
];
const CHOICE_FIELDS = [
  {key: "align", label: "对齐", options: ["LEFT", "RIGHT"], labels: {LEFT: "左对齐", RIGHT: "右对齐"}},
  {key: "background", label: "底板", options: ["NONE", "GLASS"], labels: {NONE: "无底", GLASS: "玻璃底"}},
];
// 所有组件都有的通用动效控件（改的是合成时间线的速度，不改变版式）
const MOTION_SPEED = {key: "motionSpeed", label: "动效速度", options: ["SLOW", "MEDIUM", "FAST"], labels: {SLOW: "慢", MEDIUM: "中", FAST: "快"}};
// 组件专属的额外控件（定义之外的补充，写在对应分区里）
const EXTRA_CONTROLS = {
  "CMP-CHP-001": [
    {key: "heightScale", label: "高度（条高与字号，宽度不变）", min: 0.5, max: 3, step: 0.05, unit: "×", section: "layout"},
  ],
  "CMP-SUB-001": [
    // 内容区开关：关闭后只显示中文（与「变体：双语 / 纯中文」是同一件事，两边会互相同步）
    {key: "showTranslation", label: "显示英文字幕", kind: "toggle", section: "content", syncVariant: true},
  ],
};

const inspector = document.getElementById("inspector");
const infoList = document.getElementById("componentInfo");
const previewMeta = document.getElementById("previewMeta");
const navHost = document.getElementById("libraryNav");
const workspace = document.getElementById("main-content");
const detailView = document.getElementById("detailView");
const channelView = document.getElementById("channelView");

let current = null;       // {id, definition, schema, sample, plan, descriptor}
let options = {};         // 当前实例标量选项
let content = {};         // 当前内容树
let contentError = "";
let writeError = "";
let markdownTimer = null;
const cache = new Map();
const expandedGroups = new Set(PORTED_GROUPS.map(group => group.id));

const chrome = createPreviewChrome({
  container: document.getElementById("playerSpace"),
  composition: "/project/index.html",
  canvas: {width: INSTANCE.width, height: INSTANCE.height},
  layout: "library",
  background: "dark",
  // 详情页要能立刻看到入场动画：从 0 开始 + 循环播放（打开任一颗都自动播一遍）
  initialTime: 0,
  loop: true,
  onPatchError: reason => { writeError = `合成拒绝了这次改动：${reason}`; renderInspector(); },
});

/* ── 数据 ─────────────────────────────────────────────────────────────────── */
async function loadComponent(id) {
  if (cache.has(id)) return cache.get(id);
  const assetDirectory = id === "CMP-SKL-001" ? "cmp-skl-001" : id;
  const [definition, schema, sample] = await Promise.all([
    fetch(`/assets/${assetDirectory}/definition.json`).then(response => response.json()),
    fetch(`/assets/${assetDirectory}/content.schema.json`).then(response => response.json()),
    fetch(`/assets/${assetDirectory}/sample.json`).then(response => response.json()),
  ]);
  const sampleState = {
    product: {
      theme: "BLUE", globalPackaging: [],
      shots: [{componentInstances: [{
        componentId: id, version: definition.identity.version,
        props: {content: sample.content, ...sample.optionDefaults},
        timing: {startFrame: 0, durationInFrames: INSTANCE.durationSeconds * INSTANCE.fps},
      }]}],
    },
    technical: {fps: INSTANCE.fps, width: INSTANCE.width, height: INSTANCE.height, durationInFrames: INSTANCE.durationSeconds * INSTANCE.fps},
  };
  const loaded = {
    id, definition, schema, sample,
    plan: buildControlPlan({componentId: id, definition, contentSchema: schema, sampleState}),
    descriptor: buildFieldSchema(schema, schema),
  };
  cache.set(id, loaded);
  return loaded;
}

function compositionUrl(id) {
  const file = COMPOSITIONS[id];
  return file ? `/project/compositions/${file}?canvas=DARK` : null;
}

function posterOf(id) {
  return LANDSCAPE_PREVIEWS?.[id] ? `/${LANDSCAPE_PREVIEWS[id]}` : `/component-previews/${id}/poster.png`;
}

/* ── ① 左栏导航（只列清单） ───────────────────────────────────────────────── */
function renderNav() {
  const sections = PORTED_GROUPS.map(group => {
    const open = expandedGroups.has(group.id);
    const children = group.subgroups.map(subgroup => {
      const active = current?.subgroupId === subgroup.id || (subgroup.leaf && current?.id === subgroup.components[0]);
      return `<li><button class="library-subnav-button ${active ? "is-active" : ""}" type="button"
        data-subgroup="${subgroup.id}" data-group="${group.id}">
        <span class="library-subnav-label">${subgroup.label}</span>
        <span class="library-nav-count">${subgroup.components.length}</span></button></li>`;
    }).join("");
    return `<div class="library-nav-section">
      <div class="library-nav-item is-open">
        <button class="library-nav-caret" type="button" data-toggle="${group.id}"
          aria-label="${open ? "收起" : "展开"}${group.label}" aria-expanded="${open}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <button class="library-nav-button" type="button" data-group="${group.id}">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>
          <span class="library-nav-label">${group.label}</span>
          <span class="library-nav-count">${group.badge}</span>
        </button>
      </div>
      <ul class="library-subnav" ${open ? "" : "hidden"}>${children}</ul>
    </div>`;
  }).join("");
  navHost.innerHTML = `<div class="sidebar-heading"><span>组件资产</span><span class="sidebar-count">19 项</span></div>
    <nav class="library-nav-list">${sections}</nav>`;

  navHost.querySelectorAll(".library-subnav-button").forEach(button => {
    button.addEventListener("click", () => openSubgroup(button.dataset.group, button.dataset.subgroup));
  });
  navHost.querySelectorAll(".library-nav-button").forEach(button => {
    button.addEventListener("click", () => {
      const group = PORTED_GROUPS.find(item => item.id === button.dataset.group);
      openSubgroup(button.dataset.group, group.subgroups[0].id);
    });
  });
  navHost.querySelectorAll(".library-nav-caret[data-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.toggle;
      if (expandedGroups.has(id)) expandedGroups.delete(id); else expandedGroups.add(id);
      renderNav();
    });
  });
}

/* ── ② 频道页 ─────────────────────────────────────────────────────────────── */
async function openSubgroup(groupId, subgroupId) {
  const group = PORTED_GROUPS.find(item => item.id === groupId);
  const subgroup = subgroupOf(groupId, subgroupId);
  if (!group || !subgroup) return;
  // 全局包装层是单组件叶子入口：点它直接进详情，不经过只有一张卡片的频道页
  if (subgroup.leaf && subgroup.components.length === 1) {
    await openDetail(subgroup.components[0], subgroup.id);
    return;
  }
  current = null;
  renderNav();
  channelView.hidden = false;
  detailView.hidden = true;
  workspace.classList.remove("is-detail");
  document.querySelector(".library-back")?.setAttribute("hidden", "");
  const cards = [];
  for (const id of subgroup.components) {
    const loaded = await loadComponent(id);
    const ready = Boolean(COMPOSITIONS[id]);
    cards.push(`<article class="library-card" data-component-card="${id}">
      <button class="library-card-button" type="button" data-open="${id}" ${ready ? "" : "disabled"}>
        <span class="library-card-media" data-library-card-media="landscape">
          <img class="is-landscape" src="${posterOf(id)}" alt="${loaded.definition.discovery?.title ?? id} 预览" loading="lazy"
            onerror="this.onerror=null;this.src='/component-previews/${id}/poster.png'">
        </span>
        <span class="library-card-body">
          <span class="library-card-head"><strong>${loaded.definition.discovery?.title ?? id}</strong></span>
          <span class="library-card-note">${loaded.definition.discovery?.description ?? ""}</span>
          <span class="library-card-tags"><span class="library-tag library-tag--type">${ready ? "HyperFrames 已改造" : "待改造"}</span></span>
        </span>
      </button></article>`);
  }
  channelView.innerHTML = `<div class="library-toolbar">
      <div class="library-toolbar-title">
        <div class="eyebrow">COMPONENT LIBRARY · HYPERFRAMES</div>
        <h1>${group.label} / ${subgroup.label}</h1>
        <p>${subgroup.en}｜这一入口下有 ${subgroup.components.length} 个组件，全部按 HyperFrames 重构。</p>
      </div>
      <div class="library-toolbar-count">
        <span class="library-count-number">${subgroup.components.length}</span>
        <span class="library-count-label">当前范围组件数</span>
      </div>
    </div>
    <div class="library-browse"><section class="library-grid" data-library-grid>${cards.join("")}</section></div>`;
  channelView.querySelectorAll("[data-open]").forEach(button => {
    button.addEventListener("click", () => openDetail(button.dataset.open, subgroup.id));
  });
}

/* ── ③ 详情页 ─────────────────────────────────────────────────────────────── */
async function openDetail(id, subgroupId = null) {
  const loaded = await loadComponent(id);
  current = {...loaded, subgroupId: subgroupId ?? current?.subgroupId ?? null};
  options = {...loaded.sample.optionDefaults, surface: "DARK", theme: "SOURCE", size: loaded.sample.optionDefaults.size ?? 1};
  content = structuredClone(loaded.sample.content);
  contentError = "";
  writeError = "";
  channelView.hidden = true;
  detailView.hidden = false;
  workspace.classList.add("is-detail");
  document.querySelector(".library-back").removeAttribute("hidden");
  renderNav();
  renderIdentity();
  renderInfo();
  renderInspector();
  const url = compositionUrl(id);
  document.documentElement.setAttribute("data-library-ready", "1");
  if (url) {
    // 换合成后要等**这一条**就绪：chrome.ready 只在首次装载时 resolve，不能复用来等后续切换
    const nextReady = new Promise(resolve => chrome.player.addEventListener("ready", resolve, {once: true}));
    chrome.adapter.load(url);
    await nextReady;
  }
  await pushPatch();
  if (url) chrome.play();
}

function renderIdentity() {
  if (!current) return;
  const identity = current.definition.identity;
  document.querySelector(".library-detail-title h1").textContent = current.definition.discovery?.title ?? identity.name;
  const spans = document.querySelectorAll(".library-detail-title p span");
  spans[0].textContent = current.id;
  spans[1].textContent = `v${identity.version}`;
  spans[2].textContent = current.definition.status ?? "REGISTERED";
}

function renderMeta() {
  previewMeta.textContent = `画幅 ${INSTANCE.aspectRatio} · ${INSTANCE.width} × ${INSTANCE.height} · ${INSTANCE.fps} fps · `
    + `${INSTANCE.durationSeconds * INSTANCE.fps} 帧 · ${INSTANCE.durationSeconds.toFixed(1)} 秒`;
}

function renderInfo() {
  if (!current) return;
  const definition = current.definition;
  const semantic = definition.semantic ?? {};
  const contentSpec = definition.content ?? {};
  const runtime = definition.runtime ?? {};
  const workbench = definition.workbench ?? {};
  const discovery = definition.discovery ?? {};
  const capability = (label, supported, detail) => `${label} ${supported ? `✓${detail ? `（${detail}）` : ""}` : `✕${detail ? `（${detail}）` : "（定义未声明）"}`}`;
  const rows = [
    {zh: "名称", en: "Name", value: [definition.identity?.name ?? current.id]},
    {zh: "编号", en: "ID", value: [current.id]},
    {zh: "版本", en: "Version", value: [`${definition.identity?.version ?? "—"} · ${definition.status ?? "—"}`]},
    {zh: "用途", en: "Purpose", value: [discovery.description ?? "—"]},
    {zh: "标签", en: "Tags", value: [(discovery.tags ?? []).join(" · ")]},
    {zh: "语义能力", en: "Semantic", value: [
      `类型 ${semantic.type ?? "—"} · 信息关系 ${semantic.pattern ?? "—"}`,
      `适用场景 ${(semantic.useCases ?? []).join("；") || "—"}`,
    ]},
    {zh: "内容能力", en: "Content Capability", value: [
      `必填 ${(contentSpec.requiredFields ?? []).join(" / ") || "—"}`,
      `可选 ${(contentSpec.optionalFields ?? []).join(" / ") || "—"}`,
      contentSpec.nodeShape ? `节点 ${contentSpec.nodeShape}` : null,
      `条目数 ${semantic.minCardinality ?? "—"}–${semantic.maxCardinality ?? "—"} · 越界处理 ${contentSpec.outOfBounds ?? "REJECT"}`,
    ]},
    {zh: "工作台可编辑能力", en: "Workbench Capability", value: [
      capability("内容编辑", workbench.contentEditing),
      capability("位置", workbench.position, workbench.positionSupport ?? null),
      capability("大小", workbench.size, workbench.sizeRange ? `${workbench.sizeRange.min}–${workbench.sizeRange.max}` : null),
      capability("主题", workbench.theme, (workbench.themes ?? []).join(" / ")),
      capability("变体", workbench.variant, (workbench.variants ?? []).map(id => workbench.variantLabels?.[id] ?? id).join(" / ") || null),
      capability("素材替换", workbench.assetReplace, workbench.assetReplaceReason ?? null),
    ]},
    {zh: "动画表现", en: "Motion Behavior", value: [
      (runtime.motionBehavior?.patterns ?? []).join(" · ") || workbench.motionPreset?.default || "—",
      runtime.motionBehavior?.description ?? null,
    ]},
    {zh: "时长", en: "Duration", value: [
      `最短 ${runtime.minimumDurationSeconds ?? "—"} 秒 · 透明输出 ${runtime.transparent ? "支持" : "不支持"}`,
      `本页实例 ${INSTANCE.durationSeconds} 秒 / ${INSTANCE.durationSeconds * INSTANCE.fps} 帧 @ ${INSTANCE.fps}fps`,
    ]},
    {zh: "HyperFrames 适配", en: "HyperFrames Adapter", value: [
      `合成文件 compositions/${COMPOSITIONS[current.id]}`,
      "内核 hyperframes 0.8.46 的 <hyperframes-player>；外壳是工作台预览控制条，未启用官方 controls",
      "内容走 content 补丁（数组不适合标量变量），标量选项走 Variables；同一条 GSAP Timeline 原地重建",
      "导出：h264 1920×1080 / 30fps / 12.0s；质检：hyperframes lint + inspect 全绿",
    ]},
  ];
  infoList.innerHTML = rows.map(row => `<div>
    <dt><span class="library-info-zh">${row.zh}</span><span class="library-info-en">${row.en}</span></dt>
    <dd>${[].concat(row.value).filter(Boolean).map(line => `<span>${line}</span>`).join("")}</dd>
  </div>`).join("");
}

/* ── 右栏配置 ─────────────────────────────────────────────────────────────── */
const section = (id, title, en, body) =>
  `<section class="library-controls-section" data-config-section="${id}"><h2>${title} <small>${en}</small></h2>${body}</section>`;

function accentOf(theme) {
  const accents = current?.sample?.accents ?? {};
  const surface = options.surface ?? "DARK";
  const entry = accents[theme] ?? accents.SOURCE;
  return typeof entry === "object" ? entry[surface] ?? entry.DARK : entry;
}

function sliderRow(label, field, value, min, max, step, formatted) {
  const progress = max === min ? 0 : ((Number(value) - min) / (max - min)) * 100;
  return `<label>${label} <output data-output="${field}">${formatted}</output>
    <input aria-label="${label}" data-option="${field}" type="range" min="${min}" max="${max}" step="${step}"
      value="${value}" style="--range-progress:${progress}%"></label>`;
}

function renderInspector() {
  if (!current) return;
  const workbench = current.definition.workbench ?? {};
  const defaults = current.sample.optionDefaults ?? {};
  const positionValue = defaults.positionOffset ?? defaults.position;
  const positionIsPreset = typeof positionValue === "string";
  const positionRange = workbench.positionRange ?? {min: 0, max: 1};
  const sizeRange = workbench.sizeRange ?? {min: 0.5, max: 2};
  const parts = [];

  // 内容素材
  parts.push(section("content", "内容素材", "Content &amp; Media", `<div class="config-markdown-editor">
      <div class="config-editor-frame">
        <textarea aria-label="内容编辑" data-markdown spellcheck="false" aria-invalid="${Boolean(contentError)}">${escapeHtml(serializeContent(content, current.descriptor))}</textarea>
        <div class="config-editor-actions">
          <button type="button" id="markdownHelp" aria-label="查看写法" aria-expanded="false">说明</button>
          <button type="button" id="markdownReset" aria-label="恢复样例内容">恢复样例</button>
        </div>
      </div>
      <p class="config-editor-status ${contentError ? "is-warn" : ""}" role="${contentError ? "alert" : "status"}">${escapeHtml(contentError || "修改文字+增删节点，直接修改Markdown")}</p>
    </div>`
    + (EXTRA_CONTROLS[current.id] ?? []).filter(field => field.section === "content").map(field => {
      const on = Boolean(options[field.key] ?? true);
      return `<div class="config-choice"><span>${field.label}</span><div class="segmented-control" role="group" aria-label="${field.label}">
        <button type="button" aria-pressed="${on}" class="${on ? "is-active" : ""}" data-option-value="${field.key}:true">开</button>
        <button type="button" aria-pressed="${!on}" class="${!on ? "is-active" : ""}" data-option-value="${field.key}:false">关</button>
      </div></div>`;
    }).join("")));

  // 颜色布局
  const layoutBody = [];
  if (workbench.position) {
    if (positionIsPreset || workbench.positionModes?.length) {
      const modes = workbench.positionModes?.length ? workbench.positionModes : ["LEFT", "RIGHT"];
      layoutBody.push(`<div class="config-choice"><span>落位</span><div class="segmented-control" role="group" aria-label="落位">
        ${modes.map(mode => `<button type="button" aria-pressed="${options.position === mode}" class="${options.position === mode ? "is-active" : ""}" data-option-value="position:${mode}">${PRESET_LABELS[mode] ?? mode}</button>`).join("")}
      </div></div>`);
    } else {
      const point = options.positionOffset ?? options.position ?? {x: 0.5, y: 0.5};
      layoutBody.push(sliderRow("水平位置", "position-x", point.x ?? 0.5, positionRange.min ?? 0, positionRange.max ?? 1, 0.01, Number(point.x ?? 0.5).toFixed(2)));
      layoutBody.push(sliderRow("垂直位置", "position-y", point.y ?? 0.5, positionRange.min ?? 0, positionRange.max ?? 1, 0.01, Number(point.y ?? 0.5).toFixed(2)));
    }
  }
  if (workbench.size) {
    layoutBody.push(sliderRow("大小", "size", options.size ?? 1, sizeRange.min ?? 0.5, sizeRange.max ?? 2, 0.01, `${Number(options.size ?? 1).toFixed(2)}×`));
  }
  (EXTRA_CONTROLS[current.id] ?? []).filter(field => field.section === "layout").forEach(field => {
    layoutBody.push(sliderRow(field.label, field.key, options[field.key] ?? 1, field.min, field.max, field.step, `${Number(options[field.key] ?? 1).toFixed(2)}${field.unit ?? ""}`));
  });
  const surfaces = workbench.surfaceModes ?? ["DARK", "LIGHT"];
  layoutBody.push(`<div class="config-choice"><span>底色</span><div class="segmented-control" role="group" aria-label="底色">
    ${surfaces.map(id => `<button type="button" aria-pressed="${options.surface === id}" class="${options.surface === id ? "is-active" : ""}" data-option-value="surface:${id}">${SURFACE_LABELS[id] ?? id}</button>`).join("")}
  </div></div>`);
  if (workbench.theme) {
    layoutBody.push(`<div class="config-theme">
      <div class="config-theme-head"><span>颜色主题</span><button type="button" id="themeReset">恢复默认</button></div>
      <div class="config-theme-tags" role="group" aria-label="颜色主题">
        ${THEME_TAGS.map(theme => `<button type="button" aria-pressed="${options.theme === theme}" class="${options.theme === theme ? "is-active" : ""}" data-option-value="theme:${theme}">${THEME_LABELS[theme]}</button>`).join("")}
      </div>
      <p class="library-control-note">当前 ${THEME_LABELS[options.theme ?? "SOURCE"]} · 强调色 ${accentOf(options.theme ?? "SOURCE")}</p>
    </div>`);
  }
  parts.push(section("layout", "颜色布局", "Color &amp; Layout", layoutBody.join("")));

  // 变体
  if (workbench.variant && (workbench.variants ?? []).length) {
    const variants = workbench.variants;
    const labels = workbench.variantLabels ?? {};
    parts.push(section("variant", "布局方向 / 变体", "Variant", `<div class="config-choice"><span>变体</span><div class="segmented-control" role="group" aria-label="变体">
      ${variants.map(id => `<button type="button" aria-pressed="${options.variant === id}" class="${options.variant === id ? "is-active" : ""}" data-option-value="variant:${id}">${labels[id] ?? PRESET_LABELS[id] ?? id}</button>`).join("")}
    </div></div>`));
  }

  // 动画设置
  const animationBody = [];
  animationBody.push(`<div class="config-choice"><span>${MOTION_SPEED.label}</span><div class="segmented-control" role="group" aria-label="${MOTION_SPEED.label}">
    ${MOTION_SPEED.options.map(option => `<button type="button" aria-pressed="${(options.motionSpeed ?? "MEDIUM") === option}" class="${(options.motionSpeed ?? "MEDIUM") === option ? "is-active" : ""}" data-option-value="${MOTION_SPEED.key}:${option}">${MOTION_SPEED.labels[option]}</button>`).join("")}
  </div></div>`);
  ANIMATION_FIELDS.filter(field => defaults[field.key] !== undefined).forEach(field => {
    animationBody.push(sliderRow(field.label, field.key, options[field.key] ?? defaults[field.key], field.min, field.max, field.step,
      `${options[field.key] ?? defaults[field.key]}${field.unit}`));
  });
  TOGGLE_FIELDS.filter(field => defaults[field.key] !== undefined).forEach(field => {
    animationBody.push(`<div class="config-choice"><span>${field.label}</span><div class="segmented-control" role="group" aria-label="${field.label}">
      ${[true, false].map(value => `<button type="button" aria-pressed="${Boolean(options[field.key]) === value}" class="${Boolean(options[field.key]) === value ? "is-active" : ""}" data-option-value="${field.key}:${value}">${value ? "开" : "关"}</button>`).join("")}
    </div></div>`);
  });
  CHOICE_FIELDS.filter(field => defaults[field.key] !== undefined).forEach(field => {
    animationBody.push(`<div class="config-choice"><span>${field.label}</span><div class="segmented-control" role="group" aria-label="${field.label}">
      ${field.options.map(option => `<button type="button" aria-pressed="${options[field.key] === option}" class="${options[field.key] === option ? "is-active" : ""}" data-option-value="${field.key}:${option}">${field.labels[option] ?? option}</button>`).join("")}
    </div></div>`);
  });
  const preset = workbench.motionPreset ?? {};
  parts.push(section("animation", "动画设置", "Animation", animationBody.join("")
    + `<p class="library-control-note">动作预设 ${preset.default ?? "—"}${animationBody.length > 1 ? "" : "：组件定义未开放专属动画参数，这里提供通用动效速度"}。</p>`));

  // 素材替换 + 实例与导出
  parts.push(section("asset", "素材替换", "Asset Replace",
    `<p class="library-control-note">${workbench.assetReplaceReason ?? "组件定义未开放素材替换。"}</p>`));
  parts.push(section("instance", "实例与导出", "Instance &amp; Export", `<div class="config-readonly"><dl>
      <div><dt>画幅</dt><dd>${INSTANCE.aspectRatio} · ${INSTANCE.width} × ${INSTANCE.height} · ${INSTANCE.fps} fps</dd></div>
      <div><dt>实例时长</dt><dd>${INSTANCE.durationSeconds.toFixed(1)} 秒 · ${INSTANCE.durationSeconds * INSTANCE.fps} 帧</dd></div>
      <div><dt>条目数</dt><dd data-readonly="items">${countItems()} </dd></div>
      <div><dt>合成</dt><dd>compositions/${COMPOSITIONS[current.id]}</dd></div>
    </dl></div>
    <button class="library-reset" type="button" id="resetAll">全部恢复默认</button>`));

  const html = parts.join("") + (writeError ? `<p class="library-control-note is-warn" role="alert">${writeError}</p>` : "");
  inspector.innerHTML = html;
  renderMeta();
  wireInspector();
}

function countItems() {
  const container = Object.values(content ?? {}).find(value => Array.isArray(value));
  return container ? `${container.length} 条` : "—";
}

const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wireInspector() {
  inspector.querySelectorAll('input[type="range"][data-option]').forEach(input => {
    input.addEventListener("input", event => {
      const key = event.target.dataset.option;
      const value = Number(event.target.value);
      if (key === "position-x") options.positionOffset = {...(options.positionOffset ?? options.position ?? {x: 0.5, y: 0.5}), x: value};
      else if (key === "position-y") options.positionOffset = {...(options.positionOffset ?? options.position ?? {x: 0.5, y: 0.5}), y: value};
      else options[key] = value;
      const output = inspector.querySelector(`[data-output="${key}"]`);
      if (output) {
        const field = ANIMATION_FIELDS.find(item => item.key === key);
        output.textContent = key === "size" ? `${value.toFixed(2)}×` : key.startsWith("position") ? value.toFixed(2) : `${value}${field?.unit ?? ""}`;
      }
      const progress = (value - Number(event.target.min)) / (Number(event.target.max) - Number(event.target.min));
      event.target.style.setProperty("--range-progress", `${progress * 100}%`);
      pushPatch();
    });
  });
  inspector.querySelectorAll("[data-option-value]").forEach(button => {
    button.addEventListener("click", () => {
      const [key, value] = button.dataset.optionValue.split(":");
      if (key === "surface" || key === "theme" || key === "variant" || key === "position") options[key] = value;
      else options[key] = value === "true" ? true : value === "false" ? false : value;
      // 「显示英文字幕」与「变体：双语 / 纯中文」是同一件事，两边互相同步，避免出现两个互相打架的控件
      const extra = (EXTRA_CONTROLS[current.id] ?? []).find(field => field.key === key && field.syncVariant);
      if (extra) options.variant = options[key] ? "BILINGUAL" : "ZH_ONLY";
      if (key === "variant") options.showTranslation = value === "BILINGUAL";
      renderInspector();
      pushPatch();
    });
  });
  inspector.querySelector("#themeReset")?.addEventListener("click", () => {
    options.theme = current.definition.workbench?.themeDefault ?? "SOURCE";
    options.surface = current.definition.workbench?.surfaceDefault ?? "DARK";
    renderInspector();
    pushPatch();
  });
  inspector.querySelector("#resetAll")?.addEventListener("click", () => {
    options = {...current.sample.optionDefaults, surface: "DARK", theme: "SOURCE", size: current.sample.optionDefaults.size ?? 1};
    content = structuredClone(current.sample.content);
    contentError = "";
    writeError = "";
    renderInspector();
    pushPatch();
  });
  const textarea = inspector.querySelector("textarea[data-markdown]");
  textarea?.addEventListener("input", event => {
    const text = event.target.value;
    window.clearTimeout(markdownTimer);
    markdownTimer = window.setTimeout(() => {
      try {
        content = parseContent(text, current.descriptor, content);
        contentError = "";
        renderInspector();
        pushPatch();
      } catch (error) {
        contentError = error.message;
        const status = inspector.querySelector(".config-editor-status");
        if (status) {
          status.textContent = contentError;
          status.classList.add("is-warn");
          status.setAttribute("role", "alert");
        }
        textarea.setAttribute("aria-invalid", "true");
      }
    }, 450);
  });
  inspector.querySelector("#markdownHelp")?.addEventListener("click", event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(expanded));
    const existing = inspector.querySelector("[data-markdown-help]");
    if (existing) existing.remove();
    if (expanded) button.closest(".config-markdown-editor").insertAdjacentHTML("beforeend",
      '<p class="library-control-note" data-markdown-help>## 分组标题 + 表格：每行一组数据，增加或删除整行即可增删条目；保留列名与 --- 分隔行。</p>');
  });
  inspector.querySelector("#markdownReset")?.addEventListener("click", () => {
    content = structuredClone(current.sample.content);
    contentError = "";
    renderInspector();
    pushPatch();
  });
}

/* ── 推补丁：内容 + 选项 → 合成 ───────────────────────────────────────────── */
async function pushPatch() {
  if (!current) return {ok: false};
  const file = COMPOSITIONS[current.id];
  if (!file) return {ok: false, reason: "该组件尚未改造"};
  const optionVariables = {
    surface: options.surface ?? "DARK",
    accent: accentOf(options.theme ?? "SOURCE"),
    size: Number(options.size ?? 1),
    duration: INSTANCE.durationSeconds,
  };
  if (typeof options.position === "string") optionVariables.position = options.position;
  const point = options.positionOffset ?? (typeof options.position === "object" ? options.position : {x: 0.5, y: 0.5});
  optionVariables["position-x"] = point.x ?? 0.5;
  optionVariables["position-y"] = point.y ?? 0.5;
  ANIMATION_FIELDS.forEach(field => { if (options[field.key] !== undefined) optionVariables[field.key] = options[field.key]; });
  TOGGLE_FIELDS.forEach(field => { if (options[field.key] !== undefined) optionVariables[field.key] = Boolean(options[field.key]); });
  CHOICE_FIELDS.forEach(field => { if (options[field.key] !== undefined) optionVariables[field.key] = options[field.key]; });
  if (options.motionSpeed !== undefined) optionVariables.motionSpeed = options.motionSpeed;
  // 组件专属补充控件（例如章节条的 heightScale）也一并带过去
  Object.entries(options).forEach(([key, value]) => {
    if (key === "positionOffset" || key === "position" || key === "theme") return;
    if (optionVariables[key] === undefined && ["number", "string", "boolean"].includes(typeof value)) optionVariables[key] = value;
  });
  if (options.variant !== undefined) optionVariables.variant = options.variant;

  const payload = {compositionId: compositionIdOf(file), content: contentForPatch(), options: optionVariables};
  if (current.id === "CMP-SKL-001") {
    // 技能卡走第一版的标量变量契约
    const compiled = toVariables({
      content: content.cards ? content : {cards: []},
      surface: optionVariables.surface,
      instanceTheme: options.theme ?? "SOURCE",
      projectTheme: "BLUE",
      position: point,
      size: optionVariables.size,
      durationSeconds: INSTANCE.durationSeconds,
    });
    payload.variables = compiled.variables;
  }
  const wasPlaying = chrome.state().playing;
  const result = await chrome.patch(payload);
  // 补丁内部会 seek 重画一次，这里恢复原来的播放状态：拖滑杆时动画不该停
  if (wasPlaying && !chrome.state().playing) chrome.play();
  writeError = result.ok ? "" : `合成拒绝了这次改动：${result.reason}`;
  const note = inspector.querySelector(".library-control-note.is-warn");
  if (writeError && !note) inspector.insertAdjacentHTML("beforeend", `<p class="library-control-note is-warn" role="alert">${writeError}</p>`);
  if (!writeError && note) note.remove();
  return result;
}

function contentForPatch() {
  return content;
}

function compositionIdOf(file) {
  const map = {
    "skill-intro-card.html": "cmp-skl-001", "punch-pill.html": "cmp-pun-001", "quote-lockup.html": "cmp-qte-001",
    "term-card.html": "cmp-trm-001", "type-shift.html": "cmp-typ-001", "stat-proof.html": "cmp-data-002",
    "odometer.html": "cmp-data-003", "ring-metric.html": "cmp-data-005", "gauge-dial.html": "cmp-data-014",
    "pin-board.html": "cmp-data-001", "entity-chips.html": "cmp-ent-001", "checklist.html": "cmp-chk-001",
    "step-timeline.html": "cmp-stp-001", "comparison-bars.html": "cmp-data-011", "versus-card.html": "cmp-vrs-001",
    "rank-bars.html": "cmp-data-004", "growth-curve.html": "cmp-data-006",
    "chapter-progress.html": "cmp-chp-001", "subtitle-track.html": "cmp-sub-001",
  };
  return map[file] ?? "cmp-skl-001";
}

/* ── 启动 ─────────────────────────────────────────────────────────────────── */
document.querySelector(".library-back").addEventListener("click", () => {
  if (current?.subgroupId) openSubgroup(groupIdOf(current.subgroupId), current.subgroupId);
});
function groupIdOf(subgroupId) {
  return PORTED_GROUPS.find(group => group.subgroups.some(item => item.id === subgroupId))?.id ?? "animation";
}

chrome.ready.then(() => { renderMeta(); });
openDetail("CMP-SKL-001", "key-statement");

window.__librarySmoke = {
  ready: chrome.ready,
  chrome,
  openSubgroup,
  openDetail,
  current: () => ({id: current?.id ?? null, subgroupId: current?.subgroupId ?? null}),
  options: () => structuredClone(options),
  content: () => structuredClone(content),
  markdown: () => inspector.querySelector("textarea")?.value ?? "",
  editMarkdown: text => {
    const textarea = inspector.querySelector("textarea");
    textarea.value = text;
    textarea.dispatchEvent(new Event("input", {bubbles: true}));
  },
  setOption: (key, value) => {
    if (key === "position-x" || key === "position-y") options.positionOffset = {...(options.positionOffset ?? {x: 0.5, y: 0.5}), [key === "position-x" ? "x" : "y"]: value};
    else options[key] = value;
    renderInspector();
    return pushPatch();
  },
  reset: () => {
    options = {...current.sample.optionDefaults, surface: "DARK", theme: "SOURCE", size: current.sample.optionDefaults.size ?? 1};
    content = structuredClone(current.sample.content);
    contentError = "";
    writeError = "";
    renderInspector();
    return pushPatch();
  },
  settle: ms => new Promise(resolve => window.setTimeout(resolve, ms ?? 500)),
};
