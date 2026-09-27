# 元素零件（platform/elements/）

> 依据：`docs/component-assets/ELEMENT_FACTORY_V1.0_2026-09-16.md` §4（零件登记表）、组件创建技能 V1.4 护栏第 11–12 条
> 状态流转：Raw → **Adapted** → Validated（未适配前不得写成"已验证来源"）

零件**不是组件**：不占 `CMP-` 编号、不进能力索引、不计入组件总数。
被 ≥2 个组件使用、或已经 Adapted 的零件放在这里；只服务一个组件的零件留在组件目录内。

## 登记表

### EL-UTIL-001｜图表工具（`chart-utils`）

```json
{
  "elementId": "EL-UTIL-001",
  "nameZh": "图表工具",
  "nameEn": "chart-utils",
  "kind": "工具 / 参数",
  "source": {"from": "RemotionGit", "file": "registry/chart-utils.json", "license": "MIT", "commit": "802a637"},
  "localPath": "platform/elements/chart-utils/",
  "status": "Adapted",
  "renderable": true,
  "usedBy": ["CMP-DATA-016", "CMP-DATA-007", "CMP-DATA-008", "CMP-DATA-021", "CMP-DATA-011", "CMP-DATA-022"]
}
```

### EL-UTIL-002｜动效令牌（`motion-tokens`）

```json
{
  "elementId": "EL-UTIL-002",
  "nameZh": "动效令牌",
  "nameEn": "motion-tokens",
  "kind": "工具 / 参数",
  "source": {"from": "RemotionGit", "file": "registry/motion-tokens.json", "license": "MIT", "commit": "802a637"},
  "localPath": "platform/elements/motion-tokens/",
  "status": "Adapted",
  "renderable": true,
  "usedBy": ["CMP-DATA-016", "CMP-DATA-007", "CMP-DATA-021", "CMP-DATA-011", "CMP-DATA-022"]
}
```

### EL-UTIL-003｜路径工具（`path-utils`）

```json
{
  "elementId": "EL-UTIL-003",
  "nameZh": "路径工具",
  "nameEn": "path-utils",
  "kind": "工具 / 参数",
  "source": {"from": "RemotionGit", "file": "registry/path-utils.json", "license": "MIT", "commit": "802a637"},
  "localPath": "platform/elements/path-utils/",
  "status": "Adapted",
  "renderable": true,
  "usedBy": ["CMP-DATA-016"]
}
```

## 改动纪律

- 改动本目录的零件后，**必须重跑所有 `usedBy` 组件的单测与 Tier A 取证**（技能 V1.4 护栏第 12 条）；
- 本目录只由**提出该零件的批次窗口**创建；其他窗口要用同一零件时**复用这里，不另抄一份**。

## 收口待决：批次内目前存在三份不同实现（供总控判断，2026-09-16 A 批窗口记录）

A 批（本目录的创建方）建成共享零件后，B / C 两批在各自组件目录下留了**私有副本**，而且互不相同：

| 零件 | 共享版（本目录，A 批 6 项在用） | B 批私有副本 | C 批私有副本 |
| --- | --- | --- | --- |
| `chart-utils` | `chart-utils.js`（230 行，来源全部纯数学函数 + 中文紧凑数值 + `equalAreaScale` / `safeAreaOf` / `placeInSafeArea` / `textWidth` / `fitTextToWidth`），md5 `97dfd31f…` | `index.js`（22 行，只有 `formatCompactNumber`），8 份中的 3 份一致，md5 `a943bc4c…` | `index.js`（174 行，来源 11 个导出、英文紧凑数值、无画幅与文本助手），8 份中的 5 份一致，md5 `fa193ed9…` |
| `motion-tokens` | `motion-tokens.js`（76 行，秒数 + `framesFor` + 弹簧参数），md5 `3fe4b52b…` | `index.js`（39 行），md5 `35e70feb…` | `index.js`（56 行），md5 `53536dbc…` |
| `timing` | 未建（本批不需要） | 5 份私有副本 | — |

现状统计（2026-09-16 工作树复核）：`chart-utils` 9 份私有副本、`motion-tokens` 12 份私有副本、`timing` 6 份私有副本，共 27 份。

**建议（A 批窗口意见，最终由总控定）**：

1. 共享版是 C 批版的**超集**（同样的 11 个来源函数、同样的数学，只是 `formatCompactNumber` 默认 `zh-CN`，可用第三参数传 `"en"` 还原）；B 批版是共享版里一个函数的子集；所以「留共享版、删私有副本、改导入路径」在代码上是可行的。
2. **但要先确认口径**：B / C 已发布的取证件是用各自的英文紧凑数值（`124K`）渲染的，切到共享版会变成 `12.4万`，像素取证与海报需要重跑。这是一个业务口径决定（中文优先 vs 与来源一致），不宜由窗口单方面改。
3. 若决定暂不合并，至少按 `scripts/cmp-06-qa-support.mjs` 的 `elementCopyHashes()` 记录「同一零件在各组件下的副本字节一致」并登记这些副本，避免出现第三种实现。
