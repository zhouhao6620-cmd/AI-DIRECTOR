import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectWorkspace, importProjectInputs } from '../../src/workspace/project-workspace.mjs';
import { WORKSPACE_DIRECTORIES } from '../../src/storage/workspace-boundary.mjs';

const [baseVideoPath, finalSrtPath] = process.argv.slice(2);
if (!baseVideoPath || !finalSrtPath) {
  console.error('Usage: node tests/stage1/golden-smoke-project.integration.mjs <Base Video> <Final SRT>');
  process.exitCode = 2;
} else {
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'r3-golden-smoke-projects-'));
  try {
    const created = await createProjectWorkspace({
      projectsRoot,
      projectName: 'GOLDEN_SMOKE_PROJECT_001',
      aspectRatio: '16:9',
    });
    const imported = await importProjectInputs({
      projectRoot: created.projectRoot,
      baseVideoPath,
      finalSrtPath,
    });
    const workspaceEntries = (await readdir(created.projectRoot)).sort();
    const inputEntries = (await readdir(path.join(created.projectRoot, '01_输入素材'))).sort();
    const project = JSON.parse(await readFile(path.join(created.projectRoot, 'project.json'), 'utf8'));

    assert.match(project.projectId, /^r3-[0-9a-f-]{36}$/);
    assert.equal(project.projectName, 'GOLDEN_SMOKE_PROJECT_001');
    assert.deepEqual(workspaceEntries, [...WORKSPACE_DIRECTORIES, 'project.json'].sort());
    assert.deepEqual(inputEntries, [path.basename(baseVideoPath), path.basename(finalSrtPath)].sort());
    assert.equal(imported.material.baseVideo.durationMs, 29360);
    assert.equal(imported.material.baseVideo.width, 1872);
    assert.equal(imported.material.baseVideo.height, 1080);
    assert.equal(imported.material.baseVideo.fps, 25);
    assert.equal(imported.material.finalSrt.segments.length, 15);
    assert.equal(imported.material.projectTimebase.subtitleEndMs, 29096);
    assert.equal(imported.material.projectTimebase.segmentCount, 15);
    assert.equal(imported.material.projectTimebase.fps, 25);
    assert.equal(project.materialPreparation.status, 'VERIFIED');
    assert.equal(project.materialPreparation.baseVideo.path, `01_输入素材/${path.basename(baseVideoPath)}`);
    assert.equal(project.materialPreparation.finalSrt.path, `01_输入素材/${path.basename(finalSrtPath)}`);
    for (const forbidden of ['runtime', 'cache', 'build', 'logs', 'temp', 'preview', 'jobs']) {
      await assert.rejects(stat(path.join(created.projectRoot, forbidden)), { code: 'ENOENT' });
    }

    console.log(JSON.stringify({
      gate: 'STAGE_1_GOLDEN_SMOKE',
      status: 'PASS',
      projectId: project.projectId,
      workspaceEntries,
      inputEntries,
      video: {
        durationMs: imported.material.baseVideo.durationMs,
        width: imported.material.baseVideo.width,
        height: imported.material.baseVideo.height,
        fps: imported.material.baseVideo.fps,
      },
      finalSrt: {
        segmentCount: imported.material.finalSrt.segments.length,
        endMs: imported.material.projectTimebase.subtitleEndMs,
      },
      storageBoundary: 'PASS',
    }, null, 2));
  } finally {
    await rm(projectsRoot, { recursive: true, force: true });
  }
}
