import projectState from '../../PROJECT_STATE.json';
import { createDevelopmentControlCenterView } from './project-state-view.mjs';
import './control-center.css';

const app = document.querySelector('#app');
const view = createDevelopmentControlCenterView(projectState);
let selectedDetail = { type: 'package', id: view.dcc.currentPackageId };

const trackGroups = [
  { id: 'p0', label: '项目准入', summary: '目标、边界与事实源', packageIds: ['P0'] },
  { id: 'm0', label: 'M0 · 研发就绪', summary: '迁移、存储、合同、产品技能与黄金样例', packageIds: ['M0-A', 'M0-B', 'M0-C', 'M0-D', 'M0-E'] },
  { id: 'm1-m7', label: 'M1–M7 · 产品交付', summary: '从真实素材到导出、部署与版本验收', packageIds: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] },
];

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function statusChip(item) {
  return `<span class="dcc-status ${escapeHtml(item.statusMeta.tone)}"><i></i>${escapeHtml(item.statusMeta.label)}</span>`;
}

function getPackage(id) { return view.dcc.workPackages.find((item) => item.id === id); }
function getSkill(id) { return view.dcc.productSkills.find((item) => item.id === id); }

function renderApp() {
  app.innerHTML = `<div class="dcc-shell">
    <header class="dcc-topbar"><div class="dcc-brand"><span>▰</span><b>AI DIRECTOR</b><small>R3</small></div><div class="dcc-title"><strong>研发控制中心</strong><span>项目进度总览</span></div><div class="dcc-source"><i></i>${escapeHtml(view.dcc.stateSource)} 已同步 <time>${escapeHtml(view.dcc.updatedAt)}</time></div></header>
    <div class="dcc-body">
      <aside class="dcc-sidebar"><nav aria-label="页面导航"><button data-anchor="roadmap" class="is-active"><span>01</span>完整研发轨道</button><button data-anchor="skills"><span>02</span>产品技能资产</button><button data-anchor="records"><span>03</span>重大研发节点</button></nav><div class="dcc-sidebar-note"><strong>统计口径</strong><p>13 个一级工作包，54 项叶子级研发任务。产品技能不重复计入任务总数。</p></div><div class="dcc-sidebar-footer"><i></i>只读项目事实</div></aside>
      <main class="dcc-main">${renderRoadmap()}${renderSkills()}<div class="dcc-detail" id="detail">${renderSelectedDetail()}</div>${renderRecords()}</main>
    </div>
  </div>`;
  bindInteractions();
}

function renderRoadmap() {
  const summary = view.dcc.taskSummary;
  const percent = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
  const current = getPackage(view.dcc.currentPackageId);
  const counts = [`待验收 ${summary.pendingAcceptance}`, `未开始 ${summary.notStarted}`];
  if (summary.blocked > 0) counts.push(`阻塞 ${summary.blocked}`);
  return `<section class="dcc-roadmap" id="roadmap">
    <header class="dcc-roadmap-hero"><div><p>R3 · 研发全景</p><h1>完整研发轨道<span>｜${view.dcc.packageCount} 个一级模块 · ${summary.total} 项研发任务</span></h1><p class="dcc-roadmap-lead">从项目边界到版本验收，一页看清当前进度、模块责任与下一步。</p></div><div class="dcc-progress-compact" aria-label="全局任务完成进度"><div><strong>${summary.completed} / ${summary.total}</strong><span>${percent}%</span></div><i><em style="width:${percent}%"></em></i><small>已完成任务</small></div></header>
    <div class="dcc-roadmap-meta"><p>${counts.map((item, index) => `<span class="${index === counts.length - 1 && summary.blocked > 0 ? 'blocked' : ''}">${escapeHtml(item)}</span>`).join('<b>·</b>')}</p><div><small>当前节点</small><strong>${escapeHtml(current.id)} ${escapeHtml(current.name)}</strong>${statusChip(current)}</div></div>
    <div class="dcc-tracks">${trackGroups.map(renderTrack).join('')}</div>
  </section>`;
}

function renderTrack(group) {
  const packages = group.packageIds.map(getPackage);
  return `<section class="dcc-track" data-track="${group.id}"><header><div><strong>${escapeHtml(group.label)}</strong><span>${escapeHtml(group.summary)}</span></div><small>${packages.length} 个模块</small></header><div class="dcc-package-grid ${group.id}">${packages.map(renderPackageCard).join('')}</div></section>`;
}

