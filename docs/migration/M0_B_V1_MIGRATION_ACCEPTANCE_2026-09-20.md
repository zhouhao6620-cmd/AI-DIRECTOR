# M0-B｜V1 迁移验收与复用封账报告

**Status:** USER ACCEPTED  
**Date:** 2026-09-20  
**Scope:** M0-B only  
**Authority:** `BASELINE_INDEX.md` 指向的 R3 权威基线、06/07 技术合同与当前实现  
**Legacy source:** `/Users/skyai/Desktop/视频生产线流程/基线文档/` (只读证据)

> 本报告是一次性迁移验收证据，不取代 06/07 权威合同。`PROJECT_STATE.json` 仍是当前机器可读状态的唯一来源。

## 1. Gate 结论

M0-B 已完成盘点、分类、真实验证和独立性扫描，并于 2026-09-20 经用户明确确认验收通过。

可封账复用的是：Project Workspace 与存储边界、SRT Parser、Media Probe / Timebase、HyperFrames Runtime Resolver / Adapter / Patch-Ack / Timeline 内核、19 个 R3 资产，以及 M0-A 已验收的研发控制中心独立性。

不得过度宣称的是：

- 当前产品 Shell 还不是已封装的全局共享工作台骨架；
- 主题资产库已有 19 张卡片和详情原型，但真实预览、搜索筛选、选用、四个一级分区和完整状态仍未闭环；
- HyperFrames Foundation / 播放控制内核已验证，但面向五类业务消费者的全局共享预览组件尚未验收；
- Golden Smoke 仅是受控模拟与验证证据，不是正式内容理解、导演编排、智能剪辑或验收工作台。

## 2. 五类统计

| 分类 | 候选能力组数 | 裁决含义 |
|---|---:|---|
| 已继承验收 | 11 | R3 当前实现与真实验证足以支持复用 |
| 修改后继承 | 14 | Legacy 能力/交互价值明确，但必须改接 R3 合同并再验收 |
| 仅作参考 | 4 | 只保留方法、知识或测试意图，不直接进入产品 |
| 禁止带入 | 7 | 持续列入 denylist，扫描和接收 Gate 必须阻断 |
| 尚未迁移 | 15 | 当前没有足够产品证据，交给后续里程碑 |
| **总计** | **51** | 19 个 HyperFrames 资产作为一个候选能力组统计，但已逐个运行验证 |

## 3. 本轮证据

| 证据 | 结果 |
|---|---|
| 确定性测试 | 15/15 PASS：DCC、Golden Smoke 边界、Foundation 合同、Material / Storage、Workspace |
| 产品构建 | `pnpm build` PASS；产品和 DCC 双入口生成 |
| HyperFrames 真实 Chrome 集成 | PASS；play / pause / seek / rate / timeupdate / Patch-Ack / Timeline rebind / destroy |
| 19 资产真实 Runtime 预览 | 19/19 PASS；逐个 ready 并确认 Patch Ack |
| 真实媒体探测 | PASS；10,657,765 bytes MP4，1872×1080，29,360 ms，25 fps |
| 产品 Shell 真实浏览器检查 | 19 卡片、选中、详情和素材页切换可用；无真实 Player/搜索/状态组件；仅 `favicon.ico` 404 |
| 独立性扫描 | PASS；运行源/资产/测试无 Legacy 根路径、`/workbench-src`、`/hf-runtime`、`development-state.json`、星号 `postMessage` 或运行时 symlink |
| 边界目录扫描 | Git 外只有已忽略的 `dist/`；`src/hyperframes-foundation/runtime/` 是源码命名，不是 Runtime Root 产物 |
| Playwright CLI | 未执行：本机无 `npx`；用项目已锁定的 Puppeteer + Chrome 完成同类真实浏览器验证，未为本 Gate 安装新工具 |

## 4. 已继承验收（11）

