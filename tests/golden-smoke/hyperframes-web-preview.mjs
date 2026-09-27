import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSrt } from '../../src/material/srt-contract.mjs';
import { createRuntimeEntries, resolveFoundationRuntimeFiles } from '../../src/hyperframes-foundation/runtime/runtime-resolver.mjs';
import {
  GOLDEN_SMOKE_CONTROLLED_PRODUCTION_STATE,
  createGoldenSmokePreviewInstances,
  validateControlledProductionState,
  validateGoldenSmokeFinalSrt,
} from './controlled-production-state.mjs';

const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const assetRoot = join(projectRoot, 'resources', 'hyperframes-assets');
const sourceRoot = join(projectRoot, 'src', 'hyperframes-foundation');
const projectDraftRoot = join(projectRoot, 'tests', 'golden-smoke', 'project-drafts');
const projectDraftFiles = Object.freeze({
  'PD-GOLDEN-S02-BARRIER-RELATION': 'PD-GOLDEN-S02-BARRIER-RELATION.html',
  'PD-GOLDEN-S04-SCFA-FLOW': 'PD-GOLDEN-S04-SCFA-FLOW.html',
});

function contentType(path) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
  }[extname(path)] ?? 'application/octet-stream';
}

function safePath(root, relativePath) {
  const candidate = normalize(join(root, relativePath));
  if (!candidate.startsWith(root + '/')) throw new Error('Invalid preview file request.');
  return candidate;
}

function escapeInlineJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function replaceTemplateToken(template, token, value) {
  return template.split(token).join(value);
}

function replaceInlineContent(template, content) {
  const marker = '<script type="application/json" data-hf-content>';
  const start = template.indexOf(marker);
  const end = template.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('HyperFrames composition has no inline content payload.');
  return template.slice(0, start + marker.length) + '\n      ' + escapeInlineJson(content) + '\n      ' + template.slice(end);
}

function makeCompositionFrameTransparent(template) {
  const marker = '</head>';
  const css = '<style>html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent !important; }</style>';
  if (!template.includes(marker)) throw new Error('HyperFrames composition has no document head.');
  return template.replace(marker, css + marker);
}

function inputFromEnvironment() {
  const videoPath = process.env.R3_GOLDEN_SMOKE_VIDEO;
  const srtPath = process.env.R3_GOLDEN_SMOKE_SRT;
  if (!videoPath || !srtPath) {
    throw new Error('R3_GOLDEN_SMOKE_VIDEO and R3_GOLDEN_SMOKE_SRT are both required. Inputs are read in place and never copied.');
  }
  return { videoPath: resolve(videoPath), srtPath: resolve(srtPath) };
}

async function loadPreviewInput() {
  const input = inputFromEnvironment();
  await Promise.all([access(input.videoPath), access(input.srtPath)]);
  const [videoStat, source] = await Promise.all([stat(input.videoPath), readFile(input.srtPath, 'utf8')]);
  assert(videoStat.isFile() && videoStat.size > 0, 'Golden Smoke Base Video must be a non-empty regular file.');
  const segments = parseSrt(source, { sourceRef: 'AKK-CH02-subs-1.35x.srt' });
  validateGoldenSmokeFinalSrt(segments);
  return Object.freeze({ input, videoStat, segments, instances: createGoldenSmokePreviewInstances(segments) });
}

function previewShotModel() {
  return GOLDEN_SMOKE_CONTROLLED_PRODUCTION_STATE.productionState.chapters.flatMap((chapter) => chapter.shots.map((shot) => ({
    id: shot.id,
    title: chapter.title + ' · ' + shot.id,
    startMs: shot.timeRange[0],
    endMs: shot.timeRange[1],
    cardInstance: shot.componentSlot.instance,
    screenLayout: shot.screenLayout,
  })));
}

