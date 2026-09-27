import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import {
  createRuntimeEntries,
  resolveFoundationRuntimeFiles,
} from '../../../src/hyperframes-foundation/runtime/runtime-resolver.mjs';
import { R3_REGISTERED_ASSETS } from '../../../src/asset-library/r3-asset-registry.mjs';

const projectRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const sourceRoot = join(projectRoot, 'src', 'hyperframes-foundation');
const fixturePath = join(projectRoot, 'tests', 'hyperframes-foundation', 'fixture', 'foundation-fixture.html');
const assetRoot = join(projectRoot, 'resources', 'hyperframes-assets');

function contentType(path) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
  }[extname(path)] ?? 'application/octet-stream';
}

function safeSourcePath(relativePath) {
  const candidate = normalize(join(sourceRoot, relativePath));
  if (!candidate.startsWith(`${sourceRoot}/`)) {
    throw new Error('Invalid R3 source request.');
  }
  return candidate;
}

function safeAssetPath(relativePath) {
  const candidate = normalize(join(assetRoot, relativePath));
  if (!candidate.startsWith(`${assetRoot}/`)) throw new Error('Invalid R3 asset request.');
  return candidate;
}

function hostDocument({ entries, sourceUrl }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><script src="${entries.playerRuntime}"></script></head>
<body><div id="mount"></div><script type="module">
  import { SharedPlayer } from '/r3-src/player/shared-player.mjs';
  const sharedPlayer = new SharedPlayer({ window, runtimeUrl: ${JSON.stringify(entries.hyperframeRuntime)} });
  const adapter = sharedPlayer.mount(document.querySelector('#mount'), {
    source: ${JSON.stringify(sourceUrl)}, width: 640, height: 360,
  });
  const events = { ready: 0, timeupdate: 0, play: 0, pause: 0 };
  for (const type of Object.keys(events)) adapter.on(type, () => { events[type] += 1; });
  window.r3Foundation = { sharedPlayer, adapter, events };
</script></body></html>`;
}

async function createFixtureServer() {
  const runtimeFiles = resolveFoundationRuntimeFiles();
  const fixtureTemplate = await readFile(fixturePath, 'utf8');
  let server;
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const origin = `http://127.0.0.1:${server.address().port}`;
      const entries = createRuntimeEntries(origin);
      const sendFile = async (path) => {
        response.writeHead(200, { 'content-type': contentType(path), 'cache-control': 'no-store' });
        response.end(await readFile(path));
      };

      if (url.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(hostDocument({ entries, sourceUrl: `${origin}/fixture/foundation-fixture.html` }));
        return;
      }
      if (url.pathname === '/asset-host') {
        const asset = R3_REGISTERED_ASSETS.find((entry) => entry.assetId === url.searchParams.get('id'));
        if (!asset) throw new Error('Unknown registered R3 asset.');
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(hostDocument({ entries, sourceUrl: `${origin}${asset.composition}` }));
        return;
      }
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }
      if (url.pathname === '/fixture/foundation-fixture.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(
          fixtureTemplate
            .replace('__R3_GSAP_ENTRY__', entries.gsapRuntime)
            .replace('__R3_HYPERFRAME_RUNTIME_ENTRY__', entries.hyperframeRuntime),
        );
        return;
      }
      if (url.pathname.startsWith('/assets/hyperframes/')) {
        const template = await readFile(safeAssetPath(`compositions/${url.pathname.slice('/assets/hyperframes/'.length)}`), 'utf8');
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(template
          .replace('__R3_GSAP_ENTRY__', entries.gsapRuntime)
          .replace('__R3_COMPONENT_KIT_ENTRY__', `${origin}/assets/shared/r3-hf-component-kit.js`)
          .replace('__R3_CANVAS_BACKDROP_ENTRY__', `${origin}/assets/shared/r3-canvas-backdrop.js`));
        return;
      }
      if (url.pathname.startsWith('/assets/shared/')) return sendFile(safeAssetPath(`shared/${url.pathname.slice('/assets/shared/'.length)}`));
      if (url.pathname === '/runtime/hyperframe.runtime.iife.js') return sendFile(runtimeFiles.hyperframeRuntime);
      if (url.pathname === '/runtime/hyperframes-player.global.js') return sendFile(runtimeFiles.playerRuntime);
      if (url.pathname === '/runtime/gsap.min.js') return sendFile(runtimeFiles.gsapRuntime);
      if (url.pathname.startsWith('/r3-src/')) return sendFile(safeSourcePath(url.pathname.slice('/r3-src/'.length)));

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
  return server;
}

