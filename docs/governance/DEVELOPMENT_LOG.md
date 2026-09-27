# DEVELOPMENT LOG
# 重大研发节点记录

> 本文件只追加用户验收、里程碑 Gate 和合同变更。
> `PROJECT_STATE.json` 是当前机器可读状态的唯一来源；本文件不复制当前状态，不记录小修改或 Git 提交流。

## 2026-09-20｜M0-A 研发可视化控制中心

- **Gate:** USER ACCEPTED
- **用户可见结果：** 用户已明确验收 M0-A；研发控制中心保持独立入口与只读状态投影。
- **验证证据：** DCC 确定性测试 PASS；产品入口无 DCC 导航；不读取 Legacy `development-state.json`。
- **影响模块：** Development Control Center only。
- **合同/基线变化：** 无产品 Baseline 变化。
- **下一重大节点：** M0-B V1 迁移验收。

## 2026-09-20｜M0-B V1 迁移验收

- **Gate:** USER ACCEPTED
- **用户可见结果：** 完成 51 组 Legacy/R3 候选能力的五类分类，冻结统一 UI 骨架、主题资产库和 HyperFrames 共享预览的复用边界。
- **验证证据：** 15/15 确定性测试 PASS；Vite build PASS；HyperFrames 真实 Chrome 集成 PASS；19/19 资产真实 Runtime 加载/Patch PASS；真实 MP4 probe PASS；Legacy 独立性扫描 PASS。
- **影响模块：** 全局 Shell / Shared UI、Asset Library、Material / Workspace、HyperFrames Foundation / Shared Player、M2–M6 预览消费者。
- **合同/基线变化：** 仅在 07 Legacy 复用合同增加统一 UI 与共享预览复用不变量；不改 00–05 产品 Baseline。
- **证据文档：** `docs/migration/M0_B_V1_MIGRATION_ACCEPTANCE_2026-09-20.md`。
- **用户验收：** 2026-09-20 明确确认通过；M0-B 结论与复用边界正式封账。
- **下一重大节点：** 独立启动 M0-C 研发仓库与存储目录正式整理；本次收口未启动该任务。

## 2026-09-20｜M0-C 核心 Gold Master 直接复制

- **Gate:** USER ACCEPTED
- **用户可见结果：** 素材准备工作台、完整设计规范、完整 HyperFrames 资产库/播放器/配置交互已从确认源码直接复制到 R3 的 4173 入口。
- **验证证据：** 工作台与设计规范截图像素哈希一致；资产库关键状态与交互一致；核心 16/16、M0-C 15/15、构建、发布包、DCC 浏览器与 HyperFrames 真实浏览器集成通过。
- **独立性：** R3 构建包使用自有 `/shared-ui` 与 `/engine/hyperframes`，没有请求 4174、3030 或旧绝对目录；旧源文件夹删除后不影响运行。
- **影响模块：** Product Workbench、Design Specification、Asset Library、Shared Player、19 HyperFrames Assets、Release Package。
- **合同/基线变化：** 无产品行为改写；遵循已冻结的 `DIRECT COPY → VERIFY PARITY → MINIMAL ADAPT → VERIFY INDEPENDENCE`。
- **证据文档：** `docs/migration/M0_C_REPOSITORY_STORAGE_ACCEPTANCE_2026-09-20.md`、`design-qa.md`。
- **用户验收：** 2026-09-20 明确确认通过；三项 Gold Master 与 R3 独立运行结果正式封账。
- **下一重大节点：** M0-D「合同与产品技能资产」；启动前先提供任务简述，并在用户确认后创建独立的 `GPT-5.6 Terra / High` 任务窗口。

## 2026-09-20｜M0-D 合同与产品技能资产启动

- **Gate:** IN PROGRESS
- **执行方式：** 独立 `GPT-5.6 Terra / High` 任务窗口；总控台管理范围、重大节点和最终验收。
- **目标：** 收敛最小业务合同，将内容理解与导演编排沉淀为 R3 自有中文 Skill 资产，并明确与 M2/M3、工作台和共享组件的边界。
- **范围保护：** 不提前实现 M2/M3 完整功能，不改写已验收的工作台、设计规范、HyperFrames 资产库、播放器及 19 个组件，不启动 M0-E 或 M1–M7。
