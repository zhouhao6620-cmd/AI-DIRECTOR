import { MaterialPreparationError } from './material-error.js';
import { parseSrt } from './srt-contract.mjs';
import { createProjectTimebase } from './material-timebase.mjs';

const supportedVideoExtensions = new Set(['.mp4', '.mov', '.m4v']);

export async function validateBrowserMaterials({ baseVideoFile, finalSrtFile, aspectRatio } = {}) {
  const [video, subtitle] = await Promise.all([
    probeBrowserVideo(baseVideoFile),
    readBrowserFinalSrt(finalSrtFile),
  ]);
  const projectTimebase = createProjectTimebase({
    videoDurationMs: video.durationMs,
    fps: video.fps,
    segments: subtitle.segments,
  });
  const orientationMatchesProject = matchesProjectOrientation(aspectRatio, video);
  if (!orientationMatchesProject) {
    throw new MaterialPreparationError('BASE_VIDEO_ORIENTATION_MISMATCH', 'Base Video orientation does not match the project aspect ratio.', {
      recommendedAction: `Create a ${aspectRatio} project or choose a video with the matching orientation.`,
    });
  }
  return Object.freeze({
    baseVideo: video,
    finalSrt: subtitle,
    projectTimebase,
    orientationMatchesProject,
  });
}

export async function probeBrowserVideo(file) {
  if (!file || typeof file.name !== 'string') {
    throw new MaterialPreparationError('BASE_VIDEO_NOT_FOUND', 'Choose a Base Video before importing.', {
      recommendedAction: 'Choose an MP4, MOV, or M4V file.',
    });
  }
  const extension = extensionOf(file.name);
  if (!supportedVideoExtensions.has(extension)) {
    throw new MaterialPreparationError('BASE_VIDEO_TYPE_UNSUPPORTED', 'Base Video must be MP4, MOV, or M4V.', {
      recommendedAction: 'Replace the Base Video with a supported local video file.',
    });
  }
  if (!Number.isFinite(file.size) || file.size < 32) {
    throw new MaterialPreparationError('BASE_VIDEO_NOT_USABLE', 'Base Video must be a non-empty regular file.', {
      recommendedAction: 'Replace the Base Video with a readable video file.',
    });
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration * 1000) : null;
      const width = Number(video.videoWidth);
      const height = Number(video.videoHeight);
      if (!durationMs || !width || !height) {
        cleanup();
        reject(new MaterialPreparationError('BASE_VIDEO_NOT_USABLE', 'Base Video metadata could not be read.', {
          recommendedAction: 'Replace the Base Video with a readable MP4/MOV/M4V file.',
        }));
        return;
      }
      const result = {
        width,
        height,
        encodedWidth: width,
        encodedHeight: height,
        rotationDegrees: 0,
        durationMs,
        fps: null,
        sampleCount: null,
        actualAspectRatio: simplifyRatio(width, height),
        orientation: width >= height ? 'LANDSCAPE' : 'PORTRAIT',
        format: extension.slice(1).toUpperCase(),
        sizeBytes: file.size,
      };
      cleanup();
      resolve(result);
    };
    video.onerror = () => {
      cleanup();
      reject(new MaterialPreparationError('BASE_VIDEO_NOT_USABLE', 'Base Video metadata could not be read.', {
        recommendedAction: 'Replace the Base Video with a readable MP4/MOV/M4V file.',
      }));
    };
    video.src = objectUrl;
  });
}

export async function readBrowserFinalSrt(file, { maxBytes = 10 * 1024 * 1024 } = {}) {
  if (!file || typeof file.name !== 'string') {
    throw new MaterialPreparationError('FINAL_SRT_NOT_FOUND', 'Choose a Final SRT before importing.', {
      recommendedAction: 'Choose a valid UTF-8 .srt file.',
    });
  }
  if (extensionOf(file.name) !== '.srt') {
    throw new MaterialPreparationError('FINAL_SRT_TYPE_UNSUPPORTED', 'Final SRT must be an .srt file.', {
      recommendedAction: 'Replace the subtitle with a UTF-8 .srt file.',
    });
  }
  if (!Number.isFinite(file.size) || file.size === 0 || file.size > maxBytes) {
    throw new MaterialPreparationError('FINAL_SRT_NOT_USABLE', 'Final SRT must be a non-empty file no larger than 10 MB.', {
      recommendedAction: 'Replace the subtitle with a valid Final SRT.',
    });
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch (error) {
    throw new MaterialPreparationError('FINAL_SRT_ENCODING_INVALID', 'Final SRT must use valid UTF-8 text encoding.', {
      recommendedAction: 'Save the Final SRT as UTF-8 and retry.',
      cause: error,
    });
  }
  return { segments: parseSrt(text, { sourceRef: file.name }), sizeBytes: file.size };
}

export function matchesProjectOrientation(projectAspectRatio, { width, height } = {}) {
  if (!new Set(['9:16', '16:9']).has(projectAspectRatio) || !width || !height) return false;
  const sourceOrientation = width >= height ? 'LANDSCAPE' : 'PORTRAIT';
  const targetOrientation = projectAspectRatio === '16:9' ? 'LANDSCAPE' : 'PORTRAIT';
  return sourceOrientation === targetOrientation;
}

function extensionOf(fileName) {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot).toLowerCase();
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
