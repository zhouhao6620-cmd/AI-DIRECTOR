import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSchema } from "../contracts/schema-validator.js";
import { loadArtifactSchema } from "../contracts/schema-registry.js";
import { resolveProjectRef } from "../runtime/path-boundary.js";
import { probeBaseVideo, matchesProjectOrientation } from "./media-probe.js";
import { MaterialPreparationError } from "./material-error.js";
import { readFinalSrt } from "./srt-parser.js";

export class ProjectInputStore {
  constructor({ projectRoot, storageRoot = path.join(projectRoot, ".runtime", "project-inputs"), mediaProbeOptions = {} }) {
    this.projectRoot = path.resolve(projectRoot);
    this.storageRoot = path.resolve(storageRoot);
    const storageRelative = path.relative(this.projectRoot, this.storageRoot);
    if (storageRelative.startsWith("..") || path.isAbsolute(storageRelative)) {
      throw new Error("Project input storage must stay inside the project root");
    }
    this.mediaProbeOptions = mediaProbeOptions;
  }

  async prepare({
    projectId,
    projectName,
    aspectRatio,
    baseVideoRef,
    finalSrtRef,
    language = "und",
    inputRevision,
    preparedAt = new Date().toISOString(),
  }) {
    assertProjectFields({ projectId, projectName, aspectRatio, baseVideoRef, finalSrtRef, language });
    let baseVideoPath;
    let finalSrtPath;
    try {
      baseVideoPath = resolveProjectRef(this.projectRoot, baseVideoRef);
      finalSrtPath = resolveProjectRef(this.projectRoot, finalSrtRef);
    } catch (error) {
      throw new MaterialPreparationError("INPUT_REFERENCE_INVALID", error.message, {
        recommendedAction: "Choose source files inside the current project and retry.", cause: error,
      });
    }

    const [baseVideoMetadata, subtitle] = await Promise.all([
      probeBaseVideo(baseVideoPath, { sourceRef: baseVideoRef, ...this.mediaProbeOptions }),
      readFinalSrt(finalSrtPath, { sourceRef: finalSrtRef }),
    ]);
    if (!matchesProjectOrientation(aspectRatio, baseVideoMetadata)) {
      throw aspectRatioConflict(aspectRatio, baseVideoMetadata.actualAspectRatio);
    }

    const revision = inputRevision ?? deriveRevision({ projectId, projectName, aspectRatio, baseVideoRef, finalSrtRef, baseVideoMetadata, subtitle });
    assertSafePart(revision, "inputRevision");
    const projectConfig = {
      product: { projectId, projectName, aspectRatio },
      technical: {
        schemaVersion: "1.0.0",
        lifecycle: "CANDIDATE",
        revision,
        sourceFiles: { baseVideo: baseVideoRef, finalSrt: finalSrtRef },
      },
    };
    const contentUnderstandingInput = {
      product: {
        projectId,
        projectName,
        aspectRatio,
        language,
        segments: subtitle.segments.map(({ sourceSegmentId, startMs, endMs, text }) => ({ sourceSegmentId, startMs, endMs, text })),
      },
      technical: {
        schemaVersion: "1.0.0",
        inputRevision: revision,
        preparedAt,
        sourceFiles: { baseVideo: baseVideoRef, finalSrt: finalSrtRef },
        baseVideoMetadata,
        subtitleTrace: subtitle.segments.map(({ sourceSegmentId, sourceCueId, sourceRef }) => ({ sourceSegmentId, sourceCueId, sourceRef })),
      },
    };
    assertSchema(await loadArtifactSchema("ProjectConfig"), projectConfig, "ProjectConfig");
    assertSchema(await loadArtifactSchema("ContentUnderstandingInput"), contentUnderstandingInput, "ContentUnderstandingInput");

    const directory = path.join(this.storageRoot, safePart(projectId), safePart(revision));
    const projectConfigPath = path.join(directory, "project-config.json");
    const contentInputPath = path.join(directory, "content-understanding-input.json");
    await mkdir(directory, { recursive: true });
    await writeIdempotentJson(projectConfigPath, projectConfig);
    await writeIdempotentJson(contentInputPath, contentUnderstandingInput);
    return {
      projectConfig,
      contentUnderstandingInput,
      projectConfigRef: toProjectRef(this.projectRoot, projectConfigPath),
      contentInputRef: toProjectRef(this.projectRoot, contentInputPath),
      inputRevision: revision,
    };
  }
}

function assertProjectFields(values) {
  for (const key of ["projectId", "projectName", "baseVideoRef", "finalSrtRef", "language"]) {
    if (typeof values[key] !== "string" || values[key].trim() === "") {
      throw new MaterialPreparationError("PROJECT_INPUT_INVALID", `${key} is required.`, { retryable: true });
    }
  }
  assertSafePart(values.projectId, "projectId");
  if (!new Set(["9:16", "16:9"]).has(values.aspectRatio)) {
    throw new MaterialPreparationError("PROJECT_ASPECT_RATIO_UNSUPPORTED", "Project aspect ratio must be 9:16 or 16:9.", {
      recommendedAction: "Choose 9:16 or 16:9 and retry.",
    });
  }
}

function aspectRatioConflict(projectAspectRatio, actualAspectRatio) {
  return new MaterialPreparationError(
    "ASPECT_RATIO_MISMATCH",
    `Project canvas ${projectAspectRatio} does not match the base video orientation (${actualAspectRatio}).`,
    {
      recommendedAction: "Change the project canvas orientation or replace the base video; no crop, stretch, or conversion was applied.",
      ui: {
        title: "项目画布方向与基础视频不一致",
        description: `项目为 ${projectAspectRatio}，视频为${orientationLabel(actualAspectRatio)}。系统未裁切、拉伸或转换视频。`,
        actions: [
          { type: "CHANGE_PROJECT_ASPECT_RATIO", label: "修改项目画幅" },
          { type: "REPLACE_BASE_VIDEO", label: "替换基础视频" }
        ]
      }
    },
  );
}

function orientationLabel(actualAspectRatio) {
  const [width, height] = String(actualAspectRatio).split(":").map(Number);
  return width >= height ? `横屏（实际比例 ${actualAspectRatio}）` : `竖屏（实际比例 ${actualAspectRatio}）`;
}

function deriveRevision(value) {
  return `input-${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)}`;
}

async function writeIdempotentJson(target, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await writeFile(target, serialized, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = JSON.parse(await readFile(target, "utf8"));
    const comparableExisting = structuredClone(existing);
    const comparableNew = structuredClone(value);
    if (comparableExisting.technical?.preparedAt && comparableNew.technical?.preparedAt) {
      comparableNew.technical.preparedAt = comparableExisting.technical.preparedAt;
    }
    if (JSON.stringify(comparableExisting) !== JSON.stringify(comparableNew)) {
      throw new MaterialPreparationError("INPUT_REVISION_CONFLICT", "The same input revision already points to different source data.", {
        retryable: false,
        recommendedAction: "Create a new input revision for the changed source files.",
      });
    }
  }
}

function toProjectRef(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function assertSafePart(value, name) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(value))) {
    throw new MaterialPreparationError("PROJECT_INPUT_INVALID", `${name} contains unsupported characters.`, {
      recommendedAction: `Use letters, numbers, dots, underscores, or hyphens for ${name}.`,
    });
  }
}

function safePart(value) {
  assertSafePart(value, "path identity");
  return String(value);
}
