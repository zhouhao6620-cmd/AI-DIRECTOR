# Gate 2A｜HyperFrames Foundation Execution Card

**Status:** CONTROLLED EXECUTION CARD — READY FOR REVIEW
**Scope:** Wave 1｜HyperFrames Foundation
**Authority:** `07_R3_LEGACY_REUSE_AND_MIGRATION_CONTRACT_旧项目复用与迁移合同.md`
**Date:** 2026-09-19

> 本卡只授权 Wave 1 的受控实施准备与未来执行范围，不授权本轮复制、安装、创建业务源码或迁移任何正式 Asset。
> `CMP-DATA-002`、`CMP-SKL-001`、`CMP-SUB-001` 只属于 Wave 2 Pilot，不能进入本卡的接收包或测试夹具。

## 1. Goal / Reuse / Delta / Scope Lock

### Goal

在 R3 内建立最小、可独立验证的 HyperFrames Foundation：Runtime 边界、Shared Component Kit、Patch / Ack、Shared Player、最小 Registry / Adapter Contract 以及确定性验证。

### Reuse

复用已验证的 HyperFrames runtime、播放器控制语义、共享 kit 的 Variables / Timeline / patch 模式、透明 iframe 背景处理经验和 smoke-test 的行为断言。

### Delta

把上述能力收敛为 R3 自有、无旧 Workbench / 旧路径 / 旧 runtime 依赖的最小 Foundation；此阶段不定义正式 Component Asset、Parent Asset、Engine Child、Asset Library UI 或多引擎平台。

### Scope Lock

Wave 1 只处理 Foundation 与一个非正式、测试专用 fixture。不得接收任何 19 个 Legacy Asset、资产 definition/schema/sample、旧 Library 页面、旧 Workbench 模块或 Remotion 内容。

## 2. Legacy Intake

下表是未来 Wave 1 允许从只读 Legacy Source 接收或提取的最小能力集合。所有接收都必须在 R3 新建文件中完成；不得原样复制旧目录。

| Legacy Source | Need | Decision | Cannot Bring Together |
|---|---|---|---|
| `hyperframes/package.json`、`hyperframes/pnpm-lock.yaml` | 确认已验证的 runtime 与测试工具版本。 | `EXTRACT` | 不复制 package manifest、lockfile、`node_modules` 或包管理器缓存。 |
| `hyperframes/adapter/runtime-player-adapter.mjs` | 播放器业务语义：load、play、pause、seek、rate、time/duration/ended/error、destroy。 | `MODIFY` | 不带 Remotion 可插拔承诺、旧注释中引用的 Workbench 或旧预览常量。 |
| `hyperframes/adapter/hyper-player-adapter.js` | HyperFrames `<hyperframes-player>` API 到 R3 Player Contract 的最小适配。 | `MODIFY` | 不带硬编码 `runtime-src`、旧 DOM 假设或旧测试全局变量。 |
| `hyperframes/player/preview-chrome.js` | 自有 chrome 与 player 解耦的结构、控制事件生命周期、背景切换后恢复播放头的经验。 | `MODIFY` | 不带旧画幅菜单、音量占位 UI、旧页面全局状态、`/hf-runtime`。 |
| `hyperframes/player/player-chrome.css` | Player 控制条的最小可访问样式和 fullscreen / surface 行为。 | `EXTRACT` | 不带 Workbench CSS、旧 Library selector、旧视觉主题或页面壳。 |
| `hyperframes/project/vendor/hf-component-kit.js` | Variables 读取、Timeline 注册/重建、patch/ack 的共享机制。 | `MODIFY` | 不带 `postMessage('*')`、旧 composition ID 约定、正式资产内容/主题规则。 |
| `hyperframes/project/canvas-backdrop.js` | 透明 iframe 的画布背景必须由 composition document 自身处理这一运行时事实。 | `EXTRACT` | 不带旧 `canvas=DARK|LIGHT|CHECKER` 参数、旧产品主题色或 Asset-specific 逻辑。 |
| `hyperframes/scripts/serve.mjs` | runtime 静态解析与 composition 注入的必要行为边界。 | `EXTRACT` | 不复制 server、`/workbench-src` 映射、`../workbench-v0/src`、`/hf-runtime` 旧路由。 |
| `hyperframes/tests/smoke.mjs` | Player 行为断言与真实浏览器验证模式。 | `EXTRACT` | 不带 `CMP-SKL-001`、旧截图/renders 写入、旧 Chrome cache 探测或旧 URL。 |

