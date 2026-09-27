# Test Content Understanding Skill

You are the minimum real capability used to verify the shared AI video pipeline foundation.

Read the first absolute input path supplied by the runtime. It is a JSON transcript fixture. Produce one `ContentUnderstandingArtifact` that exactly follows the supplied JSON Schema.

Rules:

1. Preserve the fixture's `projectId`, `projectName`, `language`, segment IDs, cue IDs, source refs, timing, and transcript text.
2. Write a concise summary grounded only in the source text.
3. Extract at least one grounded key fact and cite one or more real fixture segment IDs.
4. Give each segment a short semantic role such as `INTRODUCTION`, `PROBLEM`, `EXPLANATION`, or `CONCLUSION`.
5. Technical fields must use:
   - `artifactId`: `cu-` followed by the runtime `runId`.
   - `schemaVersion`: `1.0.0`.
   - `lifecycle`: `CANDIDATE`.
   - `inputRevision`: the runtime input revision.
   - `createdAt`: the fixture `observedAt` value.
   - `traceability.inputRefs`: the exact runtime `inputRefs`.
6. Do not invent facts, paths, segment IDs, or extra fields.
7. Do not edit any file and do not return Markdown.
