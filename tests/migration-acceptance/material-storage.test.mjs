import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSrt } from '../../src/material/srt-parser.js';
import { matchesProjectOrientation } from '../../src/material/media-probe.js';
import { validateMaterialTimebase } from '../../src/material/material-timebase.mjs';
import { R3_REGISTERED_ASSETS, createR3AssetRecord } from '../../src/asset-library/r3-asset-registry.mjs';
import { assertExternalRuntimeRoot, resolveWorkspacePath } from '../../src/storage/workspace-boundary.mjs';

test('R3 SRT parser preserves ordered Final SRT segments', () => {
  const segments = parseSrt('1\n00:00:00,000 --> 00:00:01,200\n第一句\n\n2\n00:00:01,200 --> 00:00:02,000\n第二句\n');
  assert.equal(segments.length, 2);
  assert.equal(segments[0].startMs, 0);
  assert.equal(segments[1].endMs, 2000);
});

test('R3 Material and Storage boundaries reject cross-root escape', () => {
  assert.equal(matchesProjectOrientation('16:9', { width: 1920, height: 1080 }), true);
  assert.equal(matchesProjectOrientation('9:16', { width: 1920, height: 1080 }), false);
  assert.equal(resolveWorkspacePath('/projects/demo', 'source.mp4'), '/projects/demo/01_输入素材/source.mp4');
  assert.throws(() => resolveWorkspacePath('/projects/demo', '../../outside.mp4'));
  assert.equal(assertExternalRuntimeRoot('/projects/demo', '/runtime/jobs'), '/runtime/jobs');
  assert.throws(() => assertExternalRuntimeRoot('/projects/demo', '/projects/demo/.runtime'));
});

test('R3 Project Timebase rejects Final SRT cues outside the Base Video', () => {
  const segments = parseSrt('1\n00:00:00,000 --> 00:00:01,000\n第一句\n\n2\n00:00:02,000 --> 00:00:04,000\n越界\n');
  assert.throws(
    () => validateMaterialTimebase({ videoDurationMs: 3000, segments }),
    (error) => error.code === 'FINAL_SRT_OUT_OF_VIDEO_RANGE',
  );
});

test('all registered HyperFrames assets have R3 taxonomy and global roles stay separate', () => {
  assert.equal(R3_REGISTERED_ASSETS.length, 19);
  assert.deepEqual(createR3AssetRecord('CMP-SUB-001').assetType, 'GLOBAL_COMPONENT');
  assert.deepEqual(createR3AssetRecord('CMP-CHP-001').category, 'CHAPTER_PROGRESS');
  assert.equal(R3_REGISTERED_ASSETS.filter((asset) => asset.assetType === 'COMPONENT_CARD').length, 17);
});
