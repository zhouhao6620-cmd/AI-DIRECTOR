import path from "node:path";
import { MockAdapter } from "../adapters/mock-adapter.js";
import { CodexCliAdapter } from "../adapters/codex-cli-adapter.js";
import { StateManager } from "../state/state-manager.js";
import { createDefaultRegistry } from "./default-registry.js";
import { LocalRuntime } from "./local-runtime.js";

export function createRuntime({ projectRoot, storageRoot = path.join(projectRoot, ".runtime", "project-state"), codex = {} }) {
  return new LocalRuntime({
    projectRoot,
    registry: createDefaultRegistry(),
    stateManager: new StateManager({ storageRoot }),
    adapters: {
      mock: new MockAdapter(),
      "codex-cli": new CodexCliAdapter(codex),
    },
  });
}
