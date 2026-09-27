import { assertSchema } from "../contracts/schema-validator.js";
import { loadArtifactSchema } from "../contracts/schema-registry.js";
import { projectProductionStateForRemotion } from "./production-projection.js";

// Preview and Render must call this same read-only projection. No renderer is implemented here.
export async function readProductionStateForRemotion(productionState, { renderTarget = "preview" } = {}) {
  const schema = await loadArtifactSchema("ProductionState");
  assertSchema(schema, productionState, "ProductionState");
  return projectProductionStateForRemotion(productionState, { renderTarget });
}
