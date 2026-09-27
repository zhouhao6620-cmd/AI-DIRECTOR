export const R3_ASSET_TAXONOMY = Object.freeze({
  'CMP-PUN-001': ['COMPONENT_CARD', 'KEY_STATEMENT'],
  'CMP-QTE-001': ['COMPONENT_CARD', 'KEY_STATEMENT'],
  'CMP-SKL-001': ['COMPONENT_CARD', 'KEY_STATEMENT'],
  'CMP-TRM-001': ['COMPONENT_CARD', 'KEY_STATEMENT'],
  'CMP-TYP-001': ['COMPONENT_CARD', 'KEY_STATEMENT'],
  'CMP-DATA-002': ['COMPONENT_CARD', 'KPI_NUMBER'],
  'CMP-DATA-003': ['COMPONENT_CARD', 'KPI_NUMBER'],
  'CMP-DATA-005': ['COMPONENT_CARD', 'KPI_NUMBER'],
  'CMP-DATA-014': ['COMPONENT_CARD', 'KPI_NUMBER'],
  'CMP-DATA-001': ['COMPONENT_CARD', 'MULTI_POINT'],
  'CMP-ENT-001': ['COMPONENT_CARD', 'MULTI_POINT'],
  'CMP-CHK-001': ['COMPONENT_CARD', 'STEP_FLOW'],
  'CMP-STP-001': ['COMPONENT_CARD', 'STEP_FLOW'],
  'CMP-DATA-011': ['COMPONENT_CARD', 'COMPARISON'],
  'CMP-VRS-001': ['COMPONENT_CARD', 'COMPARISON'],
  'CMP-DATA-004': ['COMPONENT_CARD', 'DATA_CHART'],
  'CMP-DATA-006': ['COMPONENT_CARD', 'DATA_CHART'],
  'CMP-CHP-001': ['GLOBAL_COMPONENT', 'CHAPTER_PROGRESS'],
  'CMP-SUB-001': ['GLOBAL_COMPONENT', 'SUBTITLE'],
});

export function createR3AssetRecord(id, implementationVersion = '1.0.0-r3') {
  const classification = R3_ASSET_TAXONOMY[id];
  if (!classification) throw new Error(`Unknown R3 asset: ${id}`);
  const [assetType, category] = classification;
  return Object.freeze({
    assetId: id,
    assetType,
    category,
    status: 'REGISTERED',
    engine: 'HYPERFRAMES',
    implementationVersion,
    composition: `/assets/hyperframes/${id}.html`,
  });
}

export const R3_REGISTERED_ASSETS = Object.freeze(Object.keys(R3_ASSET_TAXONOMY).map((id) => createR3AssetRecord(id)));
