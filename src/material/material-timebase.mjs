import { MaterialPreparationError } from './material-error.js';

const DEFAULT_TOLERANCE_MS = 40;

export function validateMaterialTimebase({ videoDurationMs, segments, toleranceMs = DEFAULT_TOLERANCE_MS } = {}) {
  const duration = Number(videoDurationMs);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new MaterialPreparationError('PROJECT_TIMEBASE_INVALID', 'Base video duration is not available for timebase validation.', {
      recommendedAction: 'Replace the base video with a readable file and retry.',
    });
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new MaterialPreparationError('PROJECT_TIMEBASE_INVALID', 'Final SRT has no timing segments for timebase validation.', {
      recommendedAction: 'Choose a non-empty Final SRT and retry.',
    });
  }

  const first = segments[0];
  const last = segments.at(-1);
  const outOfRange = segments.find((segment) => segment.startMs < 0 || segment.endMs > duration + toleranceMs);
  if (outOfRange) {
    throw new MaterialPreparationError(
      'FINAL_SRT_OUT_OF_VIDEO_RANGE',
      `Final SRT timing exceeds the Base Video duration at ${outOfRange.sourceSegmentId}: ${outOfRange.endMs}ms > ${duration}ms.`,
      {
        recommendedAction: 'Choose the Final SRT that belongs to this Base Video; Stage 1 does not guess or rewrite timing.',
      },
    );
  }

  return Object.freeze({
    videoDurationMs: duration,
    subtitleStartMs: first.startMs,
    subtitleEndMs: last.endMs,
    trailingGapMs: Math.max(0, duration - last.endMs),
    segmentCount: segments.length,
  });
}

export function createProjectTimebase({ videoDurationMs, fps, segments } = {}) {
  const timing = validateMaterialTimebase({ videoDurationMs, segments });
  const normalizedFps = Number.isFinite(Number(fps)) && Number(fps) > 0 ? Number(fps) : null;
  return Object.freeze({
    ...timing,
    fps: normalizedFps,
    frameDurationMs: normalizedFps ? Number((1000 / normalizedFps).toFixed(6)) : null,
    frameCount: normalizedFps ? Math.ceil((timing.videoDurationMs / 1000) * normalizedFps) : null,
  });
}
