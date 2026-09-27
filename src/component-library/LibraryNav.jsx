// 组件库左侧资产导航（05 §8.1）
//
// 一级固定 4 个正式分类 + 1 个组件草稿箱；动画组件 / 全局包装组件 / 人物布局可展开二级。
// 左侧不放 Search，也不放 Tag 筛选：搜索与筛选统一在右侧顶部工具区。
import React from "react";
import {ChevronDown, ChevronRight, LayoutGrid, Library, ListTree, Star, UserSquare2} from "lucide-react";
import {
  CHARACTER_LAYOUT_ENTRIES, GLOBAL_SUBGROUPS, LIBRARY_NAV, ANIMATION_SUBGROUPS,
} from "./taxonomy.js";

const SECTION_ICONS = {
  featured: Star,
  animation: LayoutGrid,
  global: Library,
  character: UserSquare2,
  drafts: ListTree,
};

function subgroupsOf(section) {
  if (section === "animation") return ANIMATION_SUBGROUPS;
  if (section === "global") return GLOBAL_SUBGROUPS;
  if (section === "character") return CHARACTER_LAYOUT_ENTRIES;
  return [];
}

export function LibraryNav({entries, counts, selection, expanded, onSelect, onToggleExpanded}) {
  const countOfSubgroup = (section, subgroup) => entries.filter(entry => {
    const classification = entry.classification;
    return classification.section === section && classification.subgroup === subgroup;
  }).length;
  return <aside className="sidebar library-nav" aria-label="组件资产导航">
    <div className="sidebar-heading"><span>组件资产</span><span className="sidebar-count">{counts.animation + counts.global} 项</span></div>
    <nav className="library-nav-list">
      {LIBRARY_NAV.map(item => {
        const Icon = SECTION_ICONS[item.id] ?? Library;
        const isOpen = expanded.has(item.id);
        const isActive = selection.section === item.id && (!item.expandable || selection.subgroup === null);
        const badge = item.id === "featured" ? null
          : item.id === "drafts" ? counts.drafts
            : item.id === "character" ? counts.character : counts[item.id] ?? 0;
        return <div className="library-nav-section" key={item.id}>
          <div className={`library-nav-item ${isActive ? "is-active" : ""}`}>
            {item.expandable
              ? <button className="library-nav-caret" type="button" aria-label={`${isOpen ? "收起" : "展开"}${item.label}`}
                aria-expanded={isOpen} onClick={() => onToggleExpanded(item.id)}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              : <span className="library-nav-caret is-placeholder" aria-hidden="true" />}
            <button className="library-nav-button" type="button" aria-current={isActive ? "true" : undefined}
              onClick={() => onSelect(item.id, null)}>
              <Icon size={15} strokeWidth={1.8} />
              <span className="library-nav-label">{item.label}</span>
              {badge === null ? null : <span className="library-nav-count">{badge}</span>}
            </button>
          </div>
          {item.expandable && isOpen && <ul className="library-subnav">
            {subgroupsOf(item.id).map(child => {
              const childActive = selection.section === item.id && selection.subgroup === child.id;
              const childCount = item.id === "character" ? null : countOfSubgroup(item.id, child.id);
              return <li key={child.id}>
                <button className={`library-subnav-button ${childActive ? "is-active" : ""}`} type="button"
                  aria-current={childActive ? "true" : undefined} onClick={() => onSelect(item.id, child.id)}>
                  {/* 二级入口只显示中文名与数量：英文名留在分类定义里，不作为导航文案。 */}
                  <span className="library-subnav-label">{child.label}</span>
                  {childCount === null ? null : <span className="library-nav-count">{childCount}</span>}
                </button>
              </li>;
            })}
          </ul>}
        </div>;
      })}
    </nav>
  </aside>;
}