function renderPackageCard(item) {
  const selected = selectedDetail.type === 'package' && item.id === selectedDetail.id;
  const percent = item.totalTasks ? Math.round((item.completedTasks / item.totalTasks) * 100) : 0;
  return `<button class="dcc-package-card${selected ? ' is-selected' : ''}" data-package-id="${escapeHtml(item.id)}" aria-expanded="${selected}">
    <div class="dcc-package-top"><span>${escapeHtml(item.id)}</span>${statusChip(item)}</div>
    <h2>${escapeHtml(item.name)}</h2>
    <p class="dcc-task-count">${item.totalTasks} 项任务</p>
    <div class="dcc-package-progress"><span>已完成 <b>${item.completedTasks} / ${item.totalTasks}</b></span><em>${percent}%</em></div><div class="dcc-package-track"><i style="width:${percent}%"></i></div>
    <dl><div><dt>当前</dt><dd>${escapeHtml(item.progress)}</dd></div><div><dt>下一步</dt><dd>${escapeHtml(item.next)}</dd></div></dl>
    ${item.blockedTasks > 0 ? `<strong class="dcc-package-blocker">阻塞 · ${item.blockedTasks} 项</strong>` : ''}
  </button>`;
}

function renderSkills() {
  return `<section class="dcc-skills" id="skills"><header class="dcc-section-head"><div><p>能力轨道</p><h2>产品技能资产<span>｜${view.dcc.productSkills.length} 项</span></h2></div><small>由 M0-D 统一治理，不计入工作包和任务总数。</small></header><div class="dcc-skill-list"><div class="dcc-skill-columns" aria-hidden="true"><span>产品技能</span><span>状态</span><span>治理模块</span><span>使用模块</span><span>版本</span></div>${view.dcc.productSkills.map(renderSkillCard).join('')}</div></section>`;
}

function renderSkillCard(skill) {
  const selected = selectedDetail.type === 'skill' && skill.id === selectedDetail.id;
  return `<button class="dcc-skill-row${selected ? ' is-selected' : ''}" data-skill-id="${escapeHtml(skill.id)}" aria-expanded="${selected}"><strong>${escapeHtml(skill.name)}</strong>${statusChip(skill)}<span data-label="治理模块"><b>${escapeHtml(skill.owner.id)}</b> 治理</span><span data-label="使用模块"><b>${skill.consumers.map((item) => escapeHtml(item.id)).join('、')}</b> 使用</span><small data-label="版本">${escapeHtml(skill.version)}</small></button>`;
}

function renderSelectedDetail() { return selectedDetail.type === 'skill' ? renderSkillDetail(getSkill(selectedDetail.id)) : renderPackageDetail(getPackage(selectedDetail.id)); }

function renderPackageDetail(item) {
  const governance = item.id === 'M0-D' ? '<aside class="dcc-governance-note"><strong>M0-D 职责边界</strong><p>负责产品技能的能力合同、版本、兼容边界与测试资产治理；不等同于使用技能的业务模块。</p></aside>' : '';
  return `<header class="dcc-detail-head"><div><span>工作包 · ${escapeHtml(item.id)}</span><h2>${escapeHtml(item.name)}</h2></div>${statusChip(item)}</header><section class="dcc-detail-intent"><small>目标</small><p>${escapeHtml(item.objective)}</p></section>${governance}<section class="dcc-detail-section dcc-detail-tasks"><header><h3>主要任务</h3><span>${item.totalTasks} 项</span></header><div class="dcc-task-matrix">${item.tasks.map((task) => `<article><div><span class="dcc-task-state ${task.statusMeta.tone}"></span><strong>${escapeHtml(task.name)}</strong></div><small class="${task.statusMeta.tone}">${escapeHtml(task.statusMeta.label)}</small></article>`).join('')}</div></section><div class="dcc-detail-facts"><section><small>完成标准</small><p>${escapeHtml(item.completion_criteria)}</p></section><section><small>上游依赖</small>${item.dependencies.length ? `<p>${item.dependencies.map((dependency) => escapeHtml(dependency.name)).join(' · ')}</p>` : '<p>这是项目起点。</p>'}</section><section><small>下一模块</small><p>${escapeHtml(item.next)}</p></section></div><details class="dcc-evidence"><summary>查看研发依据</summary><div><dl><dt>内部标识</dt><dd>${escapeHtml(item.id)}</dd><dt>状态源</dt><dd>${escapeHtml(view.dcc.stateSource)}</dd><dt>投影版本</dt><dd>${view.dcc.schemaVersion}</dd></dl><ul>${item.evidence.map((evidence) => `<li>${escapeHtml(evidence)}</li>`).join('')}</ul></div></details>`;
}

