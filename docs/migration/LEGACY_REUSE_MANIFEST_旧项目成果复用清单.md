# Legacy Reuse Manifest｜旧项目成果复用清单

> Status: **WORKING AUDIT — NOT AUTHORITATIVE**
> Gate: **Gate 1B｜Legacy Harvest**
> Audit date: 2026-09-19
> Legacy source: `/Users/skyai/Desktop/视频生产线流程/基线文档/`
> Rule: 本文件只记录只读审计结论，不构成迁移、复制、重构或实现授权。

## 1. Scope and decision basis

本次审计以当前 R3 `BASELINE_INDEX.md` 指向的六份产品基线及
`06_R3_REPOSITORY_STORAGE_ARCHITECTURE_研发工程与存储边界.md` 为唯一目标事实源。
旧项目行为、文件名、版本号、修改时间、`final/latest` 字样均不作为权威性依据。

**审计重心补充：** 经 Hao 指定，`legacy/hyperframes/` 是经过验证改造的 HyperFrames 组件、播放器、
Library 接入与证据集合，是 Gate 1B 的首要收割对象。相邻旧 Workbench 只用于识别它的最小依赖闭包；
历史 Remotion 组件与大批旧内容不作为本轮主要迁移候选，仅在解释来源、合同冲突或隐藏耦合时引用。

旧路径仅用于审计溯源，禁止成为 R3 的 import、build、runtime、storage 或 symlink 依赖。
本轮未执行安装、构建、测试、渲染或业务脚本；“已验证”仅指旧仓库中存在实现、测试、报告或可追溯提交证据，迁移后仍须在 R3 独立环境重新验证。

Decision 含义：

- `KEEP`：实现边界清晰，原则上可原样提取，但仍须做许可、来源与 R3 独立性验证。
- `MODIFY`：主体可保留，只做当前 Baseline、接口或边界所需的最小修改。
- `EXTRACT`：只提取已验证的模式、合同、视觉基因或局部实现，不整体搬运。
- `REBUILD`：保留业务意图，旧实现或旧合同不能进入 R3。
- `DROP`：不进入 R3。

Coupling Risk：🟢 `Independent`｜🟡 `Controlled Dependency`｜🔴 `Hidden Coupling`。

## 2. Executive decision matrix

| # | Module / Asset | Decision | Coupling Risk | Confidence |
|---|---|---|---|---|
| 1 | 19 个 HyperFrames compositions | `MODIFY` | 🟡 Controlled Dependency | High |
| 2 | `hf-component-kit` 与 composition patch contract | `MODIFY` | 🟡 Controlled Dependency | High |
| 3 | HyperFrames Shared Player / Runtime Adapter | `MODIFY` | 🟡 Controlled Dependency | Medium-High |
| 4 | HyperFrames Asset Library 三级链路 | `MODIFY` | 🔴 Hidden Coupling | High |
| 5 | HyperFrames QA 工具、报告与证据 | `EXTRACT` | 🟡 Controlled Dependency | High |
| 6 | 19 份旧定义/schema/sample 副本 | `EXTRACT` | 🔴 Hidden Coupling | High |
| 7 | Global Skeleton & Visual Gene | `EXTRACT` | 🟡 Controlled Dependency | High |
| 8 | Material Understanding 输入准备 UI | `MODIFY` | 🟡 Controlled Dependency | High |
| 9 | SRT 解析器 | `KEEP` | 🟢 Independent | High |
| 10 | MP4/MOV 媒体探测与校验 | `MODIFY` | 🟡 Controlled Dependency | High |
| 11 | Content Understanding 编排与旧产物合同 | `EXTRACT` / `REBUILD` | 🔴 Hidden Coupling | High |
| 12 | Storage Path Boundary / Immutable State Patterns | `EXTRACT` | 🟡 Controlled Dependency | High |
| 13 | Development Control Center UI | `EXTRACT` | 🔴 Hidden Coupling | High |
| 14 | 历史 Remotion-only 组件与旧大型内容 | `DROP` | 🔴 Hidden Coupling | High |
| 15 | 旧 Baseline、运行产物、vendor 快照与本机启动器 | `DROP` | 🔴 Hidden Coupling | High |

## 3. Detailed audit records

### 3.1 Global Skeleton & Visual Gene｜全局骨架与视觉基因

