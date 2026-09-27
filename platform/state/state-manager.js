import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSchema } from "../contracts/schema-validator.js";
import { loadArtifactSchema } from "../contracts/schema-registry.js";

const protectedLifecycles = new Set(["CONFIRMED", "READY_FOR_PACKAGING", "FROZEN"]);

export class StateTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = "StateTransitionError";
  }
}

export class StateManager {
  constructor({ storageRoot }) {
    this.storageRoot = path.resolve(storageRoot);
  }

  async submitCandidate({ artifactType, artifact, runId }) {
    const schema = await loadArtifactSchema(artifactType);
    assertSchema(schema, artifact, artifactType);
    if (artifact.technical.lifecycle !== "CANDIDATE") {
      throw new StateTransitionError("Skill output must enter State Manager as CANDIDATE");
    }

    const identity = getIdentity(artifactType, artifact);
    const record = {
      artifactType,
      runId,
      persistedAt: new Date().toISOString(),
      artifact,
    };
    const target = this.#recordPath(artifact.product.projectId, artifactType, identity, "CANDIDATE");
    await writeImmutableJson(target, record);
    return { projectId: artifact.product.projectId, artifactType, identity, lifecycle: "CANDIDATE", path: target };
  }

  async recordRunStatus({ request, status, issues = [], retry = defaultRetry(), uiError = null }) {
    const allowed = new Set(["PENDING", "RUNNING", "SUCCESS", "NEEDS_FIX", "BLOCKED", "FAILED"]);
    if (!allowed.has(status)) throw new Error(`Unsupported run status: ${status}`);
    const target = path.join(
      this.storageRoot,
      safePathPart(request.projectId),
      "runs",
      safePathPart(request.runId),
      `${status}.json`,
    );
    await writeImmutableJson(target, {
      runId: request.runId,
      projectId: request.projectId,
      capabilityName: request.capabilityName,
      inputRevision: request.inputRevision,
      status,
      uiStatus: toUiStatus(status),
      issues,
      retry,
      uiError,
      recordedAt: new Date().toISOString(),
    });
    return target;
  }

  async readRunStatus({ projectId, runId }) {
    const directory = path.join(this.storageRoot, safePathPart(projectId), "runs", safePathPart(runId));
    const filenames = await readdir(directory);
    const records = await Promise.all(
      filenames.filter((filename) => filename.endsWith(".json")).map(async (filename) => JSON.parse(await readFile(path.join(directory, filename), "utf8"))),
    );
    records.sort((left, right) => {
      const timeDifference = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
      return timeDifference || statusOrder(left.status) - statusOrder(right.status);
    });
    return records.at(-1);
  }

  async promote({ stateRef, targetLifecycle, authorization = {} }) {
    if (!protectedLifecycles.has(targetLifecycle)) {
      throw new StateTransitionError(`Unsupported protected lifecycle: ${targetLifecycle}`);
    }
    const source = await this.read(stateRef);
    const current = source.artifact.technical.lifecycle;
    assertTransition(current, targetLifecycle, stateRef.artifactType, source.artifact, authorization);

    const promoted = structuredClone(source.artifact);
    promoted.technical.lifecycle = targetLifecycle;
    const schema = await loadArtifactSchema(stateRef.artifactType);
    assertSchema(schema, promoted, stateRef.artifactType);

    const target = this.#recordPath(
      stateRef.projectId,
      stateRef.artifactType,
      stateRef.identity,
      targetLifecycle,
    );
    await writeImmutableJson(target, {
      artifactType: stateRef.artifactType,
      promotedAt: new Date().toISOString(),
      promotedFrom: stateRef.path,
      authorization: sanitizeAuthorization(authorization),
      artifact: promoted,
    });
    return { ...stateRef, lifecycle: targetLifecycle, path: target };
  }

  async read(stateRef) {
    const resolved = path.resolve(stateRef.path);
    if (!isInside(this.storageRoot, resolved)) throw new Error("State reference escapes storage root");
    return JSON.parse(await readFile(resolved, "utf8"));
  }

  #recordPath(projectId, artifactType, identity, lifecycle) {
    const safeParts = [projectId, artifactType, identity, lifecycle].map(safePathPart);
    return path.join(this.storageRoot, safeParts[0], safeParts[1], safeParts[2], `${safeParts[3]}.json`);
  }
}

function getIdentity(artifactType, artifact) {
  if (artifactType === "ProductionState") return artifact.technical.stateId;
  if (artifactType === "ExportRecord") return artifact.technical.exportId;
  if (artifactType === "ProjectConfig") return artifact.product.projectId;
  return artifact.technical.artifactId;
}

function assertTransition(current, target, artifactType, artifact, authorization) {
  if (current === "FROZEN") throw new StateTransitionError("FROZEN state is immutable");
  if (target === "CONFIRMED") {
    if (current !== "CANDIDATE" || authorization.actor !== "USER" || authorization.userConfirmed !== true) {
      throw new StateTransitionError("CANDIDATE may become CONFIRMED only after explicit user confirmation");
    }
    return;
  }
  if (target === "READY_FOR_PACKAGING") {
    if (artifactType !== "DirectorPlan" || current !== "CONFIRMED") {
      throw new StateTransitionError("READY_FOR_PACKAGING is available only to a CONFIRMED DirectorPlan");
    }
    if (
      authorization.actor !== "USER" ||
      authorization.userConfirmed !== true ||
      artifact.technical.critic.status !== "PASSED" ||
      artifact.technical.executabilityPassed !== true
    ) {
      throw new StateTransitionError("DirectorPlan requires user confirmation, passed Critic, and executability check");
    }
    return;
  }
  if (target === "FROZEN" && authorization.baselineChangeApproved !== true) {
    throw new StateTransitionError("FROZEN requires explicit baseline change approval");
  }
}

function sanitizeAuthorization(authorization) {
  return {
    actor: authorization.actor ?? null,
    userConfirmed: authorization.userConfirmed === true,
    baselineChangeApproved: authorization.baselineChangeApproved === true,
  };
}

async function writeImmutableJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await readFile(target);
    throw new StateTransitionError(`Immutable state already exists: ${target}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, target);
}

function safePathPart(value) {
  const text = String(value);
  if (!/^[A-Za-z0-9._-]+$/.test(text)) throw new Error(`Unsafe state identity: ${text}`);
  return text;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function toUiStatus(status) {
  return new Set(["NEEDS_FIX", "BLOCKED"]).has(status) ? "FAILED" : status;
}

function statusOrder(status) {
  return ["PENDING", "RUNNING", "NEEDS_FIX", "BLOCKED", "FAILED", "SUCCESS"].indexOf(status);
}

function defaultRetry() {
  return { retryable: false, attempt: 1, maxAttempts: 2, remainingAttempts: 0 };
}
