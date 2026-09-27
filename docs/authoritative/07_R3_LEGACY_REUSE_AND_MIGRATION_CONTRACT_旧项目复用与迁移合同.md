# R3 Legacy Reuse and Migration Contract
# R3 旧项目复用与迁移合同

**Status:** CURRENT AUTHORITATIVE TECHNICAL CONTRACT — GATE 1C
**Frozen Date:** 2026-09-19
**Project:** AI视频导演剪辑工作台_R3

> 本文以 Meaning-Preserving Freeze 方式吸收 Gate 1B 已验收的 Legacy Harvest 结论，冻结 R3 的复用范围、资产分类、Pilot、Migration Waves、Denylist 与接收 Gate。
> 本文不修改六份产品 Baseline，不授权迁移，不创建业务源码，也不把旧实现提升为产品事实源。

## 1. Authority and Source Relationship

权威顺序：

1. 当前六份 R3 Product Baseline；
2. `06_R3_REPOSITORY_STORAGE_ARCHITECTURE_研发工程与存储边界.md`；
3. 本合同；
4. `docs/migration/LEGACY_REUSE_MANIFEST_旧项目成果复用清单.md` 仅作为 Gate 1B 审计证据与来源追溯。

旧项目、Legacy Registry、旧 Taxonomy、旧目录结构、文件名和历史版本号均不能覆盖当前 R3 Authoritative Baseline。

## 2. Frozen Reuse Posture

正式采用：

```text
Reuse proven capability
→ adapt minimally to current R3 contracts
→ verify physical and runtime independence
→ accept through a Gate
→ extend only after acceptance
```

| Reuse Area | Frozen Decision | Boundary |
|---|---|---|
| HyperFrames Runtime / Component Contract | `MODIFY` | 保留已验证运行与 patch 模式；解除旧路径、宽泛消息目标与本机 runtime 耦合。 |
| Shared Component Kit | `MODIFY` | 保留共同 Variables / patch / Timeline rebind 合同；建立 R3 版本与 contract QA。 |
| Shared Player | `MODIFY` | 保留 engine-neutral 播放语义与自定义 chrome；不得依赖旧 Workbench CSS 或旧 `/hf-runtime` 映射。 |
| 19 个 HyperFrames Legacy Assets | `MODIFY` | 作为接收候选，不视为已迁移或已满足 R3 Registry；禁止一次迁移全部 19 个。 |
| Asset Library Channel / Detail / Inspector | `MODIFY` | 保留交互与页面骨架；改接 R3 Taxonomy、Registry、AppDataRoot 和 Preview Contract。 |
| Global Skeleton & Visual Gene | `EXTRACT` | 只提取 Shell、视觉 token 与无业务状态的 UI 能力。 |
| SRT Parser | `KEEP` | 迁移时仍需独立环境复验。 |
| Media Probe / Material UI | `MODIFY` | 接入 R3 Workspace 与 Runtime 边界，不接旧 `.runtime`。 |
| Stage 1 Reliability Patterns | `EXTRACT` | 只复用重试、状态、不可变写入等可靠性模式；业务合同按当前 R3 重建。 |
| Development Control Center | `EXTRACT` / SEPARATE | 不混入业务迁移 Waves，另行规划并只读取 R3 Project State。 |

## 3. HyperFrames Asset Classification

### 3.1 Classification Authority

19 个 Legacy Asset 进入 R3 前必须按 `04_AI DIRECTOR主题包装资产库R3.md` 重新确定资产角色。

冻结规则：

- `scope = GLOBAL` 且属于 Subtitle / Chapter Progress → `Global Component`；
- 其他普通 REGISTERED 动画组件候选 → `Component Card`；
- Legacy Registry、旧 `Animation Components` 中间层、旧文件位置与旧 Taxonomy 不具有分类裁决权；
- Parent Asset 与 HyperFrames Engine Child 必须分离；Legacy `REGISTERED` 状态不自动等于 R3 `REGISTERED`；
- 只有通过 R3 Runtime / Preview / Render / Registration QA 的真实 Engine Child 才能标记 `VERIFIED`。

### 3.2 Frozen Classification Map

| R3 Asset Type | R3 Category / Role | Legacy Asset IDs |
|---|---|---|
| Component Card | 核心观点｜Key Statement | `CMP-PUN-001`, `CMP-QTE-001`, `CMP-SKL-001`, `CMP-TRM-001`, `CMP-TYP-001` |
| Component Card | 核心数据｜KPI Number | `CMP-DATA-002`, `CMP-DATA-003`, `CMP-DATA-005`, `CMP-DATA-014` |
| Component Card | 多点并列｜Multi Point | `CMP-DATA-001`, `CMP-ENT-001` |
| Component Card | 步骤流程｜Step Flow | `CMP-CHK-001`, `CMP-STP-001` |
| Component Card | 对比｜Comparison | `CMP-DATA-011`, `CMP-VRS-001` |
| Component Card | 数据图表｜Data Chart | `CMP-DATA-004`, `CMP-DATA-006` |
| Global Component | Chapter Progress｜主题章节进度 | `CMP-CHP-001` |
| Global Component | Subtitle｜字幕 | `CMP-SUB-001` |

