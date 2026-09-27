import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { COMPOSITIONS } from '../../resources/library/components.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFile(resolve(root, path), 'utf8');

test('the copied workbench and design specification are R3-owned entries', async () => {
  const [product, design, productSource, designSource, styles] = await Promise.all([
    read('index.html'),
    read('design-spec.html'),
    read('src/App.jsx'),
    read('src/design-spec/main.jsx'),
    read('src/styles.css'),
  ]);

  assert.match(product, /AI Director Workbench V0/);
  assert.match(product, /src="\/src\/main\.jsx"/);
  assert.match(design, /Workbench 公共骨架 · 设计规范/);
  assert.match(design, /src="\/src\/design-spec\/main\.jsx"/);
  assert.match(productSource, /素材准备/);
  assert.match(designSource, /交付前 QA Gate/);
  assert.match(styles, /--wb-primary:\s*#FF6A00/i);
});

test('the HyperFrames library owns all 19 assets, compositions, player and runtime files', async () => {
  const [library, playerRuntime, frameRuntime] = await Promise.all([
    read('resources/library/index.html'),
    readFile(resolve(root, 'resources/engine/hyperframes/hyperframes-player.global.js')),
    readFile(resolve(root, 'resources/engine/hyperframes/hyperframe.runtime.iife.js')),
  ]);

  assert.match(library, /组件库 · 技能介绍卡/);
  assert.match(library, /\/shared-ui\/styles\.css/);
  assert.ok(playerRuntime.byteLength > 60_000);
  assert.ok(frameRuntime.byteLength > 400_000);
  assert.equal(Object.keys(COMPOSITIONS).length, 19);

  for (const [assetId, composition] of Object.entries(COMPOSITIONS)) {
    const assetDirectory = assetId === 'CMP-SKL-001' ? 'cmp-skl-001' : assetId;
    const [definition, schema, sample, compositionSource] = await Promise.all([
      read(`resources/assets/${assetDirectory}/definition.json`),
      read(`resources/assets/${assetDirectory}/content.schema.json`),
      read(`resources/assets/${assetDirectory}/sample.json`),
      read(`resources/project/compositions/${composition}`),
    ]);
    assert.equal(JSON.parse(definition).identity.componentId, assetId);
    assert.ok(JSON.parse(schema));
    assert.ok(JSON.parse(sample));
    assert.match(compositionSource, /\/engine\/hyperframes\/hyperframe\.runtime\.iife\.js/);
  }
});

test('every copied project HTML is pre-wired for standalone static runtime loading', async () => {
  const projectRoot = resolve(root, 'resources/project');
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.html')) files.push(path);
    }
  }
  await walk(projectRoot);
  assert.equal(files.length, 21);
  for (const file of files) {
    assert.match(await readFile(file, 'utf8'), /\/engine\/hyperframes\/hyperframe\.runtime\.iife\.js/);
  }
});

test('runtime entry files do not call the legacy preview ports or absolute source folders', async () => {
  const criticalFiles = [
    'index.html',
    'design-spec.html',
    'src/main.jsx',
    'src/App.jsx',
    'resources/library/index.html',
    'resources/library/library-host.js',
    'resources/player/player-host.js',
    'resources/player/preview-chrome.js',
  ];
  const source = (await Promise.all(criticalFiles.map(read))).join('\n');
  assert.doesNotMatch(source, /127\.0\.0\.1:(3030|4174)|localhost:(3030|4174)/);
  assert.doesNotMatch(source, /\/Users\/skyai\/Desktop\/视频生产线流程\/基线文档/);
});
