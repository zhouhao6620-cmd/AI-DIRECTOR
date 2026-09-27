import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

export class CodexCliAdapter {
  name = "codex-cli";

  constructor({ command = "codex", commandArgs = [], timeoutMs = 120_000 } = {}) {
    this.command = command;
    this.commandArgs = commandArgs;
    this.timeoutMs = timeoutMs;
  }

  async execute({ definition, request, inputPaths, projectRoot, correctionAttempts }) {
    const skillInstructions = await readFile(definition.skill.instructionPath, "utf8");
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "ai-video-codex-"));
    const outputPath = path.join(temporaryDirectory, "artifact.json");
    const readableInputPaths = definition.skill.readableInputIndexes
      ? definition.skill.readableInputIndexes.map((index) => inputPaths[index])
      : inputPaths;
    const prompt = [
      skillInstructions,
      "",
      "Runtime contract (authoritative for this run):",
      `- runId: ${request.runId}`,
      `- projectId: ${request.projectId}`,
      `- inputRevision: ${request.inputRevision}`,
      `- inputRefs: ${JSON.stringify(request.inputArtifactRefs)}`,
      `- absolute input paths to read: ${JSON.stringify(readableInputPaths)}`,
      `- correctionAttempt: ${correctionAttempts}`,
      "Follow the Project Skill's input-reading boundary. Input refs not listed as readable paths are traceability labels only.",
      "Return only one JSON object matching the provided output schema. Do not edit files.",
    ].join("\n");

    try {
      await runProcess(
        this.command,
        [
          ...this.commandArgs,
          "exec",
          "--ephemeral",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "--output-schema",
          definition.outputSchema,
          "--output-last-message",
          outputPath,
          "-",
        ],
        { cwd: projectRoot, input: prompt, timeoutMs: this.timeoutMs },
      );
      return { artifact: JSON.parse(await readFile(outputPath, "utf8")), modelVersion: "codex-cli-configured-model" };
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

function runProcess(command, args, { cwd, input, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Codex CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-12_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-12_000); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Codex CLI exited ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(input);
  });
}
