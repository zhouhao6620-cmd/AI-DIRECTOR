import { fileURLToPath } from "node:url";
import { loadSchema } from "./schema-validator.js";

const schemaDirectory = new URL("./schemas/", import.meta.url);

export const artifactSchemaFiles = Object.freeze({
  ProjectConfig: "project-config.schema.json",
  ContentUnderstandingInput: "content-understanding-input.schema.json",
  ContentUnderstandingArtifact: "content-understanding-artifact.schema.json",
  ComponentCapabilityIndex: "component-capability-index.schema.json",
  DirectorPlan: "director-plan.schema.json",
  ProductionState: "production-state.schema.json",
  ExportRecord: "export-record.schema.json",
});

export function schemaPath(schemaName) {
  const filename = artifactSchemaFiles[schemaName] ?? `${schemaName}.schema.json`;
  return fileURLToPath(new URL(filename, schemaDirectory));
}

export async function loadArtifactSchema(artifactType) {
  const filename = artifactSchemaFiles[artifactType];
  if (!filename) throw new Error(`Unknown artifact schema: ${artifactType}`);
  return loadSchema(new URL(filename, schemaDirectory));
}

export async function loadContractSchema(contractName) {
  const files = {
    CapabilityRequest: "capability-request.schema.json",
    CapabilityResult: "capability-result.schema.json",
  };
  if (!files[contractName]) throw new Error(`Unknown contract schema: ${contractName}`);
  return loadSchema(new URL(files[contractName], schemaDirectory));
}