明确不属于 Wave 1 Intake：

- `hyperframes/assets/**`；
- `hyperframes/project/compositions/**`；
- `hyperframes/library/**`；
- `hyperframes/adapter/hyper-config-mapper.mjs`；
- `hyperframes/adapter/hyper-composition-compiler.mjs`；
- `hyperframes/project/vendor/gsap.min.js`；
- 所有 `workbench-v0/**`、Remotion、legacy `renders/**`、旧启动脚本、旧 lockfile、`node_modules` 与缓存。

## 3. Minimal Dependency Closure

### 3.1 Runtime and package boundary

| Dependency / Precondition | Exact Wave 1 Rule |
|---|---|
| HyperFrames | 新 R3 manifest 必须锁定 `hyperframes` **`0.8.46`**；不得以 `^`、`latest` 或旧安装目录作为运行时来源。 |
| GSAP | 测试 fixture 与 Shared Component Kit 的 Timeline 能力使用 `gsap` **`3.15.0`**；从 R3 package dependency 安装，不复制 `gsap.min.js` vendor 文件。 |
| Browser test driver | `puppeteer-core` **`25.11.0`** 仅为 dev/test dependency；Chrome executable 由 R3 测试环境显式提供，禁止扫描或引用旧项目/user cache 路径。 |
| Node | 执行环境为 Node.js `>=22`；精确版本记录在 Wave 1 测试报告，不写入产品事实源。 |
| Render toolchain | FFmpeg / FFprobe、MP4 export、snapshot render 不属于 Wave 1 Done Definition，不进入依赖闭包。 |
| Lockfile | 由 R3 自己生成并提交；绝不复制 Legacy `pnpm-lock.yaml`。若依赖解析额外需要 peer package，必须在新 lockfile 中显式记录并在 Wave 1 变更说明中解释。 |

### 3.2 R3-owned runtime boundary

1. Runtime 资源只能从 R3 安装的 `hyperframes@0.8.46` 解析。
2. Player 不得硬编码 `/hf-runtime`，也不得知道 package 内部文件路径；它只消费 R3 `RuntimeResolver` 给出的同源 runtime URL / entry。
3. 若执行时需要本地静态服务，该服务必须只暴露 R3 接收包与测试 fixture；禁止任何 `../workbench-v0`、`/workbench-src`、旧项目根或用户缓存映射。
4. `RuntimeResolver`、Player 和 fixture 的相对资源路径必须在 R3 repository 内闭合；运行时输出只允许进入 `<AppRuntimeRoot>/` 或测试临时目录，不能进入 Workspace、AppDataRoot 或 Git。

### 3.3 Shared Component Kit and patch contract

Foundation Kit 只提供与业务无关的：

- Variables 读取与校验；
- Timeline 注册、清理、重建与 rebind 请求；
- 版本化 patch 接收；
- patch result / failure ack；
- fixture 所需的最小 DOM 更新钩子。

不提供：Theme Mapping、旧四色、Content Schema、Asset ID、Component Card 业务语义、Global Packaging 规则或正式资产实现。

Patch / Ack 最小合同：

```text
Host → Composition: r3.hyperframes.patch.v1
  { requestId, variables }

Composition → Host: r3.hyperframes.patch-ack.v1
  { requestId, ok, errorCode?, detail? }
```

安全要求：

- Host 使用明确的 `targetOrigin`，不得使用 `"*"`；
- Composition 验证 `event.origin === expectedOrigin`，并验证 `event.source` 是当前允许的 host；
- ack 返回同一明确 origin，携带原始 `requestId`；
- 未知协议、未知字段类型、重复 requestId、来源错误或超时必须确定性失败，不得静默成功；
- R3 Foundation 不实现跨 origin、跨窗口或多引擎消息总线。

### 3.4 Player / CSS / font closure

