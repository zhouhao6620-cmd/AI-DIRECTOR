# Material + Content Understanding Integration

This module is the non-UI implementation behind Material Preparation and lifecycle Stage 2 Content Understanding.

## Public entry point

Call `createContentUnderstandingService({ projectRoot })`, then call `service.run(input, { mode, attempt })`.

The input contains `runId`, project identity/name, target canvas `aspectRatio` (`9:16` or `16:9`), a project-relative `baseVideoRef`, a project-relative `finalSrtRef`, and optional `language`, `inputRevision`, and `projectContext`. `aspectRatio` defines the default downstream packaging canvas, not an exact-ratio requirement for the source video.

The service:

1. records `PENDING`;
2. validates both local refs and file types;
3. reads display width/height (including rotation), actual ratio, duration, and low-cost FPS;
4. accepts any landscape source for a `16:9` target canvas and any portrait source for a `9:16` target canvas; an orientation conflict returns the backward-compatible `ASPECT_RATIO_MISMATCH` with exactly `CHANGE_PROJECT_ASPECT_RATIO` and `REPLACE_BASE_VIDEO`, without changing media;
5. parses but never edits SRT cues;
6. writes immutable ProjectConfig and normalized ContentUnderstandingInput snapshots;
7. calls `content-understanding` through Local Runtime and the Capability Registry;
8. validates and persists only a `CANDIDATE` through State Manager.

## UI wiring contract

The UI sends only business input to this service. It must not import a Skill path, prompt, model, or adapter. Poll/read `service.runtime.stateManager.readRunStatus({ projectId, runId })`; use its `uiStatus`, which is always one of `PENDING`, `RUNNING`, `SUCCESS`, or `FAILED` for this flow. On failure, display `issues[0].reason`, `issues[0].recommendedAction`, `retry`, and `uiError` when present.

Retries are caller-initiated and capped at two attempts. Each attempt uses a new `runId` and passes `attempt: 1` or `attempt: 2`. No automatic unbounded loop exists. A successful result includes `projectInput`, `stateRef`, and a schema-valid `ContentUnderstandingArtifact` whose lifecycle is `CANDIDATE`; the UI must not promote it automatically.

## Local browser bridge

`local-http-bridge.js` is the thin, local-only HTTP boundary used by the browser. It accepts multipart business input at `POST /api/content-understanding/runs`, stores the selected files under `.runtime/uploads`, then calls this module's public service. The browser polls `GET /api/content-understanding/runs/:runId`; a caller-initiated second attempt uses `POST /api/content-understanding/sessions/:sessionId/retry`.

The bridge owns generated project/run identities and enforces the two-attempt limit. It never exposes Skill paths, prompts, model names, adapter selection, or writable protected-state paths to React. The default development mode is the real Codex adapter. Set `CONTENT_UNDERSTANDING_MODE=mock` only for deterministic, no-egress UI smoke tests with the checked-in synthetic fixtures.

## Media probing

MP4, MOV, and M4V are accepted after checking both extension and ISO-BMFF structure. `ffprobe` is used when present; otherwise the built-in read-only MP4/MOV parser reads the video track, display rotation, timing table, duration, and FPS without decoding or converting the video.

## Verification

`npm run test:platform` covers the synthetic video/SRT, parsing, aspect conflict, bounded retry, process adapter boundary, Schema validation, and State Manager protection. `npm run smoke:platform` is deterministic. `npm run smoke:platform:real` invokes the locally authenticated Codex CLI and sends only the checked-in synthetic subtitle text, normalized synthetic metadata, and Project Skill instructions.
