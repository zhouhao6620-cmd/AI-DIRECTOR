# BASELINE INDEX
# R3 当前权威基线索引

> 当前 R3 权威资料的唯一索引。
> 开始任务时只读取与当前任务直接相关的 Authoritative Source，不机械加载全部 Baseline。

| Domain | Authoritative Source |
|---|---|
| Product Architecture｜产品总架构 | `docs/authoritative/00_AI DIRECTOR产品架构R3.md` |
| Stage 1｜内容理解与导演编排 | `docs/authoritative/01_AI DIRECTOR内容理解与导演编排R3.md` |
| Intelligent Editing｜智能剪辑 | `docs/authoritative/02_AI DIRECTOR智能剪辑R3.md` |
| Workbench / UI｜智能剪辑工作台 | `docs/authoritative/03_AI DIRECTOR智能剪辑工作台R3.md` |
| Asset Library｜主题包装资产库 | `docs/authoritative/04_AI DIRECTOR主题包装资产库R3.md` |
| Export｜导出阶段 | `docs/authoritative/05_AI DIRECTOR导出R3.md` |
| Repository / Storage｜研发工程与存储边界 | `docs/authoritative/06_R3_REPOSITORY_STORAGE_ARCHITECTURE_研发工程与存储边界.md` |
| Legacy Reuse & Migration｜旧项目复用与迁移 | `docs/authoritative/07_R3_LEGACY_REUSE_AND_MIGRATION_CONTRACT_旧项目复用与迁移合同.md` |

## Confirmed Core Reuse Sources｜已确认核心复用来源

以下实现由用户确认必须继承，但仍属于受控复用来源，不是新的产品事实源，也不得成为 R3 的运行时路径依赖：

| Capability | Reference Source | Current Local Preview |
|---|---|---|
| 统一视觉规范与产品工作台骨架 | `/Users/skyai/Desktop/视频生产线流程/基线文档/workbench-v0/` | `http://127.0.0.1:4174/`、`http://127.0.0.1:4174/design-spec.html` |
| HyperFrames 完整主题资产库、播放器与配置交互 | `/Users/skyai/Desktop/视频生产线流程/基线文档/hyperframes/` | `http://127.0.0.1:3030/library/` |

复用必须遵循 `KEEP → MODIFY → REGENERATE`：三个确认页面的可见内容、UI、布局、视觉和交互以现有预览为 Gold Master，迁入 R3 后保持 1:1；只修改底层路径、Runtime、Registry、Storage 与构建接线，并解除对上述来源路径与本地端口的依赖。

## Rule

只有本索引列出的 Authoritative Source 可以裁决当前产品与研发事实。

历史 Delta、Patch、Handoff、Chat、审计材料和 Legacy 实现只用于追溯或参考，不得覆盖当前 Baseline。
