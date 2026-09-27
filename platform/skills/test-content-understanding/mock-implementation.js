import { readFile } from "node:fs/promises";

export async function run({ request, inputPaths }) {
  const source = JSON.parse(await readFile(inputPaths[0], "utf8"));
  return {
    product: {
      projectId: source.projectId,
      projectName: source.projectName,
      language: source.language,
      summary: source.expectedSummary,
      keyFacts: source.expectedFacts,
      segments: source.segments.map((segment) => ({ ...segment })),
    },
    technical: {
      artifactId: `cu-${request.runId}`,
      schemaVersion: "1.0.0",
      lifecycle: "CANDIDATE",
      inputRevision: request.inputRevision,
      createdAt: source.observedAt,
      traceability: { inputRefs: [...request.inputArtifactRefs] },
    },
  };
}
