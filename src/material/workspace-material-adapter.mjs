import { readFinalSrt } from './srt-parser.js';
import { matchesProjectOrientation, probeBaseVideo } from './media-probe.js';
import { createProjectTimebase } from './material-timebase.mjs';
import { resolveExistingWorkspacePath } from '../storage/workspace-boundary.mjs';

export async function readWorkspaceMaterials({ projectRoot, baseVideo, finalSrt, aspectRatio, mediaProbeOptions }) {
  const [baseVideoPath, finalSrtPath] = await Promise.all([
    resolveExistingWorkspacePath(projectRoot, baseVideo),
    resolveExistingWorkspacePath(projectRoot, finalSrt),
  ]);
  const [video, subtitle] = await Promise.all([
    probeBaseVideo(baseVideoPath, { sourceRef: `01_输入素材/${baseVideo}`, ...mediaProbeOptions }),
    readFinalSrt(finalSrtPath, { sourceRef: `01_输入素材/${finalSrt}` }),
  ]);
  return Object.freeze({
    baseVideo: video,
    finalSrt: subtitle,
    projectTimebase: createProjectTimebase({
      videoDurationMs: video.durationMs,
      fps: video.fps,
      segments: subtitle.segments,
    }),
    orientationMatchesProject: matchesProjectOrientation(aspectRatio, video),
  });
}
