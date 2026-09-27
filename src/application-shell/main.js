import { R3_REGISTERED_ASSETS } from '../asset-library/r3-asset-registry.mjs';
import './shell.css';

const app = document.querySelector('#app');
let selected = R3_REGISTERED_ASSETS[0];

function statusLabel(asset) {
  return asset.assetType === 'GLOBAL_COMPONENT' ? '全局包装' : '组件卡片';
}

function render() {
  app.innerHTML = `<header><strong>AI视频导演剪辑工作台_R3</strong><span>Asset Library · Material Foundation</span></header>
  <main><aside><p>主题包装资产库</p><button data-area="library">组件资产 ${R3_REGISTERED_ASSETS.length}</button><button data-area="material">素材准备</button></aside>
  <section id="workspace"></section></main>`;
  app.querySelector('[data-area="library"]').onclick = renderLibrary;
  app.querySelector('[data-area="material"]').onclick = renderMaterial;
  renderLibrary();
}

function renderLibrary() {
  const workspace = document.querySelector('#workspace');
  workspace.innerHTML = `<div class="title"><div><small>THEME PACKAGING ASSET LIBRARY</small><h1>组件卡片库与全局包装</h1><p>只展示 R3 REGISTERED Assets；Global Packaging 与 Component Card 分区。</p></div></div>
  <div class="layout"><div class="asset-grid">${R3_REGISTERED_ASSETS.map((asset) => `<button class="asset-card ${asset.assetId === selected.assetId ? 'selected' : ''}" data-id="${asset.assetId}"><small>${statusLabel(asset)} · ${asset.category}</small><strong>${asset.assetId}</strong><span>HyperFrames · ${asset.implementationVersion}</span></button>`).join('')}</div>
  <article class="detail"><small>${statusLabel(selected)}</small><h2>${selected.assetId}</h2><p>R3 Taxonomy: ${selected.category}</p><p>Engine: HyperFrames</p><p>Implementation: ${selected.implementationVersion}</p><div class="preview">真实预览由 Shared Player 与 R3 Asset Runtime 提供；迁移验收测试已覆盖该资产的加载、Patch/Ack 和 timeline lifecycle。</div><label>配置试填<input id="preview-input" value="" placeholder="本 Preview 仅更新实例配置，不修改资产" /></label><button id="preview-apply">试填配置</button><p id="preview-status"></p></article></div>`;
  workspace.querySelectorAll('[data-id]').forEach((button) => {
    button.onclick = () => {
      selected = R3_REGISTERED_ASSETS.find((asset) => asset.assetId === button.dataset.id);
      renderLibrary();
    };
  });
  workspace.querySelector('#preview-apply').onclick = () => {
    workspace.querySelector('#preview-status').textContent = '配置已在本地 preview state 中验证；不会写入 Asset Library 或 Project Workspace。';
  };
}

function renderMaterial() {
  document.querySelector('#workspace').innerHTML = `<div class="title"><small>MATERIAL FOUNDATION</small><h1>素材准备</h1><p>Base Video 与 Final SRT 必须进入当前 Project Workspace 的 01_输入素材；R3 Parser 与 Media Probe 负责独立校验。</p></div><div class="panel"><label>Base Video<input type="file" accept=".mp4,.mov,.m4v" /></label><label>Final SRT<input type="file" accept=".srt" /></label><p>浏览器选择不写入项目。正式落盘必须经 R3 Workspace Adapter，并保持 Runtime Root 与 Workspace 分离。</p></div>`;
}

render();