- Shared Player Contract 最小方法：`load`, `play`, `pause`, `seek`, `setPlaybackRate`, `getPlaybackState`, `onTimeUpdate`, `onDurationChange`, `onEnded`, `onError`, `destroy`。
- Shared Player 只能通过 HyperFrames Adapter 与 `<hyperframes-player>` 交互；不查询其 shadow DOM，也不耦合具体 Component Asset。
- Player CSS 只保留控制器、surface、fullscreen、安全区/可访问性所需规则；不引入 Workbench、Library 或 Global Shell CSS。
- Wave 1 fixture 只使用 generic CSS font stack，不带 `PingFang SC`、`SFMono-Regular`、用户字体、`@font-face` 或外部网络字体。字体确定性属于 Pilot / 后续资产验收。
- `postMessage('*')`、`/hf-runtime`、`/workbench-src`、`../workbench-v0`、旧绝对路径均为 Wave 1 禁止字符串；确定性 QA 必须扫描。

## 4. Minimal R3 Receiving Structure

以下是 Wave 1 可在执行时创建的最小接收边界；它不是最终 `src/` 架构冻结：

```text
AI视频导演剪辑工作台_R3/
├── package.json                              # Wave 1 exact dependencies
├── <R3 lockfile>                              # R3-generated; never copied from Legacy
├── .gitignore                                 # dependency / runtime / test artifact exclusion
├── src/
│   └── hyperframes-foundation/                # PROVISIONAL Wave 1 boundary only
│       ├── runtime/                           # RuntimeResolver
│       ├── player/                            # Player Contract + HyperFrames Adapter + chrome
│       ├── component-kit/                     # generic kit + patch/ack
│       └── registry/                          # test-only descriptor / adapter contract
└── tests/
    └── hyperframes-foundation/
        ├── fixture/                           # non-asset test composition only
        ├── contract/                          # deterministic contract tests
        └── integration/                       # real runtime / browser independence tests
```

约束：

- `hyperframes-foundation` 是接收边界名，不是对 `src/` 长期组织的裁决；
- fixture 身份必须是 `R3-HF-FOUNDATION-FIXTURE` 或等价明确测试标识，不能使用 `CMP-*`、不能进入 Asset Registry、不能有 Parent Asset / Engine Child 身份；
- 不创建 Asset Library、Global Shell、Material、Stage 1 或 Remotion 目录；
- 无正式 Asset、poster、render、cache、截图或 runtime 文件进入 Git。

## 5. Required Modifications

| Legacy Coupling | Required R3 Modification |
|---|---|
| `/hf-runtime/hyperframe.runtime.iife.js` | 改为 `RuntimeResolver` 提供的 R3-owned entry；Player 与 Kit 均不出现硬编码 legacy route。 |
| `/workbench-src/*`、`../workbench-v0/src/*` | 完全删除；Wave 1 不接收 Library Host、Workbench CSS、control plan、markdown parser 或 preview registry。 |
| `postMessage('*')` | 改为明确同源 `targetOrigin`，并对 origin、source、protocol、requestId 做验证。 |
| 旧 Chrome cache / 本机绝对 executable path | 改为 R3 test configuration 的显式、可注入 browser path；测试失败时明确报告，不搜索旧目录。 |
| Legacy `node_modules` / vendor GSAP | 改为 R3 own package dependency 与新 lockfile。 |
| Player 与旧页面 / component state | Player 仅依赖 Player Contract、RuntimeResolver 与 adapter；状态由调用方持有，不引入 Workbench global state。 |
| 旧 Theme / font / Asset-specific config | 从 Foundation 删除；fixture 只用中性变量与 generic CSS。 |
| 旧 `serve.mjs` 跨目录映射 | 仅保留 R3-local resolver 所需行为；不得映射外部目录。 |

## 6. Wave 1 Acceptance Criteria

Wave 1 只有同时满足下列条件，才可输出 `R3 HYPERFRAMES FOUNDATION WAVE 1 PASS`：