- **Old Location:** `workbench-v0/src/App.jsx`, `workbench-v0/src/styles.css`
- **What Is Proven:** 已形成可工作的桌面式三栏工作台、黑色顶栏/侧栏、白色内容区、橙色强调色、主导航与阶段导航的完整视觉组合；不是孤立截图或概念稿。
- **R3 Relevance:** 当前 R3 明确认定其为高价值复用候选，可作为 R3 全局外壳和视觉连续性的来源。
- **Decision:** `EXTRACT`
- **Minimal Dependency Set:** 布局结构、可复用视觉 token、核心 CSS 规则、图标依赖、响应式/滚动行为；不包含旧页面路由、旧业务状态和旧阶段命名。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 视觉与骨架成立，但 `App.jsx` 同时承载素材、内容理解、Asset Library 与旧导航，整文件复制会把旧信息架构带入 R3。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/application-shell` 与共享视觉层；最终路径待 Legacy Harvest 冻结后决定。
- **Migration Risk:** 旧阶段 04“智能包装生产”、旧导航与当前 R3 四阶段/五阶段事实不一致；1867 行全局 CSS 可能产生选择器污染。
- **Required Verification:** R3 导航语义对照、三栏滚动/缩放、字体与图标许可、无旧路由/旧状态残留、视觉回归截图。
- **Confidence:** High

### 3.2 Material Understanding｜输入准备 UI

- **Old Location:** `workbench-v0/src/App.jsx` 的 Material 区域、`workbench-v0/src/styles.css`
- **What Is Proven:** 已有 Base Video、SRT 选择与状态反馈、方向信息、错误提示和本地桥接流程；代码与相关测试入口存在。
- **R3 Relevance:** 对应 R3 Stage 1 的项目输入准备，但必须服务于 `01_输入素材/` 与当前 Content Understanding 合同。
- **Decision:** `MODIFY`
- **Minimal Dependency Set:** Material UI、文件选择状态、错误状态、媒体/SRT 校验接口、R3 Workspace adapter；不携带旧 `.runtime` 存储实现。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 用户交互主体可复用；旧桥接默认写入 `workbench-v0/.runtime/uploads` 和 `.runtime/project-state`，违反 R3 四层物理边界。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/material-input`；正式素材写入当前 Project Workspace 的 `01_输入素材/`。
- **Migration Risk:** UI 状态与旧 HTTP bridge 紧耦合；若只复制 JSX，会缺失校验、持久化与错误合同。
- **Required Verification:** 新 Workspace 中真实视频/SRT 选择、方向不一致、取消选择、重复打开、路径越界与失败恢复。
- **Confidence:** High

### 3.3 SRT Parser｜SRT 解析器

- **Old Location:** `workbench-v0/platform/material/srt-parser.js` 及对应测试
- **What Is Proven:** 独立解析时间码、字幕块和错误输入；存在确定性测试覆盖，未发现绝对路径或旧项目状态依赖。
- **R3 Relevance:** Stage 1 输入校验与后续 Theme Chapter / Director Shot 时间定位所需的基础能力。
- **Decision:** `KEEP`
- **Minimal Dependency Set:** parser、错误类型/最小校验合同、对应测试夹具。
- **Coupling Risk:** 🟢 `Independent`
- **Why:** 逻辑边界小、输入输出明确，不依赖 UI、存储、数据库或旧运行时。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/material/srt`。
- **Migration Risk:** 低；主要风险是字符编码、BOM、异常换行与真实字幕边界未在本轮重跑。
- **Required Verification:** 在 R3 独立测试环境复跑原测试，并加入中文、BOM、CRLF、空字幕与非法时间码样例。
- **Confidence:** High

### 3.4 MP4/MOV Probe｜媒体探测与校验

- **Old Location:** `workbench-v0/platform/material/video-probe.js`、ISO BMFF 解析相关文件及测试
- **What Is Proven:** 已实现 `ffprobe` 优先与纯 ISO BMFF fallback，可读取尺寸/方向/时长并形成错误状态；存在对应测试。
- **R3 Relevance:** Stage 1 的 Base Video 校验、项目方向识别和 Golden Test 输入准备。
- **Decision:** `MODIFY`
- **Minimal Dependency Set:** 纯容器解析器、统一 probe 接口、可选 `ffprobe` adapter、错误合同、测试夹具。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 核心解析可保留，但外部二进制发现、进程调用和环境差异需要显式封装，不能依赖旧机环境。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/material/media-probe`。
- **Migration Risk:** 不同编码/容器、无 `ffprobe` 环境、超大文件和损坏文件行为。
- **Required Verification:** 有/无 `ffprobe` 双路径、MP4/MOV、横竖屏、损坏文件、路径含中文、超时与资源释放。
- **Confidence:** High

