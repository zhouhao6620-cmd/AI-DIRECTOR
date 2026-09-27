import { fileURLToPath } from "node:url";
import { CapabilityRegistry } from "./capability-registry.js";

export function createDefaultRegistry() {
  return new CapabilityRegistry().register({
    capabilityName: "content-understanding",
    description: "Validate Base Video and Final SRT input, then produce a traceable content-understanding Candidate.",
    skill: {
      name: "content-understanding-skill",
      version: "1.0.0",
      instructionPath: fileURLToPath(new URL("../skills/content-understanding/SKILL.md", import.meta.url)),
      mockModulePath: fileURLToPath(new URL("../skills/content-understanding/mock-implementation.js", import.meta.url)),
      readableInputIndexes: [0],
    },
    adapters: { real: "codex-cli", mock: "mock" },
    outputArtifactType: "ContentUnderstandingArtifact",
    outputSchema: fileURLToPath(new URL("../contracts/schemas/content-understanding-artifact.schema.json", import.meta.url)),
    maxCorrectionAttempts: 1,
  }).register({
    capabilityName: "test-content-understanding",
    description: "Read a source transcript fixture and produce a traceable content-understanding Candidate.",
    skill: {
      name: "test-content-understanding-skill",
      version: "1.0.0",
      instructionPath: fileURLToPath(new URL("../skills/test-content-understanding/SKILL.md", import.meta.url)),
      mockModulePath: fileURLToPath(new URL("../skills/test-content-understanding/mock-implementation.js", import.meta.url)),
    },
    adapters: { real: "codex-cli", mock: "mock" },
    outputArtifactType: "ContentUnderstandingArtifact",
    outputSchema: fileURLToPath(new URL("../contracts/schemas/content-understanding-artifact.schema.json", import.meta.url)),
    maxCorrectionAttempts: 1,
  });
}
