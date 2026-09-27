// 组件库页面（LIB-01）
//
// 事实源：`05_COMPONENT_ASSET_LIBRARY_BASELINE_V3.1_2026-09-15.md` §7 / §8 / §13。
// 结构固定为「左侧资产导航 + 右侧工作区」：左侧管资产体系，右侧顶部管搜索与筛选，
// 右侧主体管浏览与详情。页面**从不写入**：不调用 AI、不落盘、不持有创建状态。
import React, {useEffect, useMemo, useState} from "react";
import {ArrowLeft, Info} from "lucide-react";
import {
  ANIMATION_SUBGROUPS, CHARACTER_LAYOUT_ENTRIES, DRAFT_BOX_DIRECTION, FEATURED_DIRECTION,
  GLOBAL_SUBGROUPS, UNMAPPED_NOTE, entriesInScope, navCounts,
} from "./taxonomy.js";
import {libraryEntries} from "./library-catalog.js";
import {applyLibraryFilters, toggleFacetValue} from "./filters.js";
import {LibraryNav} from "./LibraryNav.jsx";
import {LibraryToolbar} from "./LibraryToolbar.jsx";
import {ComponentDetail} from "./ComponentDetail.jsx";
import {PromptPanel} from "./PromptPanel.jsx";
import {StillCapture} from "./StillCapture.jsx";
import {NEW_COMPONENT_PROMPT, draftDiscardPrompt, draftPromotionPrompt, revisionPrompt} from "./prompts.js";
import "./library.css";

// 截图入口：`/?still=<componentId>` 只渲染一块干净的深色画布，供截图脚本取图。
// 正常进入组件库（不带参数）走下面的完整页面。
export function ComponentLibraryRoute({drawerOpen = true, onDrawerAvailabilityChange}) {
  const stillId = new URLSearchParams(window.location.search).get("still");
  if (!stillId) return <ComponentLibraryPage drawerOpen={drawerOpen} onDrawerAvailabilityChange={onDrawerAvailabilityChange} />;
  const entry = libraryEntries.find(item => item.componentId === stillId);
  return <main className="still-page" data-library-still-page>
    {entry ? <StillCapture entry={entry} /> : <p className="still-missing">组件目录里没有这个组件：{stillId}</p>}
  </main>;
}

function subgroupName(section, subgroup) {
  const list = section === "global" ? GLOBAL_SUBGROUPS : section === "character" ? CHARACTER_LAYOUT_ENTRIES : ANIMATION_SUBGROUPS;
  return list.find(item => item.id === subgroup) ?? null;
}

function scopeCopy(section, subgroup, scoped) {
  if (section === "search") return {title: "全库搜索", lead: "按组件标题、用途、标签或常用叫法查找。"};
  if (section === "featured") return {title: "精选推荐", lead: "资产运营入口，不属于正式语义分类。"};
  if (section === "drafts") return {title: "组件草稿箱", lead: "候选组件的预览与确认入口，不属于正式分类。"};
  if (section === "character") return {title: "人物布局", lead: "人物布局作为资产中心独立一级入口，当前只有三种布局状态。"};
  if (section === "global") {
    const child = subgroupName(section, subgroup);
    return child
      ? {title: `全局包装组件 / ${child.en}｜${child.label}`, lead: "全局包装层只包含章节进度与字幕。"}
      : {title: "全局包装组件", lead: "全局包装层只包含章节进度与字幕，共 2 项。"};
  }
  const child = subgroupName(section, subgroup);
  return child
    ? {title: `动画组件 / ${child.en}｜${child.label}`, lead: `这一入口下有 ${scoped.length} 个组件。`}
    : {title: "动画组件", lead: `动画组件固定 10 个二级入口，共 ${scoped.length} 个组件。`};
}