### 3.5 Content Understanding｜编排、旧 Artifact 与 DirectorPlan 合同

- **Old Location:** `workbench-v0/platform/content-understanding/`, `workbench-v0/platform/runtime/`, `workbench-v0/platform/state/`
- **What Is Proven:** 已有本地任务编排、bounded retry、状态推进、候选产物/晋升及 Codex CLI adapter；旧测试证明过若干失败和状态路径。
- **R3 Relevance:** 可为 Stage 1 的任务可靠性与审计链提供实现经验，但产品输出必须服从当前 R3 Theme Chapter → Director Shot 结构。
- **Decision:** 编排可靠性模式 `EXTRACT`；旧 artifact schema、旧 DirectorPlan schema 与生命周期 `REBUILD`。
- **Minimal Dependency Set:** 可取消任务、重试/超时模式、不可变写入、候选晋升、错误分类；重新定义的 R3 Stage 1 schema 与 Project Workspace adapter。
- **Coupling Risk:** 🔴 `Hidden Coupling`
- **Why:** 旧输出包含 `summary/keyFacts/segments`、组件 ID 绑定、`assetGaps`、`executabilityPassed` 与 `READY_FOR_PACKAGING`，分别与当前 R3 Key Message 归属、DirectorPlan 非执行门槛和阶段语义冲突；adapter 还依赖本机 Codex CLI 与旧 runtime root。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/content-understanding` 的新合同与 adapters；产物进入 `02_导演计划/`，运行状态进入 Runtime Root。
- **Migration Risk:** 最高；旧合同若被误当事实源，会反向污染当前 Baseline。
- **Required Verification:** 按当前 Baseline 建立 schema conformance、禁止 Stage 1 生成 Key Message、禁止一般性绑定真实组件、失败恢复与跨重启一致性测试。
- **Confidence:** High

### 3.6 Asset Library｜频道页、详情页与交互骨架

- **Old Location:** `workbench-v0/src/component-library/`, `workbench-v0/src/shared/component-preview/`, `workbench-v0/src/shared/component-config/`
- **What Is Proven:** 列表/频道、详情、左右分栏、选择同步、搜索过滤、预览控制、配置面板和状态展示已有完整交互实现。
- **R3 Relevance:** 与 R3 Asset Library UI 高度相关，是最值得复用的前端成果之一。
- **Decision:** `MODIFY`
- **Minimal Dependency Set:** 页面壳、频道/详情路由、选择与滚动状态、搜索过滤、预览/配置 UI；替换 taxonomy、catalog、registry、storage 与 engine adapter。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 页面结构成熟；但旧 IA 含 Featured、Animation Components、Global Packaging、Character Layout、Drafts，与 R3 四个一级模块、Global 仅 Subtitle + Chapter Progress、无 Animation Components 中间层的规则不一致。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/asset-library-ui`；资产事实存储在 AppDataRoot，由产品 UI 管理。
- **Migration Risk:** 旧 taxonomy 与状态字段渗入 UI；详情页可能把 engine child 当作 parent asset。
- **Required Verification:** 四个一级模块、十个种子分类、Parent Asset → Engine Child、五种 Theme Preset、状态维度分离、横竖屏筛选与空状态。
- **Confidence:** High

### 3.7 Preview State / Config Control Model

