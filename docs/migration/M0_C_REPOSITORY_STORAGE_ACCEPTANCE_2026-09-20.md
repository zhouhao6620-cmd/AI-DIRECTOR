# M0-C｜研发仓库与存储结构固化验收报告

**Status:** USER ACCEPTED
**Date:** 2026-09-20
**Scope:** M0-C only

## 结论

M0-C 原位固化四 Root、发布/归档边界和存储安全接口。没有搬迁既有产品模块，也没有写入真实 ProjectsRoot、AppDataRoot 或 RuntimeRoot。

在用户纠正迁移目标后，本次同一 Gate 还按 Gold Master 直接复制了三项核心资产：完整素材准备工作台、完整设计规范页、完整 HyperFrames 主题资产库/播放器/配置交互。没有重新手写替代 UI。

## Gold Master 直接复制结果

| Gold Master | R3 入口 | 结果 |
|---|---|---|
| `workbench-v0/` 根页面 | `http://127.0.0.1:4173/` | 原始 React 页面、完整素材准备、工作台骨架与交互直接复制 |
| `workbench-v0/design-spec.html` | `http://127.0.0.1:4173/design-spec.html` | 01–06 全部规范内容、Token、控件和 QA Gate 直接复制 |
| `hyperframes/library/` | `http://127.0.0.1:4173/library/` | 19 项导航、频道页、详情页、真实播放器、Inspector 配置与 19 个合成直接复制 |

仅做四类适配：Legacy URL 改为 R3 自有 `/shared-ui`；运行时改为 R3 自有 `/engine/hyperframes`；为静态发布包预注入 HyperFrames Runtime；修正大小写文件系统下 `CMP-SKL-001` 的资源目录映射。

## 实施映射

| Existing path | Action | M0-C result |
|---|---|---|
| `src/application-shell/`、`src/development-control-center/`、`src/asset-library/`、`src/hyperframes-foundation/`、`src/material/`、`src/stage1/`、`src/workspace/` | KEEP | 原位保留；不复制或重构已验证闭包 |
| `src/storage/workspace-boundary.mjs` | MODIFY | 增加 AppData/Runtime 隔离与 symlink escape guard |
| `src/storage/{root-resolver,app-data-root,runtime-root}.mjs` | CREATE | 集中 Root 映射、持久应用数据区与可重建 Runtime 布局 |
| `config/package-boundaries.json`、`resources/release-manifest.json` | CREATE | 发布/归档包含与排除规则、引擎/资产种子版本入口 |
| `tests/m0-c/**` | CREATE | 四 Root、路径、发布包与 Legacy 独立性证据 |

## macOS 默认映射

```text
Product Repository  /Users/skyai/Documents/AI视频导演剪辑工作台_R3
ProjectsRoot        ~/Documents/Ai视频导演工作台/
AppDataRoot         ~/Library/Application Support/AI视频导演剪辑工作台_R3/
RuntimeRoot         ~/Library/Caches/AI视频导演剪辑工作台_R3/
```

ProjectsRoot 可以通过用户设置更换，既有项目不会被静默重定位。AppDataRoot 和 RuntimeRoot 也接受显式设置覆盖；四 Root 不得相等、嵌套或 symlink 互指。

## 发布与项目归档

- 发布包：应用代码、HyperFrames/GSAP 引擎、19 个资产种子、manifest、licenses；不含任何用户项目、AppData 或 Runtime 数据。
- 项目包：`project.json` 与四个冻结目录；不含 AppData、Runtime/cache/build/logs/temp/preview/jobs 或外部 Root symlink。
- RuntimeRoot：可整体删除、自动重建；不能保存权威项目事实。

## 集成保护

- 保留主项目新版 DCC、4173 browser acceptance 和所有既有脚本。
- 不集成工作树继承的 Stage 1、M0-B、AGENTS、BASELINE、07 合同或状态文件差异。
- 未创建、移动或写入真实用户数据；测试只使用后即清理的临时目录。

## 验证门槛

- DCC deterministic + browser acceptance；
- 原核心 15 项测试；
- M0-C 11 项 Root/package contract；
- production build 与 release-package scan；
- 真实 Chrome HyperFrames integration 与 19/19 assets。

补充验证：

- 素材准备页 1440×960 同标签截图 SHA-1 完全一致；
- 设计规范完整长页截图 SHA-1 完全一致；
- 资产库同视口视觉结构一致，频道切换、组件切换、播放、主题、安全区与配置交互真实通过；
- `dist/` 独立启动通过，页面资源没有请求 `4174`、`3030` 或 Legacy 绝对目录；
- 核心测试 16/16、M0-C 合同 15/15、DCC 浏览器验收、production build、release package、HyperFrames 浏览器集成全部通过。

视觉证据：`docs/evidence/m0-c-gold-master/`。

## 用户验收

2026-09-20，用户明确确认 M0-C 验收通过。三项 Gold Master、独立运行边界与对应验证证据正式封账；后续改动必须遵循共享骨架与最小变化原则。