function renderHost({ entries, instances }) {
  const config = {
    runtimeUrl: entries.hyperframeRuntime,
    shots: previewShotModel(),
    players: Object.entries(instances).map(([instance, specification]) => ({
      instance,
      assetId: specification.asset.assetId,
      variables: specification.variables,
    })),
  };

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>Golden Smoke · HyperFrames 网页预览</title>',
    '<script src="' + entries.playerRuntime + '"></script>',
    '<style>',
    ':root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; color: #eef2f7; background: #0a0d13; }',
    '* { box-sizing: border-box; }',
    'body { min-width: 960px; margin: 0; background: radial-gradient(circle at 15% 0%, #1a2936 0%, #0a0d13 42%); }',
    '.shell { width: min(1440px, calc(100vw - 56px)); margin: 0 auto; padding: 28px 0 38px; }',
    '.topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 22px; }',
    '.eyebrow { margin: 0 0 8px; color: #70c9bc; font-size: 11px; font-weight: 850; letter-spacing: .17em; }',
    'h1 { margin: 0; color: #fff; font-size: 28px; letter-spacing: -.025em; }',
    '.topbar p { max-width: 650px; margin: 10px 0 0; color: #9eabb9; font-size: 14px; line-height: 1.55; }',
    '.badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }',
    '.badge { padding: 7px 10px; border: 1px solid rgba(240,162,79,.36); border-radius: 999px; color: #f7c17e; background: rgba(240,162,79,.09); font-size: 11px; font-weight: 800; letter-spacing: .06em; white-space: nowrap; }',
    '.preview-wrap { display: grid; grid-template-columns: minmax(780px, 1fr) 250px; gap: 18px; align-items: start; }',
    '.preview-panel, .facts { border: 1px solid rgba(255,255,255,.11); border-radius: 18px; background: rgba(15,20,29,.78); box-shadow: 0 24px 66px rgba(0,0,0,.26); }',
    '.preview-panel { padding: 14px; }',
    '.stage { position: relative; isolation: isolate; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid rgba(255,255,255,.13); border-radius: 12px; background: #081018; }',
    '.stage::after { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(180deg, rgba(3,8,14,.18), transparent 24%, transparent 68%, rgba(3,8,14,.38)); content: ""; }',
    '.source-video, .pip-video { position: absolute; object-fit: cover; transition: .38s ease; }',
    '.source-video { z-index: 1; inset: 0; width: 100%; height: 100%; }',
    '.pip-video { z-index: 4; right: 4%; bottom: 12%; width: 27%; aspect-ratio: 16 / 9; border: 1px solid rgba(255,255,255,.28); border-radius: 10px; opacity: 0; box-shadow: 0 18px 42px rgba(0,0,0,.44); }',
    '.stage[data-shot="S-02"] .source-video, .stage[data-shot="S-05"] .source-video { filter: blur(9px) brightness(.35) saturate(.75); transform: scale(1.07); }',
    '.stage[data-shot="S-02"] .pip-video, .stage[data-shot="S-05"] .pip-video { opacity: 1; }',
    '.stage[data-shot="S-03"] .source-video { inset: 0 auto 0 0; width: 43%; border-right: 1px solid rgba(240,162,79,.45); }',
    '.stage[data-shot="S-04"] .source-video { inset: 0 0 auto 0; height: 43%; border-bottom: 1px solid rgba(112,201,188,.45); }',
    '.overlay { position: absolute; z-index: 6; pointer-events: none; }',
    '.overlay > hyperframes-player { display: block; width: 100%; height: 100%; background: transparent !important; }',
    '#subtitle { inset: 0; z-index: 8; }',
    '#chapter-progress { inset: 0; z-index: 9; }',
    '.card { z-index: 7; opacity: 0; transform: translateY(12px); transition: opacity .16s ease, transform .16s ease; }',
    '.card.is-active { opacity: 1; transform: translateY(0); }',
    '#card-s01 { top: 19%; right: 2%; width: 51%; height: 55%; }',
    '#card-s02 { top: 18%; left: 4%; width: 58%; height: 63%; }',
    '#card-s03 { top: 12%; right: 2%; width: 54%; height: 70%; }',
    '#card-s04 { top: 43%; left: 7%; width: 84%; height: 53%; }',
    '#card-s05 { top: 16%; left: 4%; width: 58%; height: 67%; }',
    '#card-s06 { right: 7%; bottom: 11%; width: 58%; height: 34%; }',
    '.shot-label { position: absolute; z-index: 10; top: 58px; left: 18px; max-width: 42%; padding: 7px 10px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; color: rgba(255,255,255,.82); background: rgba(3,7,12,.54); font-size: 11px; font-weight: 800; letter-spacing: .06em; }',
    '.controls { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 14px 5px 4px; }',
    '.controls button { padding: 8px 13px; border: 1px solid rgba(240,162,79,.44); border-radius: 8px; color: #fff; background: #222838; cursor: pointer; font-weight: 800; }',
    '.controls input { width: 100%; accent-color: #f0a24f; }',
    '.time { color: #b9c4d1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }',
    '.facts { padding: 18px; }',
    '.facts h2 { margin: 0 0 14px; color: #fff; font-size: 14px; }',
    '.fact { margin: 0; padding: 12px 0; border-top: 1px solid rgba(255,255,255,.08); color: #9eabb9; font-size: 12px; line-height: 1.52; }',
    '.fact strong { display: block; margin-bottom: 4px; color: #eaf0f5; font-size: 12px; }',
    '.fact code { color: #70c9bc; font-size: 11px; }',
    '.status { min-height: 16px; margin: 8px 5px 0; color: #f7c17e; font-size: 12px; }',
    '</style>',
    '</head>',
    '<body>',
    '<main class="shell">',
    '<header class="topbar"><div><p class="eyebrow">GOLDEN SMOKE · CONTROLLED SIMULATION</p><h1>HyperFrames 网页预览</h1><p>真实 Base Video + Final SRT，叠加已注册资产与两张仅服务本项目的 HyperFrames Project DRAFT。</p></div><div class="badges"><span class="badge">不导出</span><span class="badge">不注册资产</span><span class="badge">仅读预览</span></div></header>',
    '<section class="preview-wrap">',
    '<div class="preview-panel"><div class="stage" id="stage" data-shot="S-01"><video class="source-video" id="source-video" preload="metadata" playsinline src="/video.mp4"></video><video class="pip-video" id="pip-video" preload="metadata" muted playsinline src="/video.mp4"></video><div class="overlay" id="subtitle"></div><div class="overlay" id="chapter-progress"></div><div class="overlay card" id="card-s01"></div><div class="overlay card" id="card-s02"></div><div class="overlay card" id="card-s03"></div><div class="overlay card" id="card-s04"></div><div class="overlay card" id="card-s05"></div><div class="overlay card" id="card-s06"></div><div class="shot-label" id="shot-label">加载中…</div></div><div class="controls"><button type="button" id="toggle">播放</button><input id="scrubber" aria-label="预览进度" type="range" min="0" max="29.36" value="0" step="0.001" /><span class="time" id="time">0:00.000 / 0:29.360</span></div><p class="status" id="status">正在加载真实素材与 HyperFrames 组件…</p></div>',
    '<aside class="facts"><h2>受控模拟范围</h2><p class="fact"><strong>输入事实</strong>29.360 秒 Base Video；15 条 Final SRT 是唯一业务时间源。</p><p class="fact"><strong>复用的 Registered Assets</strong><code>CMP-SUB-001</code>、<code>CMP-CHP-001</code>、<code>CMP-TYP-001</code>、<code>CMP-DATA-001</code>、<code>CMP-STP-001</code>、<code>CMP-PUN-001</code></p><p class="fact"><strong>新生成 Project DRAFT</strong><code>PD-GOLDEN-S02-BARRIER-RELATION</code> 与 <code>PD-GOLDEN-S04-SCFA-FLOW</code>，不会进入资产库。</p><p class="fact"><strong>边界</strong>无新外部素材、无 Render、无 MP4/MOV、无 Export Job。</p></aside>',
    '</section>',
    '</main>',
    '<script>window.__R3_GOLDEN_SMOKE_CONFIG__ = ' + escapeInlineJson(config) + ';</script>',
    '<script type="module">',
    "import { SharedPlayer } from '/r3-src/player/shared-player.mjs';",
    "const config = window.__R3_GOLDEN_SMOKE_CONFIG__;",
    "const stage = document.querySelector('#stage');",
    "const video = document.querySelector('#source-video');",
    "const pip = document.querySelector('#pip-video');",
    "const label = document.querySelector('#shot-label');",
    "const scrubber = document.querySelector('#scrubber');",
    "const toggle = document.querySelector('#toggle');",
    "const timeLabel = document.querySelector('#time');",
    "const status = document.querySelector('#status');",
    "const players = new Map();",
    "let activeShotId = null;",
    "const pad = value => String(value).padStart(2, '0');",
    "const formatTime = seconds => { const ms = Math.round(Math.max(0, seconds) * 1000); return Math.floor(ms / 60000) + ':' + pad(Math.floor(ms / 1000) % 60) + '.' + String(ms % 1000).padStart(3, '0'); };",
    "const waitForMetadata = element => new Promise((resolve, reject) => { if (Number.isFinite(element.duration) && element.duration > 0) return resolve(); element.addEventListener('loadedmetadata', resolve, { once: true }); element.addEventListener('error', () => reject(new Error('Base Video 无法加载。')), { once: true }); });",
    "const waitForDecodedFrame = () => new Promise((resolve, reject) => { if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve(); const timeout = window.setTimeout(() => reject(new Error('Base Video frame decode timeout.')), 5000); video.addEventListener('loadeddata', () => { window.clearTimeout(timeout); resolve(); }, { once: true }); });",
    "const settlePreviewPaint = async () => { await waitForDecodedFrame(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 180)))); };",
    "const waitForReady = adapter => new Promise((resolve, reject) => { if (adapter.element.ready) return resolve(); const timeout = window.setTimeout(() => reject(new Error('HyperFrames component ready timeout.')), 9000); adapter.on('ready', () => { window.clearTimeout(timeout); resolve(); }); adapter.on('error', detail => { window.clearTimeout(timeout); reject(new Error(detail && detail.message ? detail.message : 'HyperFrames component failed.')); }); });",
    "async function mount(spec) { const container = document.getElementById(spec.instance); const player = new SharedPlayer({ window, runtimeUrl: config.runtimeUrl }); const adapter = player.mount(container, { source: '/composition?instance=' + encodeURIComponent(spec.instance), width: 1920, height: 1080 }); adapter.element.style.setProperty('background', 'transparent', 'important'); await waitForReady(adapter); const ack = await player.patch(spec.variables); if (!ack.ok) throw new Error('Patch was rejected for ' + spec.instance); players.set(spec.instance, { player, adapter, container }); }",
    "function shotAt(milliseconds) { return config.shots.find(shot => milliseconds >= shot.startMs && milliseconds < shot.endMs) || config.shots.at(-1); }",
    "function seekComponent(instance, seconds) { const entry = players.get(instance); if (entry && entry.adapter.element.ready) entry.adapter.element.currentTime = seconds; }",
    "function activateCard(shot) { if (activeShotId === shot.id) return; activeShotId = shot.id; document.querySelectorAll('.card').forEach(card => card.classList.toggle('is-active', card.id === shot.cardInstance)); const entry = players.get(shot.cardInstance); if (entry) { const duration = Math.max(.3, entry.adapter.element.duration || 1); entry.adapter.element.currentTime = Math.min(duration * .92, 1.8); } }",
    "function syncPip(seconds) { if (Math.abs((pip.currentTime || 0) - seconds) > .08) pip.currentTime = seconds; }",
    "function updateScene() { const seconds = Number(video.currentTime || 0); const milliseconds = seconds * 1000; const shot = shotAt(milliseconds); stage.dataset.shot = shot.id; label.textContent = shot.title + ' · ' + shot.screenLayout; activateCard(shot); seekComponent('subtitle', seconds); seekComponent('chapter-progress', seconds); syncPip(seconds); scrubber.value = String(seconds); timeLabel.textContent = formatTime(seconds) + ' / 0:29.360'; return shot; }",
    "function inspect() { const componentStates = Object.fromEntries(Array.from(players.entries()).map(([instance, entry]) => { const root = entry.adapter.element.iframe.contentDocument && entry.adapter.element.iframe.contentDocument.querySelector('[data-composition-id]'); return [instance, { ready: entry.adapter.element.ready, componentId: root && root.getAttribute('data-composition-id'), projectDraft: root && root.getAttribute('data-project-draft'), playerBackground: getComputedStyle(entry.adapter.element).backgroundColor }]; })); const subtitleRoot = players.get('subtitle') && players.get('subtitle').adapter.element.iframe.contentDocument.querySelector('[data-composition-id]'); const progressRoot = players.get('chapter-progress') && players.get('chapter-progress').adapter.element.iframe.contentDocument.querySelector('[data-composition-id]'); const activeCard = document.querySelector('.card.is-active'); return { activeShot: activeShotId, activeCard: activeCard && activeCard.id, sourceTime: Number(video.currentTime || 0), subtitleCueCount: subtitleRoot ? subtitleRoot.querySelectorAll('[data-cue-id]').length : 0, chapterCount: progressRoot ? progressRoot.querySelectorAll('[data-chapter-id]').length : 0, componentStates, visualReadiness: { sourceReadyState: video.readyState, sourceDimensions: [video.videoWidth, video.videoHeight], activeCardOpacity: activeCard ? Number(getComputedStyle(activeCard).opacity) : 0, transparentPlayerBackdrops: Object.values(componentStates).every(entry => entry.playerBackground === 'rgba(0, 0, 0, 0)' || entry.playerBackground === 'transparent') } }; }",
    "async function seek(seconds) { const target = Math.max(0, Math.min(29.36, Number(seconds) || 0)); if (Math.abs((video.currentTime || 0) - target) < .01) { updateScene(); await settlePreviewPaint(); return inspect(); } await new Promise((resolve, reject) => { const timeout = window.setTimeout(() => reject(new Error('Video seek timeout.')), 5000); video.addEventListener('seeked', () => { window.clearTimeout(timeout); resolve(); }, { once: true }); video.currentTime = target; }); updateScene(); await settlePreviewPaint(); return inspect(); }",
    "function bindEvents() { video.addEventListener('timeupdate', updateScene); video.addEventListener('seeking', updateScene); video.addEventListener('play', () => { toggle.textContent = '暂停'; pip.play().catch(() => {}); }); video.addEventListener('pause', () => { toggle.textContent = '播放'; pip.pause(); }); toggle.addEventListener('click', () => { if (video.paused) video.play().catch(error => { status.textContent = error.message; }); else video.pause(); }); scrubber.addEventListener('input', () => { seek(scrubber.value).catch(error => { status.textContent = error.message; }); }); }",
    "async function bootstrap() { await Promise.all([waitForMetadata(video), waitForMetadata(pip)]); await Promise.all(config.players.map(mount)); bindEvents(); await seek(0); status.textContent = '已加载：6 个 Director Shot、15 条 Final SRT、6 个 Registered Assets、2 个 HyperFrames Project DRAFT。'; window.r3GoldenSmoke.status = 'ready'; return inspect(); }",
    "window.r3GoldenSmoke = { status: 'booting', lastError: null, seek, inspect, ready: null };",
    "window.r3GoldenSmoke.ready = bootstrap().catch(error => { status.textContent = error.message; window.r3GoldenSmoke.lastError = error.message; window.r3GoldenSmoke.status = 'failed'; return null; });",
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}

