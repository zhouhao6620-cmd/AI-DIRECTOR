const STATUS_META = {
  not_started: { label: '未开始', tone: 'neutral' },
  in_progress: { label: '进行中', tone: 'progress' },
  pending_acceptance: { label: '待验收', tone: 'acceptance' },
  completed: { label: '已完成', tone: 'completed' },
  blocked: { label: '阻塞', tone: 'blocked' },
  pass: { label: '已完成', tone: 'completed' },
};

const PACKAGE_STATES = new Set(['not_started', 'in_progress', 'pending_acceptance', 'completed', 'blocked']);
const REQUIRED_PACKAGE_IDS = ['P0', 'M0-A', 'M0-B', 'M0-C', 'M0-D', 'M0-E', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
const MILESTONE_KEYS = { 'M0-A': 'm0_a', 'M0-B': 'm0_b', 'M0-C': 'm0_c', 'M0-D': 'm0_d', 'M0-E': 'm0_e' };

const ROADMAP = [
  ['P0', '项目目标与边界冻结', [], 'M0-A 研发可视化控制中心', ['冻结产品目标与 V1 非目标', '确立权威基线索引', '冻结四 Root 职责边界', '冻结 R3 与 Legacy 独立性']],
  ['M0-A', '研发可视化控制中心', ['P0'], 'M0-B V1 迁移验收', ['建立唯一状态投影', '建立 13 个工作包与叶子任务模型', '实现顶部任务统计', '实现单页研发轨道与全宽下钻', '完成状态、构建与浏览器验证', '用户验收结构化展示优化']],
  ['M0-B', 'V1 迁移验收', ['M0-A'], 'M0-C 研发仓库、存储与核心视觉资产迁移', ['核对 V1 迁移范围', '执行 Legacy 独立性验收', '执行真实运行与预览验收', '形成迁移接收结论']],
  ['M0-C', '研发仓库、存储与核心视觉资产迁移', ['M0-B'], 'M0-D 合同与产品技能资产', ['复制素材准备工作台与完整设计规范', '复制 HyperFrames 资产库、播放器与 19 个合成', '固化 R3 共享资产、运行时与存储路径', '验证视觉一致性及脱离 Legacy 独立运行']],
  ['M0-D', '合同与产品技能资产', ['M0-C'], 'M0-E 全链路黄金样例验证', ['整理产品合同资产', '创建内容理解技能', '创建导演编排技能', '创建智能剪辑技能']],
  ['M0-E', '全链路黄金样例验证', ['M0-D'], 'M1 项目工作区与素材准备', ['冻结黄金项目与真实输入', '验证内容结构与导演计划 Gate', '验证智能剪辑与真实预览', '形成可重复黄金回归']],
  ['M1', '项目工作区与素材准备', ['M0-E'], 'M2 内容理解', ['选择正式项目根目录', '创建独立项目工作区', '导入基础视频与最终字幕', '完成素材与时间基准验证']],
  ['M2', '内容理解', ['M1', 'M0-D'], 'M3 导演编排', ['生成语义分段', '生成主题章节', '生成导演分镜提纲', '确认内容结构']],
  ['M3', '导演编排', ['M2'], 'M4 智能剪辑', ['确定分镜编排意图', '确定卡片线稿与上屏内容', '确定主题预设与全局包装', '确认导演计划']],
  ['M4', '智能剪辑', ['M3', 'M0-D'], 'M5 预览与验收工作台', ['生成生产输入快照', '解析资产并物化内容', '编译布局、时序与动画', '装配全片生产状态']],
  ['M5', '预览与验收工作台', ['M4'], 'M6 成片导出', ['建立全片真实预览', '建立分镜与参数检查', '支持 V1 轻量验收调整', '确认最终生产状态']],
  ['M6', '成片导出', ['M5'], 'M7 部署、资产沉淀与版本验收', ['创建显式导出任务', '实现完整成片导出', '实现分层导出', '交付正式成片文件']],
  ['M7', '部署、资产沉淀与版本验收', ['M6'], 'V1 发布与后续迭代', ['建立可部署交付包', '验收可复用资产沉淀', '执行完整产品回归', '完成 V1 版本验收']],
];

const SKILLS = [
  { id: 'content-understanding-skill', name: '内容理解技能', owner_module: 'M0-D', used_by: ['M2'], version: '版本待冻结', purpose: '把连续视频内容整理为可审核、可追溯的主题章节与导演分镜结构。', input: '最终字幕与基础视频时间基准。', output: '已确认内容结构：主题章节、导演分镜、时间范围与源字幕追溯。', test_status: '稳定能力合同已冻结；正式技能资产与确定性测试尚未建立。', source_contract: 'docs/authoritative/01_AI DIRECTOR内容理解与导演编排R3.md' },
  { id: 'director-arrangement-skill', name: '导演编排技能', owner_module: 'M0-D', used_by: ['M3'], version: '版本待冻结', purpose: '将已确认内容结构转化为低保真、可确认的视觉生产计划。', input: '已确认内容结构、当前与相邻分镜及编辑请求补丁。', output: '核心信息、导演决策、卡片线稿结构与 Graybox 所需结构化数据。', test_status: '职责与 DirectorPlan Schema 兼容边界已冻结；正式技能资产与兼容性测试尚未建立。', source_contract: 'docs/authoritative/01_AI DIRECTOR内容理解与导演编排R3.md' },
];

export function getStatusMeta(status) {
  return STATUS_META[status] ?? { label: String(status ?? '待核对'), tone: 'neutral' };
}

export function statusFromMilestone(status, fallback = 'not_started') {
  return ({ user_accepted: 'completed', accepted: 'completed', pass: 'completed', completed: 'completed', in_progress: 'in_progress', pending_acceptance: 'pending_acceptance', pending_user_acceptance: 'pending_acceptance', blocked: 'blocked', not_started: 'not_started', planned: 'not_started' })[status] ?? fallback;
}

function countByState(items) {
  return items.reduce((counts, item) => ({ ...counts, [item.state]: (counts[item.state] ?? 0) + 1 }), {});
}

function packageState(state, id) {
  if (id === 'P0') return 'completed';
  if (MILESTONE_KEYS[id]) return statusFromMilestone(state.milestone_control?.[MILESTONE_KEYS[id]]?.status, id === 'M0-A' ? 'completed' : 'not_started');
  return statusFromMilestone(state.milestone_control?.m1_to_m7?.status);
}

function packageProgress(state, id, name) {
  if (id === 'M0-B' && packageState(state, id) === 'completed') return '主项目状态源记录为 USER_ACCEPTED：迁移验收、真实预览与 Legacy 扫描已通过。';
  if (id === 'M0-C') {
    const status = packageState(state, id);
    if (status === 'pending_acceptance') return '工程实施与验证已完成，等待用户验收；未自行标记为完成。';
    if (status === 'in_progress') return '主项目状态源已标记为进行中。';
    if (status === 'completed') return 'M0-C 已通过用户验收。';
    return '主项目状态源当前标记为未开始；等待正式启动状态写入。';
  }
  return packageState(state, id) === 'completed' ? `${name} 已按主项目状态源完成。 ` : `${name} 以主项目状态源为准。 `;
}

function createRoadmap(state) {
  return ROADMAP.map(([id, name, dependencies, next, taskNames]) => {
    const stateValue = packageState(state, id);
    return {
      id, name, state: stateValue, dependencies, next,
      objective: `完成 ${name}，让研发路径、输入输出与验收边界保持可追溯。 `,
      progress: packageProgress(state, id, name),
      completion_criteria: '按权威产品合同、项目状态和对应验证证据确认完成。',
      evidence: ['PROJECT_STATE.json milestone_control'],
      tasks: taskNames.map((taskName, index) => ({ id: `${id}-T${index + 1}`, name: taskName, state: stateValue })),
    };
  });
}

function createRecords(state, dcc) {
  const records = (dcc.modules ?? []).flatMap((module) => (module.history ?? []).map((entry) => ({ date: entry.date, milestone: entry.title, result: entry.result, state: 'completed' })));
  if (state.milestone_control?.m0_b?.status === 'user_accepted') records.push({ date: state.project?.updated_at ?? '', milestone: 'M0-B · V1 迁移验收', result: '主项目状态源已记录 USER_ACCEPTED；M0-B 保持已完成。', state: 'completed' });
  return records.length ? records : [{ date: state.project?.updated_at ?? '', milestone: '研发状态投影', result: '当前状态仅以 PROJECT_STATE.json 为准。', state: 'completed' }];
}

export function createDevelopmentControlCenterView(state) {
  const dcc = state?.development_control_center;
  if (!dcc) throw new Error('PROJECT_STATE is missing development_control_center.');
  const rawPackages = dcc.work_packages ?? createRoadmap(state);
  const byId = new Map(rawPackages.map((item) => [item.id, item]));
  const workPackages = rawPackages.map((item) => {
    const tasks = item.tasks.map((task) => ({ ...task, statusMeta: getStatusMeta(task.state) }));
    const taskCounts = countByState(tasks);
    return { ...item, tasks, statusMeta: getStatusMeta(item.state), dependencies: item.dependencies.map((id) => ({ id, name: byId.get(id)?.name ?? id })), completedTasks: taskCounts.completed ?? 0, blockedTasks: taskCounts.blocked ?? 0, totalTasks: tasks.length, taskCounts };
  });
  const viewById = new Map(workPackages.map((item) => [item.id, item]));
  const allTasks = workPackages.flatMap((item) => item.tasks.map((task) => ({ ...task, packageId: item.id })));
  const taskCounts = countByState(allTasks);
  const fromStage = String(state.current_stage ?? '').match(/\b(M0-[A-E]|M[1-7])\b/)?.[1];
  const currentPackageId = viewById.has(dcc.executive_summary?.current_milestone_id) ? dcc.executive_summary.current_milestone_id : (viewById.has(fromStage) ? fromStage : workPackages.find((item) => item.state === 'in_progress')?.id ?? 'P0');
  const productSkills = SKILLS.map((skill) => ({ ...skill, state: packageState(state, skill.owner_module), statusMeta: getStatusMeta(packageState(state, skill.owner_module)), owner: { id: skill.owner_module, name: viewById.get(skill.owner_module)?.name ?? skill.owner_module }, consumers: skill.used_by.map((id) => ({ id, name: viewById.get(id)?.name ?? id })) }));
  return {
    project: state.project,
    dcc: {
      schemaVersion: dcc.work_packages ? dcc.schema_version : 'roadmap-v4', status: dcc.status, statusLabel: dcc.status_label, stateSource: dcc.state_source, updatedAt: state.project?.updated_at,
      workPackages, packageCount: workPackages.length, allTasks,
      taskSummary: { total: allTasks.length, inProgress: taskCounts.in_progress ?? 0, pendingAcceptance: taskCounts.pending_acceptance ?? 0, completed: taskCounts.completed ?? 0, notStarted: taskCounts.not_started ?? 0, blocked: taskCounts.blocked ?? 0 },
      currentPackageId, productSkills, majorRecords: createRecords(state, dcc).map((record) => ({ ...record, statusMeta: getStatusMeta(record.state) })),
    },
  };
}

export function validateDevelopmentControlCenterState(state) {
  const errors = [];
  const dcc = state?.development_control_center;
  if (!dcc) return ['missing development_control_center'];
  if (dcc.state_source !== 'PROJECT_STATE.json') errors.push('DCC must use PROJECT_STATE.json as its state source');
  const { dcc: view } = createDevelopmentControlCenterView(state);
  if (JSON.stringify(view.workPackages.map((item) => item.id)) !== JSON.stringify(REQUIRED_PACKAGE_IDS)) errors.push('work package order or membership does not match the frozen 13-package roadmap');
  const ids = new Set(view.workPackages.map((item) => item.id));
  const taskIds = new Set();
  for (const item of view.workPackages) {
    if (!PACKAGE_STATES.has(item.state)) errors.push(`invalid package state: ${item.id}`);
    if (!item.name || !item.objective || !item.progress || !item.completion_criteria || !item.next || !item.tasks.length) errors.push(`incomplete package: ${item.id}`);
    for (const dependency of item.dependencies) if (!ids.has(dependency.id)) errors.push(`unknown dependency: ${dependency.id}`);
    for (const task of item.tasks) { if (taskIds.has(task.id)) errors.push(`duplicate task id: ${task.id}`); taskIds.add(task.id); if (!task.name || !PACKAGE_STATES.has(task.state)) errors.push(`invalid task: ${task.id}`); }
    if (item.state === 'completed' && item.tasks.some((task) => task.state !== 'completed')) errors.push(`completed package has unfinished tasks: ${item.id}`);
  }
  for (const id of ['M0-B', 'M0-C']) if (view.workPackages.find((item) => item.id === id)?.state !== packageState(state, id)) errors.push(`${id} does not reflect milestone_control`);
  if (!ids.has(view.currentPackageId)) errors.push('current work package is not in roadmap');
  if (view.productSkills.length < 2 || view.productSkills.some((skill) => !ids.has(skill.owner.id))) errors.push('product skill projection is incomplete');
  return errors;
}

export { PACKAGE_STATES, REQUIRED_PACKAGE_IDS, STATUS_META };
