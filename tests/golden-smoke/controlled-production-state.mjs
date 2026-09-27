import { R3_REGISTERED_ASSETS } from '../../src/asset-library/r3-asset-registry.mjs';
import { HYPERFRAMES_VERSION } from '../../src/hyperframes-foundation/runtime/runtime-resolver.mjs';

const assetById = new Map(R3_REGISTERED_ASSETS.map((asset) => [asset.assetId, asset]));

const EXPECTED_FINAL_SRT = Object.freeze([
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
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function registeredAsset(id) {
  const asset = assetById.get(id);
  assert(asset, `Controlled Golden Smoke references an unknown R3 asset: ${id}`);
  return {
    assetId: asset.assetId,
    assetType: asset.assetType,
    category: asset.category,
    implementationVersion: asset.implementationVersion,
  };
}

function projectDraft(id, category, purpose) {
  return {
    assetId: id,
    assetType: 'PROJECT_DRAFT',
    category,
    status: 'CONTROLLED_SIMULATION_ONLY',
    engine: 'HYPERFRAMES',
    implementationVersion: '0.1.0-golden-smoke',
    purpose,
  };
}

export const GOLDEN_SMOKE_CONTROLLED_PRODUCTION_STATE = deepFreeze({
  simulation: {
    kind: 'CONTROLLED_SIMULATION',
    authority: 'NON_FORMAL_TEST_FIXTURE',
    purpose: 'Confirm the approved DirectorPlan against the real Base Video and Final SRT through local HyperFrames webpage preview.',
    formalProductArtifact: false,
    exportAllowed: false,
  },
  project: {
    id: 'GOLDEN_SMOKE_PROJECT_001',
    canvas: '16:9',
  },
  productionInputSnapshot: {
    directorPlanVersion: 'GOLDEN_SMOKE_DIRECTORPLAN_V1_CONFIRMED',
    finalSrt: {
      sourceReference: 'AKK-CH02-subs-1.35x.srt',
      cueCount: 15,
      startMs: 0,
      endMs: 29096,
    },
    baseVideo: {
      sourceReference: 'AKK-CH02-raw-135.mp4',
      durationMs: 29360,
      width: 1872,
      height: 1080,
      fps: 25,
    },
    themePreset: {
      reference: 'GOLDEN_SMOKE_SCIENCE_EXPLAINER_DRAFT',
      status: 'CONTROLLED_SIMULATION_VISUAL_DNA',
      backgroundMusic: 'OFF',
    },
    materials: [],
    references: [],
    selectedEngine: {
      name: 'HYPERFRAMES',
      version: HYPERFRAMES_VERSION,
    },
  },
  productionState: {
    status: 'CONTROLLED_SIMULATION_PRODUCTION_COMPLETED_PENDING_ACCEPTANCE',
    executionUnit: 'THEME_CHAPTER',
    executionOrder: ['CH-01', 'CH-02'],
    chapters: [
      {
        id: 'CH-01',
        title: '问题重构：从减脂困扰到肠道屏障',
        timeRange: [0, 7200],
        shots: [
          {
            id: 'S-01',
            timeRange: [0, 2904],
            sourceSegmentIds: ['srt-0001', 'srt-0002'],
            characterStrategy: '人物主体',
            screenLayout: 'Full Screen + right Overlay',
            componentSlot: { id: 'slot-s01-card', instance: 'card-s01', asset: registeredAsset('CMP-TYP-001') },
          },
          {
            id: 'S-02',
            timeRange: [2904, 7200],
            sourceSegmentIds: ['srt-0003', 'srt-0004'],
            characterStrategy: '小框人物',
            screenLayout: 'Main Visual + PIP',
            componentSlot: {
              id: 'slot-s02-card',
              instance: 'card-s02',
              asset: projectDraft('PD-GOLDEN-S02-BARRIER-RELATION', 'RELATIONSHIP', 'Express the approved “gut barrier as wall” visual metaphor without importing an unrelated external asset.'),
            },
          },
        ],
      },
      {
        id: 'CH-02',
        title: '阿克曼菌的四项作用',
        timeRange: [7348, 29096],
        shots: [
          {
            id: 'S-03',
            timeRange: [7348, 13600],
            sourceSegmentIds: ['srt-0005', 'srt-0006', 'srt-0007'],
            characterStrategy: '小框人物',
            screenLayout: 'Left / Right Split',
            componentSlot: { id: 'slot-s03-card', instance: 'card-s03', asset: registeredAsset('CMP-DATA-001') },
          },
          {
            id: 'S-04',
            timeRange: [13600, 20326],
            sourceSegmentIds: ['srt-0008', 'srt-0009', 'srt-0010', 'srt-0011'],
            characterStrategy: '小框人物',
            screenLayout: 'Top / Bottom Split',
            componentSlot: {
              id: 'slot-s04-card',
              instance: 'card-s04',
              asset: projectDraft('PD-GOLDEN-S04-SCFA-FLOW', 'FLOW_RELATIONSHIP', 'Express the approved short-chain-fatty-acid one-to-two flow without forcing it into an inexact generic step list.'),
            },
          },
          {
            id: 'S-05',
            timeRange: [20326, 26015],
            sourceSegmentIds: ['srt-0012', 'srt-0013', 'srt-0014'],
            characterStrategy: '小框人物',
            screenLayout: 'Main Visual + PIP',
            componentSlot: { id: 'slot-s05-card', instance: 'card-s05', asset: registeredAsset('CMP-STP-001') },
          },
          {
            id: 'S-06',
            timeRange: [26015, 29096],
            sourceSegmentIds: ['srt-0015'],
            characterStrategy: '人物主体',
            screenLayout: 'Full Screen + lower Overlay',
            componentSlot: { id: 'slot-s06-card', instance: 'card-s06', asset: registeredAsset('CMP-PUN-001') },
          },
        ],
      },
    ],
    globalPackaging: {
      subtitle: { enabled: true, instance: 'subtitle', asset: registeredAsset('CMP-SUB-001') },
      chapterProgress: { enabled: true, instance: 'chapter-progress', asset: registeredAsset('CMP-CHP-001') },
    },
    assetChangeLedger: {
      reusedRegisteredAssets: ['CMP-SUB-001', 'CMP-CHP-001', 'CMP-TYP-001', 'CMP-DATA-001', 'CMP-STP-001', 'CMP-PUN-001'],
      reusedJobLocalComponents: [],
      generatedProjectDrafts: [
        projectDraft('PD-GOLDEN-S02-BARRIER-RELATION', 'RELATIONSHIP', 'Source-faithful “gut barrier as wall” relationship visual.'),
        projectDraft('PD-GOLDEN-S04-SCFA-FLOW', 'FLOW_RELATIONSHIP', 'Source-faithful short-chain-fatty-acid one-to-two flow visual.'),
      ],
      assetCandidates: [],
    },
    preview: {
      kind: 'LOCAL_HYPERFRAMES_WEBPAGE',
      readOnly: true,
      generatedMediaFiles: false,
      entry: 'tests/golden-smoke/hyperframes-web-preview.mjs',
    },
  },
});

export function validateGoldenSmokeFinalSrt(segments) {
  assert(Array.isArray(segments), 'Final SRT segments must be an array.');
  assert(segments.length === EXPECTED_FINAL_SRT.length, `Expected ${EXPECTED_FINAL_SRT.length} Final SRT cues, received ${segments.length}.`);

  for (const [index, [startMs, endMs, text]] of EXPECTED_FINAL_SRT.entries()) {
    const segment = segments[index];
    assert(segment.startMs === startMs && segment.endMs === endMs, `Final SRT cue ${index + 1} timing diverged from the approved source.`);
    assert(segment.text === text, `Final SRT cue ${index + 1} text diverged from the approved source.`);
  }
  return deepFreeze({ cueCount: segments.length, startMs: segments[0].startMs, endMs: segments.at(-1).endMs });
}

export function createGoldenSmokePreviewInstances(segments) {
  validateGoldenSmokeFinalSrt(segments);
  const subtitleCues = segments.map((segment, index) => ({
    id: `cue-${String(index + 1).padStart(4, '0')}`,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
  }));

  return deepFreeze({
    subtitle: {
      asset: registeredAsset('CMP-SUB-001'),
      variables: { variant: 'ZH_ONLY', showTranslation: false, stroke: true, accent: '#f0a24f', size: 0.86, duration: 29.36, 'position-x': 0.5, 'position-y': 1 },
      content: { cues: subtitleCues },
    },
    'chapter-progress': {
      asset: registeredAsset('CMP-CHP-001'),
      variables: { surface: 'DARK', variant: 'LINE', showProgress: true, accent: '#f0a24f', size: 1, duration: 29.36, 'position-x': 0.5, 'position-y': 0 },
      content: {
        chapters: [
          { id: 'chapter-01', label: '问题与肠道屏障', startMs: 0, endMs: 7200 },
          { id: 'chapter-02', label: '阿克曼菌的四项作用', startMs: 7348, endMs: 29096 },
        ],
      },
    },
    'card-s01': {
      asset: registeredAsset('CMP-TYP-001'),
      variables: { surface: 'DARK', accent: '#f0a24f', background: 'GLASS', glassAlpha: 0.62, size: 0.72, duration: 3 },
      content: { lines: ['为什么节食总反弹？', '肚子上的肉还特别难减？'] },
    },
    'card-s02': {
      asset: projectDraft('PD-GOLDEN-S02-BARRIER-RELATION', 'RELATIONSHIP', 'Source-faithful “gut barrier as wall” relationship visual.'),
      variables: { accent: '#70c9bc', size: 0.76, duration: 4.3 },
      content: { qualifier: '很可能跟肠道屏障有关', title: '肠道屏障', metaphor: '把它想成肠道里的一道“城墙”' },
    },
    'card-s03': {
      asset: registeredAsset('CMP-DATA-001'),
      variables: { surface: 'DARK', accent: '#f0a24f', align: 'RIGHT', stepMs: 420, size: 0.86, duration: 6.25, 'position-x': 1, 'position-y': 0.35 },
      content: { title: '阿克曼菌主要做四件事', subtitle: '1 / 4 · 修补城墙', items: [{ id: 'endotoxin', label: '不让内毒素进入血液' }] },
    },
    'card-s04': {
      asset: projectDraft('PD-GOLDEN-S04-SCFA-FLOW', 'FLOW_RELATIONSHIP', 'Source-faithful short-chain-fatty-acid one-to-two flow visual.'),
      variables: { accent: '#70c9bc', size: 0.72, duration: 6.73 },
      content: { title: '2 / 4 · 分解黏液', source: '产生短链脂肪酸', outcomes: ['给肠道细胞提供能量', '传递代谢信号'] },
    },
    'card-s05': {
      asset: registeredAsset('CMP-STP-001'),
      variables: { surface: 'DARK', accent: '#70c9bc', revealed: 2, stepMs: 300, size: 0.74, duration: 5.69 },
      content: { title: '3 / 4 · 刺激身体分泌 GLP1', steps: [{ id: 'signal', label: '也就是饱腹激素信号' }, { id: 'satiety', label: '让你更容易觉得吃饱了' }] },
    },
    'card-s06': {
      asset: registeredAsset('CMP-PUN-001'),
      variables: { surface: 'DARK', accent: '#f0a24f', size: 0.9, duration: 3.08, 'position-x': 0.5, 'position-y': 0.75 },
      content: { text: '第四 调节参与脂肪代谢的胆汁酸' },
    },
  });
}

export function validateControlledProductionState(state = GOLDEN_SMOKE_CONTROLLED_PRODUCTION_STATE) {
  assert(state?.simulation?.kind === 'CONTROLLED_SIMULATION', 'The fixture must remain explicitly marked as a controlled simulation.');
  assert(state.simulation.formalProductArtifact === false, 'The fixture must not claim a formal product artifact.');
  assert(state.simulation.exportAllowed === false, 'The fixture must not authorize export.');
  assert(state.productionInputSnapshot.finalSrt.cueCount === EXPECTED_FINAL_SRT.length, 'The fixture must consume all approved Final SRT cues.');
  assert(state.productionInputSnapshot.baseVideo.durationMs === 29360, 'The fixture must retain the verified Base Video duration.');
  assert(state.productionInputSnapshot.selectedEngine.version === HYPERFRAMES_VERSION, 'The fixture must use the approved HyperFrames version.');
  assert(state.productionState.executionUnit === 'THEME_CHAPTER', 'Intelligent Editing execution must remain Chapter-level.');
  assert(state.productionState.chapters.length === 2, 'The approved structure has exactly two Theme Chapters.');
  const shots = state.productionState.chapters.flatMap((chapter) => chapter.shots);
  assert(shots.length === 6, 'The approved structure has exactly six Director Shots.');
  assert(shots.every((shot) => shot.componentSlot?.asset?.assetId), 'Every Director Shot must have an identifiable component slot.');
  const reused = state.productionState.assetChangeLedger.reusedRegisteredAssets;
  assert(reused.every((assetId) => assetById.has(assetId)), 'Only R3 REGISTERED assets may be reused by this controlled simulation.');
  const drafts = state.productionState.assetChangeLedger.generatedProjectDrafts;
  assert(drafts.length === 2, 'The simulation must generate only the two semantically unmatched Project DRAFTs.');
  assert(drafts.every((draft) => draft.assetType === 'PROJECT_DRAFT' && draft.engine === 'HYPERFRAMES'), 'Generated drafts must remain HyperFrames Project DRAFTs.');
  assert(state.productionState.assetChangeLedger.assetCandidates.length === 0, 'The simulation may not create Asset Candidates.');
  assert(state.productionState.preview.generatedMediaFiles === false, 'The simulation must not generate media files.');
  assert(!JSON.stringify(state).includes('/Users/'), 'The fixture must not persist a machine-local input path.');
  return deepFreeze({ chapters: state.productionState.chapters.length, shots: shots.length, reusedRegisteredAssets: reused.length, generatedProjectDrafts: drafts.length });
}