async function renderComposition(instanceId, preview) {
  const specification = preview.instances[instanceId];
  if (!specification) throw new Error('Unknown controlled-preview instance.');
  const assetId = specification.asset.assetId;
  let path;
  if (projectDraftFiles[assetId]) path = safePath(projectDraftRoot, projectDraftFiles[assetId]);
  else path = safePath(assetRoot, 'compositions/' + assetId + '.html');
  let template = await readFile(path, 'utf8');
  template = replaceInlineContent(template, specification.content);
  return makeCompositionFrameTransparent(template);
}

function videoRange(response, request, videoPath, videoStat) {
  const range = request.headers.range;
  const size = videoStat.size;
  if (!range) {
    response.writeHead(200, { 'content-type': 'video/mp4', 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
    createReadStream(videoPath).pipe(response);
    return;
  }
  const matched = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!matched) {
    response.writeHead(416, { 'content-range': 'bytes */' + size });
    response.end();
    return;
  }
  const start = matched[1] ? Number(matched[1]) : 0;
  const end = matched[2] ? Math.min(Number(matched[2]), size - 1) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    response.writeHead(416, { 'content-range': 'bytes */' + size });
    response.end();
    return;
  }
  response.writeHead(206, { 'content-type': 'video/mp4', 'content-length': end - start + 1, 'content-range': 'bytes ' + start + '-' + end + '/' + size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
  createReadStream(videoPath, { start, end }).pipe(response);
}

export async function startGoldenSmokePreviewServer() {
  validateControlledProductionState();
  const preview = await loadPreviewInput();
  const runtimeFiles = resolveFoundationRuntimeFiles();
  let server;
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const origin = 'http://127.0.0.1:' + server.address().port;
      const entries = createRuntimeEntries(origin);
      const sendFile = async (path) => {
        response.writeHead(200, { 'content-type': contentType(path), 'cache-control': 'no-store' });
        response.end(await readFile(path));
      };
      if (url.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(renderHost({ entries, instances: preview.instances }));
        return;
      }
      if (url.pathname === '/api/state') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        response.end(escapeInlineJson(GOLDEN_SMOKE_CONTROLLED_PRODUCTION_STATE));
        return;
      }
      if (url.pathname === '/video.mp4') {
        videoRange(response, request, preview.input.videoPath, preview.videoStat);
        return;
      }
      if (url.pathname === '/composition') {
        let composition = await renderComposition(url.searchParams.get('instance'), preview);
        composition = replaceTemplateToken(composition, '__R3_GSAP_ENTRY__', entries.gsapRuntime);
        composition = replaceTemplateToken(composition, '__R3_COMPONENT_KIT_ENTRY__', origin + '/assets/shared/r3-hf-component-kit.js');
        composition = replaceTemplateToken(composition, '__R3_CANVAS_BACKDROP_ENTRY__', origin + '/assets/shared/r3-canvas-backdrop.js');
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(composition);
        return;
      }
      if (url.pathname.startsWith('/assets/shared/')) {
        await sendFile(safePath(assetRoot, 'shared/' + url.pathname.slice('/assets/shared/'.length)));
        return;
      }
      if (url.pathname.startsWith('/r3-src/')) {
        await sendFile(safePath(sourceRoot, url.pathname.slice('/r3-src/'.length)));
        return;
      }
      if (url.pathname === '/runtime/hyperframe.runtime.iife.js') return sendFile(runtimeFiles.hyperframeRuntime);
      if (url.pathname === '/runtime/hyperframes-player.global.js') return sendFile(runtimeFiles.playerRuntime);
      if (url.pathname === '/runtime/gsap.min.js') return sendFile(runtimeFiles.gsapRuntime);
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.stack : String(error));
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  return Object.freeze({
    origin,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  });
}

