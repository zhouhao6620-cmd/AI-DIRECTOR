// 组件库右侧顶部工具区（05 §8.2）
//
// 浏览页只放两样：Search｜搜索框、New Component｜新建组件入口。
// 左栏管资产体系（分类就是筛选），右栏顶部管搜索；新建组件是提示词式入口，
// 只生成可复制提示词，页面不进入创建交互、不写任何文件（§13.1）。
// 呈现方式只有卡片网格一种（用户当前指令）：没有列表 / 卡片视图切换。
//
// Tags 控件位置按 §7.7 保留：本版**只铺两类标签**——类型与动画模式（用户当前指令），
// 其余字段（密度 / 层级深度 / 条目数 / 画幅 / 主题支持 / 状态 / 来源）暂不做筛选，
// 数据仍在组件目录里，需要时再加一行即可，不需要新增数据。
import React, {useState} from "react";
import {ChevronDown, ChevronUp, Plus, Search, X} from "lucide-react";
import {FACET_DEFINITIONS, VISIBLE_FILTER_FACETS} from "./library-catalog.js";
import {facetGroups} from "./filters.js";

export function LibraryToolbar({
  scopedEntries, query, onQuery, selected, onToggleFacet, onClearAll, onNewComponent,
}) {
  const groups = facetGroups(scopedEntries, FACET_DEFINITIONS.filter(facet => VISIBLE_FILTER_FACETS.includes(facet.id)));
  const selectedCount = Object.values(selected ?? {}).reduce((total, values) => total + (values?.length ?? 0), 0);
  const [expanded, setExpanded] = useState(false);
  return <div className="library-toolbar-bar">
    <div className="library-toolbar-row">
      <label className="library-search">
        <Search size={15} strokeWidth={1.8} />
        <input type="search" aria-label="搜索组件" data-library-search value={query}
          placeholder="搜索标题、用途或标签" onChange={event => onQuery(event.target.value)} />
        {query && <button className="library-search-clear" type="button" aria-label="清空搜索" onClick={() => onQuery("")}><X size={14} /></button>}
      </label>
      <button className="button primary library-new" type="button" onClick={onNewComponent}>
        <Plus size={15} strokeWidth={2} />新建组件
      </button>
    </div>
    <div className="library-tags" data-library-tags>
      <div className="library-tags-head">
        <strong>标签</strong>
        {selectedCount > 0 && <button className="library-tags-clear" type="button" onClick={onClearAll}>
          <X size={15} strokeWidth={1.9} /><span>清除全部（{selectedCount}）</span>
        </button>}
        {groups.some(group => group.options.length > 8) && <button className="library-tags-toggle" type="button" onClick={() => setExpanded(value => !value)}>
          {expanded ? <ChevronUp size={15} strokeWidth={1.9} /> : <ChevronDown size={15} strokeWidth={1.9} />}
          <span>{expanded ? "收起" : "展开"}</span>
        </button>}
      </div>
      <div className={`library-tags-groups ${expanded ? "is-expanded" : ""}`}>
        {groups.map(group => <div className="library-tag-group" key={group.id}>
          <div className="library-tag-options">
            {group.options.map(({option, count}) => {
              const checked = (selected?.[group.id] ?? []).includes(option.id);
              return <button className={`library-tag-option ${checked ? "is-checked" : ""}`} type="button"
                key={option.id} data-library-facet={`${group.id}:${option.id}`} aria-pressed={checked}
                title={`${group.label}：${group.hint}`} onClick={() => onToggleFacet(group.id, option.id)}>
                <span>{option.label}</span>
                <span className="library-tag-option-count">{count}</span>
              </button>;
            })}
          </div>
        </div>)}
      </div>
    </div>
  </div>;
}
