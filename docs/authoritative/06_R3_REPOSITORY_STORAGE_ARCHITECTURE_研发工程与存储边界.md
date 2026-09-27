# R3 Repository & Storage Architecture
# R3 研发工程与存储边界合同

**Status:** CURRENT AUTHORITATIVE TECHNICAL CONTRACT — M0-C INTEGRATED, PENDING CONTROL REVIEW
**Updated Date:** 2026-09-20
**Project:** AI视频导演剪辑工作台_R3

> 本文是 Gate 1A 的权威技术合同，用于冻结产品研发工程、用户项目、共享资产与运行时数据的物理边界。
> 本文不改变六份 R3 产品 Baseline，也不构成第七份产品 Baseline。

## 1. Authority and Scope

本文继承并落实：

- `00_AI DIRECTOR产品架构R3.md` 中的 Project Workspace、事实源与模块边界；
- `02_AI DIRECTOR智能剪辑R3.md` 中的 Engine Workspace、正式项目实现与运行时隔离；
- `04_AI DIRECTOR主题包装资产库R3.md` 中的跨项目资产选择与复用关系；
- `05_AI DIRECTOR导出R3.md` 中的正式导出产物边界。

本文只冻结 V1 必需边界，不定义业务功能、具体数据 Schema、技术栈或完整源码架构。

## 2. Frozen Four-Root Boundary

以下四类根目录必须在物理位置和职责上分离：

| Root | Responsibility | Durability / Authority |
|---|---|---|
| Product Repository | 产品源码、配置、测试、研发脚本、产品资源、治理与研发文档 | Git 管理的产品研发事实源 |
| Project Workspace | 每个真实视频项目的输入、导演计划、正式项目实现与最终导出 | 用户项目的持久事实源 |
| AppDataRoot | 共享资产、已安装 Product Skill、用户设置、注册表等跨项目可变应用数据 | 应用托管的持久共享数据；Shared Asset Library 不是已有项目的永久单点运行依赖 |
| Runtime Root | Job、Cache、Preview、Build、Logs、Temp 等运行时数据 | 可删除、可重建，不得成为项目事实源 |

四者不得通过目录混放、软链接、绝对路径耦合或隐式共享运行时状态破坏边界。

## 3. Product Repository

Product Repository 是当前独立 Git Repository：`AI视频导演剪辑工作台_R3`。

冻结的 Repo 一级边界如下；这是允许承载的顶层职责，不要求在尚无真实内容时提前创建目录：

```text
AI视频导演剪辑工作台_R3/
├── src/                  # 产品源码；内部组织暂不冻结
├── tests/                # 产品测试
├── config/               # 研发/构建配置
├── scripts/              # 研发与验证脚本
├── resources/            # 随产品发布或研发使用的产品资源
├── docs/                 # 权威基线与必要研发文档
├── AGENTS.md
├── BASELINE_INDEX.md
├── PROJECT_STATE.json
└── CURRENT_HANDOFF.md
```

规则：

- 只冻结 Repo 一级职责边界，不冻结完整目录清单或工具链文件名。
- `src/app`、`src/modules`、`src/ui`、`src/engines`、`src/storage`、`src/shared` 等内部组织均为 **PROVISIONAL**。
- `src/` 内部架构须在 Legacy Harvest 后，基于可验证复用成果确定，避免无价值重构。
- 没有真实内容的目录（例如 `docs/decisions`）不得为了形式完整而提前创建。
- Product Repository 不存放用户项目、共享资产库实体或 Runtime 数据。

## 4. Project Workspace

### 4.1 ProjectsRoot UX

- 首次使用时，由用户选择一个用户可见的全局 `ProjectsRoot`。
- 此后所有新项目默认在该 Root 下创建各自独立的项目文件夹。
- 用户以后可以修改全局 `ProjectsRoot`。
- V1 不要求每次创建项目都重新选择保存位置。
- 修改全局 `ProjectsRoot` 只影响后续默认创建位置；既有项目的移动、重定位或迁移不得被静默推断。