async function verifyPreview(origin) {
  const browserPath = process.env.R3_GOLDEN_SMOKE_BROWSER || process.env.R3_BROWSER_EXECUTABLE;
  assert(browserPath, 'R3_GOLDEN_SMOKE_BROWSER or R3_BROWSER_EXECUTABLE must identify a browser for verification.');
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
  const artifactDirectory = process.env.R3_GOLDEN_SMOKE_ARTIFACT_DIR;
  const captured = [];
  try {
    await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.r3GoldenSmoke && window.r3GoldenSmoke.status !== 'booting', { timeout: 15000 });
    const readiness = await page.evaluate(() => ({ status: window.r3GoldenSmoke.status, lastError: window.r3GoldenSmoke.lastError }));
    assert.equal(readiness.status, 'ready', 'Preview did not become ready: ' + (readiness.lastError || 'unknown bootstrap failure.'));
    const initial = await page.evaluate(() => window.r3GoldenSmoke.inspect());
    assert.equal(initial.subtitleCueCount, 15, 'The registered subtitle component must receive all Final SRT cues.');
    assert.equal(initial.chapterCount, 2, 'The registered Chapter Progress component must receive both confirmed Chapters.');
    assert.equal(Object.keys(initial.componentStates).length, 8, 'The preview must mount exactly six shot cards and two global components.');
    assert(Object.values(initial.componentStates).every((entry) => entry.ready), 'Every HyperFrames component must become ready.');
    assert.equal(initial.componentStates['card-s02'].projectDraft, 'PD-GOLDEN-S02-BARRIER-RELATION');
    assert.equal(initial.componentStates['card-s04'].projectDraft, 'PD-GOLDEN-S04-SCFA-FLOW');
    assert(initial.visualReadiness.sourceReadyState >= 2, 'The real Base Video must have a decoded frame before preview verification.');
    assert.deepEqual(initial.visualReadiness.sourceDimensions, [1872, 1080], 'Preview video dimensions diverged from the verified Base Video.');
    assert.equal(initial.visualReadiness.transparentPlayerBackdrops, true, 'HyperFrames overlay players must remain transparent over the real Base Video.');
    const checkpoints = [
      [1000, 'S-01'],
      [5000, 'S-02'],
      [10000, 'S-03'],
      [18000, 'S-04'],
      [23000, 'S-05'],
      [27500, 'S-06'],
    ];
    if (artifactDirectory) await mkdir(artifactDirectory, { recursive: true });
    for (const [milliseconds, shotId] of checkpoints) {
      const state = await page.evaluate((seconds) => window.r3GoldenSmoke.seek(seconds), milliseconds / 1000);
      assert.equal(state.activeShot, shotId, 'Preview did not resolve ' + shotId + ' at ' + milliseconds + 'ms.');
      assert(state.visualReadiness.activeCardOpacity >= 0.99, 'Active HyperFrames card did not finish painting for ' + shotId + '.');
      assert.equal(state.visualReadiness.transparentPlayerBackdrops, true, 'An opaque HyperFrames player backdrop covered the preview at ' + shotId + '.');
      if (artifactDirectory) {
        const screenshot = join(artifactDirectory, 'golden-smoke-' + shotId.toLowerCase() + '.png');
        await page.screenshot({ path: screenshot, fullPage: true });
        captured.push(screenshot);
      }
    }
    assert.deepEqual(errors, [], 'Browser preview emitted errors.');
    const result = { initial, checkpoints, screenshots: captured, noExport: true };
    if (artifactDirectory) await writeFile(join(artifactDirectory, 'golden-smoke-preview-verification.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
  } finally {
    await page.close();
    await browser.close();
  }
}

async function main() {
  const mode = process.argv[2] || 'serve';
  if (mode !== 'serve' && mode !== 'verify') throw new Error('Use either "serve" or "verify".');
  const server = await startGoldenSmokePreviewServer();
  if (mode === 'serve') {
    process.stdout.write('GOLDEN_SMOKE_PREVIEW_URL=' + server.origin + '\n');
    return;
  }
  try {
    const result = await verifyPreview(server.origin);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally {
    await server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