1. `hyperframes@0.8.46` 从 R3 自身 package/lockfile 独立解析，Runtime 可加载。
2. Shared Player 可加载非正式 fixture，并通过 Play / Pause / Seek / Rate / Time / Duration / Ended / Error / Destroy 基础合同。
3. Shared Component Kit 在 fixture 中独立完成 Variables、Timeline 生命周期与 patch 后 rebind。
4. Patch / Ack 用明确 origin 与 source 验证；成功、未知协议、错误来源、无效变量、超时均有确定性结果。
5. 最小 Registry / Adapter Contract 仅能解析 test-only fixture descriptor，不能声明或伪造正式 Asset / Engine Child 支持。
6. fixture 是新建、非正式、非 `CMP-*` 的测试 composition，不含 Pilot 或其他 Legacy Asset 内容、definition、schema、sample 或视觉资产。
7. R3 依赖扫描无旧路径、`/workbench-src`、`../workbench-v0`、`/hf-runtime`、`postMessage('*')`、legacy absolute path 或 symlink。
8. 测试在旧项目路径不可访问的环境仍通过；不得读取旧 `node_modules`、cache、runtime、build 或 user Chrome cache。
9. 所有 test artifact 写入受控临时 / Runtime Root 并被 `.gitignore` 排除；Workspace、AppDataRoot、Git 均不成为测试输出落点。
10. 没有 `CMP-DATA-002`、`CMP-SKL-001`、`CMP-SUB-001` 或其余 16 个正式资产迁入 R3。
11. 所有 Wave 1 tests 与真实浏览器预览均通过；FFmpeg/MP4 export 不作为本 Wave Gate 的替代条件或额外范围。
12. `PROJECT_STATE.json`、`CURRENT_HANDOFF.md` 更新为 Wave 1 Gate 结果，并明确下一步是否允许 Wave 2 Pilot。

## 7. Regression / Risk / Rollback

| Area | Assessment |
|---|---|
| Coupling Risk | **🟡 Controlled Dependency**：HyperFrames runtime 与浏览器是明确外部依赖；旧路径、旧 kit 与 message contract 是必须消除的风险面。 |
| Change Impact | 影响后续 Wave 2 全部 19 个资产、Wave 3 Asset Library Preview、以及 Stage 4 Shared Preview；不影响现有产品 Baseline 或 Project Workspace。 |
| Main Failure Points | runtime entry 解析失败；HyperFrames Player 事件语义差异；iframe origin/source 验证错误；Timeline rebind 不生效；测试错误依赖本机 Browser；CSS 仍泄漏 Workbench 选择器。 |
| Rollback | 单一 Wave 1 commit / branch 或未通过 Gate 的接收包可整体回退；不修改旧项目、不修改 Workspace/AppDataRoot、不产生正式 Asset，因此无数据迁移回滚。 |

## 8. Files Allowed To Change

### Allowed To Create / Modify during Wave 1 execution

- `package.json`、R3 新生成 lockfile、`.gitignore`；
- `src/hyperframes-foundation/**`；
- `tests/hyperframes-foundation/**`；
- 必要的 R3-local test configuration / script，限于 Foundation；
- 本 Execution Card 的状态/QA 记录；
- `PROJECT_STATE.json`、`CURRENT_HANDOFF.md`，仅用于 Gate 状态与连续性更新。

### Protected / Do Not Modify

- `AGENTS.md`；
- `BASELINE_INDEX.md`；
- 六份产品 Baseline `00`–`05`；
- `06_R3_REPOSITORY_STORAGE_ARCHITECTURE_研发工程与存储边界.md`；
- `07_R3_LEGACY_REUSE_AND_MIGRATION_CONTRACT_旧项目复用与迁移合同.md`；
- `docs/migration/LEGACY_REUSE_MANIFEST_旧项目成果复用清单.md`；
- 任何全局 Codex 配置；
- Project Workspace、ProjectsRoot、AppDataRoot、AppRuntimeRoot 的正式用户数据；
- Legacy 项目及其所有文件、Git、runtime、cache、`node_modules`；
- 任何正式 Asset、Pilot Asset、Asset Library UI、Global Skeleton、Material、Stage 1、Remotion 代码。

## 9. Gate Procedure

1. 仅在 Hao 另行授权 Wave 1 实施后，按本卡 Scope Lock 创建 R3-local Foundation。
2. 先完成 package/runtime boundary、kit/patch、player/adapter、fixture/contract tests；不接收正式资产。
3. 执行确定性扫描、依赖来源验证和真实浏览器独立性验证。
4. 若全部 Acceptance Criteria 通过，更新本卡 QA、`PROJECT_STATE.json` 与 `CURRENT_HANDOFF.md`。
5. 此时才可输出：`R3 HYPERFRAMES FOUNDATION WAVE 1 PASS`。
6. Wave 1 PASS 只解除 Wave 2 Pilot 的前置条件，不自动执行或批准 Wave 2。
