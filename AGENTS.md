# AI视频导演剪辑工作台_R3 — Project Facts and Consensus

## Project

AI视频导演剪辑工作台 R3。

R3 是独立新项目。Legacy 只用于参考和验证后复用，不得成为 R3 的运行时依赖。

## Project Truth

- `BASELINE_INDEX.md`：当前权威 Baseline 的唯一索引。
- `CURRENT_HANDOFF.md`：当前研发状态与最小继续上下文。
- `docs/authoritative/`：正式产品 Baseline 与技术合同。
- 当前代码：真实实现状态。

历史聊天、旧文档、Legacy 实现只作为参考，不得覆盖当前 R3 Baseline。

## Boundaries

- 不隐式修改 Frozen 产品决策。
- 不建立对 Legacy 的路径、Runtime、Storage、Build 或 Asset 依赖。
- 已验证且符合 R3 的能力优先复用，不无必要重做。
- Development Control Center 只展示项目状态，不拥有独立事实源。

## Independent Task Windows

- 新建独立研发任务窗口时，默认使用 `GPT-5.6 Terra`，推理强度使用 `High`。
- 总控窗口负责业务目标、里程碑、集成审查与验收；独立任务窗口负责具体实施和验证。
- 独立任务的完成回报必须先经过总控核对并同步主项目事实，才能提交用户验收。

## Confirmed Legacy Reuse

- 对用户明确确认已经完成且要求继承的旧项目能力，默认执行 `DIRECT COPY → VERIFY PARITY → MINIMAL ADAPT → VERIFY INDEPENDENCE`。
- 不得把直接可复用的页面、CSS、组件或交互重新手写成近似版本；新代码只用于必要的路径、Runtime、Registry、Storage、合同与构建适配。
- 如真实源码无法直接复用，必须先提供文件级证据和原因，由总控确认后才允许重写。