| ID | 中文业务名称 | Legacy 证据 | R3 承接位置 | 当前验证 / Legacy 依赖 | 剩余缺口与归属 |
|---|---|---|---|---|---|
| A01 | 研发控制中心框架与逻辑 | `dev-control-panel/index.html` + `development-state.json` 仅作反例/信息架构证据 | `development-control-center.html`, `src/development-control-center/**` | M0-A 已由用户验收；测试确认只读 `PROJECT_STATE.json`；无 Legacy 运行依赖 | 不改 UI；M0-C 只保护路径，后续状态继续单向投影 |
| A02 | 项目工作区 | Legacy workspace / path-boundary 模式 | `src/workspace/**` | 四个冻结目录、唯一 ID、`project.json` 测试 PASS；无 Legacy 依赖 | 浏览器挂载和正式 Schema 归 M0-C/M1 |
| A03 | 工作区边界与不可变写入 | `workbench-v0/platform/runtime/path-boundary.js` 等模式 | `src/storage/**` | 路径逃逸和 Runtime-in-Workspace 阻断测试 PASS；无 Legacy 依赖 | symlink / 跨卷等完整 QA 归 M0-C |
| A04 | 最终字幕解析器 | `workbench-v0/platform/material/srt-parser.js` | `src/material/srt-parser.js`, `srt-contract.mjs` | 中文有序 cue 和时间边界测试 PASS；无 Legacy 依赖 | 字符编码全组合回归归 M1 |
| A05 | 基础视频媒体探测 | `workbench-v0/platform/material/media-probe.js`, `mp4-probe.js` | `src/material/media-probe.js`, `mp4-probe.js` | 真实 MP4 得到 1872×1080 / 29.36s / 25fps；无 Legacy 运行依赖 | MOV、损坏文件、超时回归归 M1 |
| A06 | 素材时间基准与适配内核 | Legacy Material 验证思路 | `src/material/material-timebase.mjs`, `workspace-material-adapter.mjs` | SRT 超出视频阻断测试 PASS；无 Legacy 依赖 | 完整产品交互归 M1 |
| A07 | HyperFrames 运行时解析 | Legacy `hyperframes@0.8.46` 及启动经验 | `src/hyperframes-foundation/runtime/**` | 从 R3 锁定依赖解析，真实 Chrome PASS；无 Legacy 路径 | 打包/部署归 M0-C/M7 |
| A08 | HyperFrames 引擎适配内核 | Legacy player adapters | `src/hyperframes-foundation/player/hyperframes-adapter.mjs` | play/pause/seek/rate/event/destroy 真实 Chrome PASS；无 Legacy 依赖 | 产品级 Player Contract 完整性见 M14/N12 |
| A09 | 版本化修补/确认合同 | Legacy kit 中的 patch 模式 | `patch-contract.mjs`, `SharedPlayer.patch()` | 同源 origin/source、超时、成功 Ack 测试 PASS；无星号 target | 正式 Registry Schema 归 M0-D/M4 |
| A10 | 时间线重绑与共享组件运行内核 | Legacy `hf-component-kit.js` 和 2 个例外实现 | `browser-foundation-kit.mjs`, `resources/**/r3-hf-component-kit.js` | Patch 后 timeline rebind；19 资产逐个 Ack/ready PASS；无 Legacy 依赖 | 合同版本治理归 M0-D/M4 |
| A11 | 19 个 HyperFrames 注册资产 | Legacy 19 compositions / definitions / library map；Gate 1B Manifest | `resources/hyperframes-assets/**`, `r3-asset-registry.mjs` | 17 Component Card + 2 Global；19/19 真实 Runtime 预览/Patch PASS；无 Legacy 依赖 | Parent/Child 正式 Schema、AppDataRoot 实体与项目快照归 M0-C/M0-D/M4 |

### A11 的 19 个资产

`CMP-PUN-001`, `CMP-QTE-001`, `CMP-SKL-001`, `CMP-TRM-001`, `CMP-TYP-001`, `CMP-DATA-001`, `CMP-DATA-002`, `CMP-DATA-003`, `CMP-DATA-004`, `CMP-DATA-005`, `CMP-DATA-006`, `CMP-DATA-011`, `CMP-DATA-014`, `CMP-ENT-001`, `CMP-CHK-001`, `CMP-STP-001`, `CMP-VRS-001`, `CMP-CHP-001`, `CMP-SUB-001`.

## 5. 修改后继承（14）