### 4.2 Frozen Workspace Tree

每个项目工作区固定使用以下一级结构：

```text
<Project Workspace>/
├── project.json
├── 01_输入素材/
├── 02_导演计划/
├── 03_项目实现/
└── 04_导出成片/
```

职责：

- `project.json`：项目身份、版本与可解析项目入口；具体 Schema 后续受控定义。
- `01_输入素材/`：Base Video、SRT 及其他正式项目输入。
- `02_导演计划/`：Confirmed Content Structure、DirectorPlan 及相关正式计划数据。
- `03_项目实现/`：可复现的正式生产实现、锁定配置、组合/清单及项目本地生产快照。
- `04_导出成片/`：Stage 5 明确导出后产生的正式文件产物。

Runtime、Cache、Build、Logs、Temp、Preview 或 Job 中间数据禁止进入 Project Workspace。

## 5. Shared Asset Library

- V1 Shared Asset Library 由应用托管在 `<AppDataRoot>/asset-library/`。
- macOS AppDataRoot 默认映射为 `~/Library/Application Support/AI视频导演剪辑工作台_R3/`，一级应用数据区为 `asset-library/`、`product-skills/`、`settings/`、`registries/`。
- 它不是供用户直接编辑的普通文件夹；用户通过产品 Asset Library UI 管理资产。
- Backup / Export / Import 属于后续能力，本 Gate 不定义、不实现。
- Shared Asset Library 是跨项目资产的选择与复用源，但不能成为已有 Project Workspace 的永久单点运行依赖。

### 5.1 Project Independence Contract

资产进入正式项目生产后，`03_项目实现/` 必须保存足以独立重现该次生产的项目本地记录，至少包括：

1. `Asset ID`；
2. `Version Lock`；
3. `Resolved Configuration`；
4. `Production Snapshot / Reproducible Implementation`。

因此：

- Shared Asset Library 中资产升级、变化或删除，不得静默改变既有项目结果；
- 既有项目必须仍可按锁定版本重新打开、预览、生产和导出；
- 项目实现不得依赖指向 Shared Asset Library 实体的软链接或不稳定绝对路径；
- 具体快照格式、资源打包方式与序列化 Schema 保持 **PROVISIONAL**，在实现前另行受控定义。

## 6. Runtime Root

Runtime Root 位于应用内部的 `<AppRuntimeRoot>/`，与 Product Repository、ProjectsRoot 和 AppDataRoot 分离。macOS 默认映射为 `~/Library/Caches/AI视频导演剪辑工作台_R3/`。

V1 只冻结以下逻辑类别，不提前冻结操作系统具体路径或内部实现：

```text
<AppRuntimeRoot>/
├── jobs/
├── cache/
├── preview/
├── build/
├── logs/
└── temp/
```

生命周期规则：

- Runtime Root 中内容可按 Job、项目、容量或时间策略删除并重建。
- Runtime 数据不是任何项目、资产或产品配置的权威事实源。
- 应用异常退出后，不得依赖 Runtime 中仅存副本恢复正式项目事实。
- 只有通过验证的正式项目实现或最终导出，才能显式写回对应 Project Workspace 目录。
- 删除整个 RuntimeRoot 后，统一 storage API 必须重建六个一级目录；具体清理阈值仍由后续运行策略定义。

## 7. Git Boundary

进入 Git：

- Product Repository 中实际存在且属于研发的源码、测试、配置、脚本、产品资源、权威基线与必要研发文档。

绝对不进入 Git：

- 任何 Project Workspace 或 ProjectsRoot；
- Shared Asset Library / AppDataRoot 中的用户或应用资产数据；
- Runtime Root、Cache、Build、Logs、Temp、Preview、Job 数据；
- 外部依赖安装结果、机器本地状态、用户素材、项目导出成片；
- 旧项目 `.git`、`node_modules`、cache、build、temp 或 runtime。

