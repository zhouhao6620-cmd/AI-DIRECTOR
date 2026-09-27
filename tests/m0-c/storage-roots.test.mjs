import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { APP_DATA_DIRECTORIES, ensureAppDataRoot, resolveAppDataPath } from '../../src/storage/app-data-root.mjs';
import { assertPhysicalRootSeparation, assertRootSeparation, resolveStorageRoots } from '../../src/storage/root-resolver.mjs';
import { ensureRuntimeRoot, RUNTIME_DIRECTORIES, resolveRuntimePath } from '../../src/storage/runtime-root.mjs';
import { assertProjectStorageIsolation, resolveExistingWorkspacePath } from '../../src/storage/workspace-boundary.mjs';

test('macOS defaults resolve the current ProjectsRoot and R3-owned AppData/Runtime roots', () => {
  const roots = resolveStorageRoots({
    platform: 'darwin',
    homeDir: '/Users/skyai',
    productRepository: '/Users/skyai/Documents/AI视频导演剪辑工作台_R3',
  });
  assert.equal(roots.projectsRoot, '/Users/skyai/Documents/Ai视频导演工作台');
  assert.equal(roots.appDataRoot, '/Users/skyai/Library/Application Support/AI视频导演剪辑工作台_R3');
  assert.equal(roots.runtimeRoot, '/Users/skyai/Library/Caches/AI视频导演剪辑工作台_R3');
  assert.equal(roots.productRepository, '/Users/skyai/Documents/AI视频导演剪辑工作台_R3');
});

test('persisted settings can relocate every mutable root without source-path coupling', () => {
  const roots = resolveStorageRoots({
    platform: 'darwin', homeDir: '/Users/example',
    settings: { projectsRoot: '/Volumes/Projects/R3', appDataRoot: '/Volumes/ApplicationData/R3', runtimeRoot: '/Volumes/Scratch/R3' },
  });
  assert.deepEqual(roots, { projectsRoot: '/Volumes/Projects/R3', appDataRoot: '/Volumes/ApplicationData/R3', runtimeRoot: '/Volumes/Scratch/R3' });
});

test('four roots reject equality or nesting in either direction', () => {
  assert.throws(() => assertRootSeparation({ productRepository: '/repo/r3', projectsRoot: '/repo/r3/projects', appDataRoot: '/app-data/r3', runtimeRoot: '/runtime/r3' }), /physically separate roots/);
  assert.throws(() => assertRootSeparation({ projectsRoot: '/projects', appDataRoot: '/projects', runtimeRoot: '/runtime' }), /physically separate roots/);
});

test('Project Workspace rejects RuntimeRoot and AppDataRoot overlap', () => {
  assert.deepEqual(assertProjectStorageIsolation({ projectRoot: '/projects/demo', appDataRoot: '/app-data/r3', runtimeRoot: '/runtime/r3' }), {
    projectRoot: '/projects/demo', appDataRoot: '/app-data/r3', runtimeRoot: '/runtime/r3',
  });
  assert.throws(() => assertProjectStorageIsolation({ projectRoot: '/projects/demo', appDataRoot: '/projects/demo/app-data', runtimeRoot: '/runtime/r3' }), /AppDataRoot must be physically outside/);
  assert.throws(() => assertProjectStorageIsolation({ projectRoot: '/projects/demo', appDataRoot: '/app-data/r3', runtimeRoot: '/projects/demo/runtime' }), /Runtime Root must be physically outside/);
});

test('AppData and Runtime paths reject escape attempts', () => {
  assert.equal(resolveAppDataPath('/app-data/r3', 'settings', 'user.json'), '/app-data/r3/settings/user.json');
  assert.throws(() => resolveAppDataPath('/app-data/r3', 'settings', '../../project.json'), /escapes AppDataRoot/);
  assert.equal(resolveRuntimePath('/runtime/r3', 'jobs', 'job-1/state.json'), '/runtime/r3/jobs/job-1/state.json');
  assert.throws(() => resolveRuntimePath('/runtime/r3', 'jobs', '../../project.json'), /escapes jobs/);
});

test('RuntimeRoot is fully reconstructable after deletion and AppData has a separate durable layout', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'r3-m0-c-'));
  const appDataRoot = path.join(temporary, 'app-data');
  const runtimeRoot = path.join(temporary, 'runtime');
  try {
    await ensureAppDataRoot(appDataRoot);
    await ensureRuntimeRoot(runtimeRoot);
    assert.deepEqual((await readdir(appDataRoot)).sort(), [...APP_DATA_DIRECTORIES].sort());
    assert.deepEqual((await readdir(runtimeRoot)).sort(), [...RUNTIME_DIRECTORIES].sort());
    await rm(runtimeRoot, { recursive: true, force: true });
    await ensureRuntimeRoot(runtimeRoot);
    assert.deepEqual((await readdir(runtimeRoot)).sort(), [...RUNTIME_DIRECTORIES].sort());
    assert.deepEqual((await readdir(appDataRoot)).sort(), [...APP_DATA_DIRECTORIES].sort());
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('physical root and Workspace checks reject symbolic-link escape', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'r3-m0-c-symlink-'));
  const repository = path.join(temporary, 'repository');
  const projects = path.join(temporary, 'projects');
  const appData = path.join(temporary, 'app-data');
  const runtime = path.join(temporary, 'runtime');
  const project = path.join(projects, 'demo');
  const input = path.join(project, '01_输入素材');
  const outside = path.join(temporary, 'outside');
  try {
    await Promise.all([repository, input, appData, runtime, outside].map((directory) => mkdir(directory, { recursive: true })));
    await writeFile(path.join(outside, 'source.srt'), 'outside');
    await symlink(outside, path.join(input, 'linked-outside'));
    await assert.rejects(() => resolveExistingWorkspacePath(project, 'linked-outside/source.srt'), /symbolic link/);
    const runtimeAlias = path.join(temporary, 'runtime-alias');
    await symlink(repository, runtimeAlias);
    await assert.rejects(() => assertPhysicalRootSeparation({ productRepository: repository, projectsRoot: projects, appDataRoot: appData, runtimeRoot: runtimeAlias }), /physically separate roots/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