- **Old Location:** `workbench-v0/src/component-library/preview-state.js`, `workbench-v0/src/shared/component-preview/`, `workbench-v0/src/shared/component-config/`, `workbench-v0/src/component-lab/`
- **What Is Proven:** 预览实例隔离、schema-driven controls、边界预设、参数更新与播放器同步已形成可复用模式。
- **R3 Relevance:** 支撑资产详情预览、参数调节和后续主题资产生产。
- **Decision:** `EXTRACT`
- **Minimal Dependency Set:** engine-neutral preview state contract、control schema、boundary presets、event contract；HyperFrames 和 Remotion 分别通过 child adapter 接入。
- **Coupling Risk:** 🔴 `Hidden Coupling`
- **Why:** 当前 `ComponentPreview.jsx` 直接依赖 `@remotion/player` 与旧 platform/remotion，HyperFrames library 又反向读取 Workbench control-plan，尚未形成真正的 engine-neutral 边界。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/preview-contract` 加 engine-specific adapters。
- **Migration Risk:** 表面上的共享组件实际固定到 Remotion；状态隔离不彻底时会污染不同资产实例。
- **Required Verification:** 同一 Parent Asset 的 HyperFrames/Remotion child 可切换；多实例互不污染；未知 schema 字段安全降级。
- **Confidence:** High

### 3.8 HyperFrames Registered Assets｜19 个已注册资产

- **Old Location:** `hyperframes/project/src/compositions/`, `hyperframes/project/src/shared/`, `hyperframes/project/registry/`, `workbench-v0/platform/components/`
- **What Is Proven:** 目录中实际存在 19 个 `project/compositions/*.html`、19 个 `assets/*/definition.json`，且 `library/components.js` 建立 19 个 ID → composition 的一一映射；19 份 definition 均标记 `REGISTERED v1.0.0`。仓内还存在逐组件截图、HyperFrames 检查说明、播放器与 Library 两份 25/25 机器报告及真实 MP4。本轮未复跑这些验证。
- **R3 Relevance:** 直接匹配 R3 “HyperFrames Primary / Remotion Expansion”的主技术方向，是当前最有价值的引擎资产集合。
- **Decision:** `MODIFY`
- **Minimal Dependency Set:** 19 个 composition、GSAP、17 个 composition 共用的 `hf-component-kit.js`、2 个自有 patch 实现、HyperFrames `0.8.46` runtime/player、ID → composition registry、player contract、所需 definition/schema/sample 字段及可重复 QA fixtures。
- **Coupling Risk:** 🔴 `Hidden Coupling`
- **Why:** 合成实现本身是 R3 最强复用资产，但整个 `hyperframes/` 在旧根 Git 中为未跟踪内容；definition 副本仍写 `REMOTION_FRAME`、旧四色主题和本机绝对 provenance，Library/样例导出脚本仍直接依赖 Workbench 路径。应接收 HyperFrames 实现及其必要合同，而不是无差别复制整个目录。
- **Recommended R3 Destination:** Shared Asset Library 中的 19 个 Parent Asset 及其 HyperFrames Engine Child；源码位置保持 `PROVISIONAL`，项目采用后须在 `03_项目实现/` 保存版本锁与生产快照。
- **Migration Risk:** 旧 Git 未纳管、共享 kit 单点耦合、2 个例外实现可能漂移、旧主题/时间模型污染、runtime 版本漂移、16:9-only、字体不确定、无音轨验证。
- **Required Verification:** 逐资产来源与许可、Git 纳管、HyperFrames 精确版本、19 个 ID/入口/schema 一致性、逐资产 runtime + screenshot + config patch、横/竖屏、字体、音频、seek/rate、确定性渲染、Parent/Child registry、旧路径零引用。
- **Confidence:** Medium-High

实际枚举出的 19 个 HyperFrames 候选：

`CMP-PUN-001`, `CMP-QTE-001`, `CMP-SKL-001`, `CMP-TRM-001`, `CMP-TYP-001`,
`CMP-DATA-001`, `CMP-DATA-002`, `CMP-DATA-003`, `CMP-DATA-004`, `CMP-DATA-005`,
`CMP-DATA-006`, `CMP-DATA-011`, `CMP-DATA-014`, `CMP-ENT-001`, `CMP-CHK-001`,
`CMP-STP-001`, `CMP-VRS-001`, `CMP-CHP-001`, `CMP-SUB-001`。

证据强度必须分层理解：

- **19/19 结构证据：** composition、definition、schema、sample 与 `library/components.js` 映射均存在。
- **19 颗视觉证据：** `renders/comp-shots/` 加 CMP-SKL-001 player/export 证据覆盖全体，但取证时间点与数量不完全一致。
- **25/25 深度交互证据：** 两份机器结果主要验证 `CMP-SKL-001` 的播放器和 Library 详情链路，不能外推为 19 颗均完成同深度交互验收。
- **文档漂移：** `gallery/index.html` 的旧 `DONE` 表只列 11 颗，而 `library/components.js` 列全 19 颗；迁移时以后者与实际文件交叉枚举，不接受任一单文件自证。

Migration 前必须以实际 registry/composition/asset 三方交叉枚举并按 ID 去重；不得只依赖 README 的“19”。

### 3.8.1 HyperFrames Shared Component Kit / Patch Contract

- **Old Location:** `hyperframes/project/vendor/hf-component-kit.js`、19 个 composition 内的 patch/render 实现
- **What Is Proven:** 17 个 composition 共用 kit；`CMP-SKL-001` 与 `CMP-CHP-001` 自有 patch 逻辑。共同能力包含 Variables 读取、内容/option patch、DOM 重建、Timeline 复用与 patched ack。
- **R3 Relevance:** 这是 19 颗资产可被同一个 Library/Player 驱动的关键运行合同，价值高于逐文件复制。
- **Decision:** `MODIFY`
- **Minimal Dependency Set:** kit API、版本标记、patch/ack message schema、Timeline rebind、2 个例外实现及 contract tests。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 已形成有效共享层，但 `postMessage('*')`、例外实现与 kit 版本一致性尚未正式治理。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/hyperframes-component-runtime`；作为 HyperFrames Engine Child 的显式依赖。
- **Migration Risk:** kit 变化同时影响 17 颗组件；2 个例外实现可能与公共合同漂移；宽泛消息目标存在安全风险。
- **Required Verification:** 19 颗 contract suite、消息来源/目标校验、版本兼容、patch ack、Timeline rebind、destroy/cleanup。
- **Confidence:** High