export function ComponentLibraryPage({drawerOpen = true, onDrawerAvailabilityChange}) {
  // 列表页分页：一行 4 个、一页最多 4 排 = 16 个组件，超过 16 个才分页。
  const PAGE_SIZE = 16;
  const [selection, setSelection] = useState({section: "animation", subgroup: null});
  const [expanded, setExpanded] = useState(() => new Set(["animation", "global", "character"]));
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedFacets, setSelectedFacets] = useState({});
  const [prompt, setPrompt] = useState(null);
  const [page, setPage] = useState(1);

  const counts = useMemo(() => navCounts(libraryEntries), []);
  const searching = query.trim().length > 0;
  const browseSection = searching ? "search" : selection.section;
  const scoped = useMemo(() => searching ? libraryEntries : entriesInScope(libraryEntries, selection.section, selection.subgroup), [searching, selection]);
  // 浏览页的筛选：左侧资产分类（二级入口）+ 搜索框 + Tags（本版只有类型与动画模式）。
  const matched = useMemo(() => applyLibraryFilters(scoped, {query, selected: selectedFacets}), [scoped, query, selectedFacets]);
  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = matched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const copy = scopeCopy(browseSection, selection.subgroup, scoped);
  const openEntry = openId ? libraryEntries.find(entry => entry.componentId === openId) ?? null : null;
  const unmapped = selection.section === "animation" && selection.subgroup === null ? counts.unmapped : 0;

  const select = (section, subgroup) => {
    setSelection({section, subgroup});
    setOpenId(null);
    if (!expanded.has(section)) setExpanded(previous => new Set([...previous, section]));
  };
  const toggleExpanded = sectionId => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
    return next;
  });
  const clearSearch = () => setQuery("");
  const clearAllFilters = () => { setSelectedFacets({}); setQuery(""); };
  const showPrompt = (kind, text, target) => setPrompt({kind, text, target});

  // 换分类、改搜索或改标签后回到第一页，避免停在已经不存在的页码上。
  useEffect(() => { setPage(1); }, [selection.section, selection.subgroup, query, selectedFacets]);

  // 头部抽屉开关要知道本页当前有没有抽屉：只有打开组件详情时才存在右侧配置栏。
  useEffect(() => { onDrawerAvailabilityChange?.(Boolean(openEntry)); }, [openEntry, onDrawerAvailabilityChange]);

  return <>
    <LibraryNav entries={libraryEntries} counts={counts} selection={selection} expanded={expanded}
      onSelect={select} onToggleExpanded={toggleExpanded} />
    <main className={`canvas library-workspace ${openEntry ? "is-detail" : ""}`} id="main-content">
      {/* 详情页只有左中右三列：不出现浏览页的标题带与工具区。 */}
      {!openEntry && <div className="library-toolbar">
        <div className="library-toolbar-title">
          <div className="eyebrow">COMPONENT LIBRARY · V3.1</div>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <div className="library-toolbar-count">
          <span className="library-count-number" data-library-result-count>{matched.length}</span>
          <span className="library-count-label">
            {matched.length === scoped.length ? "当前范围组件数" : `筛选结果 / 共 ${scoped.length} 项`}
          </span>
        </div>
      </div>}
      {/* 搜索、Tags、视图切换与新建组件都属于浏览页；进详情后整条工具区不出现。 */}
      {!openEntry && <LibraryToolbar scopedEntries={scoped} query={query} onQuery={setQuery} selected={selectedFacets}
        onToggleFacet={(facetId, valueId) => setSelectedFacets(previous => toggleFacetValue(previous, facetId, valueId))}
        onClearAll={clearAllFilters}
        onNewComponent={() => showPrompt("new", NEW_COMPONENT_PROMPT)} />}
      {openEntry
        ? <ComponentDetail key={openEntry.componentId} entry={openEntry} catalogEntries={libraryEntries} drawerOpen={drawerOpen}
          onBack={() => setOpenId(null)}
          onRevise={target => showPrompt("revise", revisionPrompt(target), target.componentId)}
          onPromote={target => showPrompt("promote", draftPromotionPrompt(target), target.componentId)}
          onDiscard={target => showPrompt("discard", draftDiscardPrompt(target), target.componentId)} />
        : <LibraryBody section={browseSection} scoped={scoped} matched={paged} unmapped={unmapped}
          draftCount={counts.drafts} onOpen={setOpenId} onClearAll={clearAllFilters}
          pager={{page: currentPage, pageCount, total: matched.length, onChange: setPage}} />}
    </main>
    {prompt && <PromptPanel prompt={prompt} onClose={() => setPrompt(null)} />}
  </>;
}

