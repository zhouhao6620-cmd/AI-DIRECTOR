# DIR-01 DirectorPlan Minimum Contract

Status: Implemented contract candidate. It becomes the shared M02 / G03 handoff only after the DIR-01 contract tests pass.

## User-visible result

AI Director reads the verified Content Understanding Artifact and produces one reviewable DirectorPlan Candidate. The page presents a Director Overview followed by chapters and shots. Each shot keeps the source subtitle trace, key message, director intent, visual strategy, character layout, component arrangement, and asset gaps.

AI output never enters packaging by itself. Director Critic may trigger at most one local correction. State Manager can move a plan to `READY_FOR_PACKAGING` only after Critic and executability pass and the user explicitly confirms it.

## Shared handoff

- Public capability: `director-storyboard-arrangement`
- Product Skill: `director-planning｜导演编排`
- Input artifact: `ContentUnderstandingArtifact`
- Output artifact: `DirectorPlan` with lifecycle `CANDIDATE`
- Component source: `component-capability-index.json`
- Global asset rule: read `technical.assetLibraryPolicy` from that index. It supplies the discovery fields, configuration order, default canvases, and the `PLAYER_CODE` preview rule. Do not request or play a stored preview video.
- Missing component behavior: leave `components` empty for the unmatched need and write `NEW_COMPONENT` or `AI_GENERATION` in `assetGaps`; never invent a Component ID.
- Critic is an internal quality step, not a new lifecycle stage or separate user-facing page.

## M02 boundary

M02 owns DirectorPlan generation, deterministic checks, Director Critic, at most one local correction, and executability reporting. It must call `assertDirectorPlanHandoff` before returning a Candidate. It must not edit UI files or promote protected state.

## G03 boundary

G03 renders the exact `DirectorPlan` shape. Mock data must validate against the same Schema. It may implement the frozen overview, chapter, shot, direct-edit, local-regenerate, save-draft, Codex-update, version-history, and confirm surfaces, but it must not embed Skill paths, prompts, model names, or a second page-specific data shape.

## Deliberate minimum

The production component index is intentionally empty until components complete the required Adapted → Validated → Registered lifecycle. Contract tests may inject isolated test entries, but production M02 may reference only `REGISTERED` entries from the supplied index. This avoids building the full Component Library before AI Director while keeping missing capabilities honest and visible.