### 3.9 Historical Remotion-only Assets｜历史 Remotion 内容

- **Old Location:** `workbench-v0/platform/components/`, `RemotionGit/`, RemotionUI vendor snapshots
- **What Is Proven:** 存在大量旧 Remotion definitions/JSX/tests 与第三方来源快照；它们不是本轮 HyperFrames 改造成果的必要运行闭包。
- **R3 Relevance:** 当前仅有来源追溯和未来 Remotion Expansion 参考价值。
- **Decision:** `DROP`（Gate 1B 首批接收范围）；未来若有明确 Remotion Expansion 需求，再单独立项审计。
- **Minimal Dependency Set:** None for current migration。19 个 HyperFrames 资产只提取仍必要的业务 schema/来源字段，不携带旧 Remotion runtime。
- **Coupling Risk:** 🔴 `Hidden Coupling`
- **Why:** Hao 明确要求本轮重点收割已验证的 HyperFrames 改造成果；继续展开大量历史 Remotion 会扩大范围，并把旧 runtime、旧主题、旧 taxonomy 与第三方快照带回 R3。
- **Recommended R3 Destination:** None in first migration batch。
- **Migration Risk:** 过早扩大范围、重复 Parent Asset、旧合同反向污染 HyperFrames Primary 路径。
- **Required Verification:** 首批迁移 denylist 必须排除 Remotion runtime/vendor/历史组件；只允许经明确引用的 schema/provenance 字段进入接收包。
- **Confidence:** High

### 3.10 HyperFrames Shared Player｜共享播放器