| ID | 中文业务名称 | Legacy 证据 | R3 承接位置 | 当前证据 / Legacy 依赖 | 差异与后续归属 |
|---|---|---|---|---|---|
| M01 | 全局工作台骨架 | `workbench-v0/src/App.jsx`, `styles.css` | 后续 R3 shared application shell（路径 M0-C 确定） | Legacy 三栏已证明；R3 仅有页面级壳；未建立 Legacy 运行依赖 | 去旧路由/状态，形成单一骨架；M0-C 确定承接边界，M1–M5 复用 |
| M02 | 顶部导航 | Legacy 顶栏与 DCC 当前实现 | 全局 Shell | R3 存在两套页面实现，未封装 | 合并为共享能力；M0-C/M1 |
| M03 | 左侧模块导航 | Legacy stage/library nav | 全局 Shell | 产品 Shell 只有 2 个按钮，与五阶段/资产库 IA 未对齐 | 使用当前 R3 IA；M1–M6 |
| M04 | 中央业务工作区 | Legacy white canvas / scroll model | 全局 Shell | 当前各页有 canvas，但无共享 contract | 封装页边距、滚动和内容接口；M0-C/M1 |
| M05 | 右侧详情/参数/检查面板 | Legacy Library / Inspector | 全局 Shell shared panel | DCC 有抽屉，产品 Asset 详情是页内 article；未统一 | 开关、宽度、滚动、错误语义；M1–M5 |
| M06 | 全局视觉 Token | Legacy 黑顶栏/黑左栏/白 canvas/橙色强调 | shared tokens | DCC 使用橙色；产品 Shell 使用蓝色，存在明显分叉 | 统一字体、色彩、间距、圆角、阴影；M0-C 定边界，后续 UI 消费 |
| M07 | 按钮/卡片/状态/表单原语 | Legacy CSS 与 R3 DCC/Product 现有样式 | shared UI primitives | 实例存在，但未共享、无状态矩阵 | 封装后禁止页面重写；M0-C/M1 |
| M08 | Hover/点击/选中/禁用交互 | Legacy Library 和 Preview controls | shared interaction primitives | 当前卡片选中/点击可用；禁用和可访问状态不完整 | 统一 keyboard/focus/disabled；M1–M5 |
| M09 | 响应式工作台规则 | Legacy CSS media/container rules | shared shell/layout | 当前 Product 没有 media query；DCC 有最小宽度规则 | 定义窄屏降级；M0-C/M1 |
| M10 | 资产库分类与导航 | Legacy `ComponentLibraryPage`, `LibraryNav` | Asset Library UI | 当前只有 Component/Global 混合页；无 Legacy 运行依赖 | 改为 Theme Preset / Global / Card / Draft 四区；M3/M4 |
| M11 | 资产搜索、筛选与卡片 | Legacy toolbar/filters/cards | Asset Library shared UI | R3 卡片存在，搜索/筛选不存在 | 改接 R3 taxonomy/registry；M3/M4 |
| M12 | 资产详情、参数与预览状态 | Legacy Detail/Config/Preview State | Asset Detail + Shared Preview | 当前详情是文字占位，“试填”未调用 Player | 保留交互模式，改接 R3 Parent/Child；M3/M4 |
| M13 | 素材上传交互 | Legacy Material UI | `stage1-entry.mjs` + browser adapters | 底层能力已验证；产品 Shell 的 2 个 file input 未接工作区 | 挂载 Stage 1 并验真实 File System Access；M1 |
| M14 | HyperFrames 全局共享预览组件 | Legacy `preview-chrome.js`, player adapters/CSS | shared preview/player | Foundation 内核 PASS，但无共享 chrome、加载/空/错误 UI 和消费者端口 | 不允许五个消费页各自重写；M0-D 合同，M3–M6 接入 |

## 6. 仅作参考（4）

| ID | 中文业务名称 | Legacy 证据 | R3 承接 | 当前证据 / 缺口 / 归属 |
|---|---|---|---|---|
| R01 | Legacy QA 方法和历史报告 | `hyperframes/tests`, `renders`, smoke reports | 只转化为 R3 assertions | 历史 PASS 不替代 R3 验收；已用 R3 真实 Chrome 重验；后续各 Gate 参考 |
| R02 | 内容理解任务可靠性模式 | Legacy retry/cancel/candidate promotion | M2 重新实现时参考 | 业务 Schema 与 R3 冲突；仅参考错误分类、重试和不可变写入 |
| R03 | Component Lab 与边界预设模式 | Legacy component lab/config control | M0-D/M4 合同参考 | 当前混有 Remotion 与旧 Schema；不直接复制 |
| R04 | Golden Smoke 内容结构/导演计划/整片预览 | R3 `tests/golden-smoke/**` | M0-E Golden Project 候选证据 | 受控模拟已证明 6 Shot / 15 SRT / 8 players，但不是正式 M2–M5 产物 |

## 7. 禁止带入（7）

