import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { APP_DATA_DIRECTORIES } from '../../src/storage/app-data-root.mjs';
import { R3_APPLICATION_ID } from '../../src/storage/root-resolver.mjs';
import { RUNTIME_DIRECTORIES } from '../../src/storage/runtime-root.mjs';
import { WORKSPACE_DIRECTORIES } from '../../src/storage/workspace-boundary.mjs';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const boundaries = JSON.parse(await readFile(path.join(repositoryRoot, 'config/package-boundaries.json'), 'utf8'));
const releaseManifest = JSON.parse(await readFile(path.join(repositoryRoot, 'resources/release-manifest.json'), 'utf8'));

test('package manifest matches the executable storage contracts', () => {
  assert.equal(boundaries.applicationId, R3_APPLICATION_ID);
  assert.equal(releaseManifest.applicationId, R3_APPLICATION_ID);
  assert.deepEqual(boundaries.appDataRoot.directories, APP_DATA_DIRECTORIES);
  assert.deepEqual(boundaries.runtimeRoot.directories, RUNTIME_DIRECTORIES);
  assert.deepEqual(boundaries.projectPackage.requiredEntries, ['project.json', ...WORKSPACE_DIRECTORIES]);
  assert.equal(boundaries.runtimeRoot.durability, 'deletable-and-rebuildable');
});

test('release, AppData, project archive and Runtime boundaries do not collapse into one package', () => {
  for (const required of ['application-code', 'engine-runtime', 'product-skill-seeds', 'shared-asset-seeds', 'schemas-and-config', 'licenses', 'release-manifest']) assert.ok(boundaries.releasePackage.includes.includes(required));
  for (const excluded of ['project-workspaces', 'app-data', 'runtime', 'cache', 'logs', 'temp', 'preview', 'jobs', 'test-artifacts']) assert.ok(boundaries.releasePackage.excludes.includes(excluded));
  for (const runtimeName of RUNTIME_DIRECTORIES) assert.ok(boundaries.projectPackage.excludedNames.includes(runtimeName));
});

test('release manifest carries the 19-asset seed but does not invent M0-D product skills or schemas', async () => {
  assert.equal(releaseManifest.seeds.sharedAssets.length, 1);
  assert.deepEqual(releaseManifest.seeds.productSkills, []);
  assert.deepEqual(releaseManifest.schemas, []);
  const compositions = await readdir(path.join(repositoryRoot, 'resources/hyperframes-assets/compositions'));
  assert.equal(compositions.filter((entry) => entry.endsWith('.html')).length, 19);
});

async function allFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const candidate = path.join(root, entry.name);
    return entry.isDirectory() ? allFiles(candidate) : [candidate];
  }))).flat();
}

test('runtime source and build config have no Legacy root, old state-source import, or hidden user-project path', async () => {
  const files = (await Promise.all([allFiles(path.join(repositoryRoot, 'src')), allFiles(path.join(repositoryRoot, 'resources')), allFiles(path.join(repositoryRoot, 'config'))])).flat().concat([
    path.join(repositoryRoot, 'vite.config.mjs'), path.join(repositoryRoot, 'package.json'),
  ]);
  const forbidden = [/\/Users\/skyai\/Desktop\/视频生产线流程/, /\/workbench-src/, /\/hf-runtime/, /(?:from|import\s*\()\s*['"][^'"]*development-state\.json/, /\/Users\/skyai\/Documents\/Ai视频导演工作台\//];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const expression of forbidden) assert.doesNotMatch(source, expression, `${file} must not contain ${expression}`);
  }
  const testImports = (await allFiles(path.join(repositoryRoot, 'tests'))).filter((file) => file.endsWith('.mjs'));
  const forbiddenTestDependency = /(?:from\s*|import\s*\()\s*['"][^'"]*(?:development-state\.json|workbench-src|hf-runtime|视频生产线流程)[^'"]*['"]/;
  for (const file of testImports) assert.doesNotMatch(await readFile(file, 'utf8'), forbiddenTestDependency, `${file} must not import a Legacy path or state source`);
});
