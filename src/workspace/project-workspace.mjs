import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { WORKSPACE_DIRECTORIES } from '../storage/workspace-boundary.mjs';
import { readWorkspaceMaterials } from '../material/workspace-material-adapter.mjs';
import { readFinalSrt } from '../material/srt-parser.js';
import { matchesProjectOrientation, probeBaseVideo } from '../material/media-probe.js';
import { createProjectTimebase } from '../material/material-timebase.mjs';

function safeName(value) {
  const name = String(value).trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
  if (!name) throw new Error('Project name is required.');
  return name.slice(0, 80);
}

export async function createProjectWorkspace({ projectsRoot, projectName, aspectRatio }) {
  if (!['16:9', '9:16'].includes(aspectRatio)) throw new Error('Project aspect ratio must be 16:9 or 9:16.');
  const projectId = `r3-${randomUUID()}`;
  const root = path.resolve(projectsRoot);
  const projectRoot = path.join(root, `${safeName(projectName)}-${projectId.slice(-8)}`);
  await mkdir(projectRoot, { recursive: false });
  await Promise.all(WORKSPACE_DIRECTORIES.map((directory) => mkdir(path.join(projectRoot, directory))));
  const project = { projectId, projectName: safeName(projectName), aspectRatio, schemaVersion: '1.0.0', createdAt: new Date().toISOString() };
  await writeFile(path.join(projectRoot, 'project.json'), `${JSON.stringify(project, null, 2)}\n`, { flag: 'wx' });
  return Object.freeze({ projectRoot, project });
}

export async function importProjectInputs({ projectRoot, baseVideoPath, finalSrtPath, mediaProbeOptions }) {
  const inputRoot = path.join(projectRoot, '01_输入素材');
  const baseVideo = path.basename(baseVideoPath);
  const finalSrt = path.basename(finalSrtPath);
  if (!baseVideo || !finalSrt) throw new Error('Both Base Video and Final SRT are required.');

  const project = JSON.parse(await readFile(path.join(projectRoot, 'project.json'), 'utf8'));
  const [sourceVideo, sourceSrt] = await Promise.all([
    probeBaseVideo(baseVideoPath, { sourceRef: baseVideo, ...mediaProbeOptions }),
    readFinalSrt(finalSrtPath, { sourceRef: finalSrt }),
  ]);
  const sourceTimebase = createProjectTimebase({
    videoDurationMs: sourceVideo.durationMs,
    fps: sourceVideo.fps,
    segments: sourceSrt.segments,
  });
  if (!matchesProjectOrientation(project.aspectRatio, sourceVideo)) {
    throw new Error('Base Video orientation does not match the project aspect ratio.');
  }

  const targetVideo = path.join(inputRoot, baseVideo);
  const targetSrt = path.join(inputRoot, finalSrt);
  await Promise.all([copyFile(baseVideoPath, targetVideo, constants.COPYFILE_EXCL), copyFile(finalSrtPath, targetSrt, constants.COPYFILE_EXCL)]);
  const material = await readWorkspaceMaterials({ projectRoot, baseVideo, finalSrt, aspectRatio: project.aspectRatio, mediaProbeOptions });
  const verifiedProject = {
    ...project,
    materialPreparation: {
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      baseVideo: {
        path: `01_输入素材/${baseVideo}`,
        durationMs: material.baseVideo.durationMs,
        width: material.baseVideo.width,
        height: material.baseVideo.height,
        fps: material.baseVideo.fps,
      },
      finalSrt: {
        path: `01_输入素材/${finalSrt}`,
        segmentCount: material.finalSrt.segments.length,
        endMs: material.projectTimebase.subtitleEndMs,
      },
      projectTimebase: material.projectTimebase,
    },
  };
  await writeFile(path.join(projectRoot, 'project.json'), `${JSON.stringify(verifiedProject, null, 2)}\n`);
  return Object.freeze({ baseVideo, finalSrt, material, project: verifiedProject, sourceTimebase });
}