async function main() {
  const executablePath = process.env.R3_BROWSER_EXECUTABLE;
  assert.ok(executablePath && existsSync(executablePath), 'R3_BROWSER_EXECUTABLE must name an available browser.');

  const server = await createFixtureServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.r3Foundation?.adapter?.element?.ready === true, { timeout: 8000 });

    const result = await page.evaluate(async () => {
      const { sharedPlayer, adapter, events } = window.r3Foundation;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const player = adapter.element;

      await adapter.play();
      await wait(250);
      await adapter.pause();
      await adapter.seek(0.75);
      const seekTime = player.currentTime;
      adapter.setRate(1.5);
      const ack = await sharedPlayer.patch({ label: 'Patched by R3 Foundation' });
      const frame = player.iframe;
      const fixtureLabel = frame.contentDocument.querySelector('#fixture-label').textContent;
      const rebindCount = frame.contentDocument.documentElement.dataset.r3TimelineRebind;
      const rate = player.playbackRate;
      sharedPlayer.destroy();

      return { ack, fixtureLabel, rebindCount, seekTime, rate, events, connected: player.isConnected };
    });

    assert.equal(result.ack.ok, true);
    assert.equal(result.fixtureLabel, 'Patched by R3 Foundation');
    assert.ok(Number(result.rebindCount) >= 2, 'Patch must cause a timeline rebind.');
    assert.ok(result.seekTime >= 0.74 && result.seekTime <= 0.76, 'Seek must update player time.');
    assert.equal(result.rate, 1.5);
    assert.ok(result.events.ready >= 1, 'Runtime must emit ready.');
    assert.ok(result.events.play >= 1, 'Player must emit play.');
    assert.ok(result.events.pause >= 1, 'Player must emit pause.');
    assert.ok(result.events.timeupdate >= 1, 'Player must emit timeupdate.');
    assert.equal(result.connected, false, 'Destroy must remove the player element.');
    assert.deepEqual(errors, []);

    const migratedAssetIds = [];
    for (const asset of R3_REGISTERED_ASSETS) {
      await page.goto(`http://127.0.0.1:${port}/asset-host?id=${encodeURIComponent(asset.assetId)}`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.r3Foundation?.adapter?.element?.ready === true, { timeout: 8000 });
      const assetResult = await page.evaluate(async () => {
        const { sharedPlayer, adapter } = window.r3Foundation;
        const ack = await sharedPlayer.patch({});
        const root = adapter.element.iframe.contentDocument.querySelector('[data-composition-id]');
        const result = {
          ack,
          ready: root?.getAttribute('data-component-ready') ?? root?.getAttribute('data-ready-cards') ?? root?.getAttribute('data-ready-chapters'),
          revision: root?.getAttribute('data-patch-revision'),
        };
        sharedPlayer.destroy();
        return result;
      });
      assert.equal(assetResult.ack.ok, true, `${asset.assetId} must acknowledge an R3 patch.`);
      assert.ok(assetResult.ready || assetResult.revision, `${asset.assetId} must initialize in the R3 runtime.`);
      migratedAssetIds.push(asset.assetId);
    }
    assert.equal(migratedAssetIds.length, 19);

    if (process.env.R3_TEST_ARTIFACT_DIR) {
      await mkdir(process.env.R3_TEST_ARTIFACT_DIR, { recursive: true });
      await writeFile(
        join(process.env.R3_TEST_ARTIFACT_DIR, 'foundation-integration.json'),
        `${JSON.stringify({ result, errors }, null, 2)}\n`,
      );
    }
  } catch (error) {
    const state = await page.evaluate(() => ({
      foundation: Boolean(window.r3Foundation),
      playerReady: window.r3Foundation?.adapter?.element?.ready,
      playerSource: window.r3Foundation?.adapter?.element?.getAttribute('src'),
    })).catch(() => null);
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nBrowser state: ${JSON.stringify(state)}\nBrowser errors: ${errors.join(' | ')}`);
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

await main();