- **Old Location:** `hyperframes/player/`, `hyperframes/adapter/runtime-player-adapter.mjs`, `hyperframes/adapter/hyper-player-adapter.js`
- **What Is Proven:** 已有自定义 player chrome、play/pause/seek/rate/time 事件和 runtime adapter；旧报告记录 25/25 smoke 通过。
- **R3 Relevance:** 可成为 Asset Library 与生产预览共享播放能力，避免每个页面重写控制器。
- **Decision:** `MODIFY`
- **Minimal Dependency Set:** engine-neutral player interface、HyperFrames adapter、player chrome/CSS、runtime package、event tests、fixture compositions。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 核心控制合同可保留；当前硬编码 `/hf-runtime/hyperframe.runtime.iife.js`、使用宽泛 `postMessage('*')`，竖屏与音频验证不足，CSS 来源仍与 Workbench 纠缠。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/player-contract` 与 HyperFrames child adapter。
- **Migration Risk:** runtime 路径、跨窗口消息安全、事件时序、seek 后画面一致性、横竖屏 fit。
- **Required Verification:** 同源消息约束、runtime 打包边界、16:9/9:16、音频、seek/rate/loop、卸载清理、离线可用性。
- **Confidence:** Medium-High

### 3.11 HyperFrames Library Host / Local Server

- **Old Location:** `hyperframes/library/library-host.js`, `hyperframes/scripts/serve.mjs`
- **What Is Proven:** 能把 HyperFrames compositions 接到旧 Library 页面，并提供本地 runtime/asset 路由。
- **R3 Relevance:** 集成路径与 adapter 经验有参考价值。
- **Decision:** `EXTRACT`
- **Minimal Dependency Set:** 路由映射意图、composition discovery、adapter contract、错误处理；不复制旧 server 与跨目录映射。
- **Coupling Risk:** 🔴 `Hidden Coupling`
- **Why:** 直接读取 `/workbench-src/component-lab/control-plan.js`、content markdown、landscape previews，并由 server 映射 `../workbench-v0/src` 与 `public`；这是明确的隐藏跨工程耦合。
- **Recommended R3 Destination:** 仅形成 R3 内部稳定接口；不保留旧 `/workbench-src` 路由。
- **Migration Risk:** 一旦照搬，本应独立的 HyperFrames 能力会继续依赖旧 Workbench 文件树。
- **Required Verification:** 删除旧目录后仍可启动、预览和发现资产；所有依赖均由 R3 package/registry 显式声明。
- **Confidence:** High

### 3.12 Storage Path Boundary / Immutable State Patterns

- **Old Location:** `workbench-v0/platform/runtime/path-boundary.js`, `workbench-v0/platform/state/state-manager.js`, `workbench-v0/platform/material/project-input-store.js`
- **What Is Proven:** 路径边界检查、不可变写入、候选产物晋升和状态持久化已有实现与测试痕迹。
- **R3 Relevance:** 对四层物理边界、项目可重复打开和失败恢复有直接价值。
- **Decision:** `EXTRACT`
- **Minimal Dependency Set:** path containment、atomic/immutable write、candidate promotion、schema validation、错误合同；接入 R3 Workspace/AppDataRoot/RuntimeRoot resolver。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 安全模式值得复用；旧默认根、旧 lifecycle 与项目内 `.runtime` 不能保留。
- **Recommended R3 Destination:** `<R3 source, PROVISIONAL>/storage-boundary`，只实现已冻结的四层合同。
- **Migration Risk:** 误把 runtime 状态写入 Workspace；软链接逃逸；跨卷原子替换差异。
- **Required Verification:** symlink escape、`..`、中文路径、跨卷、崩溃恢复、Runtime Root 清空后项目事实仍完整。
- **Confidence:** High

### 3.13 Component Lab、测试合同与样例夹具

- **Old Location:** `workbench-v0/src/component-lab/`, `workbench-v0/platform/**/tests`, `hyperframes/tests/`, `workbench-v0/platform/fixtures/content-understanding/`
- **What Is Proven:** 已积累控制计划、边界样例、parser/probe/state/player/component 测试与合成 fixture；它们比页面文件更能说明旧能力的行为边界。
- **R3 Relevance:** 可用于迁移接收测试和 Golden Test 的前置素材，但不能替代当前 R3 正式 Golden Test。
- **Decision:** `EXTRACT`；其中无外部版权且自包含的 synthetic fixture 可在迁移批准后 `KEEP`。
- **Minimal Dependency Set:** 测试意图、输入夹具、期望值、runner-independent assertions；排除写旧 runtime/renders 的脚本。
- **Coupling Risk:** 🟡 `Controlled Dependency`
- **Why:** 测试资产价值高，但大量 runner、Chrome、FFmpeg、Remotion/HyperFrames runtime 和用户缓存路径是环境依赖。
- **Recommended R3 Destination:** `<R3 tests, PROVISIONAL>/migration-acceptance`；Golden fixture 最终位置另行冻结。
- **Migration Risk:** 把旧“通过”当作 R3 通过；测试运行产生 renders/cache；外部 AKK 路径不可复现。
- **Required Verification:** fixture 版权/来源、无绝对路径、只写 R3 Runtime Root、干净环境可复跑、当前 Baseline assertions。
- **Confidence:** High

### 3.14 Development Control Center｜研发控制中心

- **Old Location:** `dev-control-panel/`
- **What Is Proven:** 已有模块导航、状态、blocker/risk 与 current/next 的静态控制台表达。
- **R3 Relevance:** 与 `AGENTS.md` 对 R3 Development Control Center 的长期要求高度一致，是用户未点名但值得保留的成果。
- **Decision:** `EXTRACT`
- **Minimal Dependency Set:** 信息架构、视觉布局、模块卡片与依赖表达；状态读取必须改接 R3 唯一 Project State source。
- **Coupling Risk:** 🔴 `Hidden Coupling`
- **Why:** 当前 `development-state.json` 是手工维护的竞争事实源，且包含旧模块、旧状态和绝对路径；不能直接接收。
- **Recommended R3 Destination:** 未来 R3 DCC UI/adapter backlog；本 Gate 不实现。
- **Migration Risk:** 形成第二套项目状态真相；把旧路径和旧 Gate 状态显示为当前事实。
- **Required Verification:** 单向读取 `PROJECT_STATE.json`、无重复手工状态、Change Impact/Coupling Risk/History 信息满足 R3 规则。
- **Confidence:** High

### 3.15 Do Not Bring｜旧事实、运行产物与第三方快照

- **Old Location:** 根目录历代 `V3.x`/R2/R3 文档与 HANDOFF；`workbench-v0/node_modules`, `.runtime`, `.pnpm-store`, build/cache/temp/renders；`RemotionGit/repo`; `src/remotionui-preview/vendor`; 本机 launch scripts；`.DS_Store`；旧 runtime symlinks。
- **What Is Proven:** 这些内容主要是历史事实、可再生成产物、本机状态、完整第三方仓库/快照或绝对路径启动器，不是当前 R3 产品事实源。
- **R3 Relevance:** 只保留审计溯源价值，不具备运行时接收价值。
- **Decision:** `DROP`
- **Minimal Dependency Set:** None。必要时仅在审计记录中保留来源与 commit/hash，不复制实体。
- **Coupling Risk:** 🔴 `Hidden Coupling`
- **Why:** 会污染 R3 权威性、Git 体积、许可边界与物理独立性，并重新引入旧 `node_modules`、cache、runtime 和绝对路径。
- **Recommended R3 Destination:** None。
- **Migration Risk:** 供应链不明、历史文档冒充当前事实、不可复现本机依赖、旧项目删除后失效。
- **Required Verification:** 迁移批次中明确 denylist；R3 扫描不得出现这些目录、旧绝对路径或 symlink。
- **Confidence:** High

## 4. Top Reuse Assets｜最值得复用的成果

1. 19 个已实际改造成 HTML/CSS/GSAP 的 HyperFrames compositions。
2. `hf-component-kit`、patch/ack 与 Timeline rebind 共同合同。
3. HyperFrames Shared Player 的 engine-neutral 接口、chrome 与 adapter。
4. 已能浏览 19 颗的 Asset Library 三级链路与 schema-driven Inspector。
5. `library/components.js` 的 19 颗 ID → composition 显式映射。
6. HyperFrames check、player/library smoke、逐组件截图、真实 MP4 等验证方法与证据。
7. 全局三栏工作台骨架与视觉基因（只提取必要依赖）。
8. SRT parser、媒体 probe 与存储边界等独立基础能力。
9. Preview State / config control / boundary preset 模型。
10. DCC 信息架构与确定性测试意图；历史 Remotion 组件不进入首批。

## 5. Do Not Bring｜明确不进入 R3

- 旧 `node_modules`、`.pnpm-store`、cache、build、dist、renders、temp、`.runtime` 和本机状态。
- 旧项目 `.git`、嵌套 `RemotionGit/repo/.git`、完整 Remotion 上游仓库与 RemotionUI vendor 快照。
- 任何指向旧项目或旧 runtime 的 symlink。
- 硬编码旧根目录、用户缓存、Chrome/FFmpeg/Codex CLI 路径的 launch scripts。
- 历代 R2/R3/V3.x Baseline、旧 HANDOFF、旧聊天导出及“final/latest”历史副本。
- Featured、Animation Components 中间层、Character Layout 等被当前 R3 Asset Library Baseline 推翻的旧 IA。
- `BLUE/ORANGE/RED/PURPLE` 旧四色主题合同。
- Stage 1 `summary/keyFacts/segments` 旧事实结构，以及在 Content Understanding 阶段生成 Key Message 的逻辑。
- DirectorPlan 普遍绑定真实组件、`executabilityPassed`、`READY_FOR_PACKAGING` 等被当前 R3 Baseline 推翻的规则。
- 手工维护的 `development-state.json` 竞争事实源。
- 未确认许可/来源的外部 AKK 或用户目录素材实体；只能记录来源，不能默认迁入。
- 大量历史 Remotion-only 组件、runtime 与第三方 vendor 快照；首批只接收 HyperFrames 所需的最小 schema/provenance 字段。

## 6. Hidden Coupling Summary｜最大隐藏耦合

1. **HyperFrames ↔ Workbench:** Library host/server 通过 `/workbench-src` 和 `../workbench-v0/src` 读取 control plan、markdown、preview 与 CSS。
2. **HyperFrames Bundle ↔ 旧 Git:** 整个 `hyperframes/` 在旧根仓库中未跟踪，缺少可靠 commit 身份；必须先形成可哈希接收包。
3. **Asset Metadata ↔ Remotion:** 19 份定义仍声明 `REMOTION_FRAME`、旧四色主题、旧 runtime module 与本机 provenance，不能直接成为 R3 Parent Asset 合同。
4. **Player/Compositions ↔ 消息协议:** 公共 kit 与个别 composition 使用 `postMessage('*')`；17 个共享 kit、2 个例外实现存在合同漂移面。
5. **Local Toolchain:** HyperFrames runtime、Chrome user cache、FFmpeg、node_modules 与旧本机路径未被 R3 package/runtime contract 显式隔离。
6. **Evidence Drift:** README/最新 Library 映射宣称 19 颗，旧 Gallery 仍只标 11 颗 DONE；25/25 深测主要覆盖 CMP-SKL-001。
7. **Material/Content Understanding ↔ 旧 Runtime:** 默认把上传与项目状态写入产品仓库 `.runtime`，与 R3 四层边界冲突。
8. **DCC ↔ 手工状态:** 静态控制台以独立 JSON 维护状态，可能成为 `PROJECT_STATE.json` 的竞争真相。

## 7. Additional Value Found｜额外发现的价值成果

- ISO BMFF fallback 让媒体探测不必把 `ffprobe` 作为唯一硬依赖。
- path-boundary、不可变写入、candidate promotion 适合转化为 R3 Storage Contract 的接收测试。
- Component Lab 的 boundary presets 和 schema-driven controls 可作为跨引擎预览合同的输入。
- synthetic content-understanding fixture 可作为确定性单元/集成测试素材候选。
- DCC 的模块/风险/Current/Next 信息架构与 R3 状态展示目标一致，但数据源必须重建。
- 旧 tests/reports 可形成迁移验收的 evidence checklist，比按文件树复制更有价值。

## 8. Migration Order Proposal｜建议迁移顺序

> 以下仅为顺序提案，不代表迁移授权。

1. **Freeze acceptance manifest:** Hao 确认本清单、denylist、首批接收集合与 provenance 要求。
2. **Create immutable HyperFrames intake inventory:** 对 19 个 ID、composition、asset metadata、共享 kit、player、lockfile 与证据文件生成哈希清单；解决旧 Git 未跟踪问题。
3. **Establish receiving contracts:** 冻结最小 Parent Asset → HyperFrames Engine Child、preview/player events、patch/ack、四层 path resolver 与验收规范；随后再决定 `src/` 最终结构。
4. **Receive Shared Player + component runtime:** 解除 `/hf-runtime`、`postMessage('*')`、旧 CSS 与本机 toolchain 耦合，先让最小独立 fixture 通过。
5. **Receive 19 assets in small batches:** 逐资产建立 Parent/Child、版本锁、来源和独立 QA；先处理 17 个 kit 共用实现，再处理 2 个例外实现；禁止整目录无差别复制。
6. **Receive Asset Library UI:** 复用三级链路与 Inspector，移除 `/workbench-src`，换成 R3 taxonomy、registry、AppDataRoot 和状态维度。
7. **Extract visual foundation:** 只提取 Library/Player 所需的骨架与视觉 token，替换旧导航、Animation Components 层与旧主题语义。
8. **Receive independent product primitives:** SRT parser → media probe → Material UI → R3 Workspace adapter，逐层验证且不接旧 `.runtime`。
9. **Rebuild Stage 1 contracts:** 只复用可靠性模式，按当前 Theme Chapter → Director Shot 事实重建 schema/编排。
10. **Later expansion:** 历史 Remotion 仅在明确产品需求下另立 Gate；DCC 只在 Project State adapter 明确后接收。

## 9. Gate 1B QA record

| QA Item | Result |
|---|---|
| 旧项目仅作只读审计源 | PASS；未运行安装、构建、测试、渲染或业务脚本 |
| 旧项目工作树审计前后变化 | PASS；排除 Finder `.DS_Store` 后，42,517 个文件/symlink 的路径、类型、大小、mtime、ctime 快照 SHA-256 完全一致；根/嵌套 Git HEAD 未变且 tracked/cached diff 均为空。期间观察到 1 个 `.DS_Store` 元数据刷新及 5 个新 `.DS_Store`，均为 Git 忽略的 Finder 元数据，本审计未删除或改写它们 |
| R3 未新增旧业务代码 | PASS；本轮仅创建本工作清单 |
| 五类已知高价值成果完成审计 | PASS |
| 主动发现额外高价值成果 | PASS |
| 所有建议迁移项有最小依赖与 Coupling Risk | PASS |
| 未依据文件名/版本号判断有效性 | PASS |
| 所有判断与当前 R3 Baseline 对照 | PASS |
| 本文件未进入 `docs/authoritative/` | PASS |
| 本文件不构成迁移授权 | PASS |

## 10. Gate disposition

本清单完成代表 **Legacy Harvest 审计完成**，不代表任何代码、资产、runtime 或基础设施已获准迁移。
下一步应由 Hao 确认本清单，再冻结首批接收范围与每批 Done Definition。
