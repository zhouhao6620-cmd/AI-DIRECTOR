import { assertSchema } from "../contracts/schema-validator.js";
import { loadArtifactSchema, loadContractSchema } from "../contracts/schema-registry.js";
import { resolveProjectRef } from "./path-boundary.js";

export class LocalRuntime {
  constructor({ projectRoot, registry, stateManager, adapters }) {
    this.projectRoot = projectRoot;
    this.registry = registry;
    this.stateManager = stateManager;
    this.adapters = adapters;
  }

  async queueCapability(request, { retryContext = defaultRetry() } = {}) {
    const requestSchema = await loadContractSchema("CapabilityRequest");
    assertSchema(requestSchema, request, "CapabilityRequest");
    return this.stateManager.recordRunStatus({ request, status: "PENDING", retry: retryContext });
  }

  async failQueuedCapability(request, {
    adapter = "not-started",
    type,
    reason,
    recommendedAction,
    retryContext = defaultRetry(),
    uiError = null,
  }) {
    const result = failureResult(request, adapter, type, reason, 0, "FAILED", retryContext, recommendedAction);
    return this.#finish(request, result, { retryContext, uiError });
  }

  async runCapability(request, { mode = "real", queued = false, retryContext = defaultRetry() } = {}) {
    const requestSchema = await loadContractSchema("CapabilityRequest");
    assertSchema(requestSchema, request, "CapabilityRequest");
    if (!queued) await this.stateManager.recordRunStatus({ request, status: "PENDING", retry: retryContext });
    await this.stateManager.recordRunStatus({ request, status: "RUNNING", retry: retryContext });
    let definition;
    try {
      definition = this.registry.resolve(request.capabilityName);
    } catch (error) {
      return this.#finish(request, failureResult(request, mode, "CAPABILITY_NOT_REGISTERED", error.message, 0, "FAILED", noRetry(retryContext)));
    }
    if (request.requestedOutputSchema !== definition.outputArtifactType) {
      return this.#finish(request, failureResult(request, mode, "SCHEMA_MISMATCH", "Requested output schema does not match capability registration", 0, "FAILED", noRetry(retryContext)));
    }

    let inputPaths;
    try {
      inputPaths = request.inputArtifactRefs.map((reference) => resolveProjectRef(this.projectRoot, reference));
    } catch (error) {
      return this.#finish(request, failureResult(request, mode, "INPUT_REFERENCE_INVALID", error.message, 0, "FAILED", retryContext));
    }
    const adapterName = definition.adapters[mode];
    const adapter = this.adapters[adapterName];
    if (!adapter) return this.#finish(request, failureResult(request, adapterName, "ADAPTER_NOT_AVAILABLE", `Adapter is not available: ${adapterName}`, 0, "FAILED", retryContext));

    let correctionAttempts = 0;
    let adapterOutput;
    let validation;
    do {
      try {
        adapterOutput = await adapter.execute({ definition, request, inputPaths, projectRoot: this.projectRoot, correctionAttempts });
      } catch (error) {
        return this.#finish(request, failureResult(request, adapterName, "ADAPTER_EXECUTION_FAILED", error.message, correctionAttempts, "FAILED", retryContext));
      }
      const outputSchema = await loadArtifactSchema(definition.outputArtifactType);
      try {
        assertSchema(outputSchema, adapterOutput.artifact, definition.outputArtifactType);
        validation = { valid: true };
      } catch (error) {
        validation = { valid: false, error };
      }
      if (!validation.valid && correctionAttempts < definition.maxCorrectionAttempts) correctionAttempts += 1;
      else break;
    } while (true);

    if (!validation.valid) {
      return this.#finish(request, failureResult(
        request,
        adapterName,
        "SCHEMA_VALIDATION_FAILED",
        validation.error.message,
        correctionAttempts,
        "NEEDS_FIX",
        retryContext,
      ));
    }

    let stateRef;
    try {
      stateRef = await this.stateManager.submitCandidate({
        artifactType: definition.outputArtifactType,
        artifact: adapterOutput.artifact,
        runId: request.runId,
      });
    } catch (error) {
      return this.#finish(request, failureResult(request, adapterName, "STATE_WRITE_FAILED", error.message, correctionAttempts, "FAILED", retryContext));
    }
    const result = {
      runId: request.runId,
      capabilityName: request.capabilityName,
      status: "SUCCESS",
      artifact: adapterOutput.artifact,
      issues: [],
      metadata: {
        adapter: adapterName,
        skillVersion: definition.skill.version,
        modelVersion: adapterOutput.modelVersion ?? null,
        inputRevision: request.inputRevision,
        correctionAttempts,
      },
      retry: noRetry(retryContext),
    };
    const resultSchema = await loadContractSchema("CapabilityResult");
    assertSchema(resultSchema, result, "CapabilityResult");
    return this.#finish(request, { ...result, stateRef });
  }

  async #finish(request, result, { retryContext = result.retry ?? defaultRetry(), uiError = null } = {}) {
    const resultSchema = await loadContractSchema("CapabilityResult");
    const contractResult = Object.fromEntries(
      ["runId", "capabilityName", "status", "artifact", "issues", "metadata", "retry"].map((key) => [key, result[key]]),
    );
    assertSchema(resultSchema, contractResult, "CapabilityResult");
    const status = result.status === "NEEDS_FIX" ? "NEEDS_FIX" : result.status;
    const runStatusPath = await this.stateManager.recordRunStatus({ request, status, issues: result.issues, retry: retryContext, uiError });
    return { ...result, uiStatus: status === "NEEDS_FIX" || status === "BLOCKED" ? "FAILED" : status, uiError, runStatusPath };
  }
}

function failureResult(request, adapter, type, reason, correctionAttempts = 0, status = "FAILED", retry = defaultRetry(), recommendedAction) {
  return {
    runId: request.runId,
    capabilityName: request.capabilityName,
    status,
    artifact: null,
    issues: [{ type, reason, recommendedAction: recommendedAction ?? "Inspect the capability run evidence and retry after correcting the input or adapter." }],
    metadata: {
      adapter,
      skillVersion: "unknown",
      modelVersion: null,
      inputRevision: request.inputRevision,
      correctionAttempts,
    },
    retry,
  };
}

function defaultRetry() {
  return { retryable: false, attempt: 1, maxAttempts: 2, remainingAttempts: 0 };
}

function noRetry(retry) {
  return { ...retry, retryable: false, remainingAttempts: 0 };
}