function renderSkillDetail(skill) {
  return `<header class="dcc-detail-head"><div><span>产品技能</span><h2>${escapeHtml(skill.name)}</h2></div>${statusChip(skill)}</header><section class="dcc-detail-intent"><small>用途</small><p>${escapeHtml(skill.purpose)}</p></section><div class="dcc-detail-facts dcc-skill-detail"><section><small>输入</small><p>${escapeHtml(skill.input)}</p></section><section><small>输出</small><p>${escapeHtml(skill.output)}</p></section><section><small>版本</small><p>${escapeHtml(skill.version)}</p></section><section><small>测试状态</small><p>${escapeHtml(skill.test_status)}</p></section><section><small>治理模块</small><p>${escapeHtml(skill.owner.id)} · ${escapeHtml(skill.owner.name)}</p></section><section><small>使用模块</small><p>${skill.consumers.map((item) => `${escapeHtml(item.id)} · ${escapeHtml(item.name)}`).join('；')}</p></section></div><details class="dcc-evidence"><summary>查看研发依据</summary><div><dl><dt>英文 ID</dt><dd>${escapeHtml(skill.id)}</dd><dt>状态源</dt><dd>${escapeHtml(view.dcc.stateSource)}</dd></dl><ul><li>${escapeHtml(skill.source_contract)}</li></ul></div></details>`;
}

function renderRecords() {
  const records = [...view.dcc.majorRecords].slice(-4).reverse();
  return `<section class="dcc-records" id="records"><header class="dcc-section-head"><div><p>项目连续性</p><h2>重大研发节点</h2></div><small>只展示 Gate、里程碑和产品 / 合同变更。</small></header><div class="dcc-record-list">${records.map((record) => `<article><div class="dcc-record-copy"><strong>${escapeHtml(record.milestone)}</strong><p>${escapeHtml(record.result)}</p><time>${escapeHtml(record.date)}</time></div>${statusChip(record)}</article>`).join('')}</div><p class="dcc-record-note">当前状态仅以 PROJECT_STATE.json 为准，不展示提交级日志。</p></section>`;
}

function updateSelection() {
  app.querySelectorAll('[data-package-id]').forEach((card) => { const selected = selectedDetail.type === 'package' && card.dataset.packageId === selectedDetail.id; card.classList.toggle('is-selected', selected); card.setAttribute('aria-expanded', String(selected)); });
  app.querySelectorAll('[data-skill-id]').forEach((card) => { const selected = selectedDetail.type === 'skill' && card.dataset.skillId === selectedDetail.id; card.classList.toggle('is-selected', selected); card.setAttribute('aria-expanded', String(selected)); });
  app.querySelector('#detail').innerHTML = renderSelectedDetail();
}

function scrollMainTo(target) {
  const main = app.querySelector('.dcc-main');
  if (window.matchMedia('(max-width: 820px)').matches) window.scrollTo({ top: target.offsetTop - 64, behavior: 'smooth' });
  else main.scrollTo({ top: Math.max(0, target.offsetTop - 24), behavior: 'smooth' });
}

function bindInteractions() {
  app.querySelectorAll('[data-package-id]').forEach((card) => { card.onclick = () => { selectedDetail = { type: 'package', id: card.dataset.packageId }; updateSelection(); scrollMainTo(app.querySelector('#detail')); }; });
  app.querySelectorAll('[data-skill-id]').forEach((card) => { card.onclick = () => { selectedDetail = { type: 'skill', id: card.dataset.skillId }; updateSelection(); scrollMainTo(app.querySelector('#detail')); }; });
  app.querySelectorAll('[data-anchor]').forEach((button) => { button.onclick = () => { scrollMainTo(app.querySelector(`#${button.dataset.anchor}`)); app.querySelectorAll('[data-anchor]').forEach((item) => item.classList.toggle('is-active', item === button)); }; });
}

renderApp();