分类结论：

- 17 个 `Component Card` 候选；
- 2 个 `Global Component` 候选；
- `CMP-CHP-001` 不得进入 Component Card 分类；
- `CMP-SUB-001` 不得进入 Component Card 分类；
- Global Packaging V1 仍然只有 Chapter Progress 与 Subtitle。

## 4. Pilot First Contract

### 4.1 Frozen Pilot Set

第一批正式资产迁移只允许以下 3 个 Pilot：

| Pilot Asset | R3 Classification | Coverage Role | Why |
|---|---|---|---|
| `CMP-DATA-002` | Component Card / 核心数据 | 公共 `hf-component-kit` 普通路径 | 代表普通卡片、数值动效和共享 kit 主路径，适合验证大多数剩余资产的公共依赖。 |
| `CMP-SKL-001` | Component Card / 核心观点 | 独立 / exception patch 路径 | 不走公共 kit，且拥有当前最完整的 Player、Patch、Library 25/25 与真实 MP4 证据，适合验证例外实现。 |
| `CMP-SUB-001` | Global Component / Subtitle | Global Packaging 路径 | 验证 `scope = GLOBAL`、Subtitle 分类、Global Registry/Library/Preview 合同，同时覆盖公共 kit 路径。 |

`CMP-CHP-001` 正式分类为 Global Component / Chapter Progress，但不进入首批 Pilot；待 Pilot Gate PASS 后随剩余资产接收。

### 4.2 Pilot Gate

三个 Pilot 必须共同通过以下 Gate，才能接收剩余 16 个资产：

1. **Independence:** 无旧项目 import、绝对路径、symlink、旧 `node_modules`、旧 runtime/cache/build/temp 依赖；删除旧工程后仍可运行。
2. **Player:** Shared Player 的 load / play / pause / seek / rate / duration / ended / error / destroy 行为确定；真实 HyperFrames Runtime Preview 可见。
3. **Patch:** 公共 kit 与 exception patch 均通过 versioned patch/ack、Timeline rebind、错误回传与消息来源/目标约束。
4. **Registry:** Parent Asset、Business Definition Version、HyperFrames Child、Implementation Version、Asset Type、Category 与 Engine Support 明确。
5. **Asset Library Contract:** Component Card 与 Global Component 进入正确一级区域；不得恢复旧 Animation Components 中间层、旧四色 Theme 或旧 Taxonomy。
6. **Storage:** Shared Asset Library 由 AppDataRoot 托管；测试产物只进入 Runtime Root；不得把 runtime、preview、render 证据写入 Product Repository 或 Project Workspace 事实目录。
7. **Real Validation:** 三个 Pilot 均完成真实 Runtime Preview、配置 patch、关键时间点视觉检查及独立可复现验证；历史报告不能代替 R3 验收。
8. **Scope:** Pilot Gate 通过前，禁止批量复制或接收剩余 16 个资产。

## 5. Frozen Migration Waves

### Wave 1｜HyperFrames Foundation

- Runtime Contract；
- Shared Component Kit；
- Shared Player；
- Registry / Adapter 最小合同。

Done Definition：Foundation 在 R3 独立环境中可由最小 fixture 验证，不引用旧工程；尚不迁移正式 Asset。

### Wave 2｜HyperFrames Asset Migration

- 先迁移 `CMP-DATA-002`, `CMP-SKL-001`, `CMP-SUB-001` 三个 Pilot；
- Pilot Gate PASS 后，才允许按小批次接收剩余 16 个资产；
- 每批必须完成当前 R3 分类、Parent/Child、版本、来源、Preview、Patch、Registry 与真实验证。

### Wave 3｜Asset Library UI

- Channel / Detail / Inspector；
- 改接 R3 Taxonomy、Registry、AppDataRoot；
- 移除 `/workbench-src`、旧静态导航快照、旧四色主题和旧业务状态。

### Wave 4｜Global Skeleton & Visual Gene

- 只提取视觉和 Shell；
- 不带旧导航、旧路由、旧阶段名称和旧业务状态。

### Wave 5｜Material Foundation

- SRT Parser；
- Media Probe；
- Material Understanding UI；
- Workspace Adapter。

### Wave 6｜Stage 1

- 只复用旧可靠性模式；
- 当前 R3 Theme Chapter → Director Shot / DirectorPlan Contract 重新实现；
- 禁止恢复旧 Stage 1 Artifact、组件绑定或 executability gate。

### Separate Track｜Development Control Center

Development Control Center 不混入 Wave 1–6。它单独规划，并且必须以 `PROJECT_STATE.json` 为状态事实源，不接收旧 `development-state.json`。

## 6. Do Not Bring / Denylist

首批以及后续迁移持续禁止接收：