function LibraryBody({section, scoped, matched, unmapped, draftCount, onOpen, onClearAll, pager}) {
  // 精选清单属库级清单（05 §7.1），首版没有数据落地，只显示建设方向。
  if (section === "featured") return <LibraryDirection kicker="建设方向 · 精选推荐" title="精选清单属于库级清单，本页不写入精选属性"
    paragraphs={[FEATURED_DIRECTION, "入口位置已经固定；清单维护后，被精选的组件会出现在这里，不需要改分类结构。"]} />;
  if (section === "character") return <LibraryDirection kicker="建设方向 · 人物布局" title="人物布局当前只有三种布局状态，还没有组件实例"
    paragraphs={["Character Layout 不是普通 Component，但作为资产库的独立一级入口统一展示（05 §7.4）。"]}
    items={CHARACTER_LAYOUT_ENTRIES.map(item => ({key: item.id, title: `${item.en}｜${item.label}`, body: item.direction}))} />;
  // 草稿箱有草稿时走下面的卡片列表；只有为空时才显示建设方向。
  if (section === "drafts" && !scoped.length) return <LibraryDirection kicker="建设方向 · 组件草稿箱" title="草稿箱当前没有待确认的候选组件"
    paragraphs={[
      `组件生成目录里当前有 ${draftCount} 条 draft: true 记录。`,
      DRAFT_BOX_DIRECTION,
      "Codex 侧产出 DRAFT- 候选组件、总控运行 components-sync.mjs 之后，草稿会出现在这里，并沿用组件详情的预览与轻编辑。",
    ]} />;
  if (!scoped.length) return <LibraryDirection kicker="建设方向" title="这一入口下还没有组件"
    paragraphs={["二级入口固定为 10 个，组件池还没有覆盖到这里；不预建其它入口，也不为凑数新建组件。"]} />;
  if (!matched.length) return <section className="library-direction" aria-label="搜索结果为空">
    <span className="section-kicker">搜索结果</span>
    <h2>没有匹配的组件</h2>
    <p>当前分类下有 {scoped.length} 个组件，但没有一个命中现在的搜索词或已选标签；换一个词，或清除条件回到完整列表。</p>
    <button className="button secondary" type="button" onClick={onClearAll}>清除搜索与标签</button>
  </section>;
  // 浏览态只有卡片网格一种呈现（用户当前指令）：没有列表 / 卡片视图切换。
  return <div className="library-browse">
    <section className="library-grid" aria-label="组件卡片网格" data-library-grid>
      {unmapped > 0 && <p className="library-warning"><Info size={14} />{UNMAPPED_NOTE}</p>}
      {matched.map(entry => <LibraryCard entry={entry} key={entry.componentId} onOpen={onOpen} />)}
    </section>
    {pager.pageCount > 1 && <nav className="library-pager" aria-label="分页" data-library-pager>
      <button type="button" disabled={pager.page <= 1} onClick={() => pager.onChange(pager.page - 1)}>上一页</button>
      <span className="library-pager-count">第 {pager.page} / {pager.pageCount} 页</span>
      <button type="button" disabled={pager.page >= pager.pageCount} onClick={() => pager.onChange(pager.page + 1)}>下一页</button>
      <span className="library-pager-total">共 {pager.total} 个组件 · 每页 16 个</span>
    </nav>}
  </div>;
}

function keyTags(entry) {
  return (entry.tags ?? []).slice(0, 3).map(label => ({tone: "type", label}));
}

// 卡片四段结构：横版预览图（上，填满卡片）+ 标题 + 描述 + 类型标签（下）。
// 预览图没有横版资产时用竖版海报居中回退，不裁切画面。
function LibraryCard({entry, onOpen}) {
  const tags = keyTags(entry);
  const landscape = entry.preview.landscape;
  return <article className="library-card" data-component-card={entry.componentId}>
    <button className="library-card-button" type="button" onClick={() => onOpen(entry.componentId)}>
      <span className="library-card-media" data-library-card-media={landscape ? "landscape" : "portrait"}>
        <img className={landscape ? "is-landscape" : "is-portrait"} src={landscape ?? entry.preview.poster}
          alt={`${entry.title} 预览`} loading="lazy" />
      </span>
      <span className="library-card-body">
        <span className="library-card-head">
          <strong>{entry.title}</strong>
        </span>
        <span className="library-card-note">{entry.note}</span>
        <span className="library-card-tags">{tags.map(tag => <LibraryTag tag={tag} key={tag.label} />)}</span>
      </span>
    </button>
  </article>;
}

// 直角标签 + 语义色：标签不是控件，所以不套胶囊；颜色只标维度，不改变文字。
function LibraryTag({tag}) {
  return <span className={`library-tag library-tag--${tag.tone}`}>{tag.label}</span>;
}

function LibraryDirection({kicker, title, paragraphs = [], items = []}) {
  return <section className="library-direction">
    <span className="section-kicker">{kicker}</span>
    <h2>{title}</h2>
    {paragraphs.map(text => <p key={text}>{text}</p>)}
    {items.length > 0 && <div className="library-direction-grid">
      {items.map(item => <article key={item.key}><strong>{item.title}</strong><p>{item.body}</p></article>)}
    </div>}
  </section>;
}
