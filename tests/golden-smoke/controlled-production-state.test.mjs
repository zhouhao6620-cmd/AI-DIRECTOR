import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GOLDEN_SMOKE_CONTROLLED_PRODUCTION_STATE,
  createGoldenSmokePreviewInstances,
  validateControlledProductionState,
  validateGoldenSmokeFinalSrt,
} from './controlled-production-state.mjs';

const finalSrtSegments = [
  [0, 1452, '为什么节食总反弹？'],
  [1452, 2904, '肚子上的肉还特别难减？'],
  [2904, 5037, '很可能跟肠道屏障有关'],
  [5037, 7200, '把它想成肠道里的一道城墙就行'],
  [7348, 9274, '阿克曼菌主要做四件事'],
  [9274, 10874, '第一 修补城墙'],
  [10874, 13600, '不让会引起炎症的内毒素进入血液'],
  [13600, 15052, '第二 分解黏液'],
  [15052, 16504, '产生短链脂肪酸'],
  [17067, 18726, '它能给肠道细胞提供能量'],
  [18726, 20326, '也能传递代谢信号'],
  [20326, 22785, '第三 刺激身体分泌GLP1'],
  [22785, 24326, '也就是饱腹激素信号'],
  [24326, 26015, '让你更容易觉得吃饱了'],
  [26015, 29096, '第四 调节参与脂肪代谢的胆汁酸'],
].map(([startMs, endMs, text], index) => ({ sourceSegmentId: `srt-${String(index + 1).padStart(4, '0')}`, startMs, endMs, text }));

test('controlled Golden Smoke ProductionState stays non-formal, Chapter-level, and export-free', () => {
  assert.deepEqual(validateControlledProductionState(), { chapters: 2, shots: 6, reusedRegisteredAssets: 6, generatedProjectDrafts: 2 });
  assert.equal(GOLDEN_SMOKE_CONTROLLED_PRODUCTION_STATE.productionState.assetChangeLedger.generatedProjectDrafts.length, 2);
});

test('preview configuration consumes the exact approved Final SRT and only registered R3 assets', () => {
  assert.deepEqual(validateGoldenSmokeFinalSrt(finalSrtSegments), { cueCount: 15, startMs: 0, endMs: 29096 });
  const instances = createGoldenSmokePreviewInstances(finalSrtSegments);
  assert.equal(instances.subtitle.content.cues.length, 15);
  assert.equal(instances['chapter-progress'].content.chapters.length, 2);
  assert.deepEqual(Object.values(instances).map((instance) => instance.asset.assetId).sort(), [
    'CMP-CHP-001',
    'CMP-DATA-001',
    'CMP-PUN-001',
    'CMP-STP-001',
    'CMP-SUB-001',
    'CMP-TYP-001',
    'PD-GOLDEN-S02-BARRIER-RELATION',
    'PD-GOLDEN-S04-SCFA-FLOW',
  ]);
});