- 旧 `node_modules`、`.pnpm-store`；
- runtime、cache、build、dist、temp、renders、preview、logs、job data；
- 旧项目 `.git` 与嵌套 Git；
- symlink；
- 历史 Remotion runtime、components 与 vendor snapshot；
- 历史 Baseline、Handoff、聊天导出与版本副本；
- 旧 Theme、旧四色合同、旧 Taxonomy 与 `Animation Components` 中间层；
- 旧 Stage 1 Artifact / DirectorPlan Contract；
- `development-state.json`；
- 本机绝对路径、用户缓存路径和旧启动脚本；
- 未确认来源或许可的外部素材；
- 任何指向旧工程的运行时、构建、存储或 CSS/模块引用。

## 7. Source Structure Boundary

本 Gate 不冻结 `src/` 内部结构，也不创建源码目录。

仅冻结以下逻辑接收边界，不等同于最终目录名：

```text
HyperFrames Foundation
Asset Parent / Engine Child Registry
Shared Preview / Player
Asset Library UI
Application Shell / Visual Gene
Material Foundation
Stage 1
```

`src/app`, `src/modules`, `src/ui`, `src/engines`, `src/storage`, `src/shared` 及任何等价组织继续标记为 **PROVISIONAL**。

最终源码结构只能在 Wave 1 和三个 Pilot 的真实依赖闭包确认后冻结，禁止为目录整齐提前建设空结构。

### 7.1 Global UI and Shared Preview Reuse Invariant｜M0-B 补充

M0-B 不冻结最终 `src/` 路径，但冻结以下复用规则：

1. 后续产品 UI 必须消费同一个 R3 工作台骨架；顶部导航、左侧导航、中央工作区和右侧详情/参数/检查面板不得由各业务页复制实现。
2. 新页面的公共能力选择顺序固定为：查找已有共享组件 → 直接复用 → 必要时扩展 → 只在确实不存在时新建。
3. 共享候选至少包括：工作台骨架、顶部导航、左侧导航、右侧面板、页面标题/工具栏、状态标签、任务进度、资产卡片、搜索/筛选、空/加载/错误状态和 HyperFrames 共享预览播放器。
4. HyperFrames 共享预览播放器必须作为同一全局能力服务主题资产库、导演编排、智能剪辑、预览与验收工作台和导出前预览；消费者只提供业务差异，不复制播放内核或 chrome。
5. 上述规则冻结复用边界，不将任何当前原型自动提升为已验收的全局组件；具体能力仍需按当前 R3 合同通过独立 Gate。

## 8. Frozen Risks and Required Controls

| Risk | Required Control |
|---|---|
| HyperFrames 来源目录未被旧 Git 跟踪 | 正式接收前建立明确的 intake inventory 与内容 hash；R3 只纳管批准的最小集合。 |
| Library 直接读取旧 Workbench | Wave 3 前移除 `/workbench-src` 和跨工程 server mapping。 |
| 旧 definitions 带 Remotion 时间模型、旧主题和绝对 provenance | 重新生成 R3 Parent/Child metadata；只保留可验证来源事实。 |
| 共享 kit 与 exception patch 漂移 | 三 Pilot 分别覆盖公共、例外与 Global 路径，建立共同 contract tests。 |
| 历史验证覆盖不均 | 所有接收项在 R3 独立环境重新验证，不用旧 25/25 报告替代接收 Gate。 |
| Shared Asset Library 成为项目永久依赖 | 正式项目采用后按 Gate 1A 保存 Asset ID、Version Lock、Resolved Configuration 与 Production Snapshot。 |

## 9. Gate 1C Invariants

1. 本合同是复用与迁移的唯一 Authoritative Source；Gate 1B Manifest 只作审计来源。
2. 旧项目不是运行依赖，也不是产品事实源。
3. 19 个资产必须先按当前 R3 Baseline 分类。
4. `CMP-SUB-001` = Global Component / Subtitle。
5. `CMP-CHP-001` = Global Component / Chapter Progress。
6. 第一批只允许 Foundation + 三个 Pilot，禁止一次迁移 19 个资产。
7. Pilot 未 PASS，不得接收剩余 16 个资产。
8. Migration Waves 顺序固定；跨 Wave 必须通过对应 Gate。
9. Denylist 持续有效。
10. Development Control Center 单独规划。
11. `src/` 内部结构继续 PROVISIONAL。
12. Gate 1C PASS 不等于授权开始 Wave 1。

## 10. Gate 1C QA Checklist

- [x] 19 个 Legacy Asset 已按当前 R3 Asset Library Baseline 分类。
- [x] Subtitle / Chapter Progress 已进入 Global Packaging，而非 Component Card Library。
- [x] 三个 Pilot 分别覆盖公共 kit、exception patch 与 Global Component。
- [x] Pilot Gate 明确阻止一次性迁移全部 19 个资产。
- [x] Wave 1–6 顺序与 DCC Separate Track 已冻结。
- [x] Do Not Bring / Denylist 完整保留。
- [x] Manifest 保持审计来源身份，不成为并行权威事实源。
- [x] `src/` 内部结构保持 PROVISIONAL。
- [x] 未创建业务源码、未复制代码、未迁移 Asset、未安装依赖、未修改旧项目。
