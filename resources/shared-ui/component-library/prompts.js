// 组件创建与修订入口的提示词（05 §13，任务卡第 4 节「提示词文案」）
//
// 文案的唯一事实源是**组件创建技能第 10 节「提示词文案」**（当前 FROZEN 版：V1.3）。
// 技能升版时改这里一处即可；提示词只指向事实源文件、不内联规则正文（05 §13.2）。
// 两个入口都只做复制：不自动打开窗口、不发起任何请求、不写任何文件。
//
// 本模块不含 JSX，Node 与浏览器都能直接导入。

// 技能一律指向「本目录下 Status = FROZEN 的最新组件创建技能」，提示词里不带版本号
//（技能第 10 节的通用指向规则），避免升版后提示词变成第二份真相。
export const AUTHORING_SKILL_DIR = "workbench-v0/docs/component-assets/";

export const NEW_COMPONENT_PROMPT = `新建一个组件，走草稿通道。

先读 ${AUTHORING_SKILL_DIR} 下最新的组件创建技能（Status=FROZEN 的那个），
按该技能流程执行：先复述需求等我确认 → 查重（含 RemotionUI 检索）→ 产出 DRAFT- 草稿 → 真实渲染取证。
实现时按技能第 4.1 节的「Remotion 实现规范（自持）」执行：内联 interpolate、Interactive + name、不用 CSS 过渡。

边界：只在组件自己的目录、单测、QA 脚本、预览产物内写文件；不碰注册表、渲染映射、
能力索引、drafts.json 等生成物；不改 HANDOFF.md、dev-control-panel/** 与任何 Frozen Baseline；
不占用正式 CMP- 编号；不运行 components-sync.mjs；不升级 Remotion 版本（收口由总控做）。

完成后回传：业务结论 + 证据路径 + 流程反哺。

我的需求：
（在这里写，或直接附参考图 / 网页链接）`;

// 修订提示词：组件 ID、版本与目录名从生成目录自动带入，不写死。
export function revisionPrompt(entry) {
  return `修订组件 ${entry.componentId}（当前版本 ${entry.version ?? "—"}）。

先读最新的组件创建技能（Status=FROZEN）与 ${componentDir(entry)}/definition.json，
按该技能的变更路径执行：先复述改动意图等我确认 → 改动 → 真实渲染预览。

边界：（同上）

我要改的是：
（在这里写）`;
}

// 草稿的两个动作都只生成可复制的指令文本，页面不写入（§7.6 / §8.5）。
export function draftPromotionPrompt(entry) {
  return `确认入库草稿组件 ${entry.componentId}（${entry.displayName}，当前版本 ${entry.version ?? "—"}）。

请按最新组件创建技能（Status=FROZEN）的晋升清单执行：分配正式 CMP- 编号 → 写入 provenance.promotion
→ 运行 scripts/components-sync.mjs（不加 --register-all）→
跑组件单测与全量回归 → 登记研发控制台与 HANDOFF.md，并清空 drafts.json 里的这条草稿。

边界：本指令由总控执行；组件库页面只生成指令，不直接写入。组件目录：${componentDir(entry)}

入库前请先复述晋升范围等我确认。`;
}

export function draftDiscardPrompt(entry) {
  return `丢弃草稿组件 ${entry.componentId}（${entry.displayName}，当前版本 ${entry.version ?? "—"}）。

请先复述丢弃范围等我确认，再删除组件目录、预览产物与这条草稿记录，并在 drafts.json 与研发
控制台登记丢弃原因；不占用正式 CMP- 编号，不改 HANDOFF.md、dev-control-panel/** 与任何
Frozen Baseline；不运行 components-sync.mjs（收口由总控做）。

组件目录：${componentDir(entry)}`;
}

// 组件目录来自组件定义里的真实路径（runtime.module / content.schemaRef），不是拼出来的名字。
export function componentDir(entry) {
  const source = entry?.definition?.runtime?.module ?? entry?.definition?.content?.schemaRef ?? "";
  const dir = String(source).split("/").slice(0, -1).join("/");
  return dir || "（组件目录未在定义里声明）";
}

export const PROMPT_KINDS = {
  new: {title: "新建组件提示词", note: "交给 Codex 执行；页面只复制，不打开窗口、不发起请求。"},
  revise: {title: "修订组件提示词", note: "组件 ID 与版本从组件生成目录自动带入。"},
  promote: {title: "确认入库指令", note: "由总控执行晋升；页面不写入任何文件。"},
  discard: {title: "丢弃指令", note: "由总控执行；页面不写入任何文件。"},
};
