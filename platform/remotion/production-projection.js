// Browser and Node use this same read-only projection after validating the state.
export function projectProductionStateForRemotion(productionState, { renderTarget = "preview" } = {}) {
  const allowedTargets = ["preview", "full-video", "character-layout-overlay", "motion"];
  if (!allowedTargets.includes(renderTarget)) throw new Error(`Unsupported render target: ${renderTarget}`);
  return Object.freeze({
    renderTarget,
    compositionProps: structuredClone(productionState.product),
    compositionMetadata: {
      fps: productionState.technical.fps,
      durationInFrames: productionState.technical.durationInFrames,
      width: productionState.technical.width,
      height: productionState.technical.height,
      directorPlanVersion: productionState.technical.directorPlanVersion,
      productionStateVersion: productionState.technical.revision,
    },
  });
}
