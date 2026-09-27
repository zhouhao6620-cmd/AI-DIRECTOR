import { spawn } from "node:child_process";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { MaterialPreparationError } from "./material-error.js";
import { probeIsoBmff } from "./mp4-probe.js";

const supportedExtensions = new Set([".mp4", ".mov", ".m4v"]);

export async function probeBaseVideo(filePath, { sourceRef, ffprobeCommand = "ffprobe" } = {}) {
  const extension = path.extname(filePath).toLowerCase();
  if (!supportedExtensions.has(extension)) {
    throw new MaterialPreparationError("BASE_VIDEO_TYPE_UNSUPPORTED", "Base video must be MP4, MOV, or M4V.", {
      recommendedAction: "Replace the base video with a supported local video file.",
    });
  }
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    throw new MaterialPreparationError("BASE_VIDEO_NOT_FOUND", `Base video does not exist: ${sourceRef ?? filePath}`, {
      recommendedAction: "Choose an existing local base video and retry.",
      cause: error,
    });
  }
  if (!fileStat.isFile() || fileStat.size < 32) {
    throw new MaterialPreparationError("BASE_VIDEO_NOT_USABLE", "Base video must be a non-empty regular file.", {
      recommendedAction: "Replace the base video with a readable MP4, MOV, or M4V file.",
    });
  }
  await assertIsoBmffSignature(filePath);

  let metadata;
  try {
    metadata = ffprobeCommand === false ? await probeIsoBmff(filePath) : await probeWithFfprobe(ffprobeCommand, filePath);
  } catch (error) {
    if (ffprobeCommand !== false && (error.code === "ENOENT" || error.code === "FFPROBE_FAILED")) {
      metadata = await probeIsoBmff(filePath);
    } else {
      throw error;
    }
  }
  const actualAspectRatio = simplifyRatio(metadata.width, metadata.height);
  return {
    ...metadata,
    actualAspectRatio,
    orientation: metadata.width >= metadata.height ? "LANDSCAPE" : "PORTRAIT",
    format: extension.slice(1).toUpperCase(),
    sizeBytes: fileStat.size,
  };
}

export function matchesProjectOrientation(projectAspectRatio, { width, height }) {
  if (!new Set(["9:16", "16:9"]).has(projectAspectRatio) || !width || !height) return false;
  const sourceOrientation = width >= height ? "LANDSCAPE" : "PORTRAIT";
  const targetOrientation = projectAspectRatio === "16:9" ? "LANDSCAPE" : "PORTRAIT";
  return sourceOrientation === targetOrientation;
}

export const matchesProjectAspectRatio = matchesProjectOrientation;

async function assertIsoBmffSignature(filePath) {
  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 12 || header.toString("ascii", 4, 8) !== "ftyp") {
      throw new MaterialPreparationError("BASE_VIDEO_TYPE_INVALID", "Base video extension does not match readable MP4/MOV media.", {
        recommendedAction: "Replace the base video with a valid MP4, MOV, or M4V file.",
      });
    }
  } finally {
    await handle.close();
  }
}

function probeWithFfprobe(command, filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,avg_frame_rate,duration:stream_tags=rotate:stream_side_data=rotation:format=duration",
      "-of", "json", filePath,
    ], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-64_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-12_000); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        const error = new Error(`ffprobe failed: ${stderr || `exit ${code}`}`);
        error.code = "FFPROBE_FAILED";
        reject(error);
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        const stream = parsed.streams?.[0];
        const encodedWidth = Number(stream?.width);
        const encodedHeight = Number(stream?.height);
        const durationSeconds = Number(stream?.duration ?? parsed.format?.duration);
        const fps = parseRate(stream?.avg_frame_rate);
        const rawRotation = stream?.side_data_list?.find((entry) => Number.isFinite(Number(entry.rotation)))?.rotation ?? stream?.tags?.rotate ?? 0;
        const rotationDegrees = normalizeRotation(Number(rawRotation));
        const quarterTurn = rotationDegrees === 90 || rotationDegrees === 270;
        if (!encodedWidth || !encodedHeight || !durationSeconds) throw new Error("missing video stream metadata");
        resolve({
          width: quarterTurn ? encodedHeight : encodedWidth,
          height: quarterTurn ? encodedWidth : encodedHeight,
          encodedWidth,
          encodedHeight,
          rotationDegrees,
          durationMs: Math.round(durationSeconds * 1000),
          fps,
          sampleCount: null,
        });
      } catch (cause) {
        reject(new MaterialPreparationError("BASE_VIDEO_NOT_USABLE", "Base video metadata could not be read.", {
          recommendedAction: "Replace the base video with a readable MP4, MOV, or M4V file.", cause,
        }));
      }
    });
  });
}

function parseRate(rate) {
  if (!rate) return null;
  const [numerator, denominator] = String(rate).split("/").map(Number);
  const value = denominator ? numerator / denominator : numerator;
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(3)) : null;
}

function normalizeRotation(value) {
  if (!Number.isFinite(value)) return 0;
  const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  return new Set([0, 90, 180, 270]).has(normalized) ? normalized : 0;
}

function simplifyRatio(width, height) {
  const divisor = greatestCommonDivisor(Math.round(width), Math.round(height));
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`;
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
