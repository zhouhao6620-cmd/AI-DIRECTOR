import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContentUnderstandingService } from "../material/content-understanding-service.js";

const platformRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectRoot = path.dirname(platformRoot);
const modeArgument = process.argv.find((argument) => argument.startsWith("--adapter="));
const mode = modeArgument?.split("=")[1] ?? "mock";
if (!new Set(["mock", "real"]).has(mode)) throw new Error("--adapter must be mock or real");

const runId = process.env.AI_VIDEO_RUN_ID ?? `smoke-${mode}-${Date.now()}`;
const storageRoot = path.join(projectRoot, ".runtime", `smoke-${mode}`);
const inputStorageRoot = path.join(projectRoot, ".runtime", "smoke-inputs");
const service = createContentUnderstandingService({ projectRoot, storageRoot, inputStorageRoot });
const input = {
  runId,
  projectId: "content-understanding-smoke",
  projectName: "Synthetic Content Understanding Smoke",
  aspectRatio: "16:9",
  language: "zh-CN",
  baseVideoRef: "platform/fixtures/content-understanding/base-video.mp4",
  finalSrtRef: "platform/fixtures/content-understanding/final.srt",
  inputRevision: "synthetic-v1",
  preparedAt: "2026-09-14T00:00:00.000Z",
  projectContext: {
    baselineRef: "../00_CURRENT_BASELINE_INDEX.md",
    frozenRulesRef: "../08_AI_CAPABILITY_RUNTIME_BASELINE.md"
  }
};

const result = await service.run(input, { mode, attempt: 1 });
if (result.status !== "SUCCESS") {
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
} else {
  const persisted = JSON.parse(await readFile(result.stateRef.path, "utf8"));
  const evidence = {
    verifiedAt: new Date().toISOString(),
    chain: ["LocalRuntime", "CapabilityRegistry", result.metadata.adapter, "ProjectSkill", "SchemaValidation", "CandidateArtifact", "StateManager"],
    privacy: "The real adapter authorizes Codex to read only the normalized synthetic subtitle/metadata snapshot; raw video/SRT refs remain traceability labels. No user material is used.",
    input,
    result,
    persistedCandidateReadable: persisted.artifact.technical.artifactId === result.artifact.technical.artifactId,
  };
  const evidenceDirectory = path.join(projectRoot, ".runtime", "evidence");
  await mkdir(evidenceDirectory, { recursive: true });
  const evidencePath = path.join(evidenceDirectory, `${runId}.json`);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: "PASS", mode, runId, evidencePath, statePath: result.stateRef.path }, null, 2)}\n`);
}
