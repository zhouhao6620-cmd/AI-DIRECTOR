import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

import { createDevelopmentControlCenterView } from '../../src/development-control-center/project-state-view.mjs';

const state = JSON.parse(await readFile(new URL('../../PROJECT_STATE.json', import.meta.url), 'utf8'));
const view = createDevelopmentControlCenterView(state);
const host = '127.0.0.1';
const port = 4175;
const baseUrl = `http://${host}:${port}/development-control-center.html`;
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), 'r3-main-dcc-acceptance-'));
const server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--host', host, '--port', String(port), '--strictPort'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before acceptance:\n${serverOutput}`);
    try { if ((await fetch(baseUrl)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${baseUrl}\n${serverOutput}`);
}

try {
  await waitForServer();
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
      const page = await browser.newPage();
      await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
      const errors = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.dcc-shell');

      const initial = await page.evaluate(() => {
        const bar = document.querySelector('.dcc-progress-compact em');
        const track = bar.parentElement;
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          packages: document.querySelectorAll('[data-package-id]').length,
          skills: document.querySelectorAll('[data-skill-id]').length,
          text: document.querySelector('#app').innerText.replaceAll('\n', ''),
          ratio: bar.getBoundingClientRect().width / track.getBoundingClientRect().width,
          taskFont: getComputedStyle(document.querySelector('.dcc-detail-tasks strong')).fontSize,
        };
      });
      const current = view.dcc.workPackages.find((item) => item.id === view.dcc.currentPackageId);
      const expectedRatio = view.dcc.taskSummary.completed / view.dcc.taskSummary.total;
      assert.equal(initial.overflow, false, `${viewport.name} has no horizontal overflow`);
      assert.equal(initial.packages, 13);
      assert.equal(initial.skills, 2);
      assert.ok(Math.abs(initial.ratio - expectedRatio) < .01);
      for (const copy of [`${view.dcc.taskSummary.completed} / ${view.dcc.taskSummary.total}`, `${Math.round(expectedRatio * 100)}%`, `${current.id} ${current.name}`, '产品技能资产']) assert.ok(initial.text.includes(copy), `${viewport.name} missing ${copy}`);
      assert.equal(initial.taskFont, '14px');
      const m0b = await page.$('[data-package-id="M0-B"]');
      const m0c = await page.$('[data-package-id="M0-C"]');
      assert.ok((await m0b.evaluate((item) => item.innerText)).includes(view.dcc.workPackages.find((item) => item.id === 'M0-B').statusMeta.label));
      assert.ok((await m0c.evaluate((item) => item.innerText)).includes(view.dcc.workPackages.find((item) => item.id === 'M0-C').statusMeta.label));
      await m0b.hover();
      const hover = await m0b.evaluate((item) => ({ transform: getComputedStyle(item).transform, border: getComputedStyle(item).borderColor }));
      assert.notEqual(hover.transform, 'none');
      assert.notEqual(hover.border, 'rgb(0, 0, 0)');
      await m0b.click();
      assert.equal(await m0b.evaluate((item) => item.classList.contains('is-selected')), true);
      assert.ok((await page.$eval('#detail', (item) => item.innerText)).includes('主要任务'));
      await page.focus('[data-package-id="P0"]');
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => ({ id: document.activeElement?.dataset?.packageId, outline: getComputedStyle(document.activeElement).outlineStyle }));
      assert.ok(focus.id);
      assert.equal(focus.outline, 'solid');
      assert.deepEqual(errors, [], `${viewport.name} console errors`);
      await page.screenshot({ path: path.join(evidenceRoot, `${viewport.name}.png`), fullPage: false });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`Main-project DCC browser acceptance PASS\nURL: ${baseUrl}\nEvidence: ${evidenceRoot}\n`);
} finally {
  server.kill('SIGTERM');
}
