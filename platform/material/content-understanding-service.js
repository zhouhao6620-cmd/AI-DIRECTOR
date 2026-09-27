import path from "node:path";
import { createRuntime } from "../runtime/create-runtime.js";
import { asMaterialError, MaterialPreparationError } from "./material-error.js";
import { ProjectInputStore } from "./project-input-store.js";

export function createContentUnderstandingService({
  projectRoot,
  storageRoot = path.join(projectRoot, ".runtime", "project-state"),
  inputStorageRoot = path.join(projectRoot, ".runtime", "project-inputs"),
  codex = {},
  mediaProbeOptions = {},
  maxAttempts = 2,
} = {}) {
  const runtime = createRuntime({ projectRoot, storageRoot, codex });
  return new ContentUnderstandingService({
    runtime,
    inputStore: new ProjectInputStore({ projectRoot, storageRoot: inputStorageRoot, mediaProbeOptions }),
    maxAttempts,
  });
}

export class ContentUnderstandingService {
  constructor({ runtime, inputStore, maxAttempts = 2 }) {
    this.runtime = runtime;
    this.inputStore = inputStore;
    this.maxAttempts = maxAttempts;
  }

  async run(input, { mode = "real", attempt = 1 } = {}) {
    assertAttempt(attempt, this.maxAttempts);
    const statusRequest = makeRequest(input, {
      inputArtifactRefs: [input.baseVideoRef ?? "missing-base-video", input.finalSrtRef ?? "missing-final-srt"],
      inputRevision: input.inputRevision ?? "unresolved",
    });
    const retryContext = retryForAttempt(attempt, this.maxAttempts, true);
    await this.runtime.queueCapability(statusRequest, { retryContext });

    let prepared;
    try {
      prepared = await this.inputStore.prepare(input);
    } catch (error) {
      const materialError = asMaterialError(error);
      return this.runtime.failQueuedCapability(statusRequest, {
        adapter: "not-started",
        type: materialError.code,
        reason: materialError.message,
        recommendedAction: materialError.recommendedAction,
        retryContext: retryForAttempt(attempt, this.maxAttempts, materialError.retryable),
        uiError: materialError.ui,
      });
    }

    const request = makeRequest(input, {
      inputArtifactRefs: [prepared.contentInputRef, prepared.projectConfigRef, input.baseVideoRef, input.finalSrtRef],
      inputRevision: prepared.inputRevision,
    });
    const result = await this.runtime.runCapability(request, {
      mode,
      queued: true,
      retryContext,
    });
    return { ...result, projectInput: prepared };
  }
}

function makeRequest(input, { inputArtifactRefs, inputRevision }) {
  return {
    runId: input.runId,
    projectId: input.projectId,
    capabilityName: "content-understanding",
    inputArtifactRefs,
    projectContext: input.projectContext ?? {},
    requestedOutputSchema: "ContentUnderstandingArtifact",
    inputRevision,
  };
}

function retryForAttempt(attempt, maxAttempts, retryable) {
  const canRetry = retryable && attempt < maxAttempts;
  return {
    retryable: canRetry,
    attempt,
    maxAttempts,
    remainingAttempts: canRetry ? maxAttempts - attempt : 0,
  };
}

function assertAttempt(attempt, maxAttempts) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new MaterialPreparationError("RETRY_ATTEMPT_INVALID", "Retry attempt must be a positive integer.", { retryable: false });
  }
  if (attempt > maxAttempts) {
    throw new MaterialPreparationError("RETRY_LIMIT_REACHED", `Retry limit reached (${maxAttempts} attempts).`, {
      retryable: false,
      recommendedAction: "Start a new run only after changing the failed input or environment.",
    });
  }
}
