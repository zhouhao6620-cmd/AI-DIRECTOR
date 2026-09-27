import { readFile } from "node:fs/promises";

export async function run({ request, inputPaths }) {
  const source = JSON.parse(await readFile(inputPaths[0], "utf8"));
  const traceBySegmentId = new Map(source.technical.subtitleTrace.map((trace) => [trace.sourceSegmentId, trace]));
  return {
    product: {
      projectId: source.product.projectId,
      projectName: source.product.projectName,
      language: source.product.language,
      summary: source.product.segments.map((segment) => segment.text).join(" "),
      keyFacts: [{ fact: source.product.segments[0].text, sourceSegmentIds: [source.product.segments[0].sourceSegmentId] }],
      segments: source.product.segments.map((segment, index, all) => ({
        ...segment,
        sourceCueId: traceBySegmentId.get(segment.sourceSegmentId).sourceCueId,
        sourceRef: traceBySegmentId.get(segment.sourceSegmentId).sourceRef,
        semanticRole: index === 0 ? "INTRODUCTION" : index === all.length - 1 ? "CONCLUSION" : "EXPLANATION",
      })),
    },
    technical: {
      artifactId: `cu-${request.runId}`,
      schemaVersion: "1.0.0",
      lifecycle: "CANDIDATE",
      inputRevision: request.inputRevision,
      createdAt: source.technical.preparedAt,
      traceability: { inputRefs: [...request.inputArtifactRefs] },
    },
  };
}