| ID | 禁带项 | Legacy 证据 | R3 承接位置 | 当前扫描 / 后续归属 |
|---|---|---|---|---|
| F01 | 旧 runtime/storage/cache/build/dist/temp/renders/preview/logs/jobs | Legacy `.runtime`, `renders`, `dist` 等 | None | 源码/资产无引用；M0-C/M7 持续扫描 |
| F02 | 旧 `node_modules` / `.pnpm-store` / `.git` / Remotion vendor 镜像 | Legacy 大量实体 | None | R3 使用自有 lockfile；M0-C 保持 denylist |
| F03 | 本机绝对路径、缓存与旧启动脚本 | Legacy `.command`, user cache paths | None | 运行源扫描无命中；测试输入路径不持久化 |
| F04 | `development-state.json` 竞争状态源 | `dev-control-panel/development-state.json` | None | DCC 测试确认仅读 `PROJECT_STATE.json` |
| F05 | 直读 Legacy 目录的模块、CSS 或资产 | `/workbench-src`, cross-directory server map | None | 扫描无命中，19 资产全部由 R3 自有路径服务 |
| F06 | 旧四色主题、旧 Taxonomy 和 Animation Components 中间层 | Legacy Library / definitions | None | R3 registry 使用 17 Card + 2 Global；M0-D/M3 持续防回流 |
| F07 | 旧 Stage 1 Artifact / DirectorPlan / executability gate | Legacy Content Understanding 合同 | None | Golden Smoke 明确 non-formal；M0-D/M2/M3 按当前基线重建 |

## 8. 尚未迁移（15）

| ID | 中文业务名称 | Legacy 证据 | R3 预定承接 | 当前证据 / Legacy 依赖 | 缺口与归属 |
|---|---|---|---|---|---|
| N01 | 共享页面标题与工具栏 | Legacy 页头模式 | shared UI | 各页各自实现；无 Legacy 运行依赖 | M0-C/M1 |
| N02 | 共享任务进度 | Legacy job/status UI | shared UI | 未实现产品级真实阶段进度 | M4 |
| N03 | 共享空/加载/错误状态 | Legacy preview/library states | shared UI | 当前 Asset 页无对应 DOM/state | M0-C/M1/M3 |
| N04 | Stage 1 产品 Shell 挂载与浏览器文件系统闭环 | Legacy Material UI | application shell + `stage1-entry.mjs` | 模块存在但 `main.js` 未挂载 | M1 |
| N05 | 资产库真实 HyperFrames 预览 | Legacy Library host/player | Asset Detail + Shared Player | 当前只有文字占位，无 `<hyperframes-player>` | M3/M4 |
| N06 | 资产选用与版本锁定交互 | Legacy detail actions | Asset Library / Director Arrangement | 当前仅选中卡片，无正式 adopt | M3/M4 |
| N07 | Theme Preset UI | Legacy theme UI 只可参考 | Asset Library Theme Preset | R3 当前无界面 | M3 |
| N08 | Component Draft Box UI | Legacy Drafts IA 需改接 | Asset Library Draft Box | R3 当前无界面 | M4/M7 |
| N09 | AppDataRoot 资产实体管理与项目生产快照 | Legacy storage 不合规 | storage/asset adapters | 当前只有 Repo resources/registry | M0-C/M0-D/M4 |
| N10 | 正式内容理解 | Legacy 业务合同冲突 | formal M2 | 只有 Golden Smoke 模拟 | M2 |
| N11 | 正式导演编排 / DirectorPlan | Legacy 合同冲突 | formal M3 | 只有 Golden Smoke 模拟 | M0-D/M3 |
| N12 | 共享播放器 9:16、完整 chrome 与状态闭环 | Legacy 有 16:9/9:16 样式和 controls | shared player | R3 只验 640×360 / 1920×1080；无音频、loop、loading/empty/error UI | M0-D/M3–M6 |
| N13 | 共享播放器五类消费者接入 | Legacy 只证明 Library/standalone | Asset Library / Director / Editing / Acceptance / pre-export | 当前无正式消费者端口 | M3–M6；必须一个组件复用 |
| N14 | 正式智能剪辑 / ProductionState | Legacy 只提供模式 | formal M4 | Golden Smoke 是 non-formal fixture | M0-D/M4 |
| N15 | 正式验收工作台与导出前预览 | Legacy Workbench/player 参考 | formal M5/M6 | 当前无产品闭环 | M5/M6 |

## 9. 全局 UI 设计规范继承结论

继承方向正确，但尚未达到“全局共享实现已验收”。后续必须以单一 R3 工作台骨架为基底：

```text
黑色顶部导航
+ 黑色左侧模块导航
+ 白色中央业务工作区
+ 白色右侧详情 / 参数 / 检查面板
+ 橙色强调 + PingFang SC + 克制圆角/轻阴影
```

当前 DCC 与 Product Shell 之间存在橙/蓝强调色分岔，各页面骨架也未组件化。所以 M0-B 冻结的是“共享原则、候选清单与承接边界”，不是一次性大量重构 UI。

