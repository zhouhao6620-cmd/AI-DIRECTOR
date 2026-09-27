// 组件库搜索与筛选（05 §8.2 / §8.3 / §7.7）
//
// 筛选只用生成目录里已经存在的真实字段（FACET_DEFINITIONS），不新增数据、不猜标签；
// Tags 词表本版留空（标「临时 / 待提炼」），所以这里的多选控件承载的就是这些真实字段。
//
// 语义：同一字段内部是「或」，字段之间是「与」；搜索命中名称、英文名、ID、类型说明与适用场景。
// 本模块不含 JSX，Node 与浏览器都能直接导入。

import {facetValueLabel} from "./library-catalog.js";

export function normalizeQuery(text) {
  return String(text ?? "").trim().toLowerCase();
}

export function entrySearchText(entry) {
  return [
    entry.title, entry.englishName, entry.displayName, entry.componentId, entry.note,
    ...(entry.tags ?? []), ...(entry.aliases ?? []),
    ...(entry.useCases ?? []),
    ...(entry.facets.type ?? []).map(option => option.label),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function matchesQuery(entry, query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;
  const haystack = entrySearchText(entry);
  // 多个关键词之间是「与」：输入「数据 图表」也能缩到同时命中两个词的组件。
  return normalized.split(/\s+/).every(token => haystack.includes(token));
}

export function matchesFacets(entry, selected = {}) {
  return Object.entries(selected).every(([facetId, values]) => {
    if (!values || !values.length) return true;
    const owned = (entry.facets[facetId] ?? []).map(option => option.id);
    return values.some(value => owned.includes(value));
  });
}

export function applyLibraryFilters(entries, {query = "", selected = {}} = {}) {
  return entries.filter(entry => matchesQuery(entry, query) && matchesFacets(entry, selected));
}

export function toggleFacetValue(selected, facetId, valueId) {
  const current = selected[facetId] ?? [];
  const next = current.includes(valueId) ? current.filter(value => value !== valueId) : [...current, valueId];
  const result = {...selected};
  if (next.length) result[facetId] = next; else delete result[facetId];
  return result;
}

export function clearFacet(selected, facetId) {
  const result = {...selected};
  delete result[facetId];
  return result;
}

export function activeFilterCount(selected = {}) {
  return Object.values(selected).reduce((total, values) => total + (values?.length ?? 0), 0);
}

// 已选条件的中文标签，用于工具区下面的可移除条件条。
export function activeFilterChips(entries, selected = {}) {
  return Object.entries(selected).flatMap(([facetId, values]) => values.map(valueId => {
    const sample = entries.find(entry => (entry.facets[facetId] ?? []).some(option => option.id === valueId));
    return {facetId, valueId, label: sample ? facetValueLabel(sample, facetId, valueId) : valueId};
  }));
}

// 当前范围下每个字段真实出现过的取值与次数；没有出现过的取值不进选项，
// 避免出现「勾了必然为空」的筛选。
export function facetGroups(entries, facetDefinitions) {
  return facetDefinitions.map(definition => {
    const counts = new Map();
    for (const entry of entries) {
      for (const option of entry.facets[definition.id] ?? []) {
        const current = counts.get(option.id) ?? {option, count: 0};
        current.count += 1;
        counts.set(option.id, current);
      }
    }
    return {
      ...definition,
      options: [...counts.values()].sort((left, right) => right.count - left.count
        || String(left.option.label).localeCompare(String(right.option.label), "zh-Hans-CN")),
    };
  }).filter(group => group.options.length > 0);
}
