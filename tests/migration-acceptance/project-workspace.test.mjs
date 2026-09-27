import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProjectWorkspace } from '../../src/workspace/project-workspace.mjs';

test('Project Workspace creates only the frozen user-visible root structure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'r3-projects-'));
  try {
    const created = await createProjectWorkspace({ projectsRoot: root, projectName: '测试项目', aspectRatio: '16:9' });
    const project = JSON.parse(await readFile(path.join(created.projectRoot, 'project.json'), 'utf8'));
    assert.equal(project.aspectRatio, '16:9');
    assert.match(created.projectRoot, /测试项目-/);
    assert.deepEqual((await readdir(created.projectRoot)).sort(), ['01_输入素材', '02_导演计划', '03_项目实现', '04_导出成片', 'project.json']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
