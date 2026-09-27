import {
  chooseProjectsRoot,
  createBrowserProjectWorkspace,
  importBrowserProjectInputs,
  listBrowserWorkspaceEntries,
  supportsProjectsRootPicker,
} from '../workspace/browser-project-workspace.mjs';
import { asMaterialError } from '../material/material-error.js';
import './stage1-entry.css';

const DEFAULT_PROJECT_NAME = 'GOLDEN_SMOKE_PROJECT_001';

export function createStage1Entry({
  container,
  initialProjectName = DEFAULT_PROJECT_NAME,
  initialAspectRatio = '16:9',
  onProjectVerified = () => {},
} = {}) {
  if (!container) throw new Error('Stage 1 entry requires a mount container.');
  const state = {
    rootHandle: null,
    projectHandle: null,
    projectRecord: null,
    folderName: '',
    baseVideoFile: null,
    finalSrtFile: null,
    material: null,
    entries: [],
    busy: false,
    error: null,
    projectName: initialProjectName,
    aspectRatio: initialAspectRatio,
  };

  const controller = {
    mount() {
      render();
      return controller;
    },
    unmount() {
      container.replaceChildren();
    },
    getState() {
      return {
        projectsRoot: state.rootHandle?.name ?? null,
        projectId: state.projectRecord?.projectId ?? null,
        verified: state.material?.projectTimebase?.segmentCount > 0,
      };
    },
  };

  function render() {
    container.innerHTML = `<div class="stage1-entry">
      <section class="stage1-hero">
        <div>
          <div class="stage1-eyebrow">STAGE 1 · MATERIAL PREPARATION</div>
          <h1>建立一个可验证的真实项目</h1>
          <p>先选择用户可见的 ProjectsRoot，再创建独立 Project Workspace；Base Video 与 Final SRT 只进入 <code>01_输入素材</code>，由 R3 Media Probe、Final SRT Parser 与 Project Timebase 一起验证。</p>
        </div>
        <div class="stage1-stage-mark"><span>01</span><small>真实入口</small></div>
      </section>
      <div class="stage1-stepper">${step('01', 'ProjectsRoot', Boolean(state.rootHandle))}${step('02', 'Project Workspace', Boolean(state.projectRecord))}${step('03', '真实素材验证', Boolean(state.material))}</div>
      ${state.error ? renderError(state.error) : ''}
      ${renderBody()}
    </div>`;
    bind();
  }

  function renderBody() {
    if (!supportsProjectsRootPicker()) {
      return `<section class="stage1-card stage1-blocked"><div class="stage1-card-icon">!</div><div><h2>需要可写的 ProjectsRoot 权限</h2><p>当前浏览器没有 File System Access API。请使用 Chromium 浏览器通过 localhost 打开 R3，才能让项目真实落盘；本入口不使用模拟数据替代真实验证。</p></div></section>`;
    }

    const rootCard = `<section class="stage1-card stage1-root-card">
      <div class="stage1-card-heading"><div><span class="stage1-label">01 · PROJECTSROOT</span><h2>${state.rootHandle ? 'ProjectsRoot 已选择' : '选择一个用户可见的 ProjectsRoot'}</h2></div><button class="stage1-secondary" data-action="choose-root">${state.rootHandle ? '更换 Root' : '选择文件夹'}</button></div>
      <div class="stage1-root-value"><span class="stage1-folder-icon">⌂</span><div><strong>${escapeHtml(state.rootHandle?.name ?? '尚未选择')}</strong><small>${state.rootHandle ? '后续新项目默认创建在此 Root 下；既有项目不会被静默移动。' : 'R3 不会把用户项目写入 Product Repository、Runtime 或旧工程。'}</small></div><span class="stage1-state-dot ${state.rootHandle ? 'is-ready' : ''}"></span></div>
    </section>`;
    if (!state.rootHandle) return `${rootCard}<section class="stage1-card stage1-guidance"><span class="stage1-label">SCOPE LOCK</span><h2>先选 Root，再创建项目</h2><p>完成 Root 选择后，入口会默认带出 <strong>${escapeHtml(DEFAULT_PROJECT_NAME)}</strong>，并创建唯一 Project ID 与四个冻结一级目录。</p></section>`;

    const projectCard = state.projectRecord ? renderProjectCard() : renderCreateCard();
    return `${rootCard}${projectCard}`;
  }

  function renderCreateCard() {
    return `<section class="stage1-card stage1-create-card"><div class="stage1-card-heading"><div><span class="stage1-label">02 · PROJECT WORKSPACE</span><h2>创建 GOLDEN Smoke Project</h2></div><span class="stage1-badge">DRAFT</span></div><p class="stage1-card-copy">创建动作只建立项目身份与冻结的一级工作区，不启动内容理解、导演编排、智能剪辑或导出。</p><form data-form="create-project"><div class="stage1-form-grid"><label>项目名称<input name="projectName" value="${escapeHtml(state.projectName)}" maxlength="80" required /></label><label>画幅<select name="aspectRatio"><option value="16:9" ${state.aspectRatio === '16:9' ? 'selected' : ''}>16:9 · 横屏</option><option value="9:16" ${state.aspectRatio === '9:16' ? 'selected' : ''}>9:16 · 竖屏</option></select></label></div><button class="stage1-primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? '正在创建…' : '创建 Project Workspace'}</button></form></section>`;
  }

  function renderProjectCard() {
    const verified = Boolean(state.material);
    return `<section class="stage1-card stage1-project-card"><div class="stage1-card-heading"><div><span class="stage1-label">02 · PROJECT WORKSPACE</span><h2>${escapeHtml(state.projectRecord.projectName)}</h2></div><span class="stage1-badge ${verified ? 'is-verified' : ''}">${verified ? 'VERIFIED' : 'CREATED'}</span></div><div class="stage1-project-meta"><span><small>PROJECT ID</small><strong>${escapeHtml(state.projectRecord.projectId)}</strong></span><span><small>WORKSPACE</small><strong>${escapeHtml(state.folderName)}</strong></span><span><small>ASPECT RATIO</small><strong>${escapeHtml(state.projectRecord.aspectRatio)}</strong></span></div>${renderWorkspaceTree()}${verified ? renderVerification() : renderInputForm()}</section>`;
  }

  function renderWorkspaceTree() {
    const names = state.entries.length ? state.entries.map((entry) => entry.name) : ['project.json', '01_输入素材', '02_导演计划', '03_项目实现', '04_导出成片'];
    return `<div class="stage1-tree"><div class="stage1-tree-heading"><span>WORKSPACE TREE</span><small>仅允许 project.json + 四个冻结一级目录</small></div><div class="stage1-tree-items">${names.map((name) => `<span class="${name === 'project.json' ? 'is-file' : ''}"><i></i>${escapeHtml(name)}</span>`).join('')}</div></div>`;
  }

  function renderInputForm() {
    return `<div class="stage1-input-section"><div><span class="stage1-label">03 · MATERIAL INPUT</span><h3>导入真实 Base Video 与 Final SRT</h3><p>选择与同一内容/时长对应的两个文件。验证失败时，R3 会阻止落盘，不会猜测或改写字幕时间。</p></div><form data-form="import-inputs"><div class="stage1-input-grid"><label class="stage1-file-input"><span>BASE VIDEO</span><input name="baseVideo" type="file" accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" required /><strong>${escapeHtml(state.baseVideoFile?.name ?? '选择 .mp4 / .mov / .m4v')}</strong><small>${state.baseVideoFile ? formatBytes(state.baseVideoFile.size) : '媒体 Probe 将读取尺寸、时长与方向'}</small></label><label class="stage1-file-input"><span>FINAL SRT</span><input name="finalSrt" type="file" accept=".srt,text/plain" required /><strong>${escapeHtml(state.finalSrtFile?.name ?? '选择 .srt')}</strong><small>${state.finalSrtFile ? formatBytes(state.finalSrtFile.size) : 'Parser 将保留原始 cue 时间与文本'}</small></label></div><button class="stage1-primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? '正在复制并验证…' : '导入并验证 Stage 1 素材'}</button></form></div>`;
  }

  function renderVerification() {
    const video = state.material.baseVideo;
    const srt = state.material.finalSrt;
    const timebase = state.material.projectTimebase;
    return `<div class="stage1-verification"><div class="stage1-verification-heading"><div><span class="stage1-label">REAL VALIDATION</span><h3>Stage 1 素材验证通过</h3></div><span class="stage1-check">✓</span></div><div class="stage1-facts"><div><small>BASE VIDEO</small><strong>${escapeHtml(video.format)} · ${formatDuration(video.durationMs)}</strong><span>${escapeHtml(video.width)} × ${escapeHtml(video.height)} · ${escapeHtml(video.orientation)}</span></div><div><small>FINAL SRT</small><strong>${escapeHtml(srt.segments.length)} cues</strong><span>最后一条到 ${formatDuration(timebase.subtitleEndMs)}</span></div><div><small>PROJECT TIMEBASE</small><strong>${timebase.fps ? `${escapeHtml(timebase.fps)} fps` : '媒体时基已读取'}</strong><span>尾部余量 ${formatDuration(timebase.trailingGapMs)}</span></div></div><p class="stage1-verified-note">Base Video 与 Final SRT 已复制到 <code>01_输入素材</code>；Project Workspace 未写入 Runtime、Cache、Build、Logs、Temp 或 Preview 数据。</p></div>`;
  }

  function renderError(error) {
    const materialError = asMaterialError(error);
    return `<div class="stage1-error"><div class="stage1-error-code">${escapeHtml(materialError.code)}</div><div><strong>${escapeHtml(materialError.message)}</strong><span>${escapeHtml(materialError.recommendedAction)}</span></div><button data-action="dismiss-error" aria-label="关闭">×</button></div>`;
  }

  function bind() {
    container.querySelector('[data-action="choose-root"]')?.addEventListener('click', handleChooseRoot);
    container.querySelector('[data-action="dismiss-error"]')?.addEventListener('click', () => { state.error = null; render(); });
    container.querySelector('[data-form="create-project"]')?.addEventListener('submit', handleCreateProject);
    container.querySelector('[data-form="import-inputs"]')?.addEventListener('submit', handleImportInputs);
    container.querySelector('input[name="baseVideo"]')?.addEventListener('change', (event) => {
      state.baseVideoFile = event.currentTarget.files?.[0] ?? null;
      render();
    });
    container.querySelector('input[name="finalSrt"]')?.addEventListener('change', (event) => {
      state.finalSrtFile = event.currentTarget.files?.[0] ?? null;
      render();
    });
  }

  async function handleChooseRoot() {
    state.error = null;
    state.busy = true;
    render();
    try {
      state.rootHandle = await chooseProjectsRoot();
      state.projectHandle = null;
      state.projectRecord = null;
      state.folderName = '';
      state.material = null;
      state.entries = [];
    } catch (error) {
      if (error?.name !== 'AbortError') state.error = error;
    } finally {
      state.busy = false;
      render();
    }
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.projectName = String(form.get('projectName') ?? state.projectName);
    state.aspectRatio = String(form.get('aspectRatio') ?? state.aspectRatio);
    state.error = null;
    state.busy = true;
    render();
    try {
      const created = await createBrowserProjectWorkspace({ projectsRootHandle: state.rootHandle, projectName: state.projectName, aspectRatio: state.aspectRatio });
      state.projectHandle = created.projectHandle;
      state.projectRecord = created.project;
      state.folderName = created.folderName;
      state.entries = await listBrowserWorkspaceEntries(state.projectHandle);
    } catch (error) {
      state.error = error;
    } finally {
      state.busy = false;
      render();
    }
  }

  async function handleImportInputs(event) {
    event.preventDefault();
    state.error = null;
    state.busy = true;
    render();
    try {
      const imported = await importBrowserProjectInputs({ projectHandle: state.projectHandle, project: state.projectRecord, baseVideoFile: state.baseVideoFile, finalSrtFile: state.finalSrtFile });
      state.material = imported.material;
      state.projectRecord = imported.project;
      state.entries = await listBrowserWorkspaceEntries(state.projectHandle);
      onProjectVerified({ ...imported, workspaceEntries: state.entries });
    } catch (error) {
      state.error = error;
    } finally {
      state.busy = false;
      render();
    }
  }

  return controller;
}

function step(number, label, complete) {
  return `<div class="stage1-step ${complete ? 'is-complete' : ''}"><span>${complete ? '✓' : number}</span><strong>${label}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function formatDuration(milliseconds) {
  const seconds = Number(milliseconds) / 1000;
  return `${seconds.toFixed(2)}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { DEFAULT_PROJECT_NAME };
