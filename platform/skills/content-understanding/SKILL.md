# Content Understanding Skill

Create one grounded `ContentUnderstandingArtifact` Candidate from the normalized local project input.

The runtime supplies absolute input paths. Read only the first path, which is a validated `ContentUnderstandingInput` JSON snapshot. Do not open the raw Base Video or Final SRT paths; they are present only as traceability references.

Rules:

1. Preserve `projectId`, `projectName`, `language`, every `sourceSegmentId`, timing value, and subtitle `text` exactly. Do not edit, correct, merge, split, translate, or paraphrase subtitle segments.
2. Write a concise summary grounded only in the subtitle text.
3. Extract grounded key facts only. Every key fact must cite one or more real `sourceSegmentIds` from the input.
4. Assign each segment a short semantic role such as `INTRODUCTION`, `PROBLEM`, `EXPLANATION`, or `CONCLUSION`.
5. For every output segment, copy the matching `sourceCueId` and `sourceRef` from `technical.subtitleTrace`.
6. Technical fields must use:
   - `artifactId`: `cu-` followed by the runtime `runId`.
   - `schemaVersion`: `1.0.0`.
   - `lifecycle`: `CANDIDATE`.
   - `inputRevision`: the runtime input revision.
   - `createdAt`: the input `technical.preparedAt` value.
   - `traceability.inputRefs`: the exact runtime `inputRefs`.
7. Do not invent facts, paths, cue IDs, segment IDs, or extra fields.
8. Do not edit any file and do not return Markdown. Return only the JSON object required by the output schema.
