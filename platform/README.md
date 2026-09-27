# Shared Platform Foundation

This directory is the single shared engineering boundary for the AI video pipeline. It intentionally contains no Workbench visual implementation, production logic, Remotion implementation, rendering, export execution, database, authentication, or cloud service.

## Stable boundaries

- `contracts/`: JSON contracts and validation. Every domain artifact separates `product` from `technical` fields.
- `state/`: the only supported writer for Candidate and promoted project state.
- `runtime/`: Local Runtime, Capability Registry, and adapter selection.
- `adapters/`: interchangeable Mock and Codex CLI execution behind one contract.
- `skills/`: project-owned capability instructions and deterministic test implementation.
- `remotion/`: read-only Preview/Render projection from one `ProductionState`.
- `smoke/`: a repeatable end-to-end test capability.

The Workbench may call only `capabilityName`. It must not import skill paths, prompts, model names, or adapters.

The first real domain chain is documented in [`material/README.md`](material/README.md). It accepts a local Base Video plus Final SRT and produces a traceable `ContentUnderstandingArtifact` Candidate without changing either source file.

## Verification

```sh
npm run test:platform
npm run smoke:platform
npm run smoke:platform:real
```

The first command covers contracts, protected state transitions, adapter replacement, and failure paths. The deterministic smoke test is free and repeatable. The real smoke test invokes the locally authenticated Codex CLI, reads the same fixture, validates the same schema, and writes through the same State Manager.
