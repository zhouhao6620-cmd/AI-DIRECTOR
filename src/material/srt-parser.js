import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { MaterialPreparationError } from "./material-error.js";
import { parseSrt } from "./srt-contract.mjs";

export async function readFinalSrt(filePath, { sourceRef, maxBytes = 10 * 1024 * 1024 } = {}) {
  if (path.extname(filePath).toLowerCase() !== ".srt") {
    throw new MaterialPreparationError("FINAL_SRT_TYPE_UNSUPPORTED", "Final subtitle must be an .srt file.", {
      recommendedAction: "Replace the final subtitle with a UTF-8 .srt file.",
    });
  }
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    throw new MaterialPreparationError("FINAL_SRT_NOT_FOUND", `Final SRT does not exist: ${sourceRef ?? filePath}`, {
      recommendedAction: "Choose an existing local .srt file and retry.",
      cause: error,
    });
  }
  if (!fileStat.isFile() || fileStat.size === 0 || fileStat.size > maxBytes) {
    throw new MaterialPreparationError("FINAL_SRT_NOT_USABLE", "Final SRT must be a non-empty regular file no larger than 10 MB.", {
      recommendedAction: "Replace the subtitle with a valid final SRT file.",
    });
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(filePath));
  } catch (error) {
    throw new MaterialPreparationError("FINAL_SRT_ENCODING_INVALID", "Final SRT must use valid UTF-8 text encoding.", {
      recommendedAction: "Save the final subtitle as UTF-8 SRT and retry.",
      cause: error,
    });
  }
  return {
    segments: parseSrt(text, { sourceRef }),
    sizeBytes: fileStat.size,
  };
}

export { parseSrt } from "./srt-contract.mjs";
