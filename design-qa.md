# M0-C Gold Master Design QA

**Date:** 2026-09-20  
**Final result:** passed

## Comparison targets

| Surface | Source truth | R3 implementation | State |
|---|---|---|---|
| Workbench / Material Preparation | `http://127.0.0.1:4174/` | `http://127.0.0.1:4173/` | Initial material preparation |
| Design Specification | `http://127.0.0.1:4174/design-spec.html` | `http://127.0.0.1:4173/design-spec.html` | Full page 01–06 |
| HyperFrames Asset Library | `http://127.0.0.1:3030/library/` | `http://127.0.0.1:4173/library/` | CMP-SKL-001 detail; player and Inspector |

Browser-rendered evidence is under `docs/evidence/m0-c-gold-master/`. Desktop comparison uses the same Codex in-app browser tab, the same 1440×960 viewport request, CSS pixel density 1, and the same initial state. The browser backend reported 1440×960 for the valid same-tab captures.

## Full-view comparison evidence

- Workbench: `source-workbench-same-tab.png` vs `r3-workbench-same-tab.png`; both 1440×960; SHA-1 identical.
- Design Specification: `source-design-spec-1440x960-full.png` vs `r3-design-spec-1440x960-full.png`; both 1270×4497 after full-page scrollbar normalization; SHA-1 identical.
- Asset Library: `source-library-same-tab.png` vs `r3-library-same-tab.png`; both 1440×960. Layout, type, colors, navigation, player chrome, metadata, component information and Inspector are visually identical. Raster hashes differ only because the HyperFrames timeline is live and the capture timestamp differs.

The source is a fixed desktop workbench shell with minimum-width behavior, not a mobile-responsive product surface. A mobile override was attempted, but the in-app browser backend retained a 1280×720 desktop viewport; no mobile-specific acceptance claim is made or required by the Gold Master.

## Focused comparison and interaction evidence

- Material Preparation: project-name input, 9:16 / 16:9 switch, Inspector collapse/reopen.
- Asset Library: core-data channel, component detail transition, real HyperFrames playback, Orange theme, safe-area overlay, position/size controls and 19-item navigation.
- Packaged build: `r3-packaged-library-4176-final.png`; direct resource inspection found no links to 4174, 3030 or the Legacy absolute source directories.

## Required fidelity surfaces

- Fonts and typography: exact source CSS and Lucide version 1.45.0 copied; hierarchy and wrapping match.
- Spacing and layout rhythm: exact source CSS and markup copied; Workbench and Design Specification raster evidence is pixel-identical.
- Colors and tokens: exact `styles.css`, library CSS and component-config CSS copied under R3-owned paths.
- Image quality and assets: all original component posters were copied locally; no hotlinks or replacements.
- Copy and content: full original visible copy retained, including all six design-spec sections and 19 asset entries.

## Findings

- No actionable P0/P1/P2 visual differences.
- The HyperFrames runtime emits the same non-blocking MutationObserver console message on both the source and R3 pages. Playback and configuration remain functional; this is inherited source/runtime behavior, not migration drift.

## Comparison history

1. Initial R3 player load failed because the Legacy development server had injected the HyperFrames runtime dynamically.
2. Fix: pre-injected the copied runtime into all 21 R3 project HTML files and moved runtime URLs to `/engine/hyperframes`.
3. Post-fix evidence: all 19 assets load, the player timeline runs, configuration patches apply, and the standalone `dist/` package passes.

## Implementation checklist

- [x] Direct source copy completed.
- [x] Gold Master visual parity checked.
- [x] Primary interactions checked.
- [x] Production build and standalone package checked.
- [x] Legacy path/port independence checked.