## 8. Allowed Connections

- Product Repository 的产品代码只能通过显式 Storage API / Adapter 访问其他三个 Root。
- Project Workspace 内部引用使用稳定项目身份与项目根相对路径；禁止依赖 Repo 绝对路径。
- Shared Asset Library 通过稳定 Asset ID 与版本解析向项目提供资产；正式采用后执行第 5.1 节的项目本地锁定与快照合同。
- Runtime Root 可读取正式输入并生成中间结果，但不得反向成为 Workspace 或 Asset Library 的事实源。
- 四个 Root 之间禁止软链接、目录嵌套和隐式共享可变状态。
- R3 不得引用旧项目路径，也不得依赖旧项目运行时；旧项目只允许在后续受控 Legacy Harvest 中作为可复制、可验证的来源。

## 9. M0-C Root Resolver and Deployment Boundary

- `src/storage/root-resolver.mjs` 是 macOS 默认映射、用户设置覆盖和四 Root 两两分离的唯一 resolver；业务模块不得散落绝对路径。
- `src/storage/workspace-boundary.mjs` 拒绝 Workspace 路径逃逸、Runtime/AppData 嵌入 Workspace 和现有文件的 symlink 逃逸。
- `src/storage/app-data-root.mjs`、`src/storage/runtime-root.mjs` 只提供受限子路径与一级布局接口；本轮不创建真实 AppDataRoot 或 RuntimeRoot。
- 已由 M0-B 依赖闭包证明的 `application-shell`、`development-control-center`、`asset-library`、`hyperframes-foundation`、`material`、`stage1`、`workspace`、`storage` 原位保留；不预建平行 `src/modules`、`src/engines` 或 `src/shared` 目录。

| Boundary | Include | Exclude |
|---|---|---|
| Application Release | 构建应用、HyperFrames/GSAP engine、19 个资产种子、release manifest、licenses | 用户项目、AppData、Runtime/cache/log/temp/preview/jobs、测试资料 |
| AppDataRoot | 解析安装后的资产/Skill、settings、registries | 用户项目、项目生产快照、Runtime、源码仓库 |
| User Project Package | `project.json` 与四个冻结目录、项目本地版本锁和生产快照 | AppData、Runtime/cache/build/log/temp/preview/jobs、外部 Root symlink |
| RuntimeRoot | jobs/cache/preview/build/logs/temp 与可重建中间产物 | 项目权威事实、共享资产唯一副本、发布内容 |

发布包的版本与种子入口是 `resources/release-manifest.json`；它已包含 19 个资产种子和引擎文件，Product Skill / business schema arrays 在 M0-D 有真实内容前保持为空。

## 10. Frozen vs Provisional

### Frozen

- 四层 Root 的物理与职责分离。
- ProjectsRoot 的首次选择、后续默认创建与全局可修改 UX。
- Project Workspace 一级目录树及 Runtime 不进入 Workspace。
- Shared Asset Library 的 V1 AppDataRoot 托管与 UI 管理方式。
- Shared Asset Library 不是既有项目永久单点依赖；正式采用资产必须形成项目本地锁定与可复现快照。
- Product Repository 一级职责边界与 Git 纳管边界。
- macOS 三个可变 Root 的默认映射、显式设置覆盖、AppData/Runtime 一级布局和发布/归档排除规则。

### PROVISIONAL

- `src/` 内部目录与模块组织。
- `project.json`、导演计划、项目实现及资产快照的具体 Schema。
- Runtime 内部命名、清理阈值与调度策略。
- Shared Asset Library 的 Backup / Export / Import 方案。
- Product Skill、业务 Schema 与安装/升级冲突规则。

## 11. Non-Goals

本合同不授权：

- 创建业务源码或空占位目录；
- 迁移、读取或重构旧项目；
- 引入数据库、对象存储、云服务或其他新基础设施；
- 提前实现资产 Backup / Export / Import；
- 修改六份产品 Baseline 的产品语义。