## 10. 主题资产库 UI 结论

- **可保留：** 19 资产清单、R3 分类、卡片选中、状态/版本显示、右侧详情基本心智。
- **必须修改：** 改为四个一级分区，复用全局 Shell，搜索/筛选和卡片成为共享组件，详情改接 Parent Asset / Engine Child / AppDataRoot。
- **当前不能宣称已完成：** 真实预览、选用、空/加载/错误、Theme Preset、Draft Box、项目版本锁定与生产快照。

## 11. HyperFrames 共享预览播放器结论

### 已通过的内核

- R3 自有 runtime 解析；
- play / pause / seek / playback rate；
- timeupdate 事件与基础时间同步；
- Patch/Ack 同源安全边界；
- patch 后 Timeline rebind；
- 19 资产逐个预览；
- Golden Smoke 中字幕、章节进度和组件叠加的受控验证。

### 尚未通过的全局组件 Gate

- 9:16 真实浏览器回归；
- 共享 chrome，以及 duration / ended / error / loading / empty 的产品状态；
- 音频、loop、全屏和可访问性闭环；
- 主题资产库、导演编排、智能剪辑、验收工作台、导出前预览的统一接入端口。

因此正式裁决是：**Foundation / 播放控制内核已继承验收；全局共享预览播放器修改后继承，尚不能作为完成的全局产品组件。**

## 12. 禁止重复开发的公共能力

以下能力不得在业务页中各自重做，必须按“先查共享→直接复用→必要时扩展→确实不存在才新建”执行：

1. 全局工作台骨架；
2. 顶部导航；
3. 左侧模块导航；
4. 右侧详情/参数/检查面板；
5. 页面标题与工具栏；
6. 按钮、卡片、表单、状态标签；
7. 任务进度；
8. 资产卡片、搜索与筛选；
9. 空、加载、错误状态；
10. HyperFrames 全局共享预览播放器。

## 13. 对后续里程碑的明确输入

### M0-C｜研发仓库与存储目录正式整理

- 根据已验证依赖闭包确定 shared shell / shared UI / shared player / engine / asset / storage 的长期承接边界，不为对称而创建空目录；
- 固化 Product Repository / Workspace / AppDataRoot / RuntimeRoot 物理映射、忽略规则和测试产物落点；
- 定义 Asset Library AppDataRoot 与项目本地快照的存储端口；
- 保护 DCC 独立入口和全部既有未提交成果，执行全量回归。

### M0-D｜产品 Skill 与最小合同

- 冻结 Parent Asset / HyperFrames Engine Child / Registry / Patch / Shared Player 的正式 Schema 和版本规则；
- 冻结 Shared Player 的业务无关端口与五类消费者接入合同；
- 定义 Content Structure、DirectorPlan、ProductionState 最小合同，禁止恢复旧 Stage 1 规则；
- 把先查共享、禁止页面重复开发纳入后续产品 Skill 的实施规则。

### M0-E｜真实全链路黄金样例

- 使用真实 Base Video + Final SRT，从 Workspace 进入，不从 Legacy 路径运行；
- 正式消费 M0-D 合同，不再以 Golden Smoke non-formal fixture 代替；
- 验证 16:9 和至少一条 9:16 共享 Player 路径；
- 验证字幕、章节进度、组件卡片、播放控制、时间同步、错误恢复和 RuntimeRoot 清空后可重建；
- 终点为 HyperFrames 本地整片预览，不启动导出。

## 14. 真实风险

1. 当前产品 Shell 中的预览文案会让用户以为已挂载真实 Shared Player，实际是静态占位；后续 UI 必须消除这种过度宣称。
2. `PROJECT_STATE.json` 先前将整个 Asset Library UI 标记为 PASS，与当前产品证据不符；M0-B 已改为基础能力已验证、产品 UI 接入未完成。
3. Foundation 的测试合同比当前 `SharedPlayer` 对外 API 更完整；若不在 M0-D 冻结端口，五个消费者可能形成不兼容包装。
4. 原始真实 Golden 视频仍位于 R3 仓库之外；本轮只把它作为显式测试输入，未持久化路径。M0-E 必须通过正式 Workspace 进入。
5. 当前工作树含大量用户未提交成果；M0-C 重组目录时必须以最小变化和完整回归保护。

## 15. Gate 处置

- M0-A：用户已验收；本任务未修改其 UI。
- M0-B：**USER ACCEPTED**，2026-09-20 正式封账。
- M0-C / M0-D / M0-E：**NOT STARTED**，仅接收本报告的明确输入。
- M1–M7：**NOT STARTED**。
