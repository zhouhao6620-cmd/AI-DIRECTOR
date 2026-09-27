import { validateBrowserMaterials } from '../material/browser-material-adapter.mjs';

export const BROWSER_WORKSPACE_DIRECTORIES = Object.freeze(['01_输入素材', '02_导演计划', '03_项目实现', '04_导出成片']);

export function supportsProjectsRootPicker() {
  return typeof globalThis.showDirectoryPicker === 'function';
}

export async function chooseProjectsRoot() {
  if (!supportsProjectsRootPicker()) {
    throw new Error('This browser does not support a writable ProjectsRoot picker. Open R3 in a Chromium browser on localhost.');
  }
  return globalThis.showDirectoryPicker({ mode: 'readwrite' });
}

export async function createBrowserProjectWorkspace({ projectsRootHandle, projectName, aspectRatio } = {}) {
  if (!projectsRootHandle) throw new Error('ProjectsRoot must be selected before creating a project.');
  if (!['16:9', '9:16'].includes(aspectRatio)) throw new Error('Project aspect ratio must be 16:9 or 9:16.');

  const cleanName = safeName(projectName);
  const projectId = `r3-${createUuid()}`;
  const folderName = `${cleanName}-${projectId.slice(-8)}`;
  const projectHandle = await projectsRootHandle.getDirectoryHandle(folderName, { create: true });
  for (const directory of BROWSER_WORKSPACE_DIRECTORIES) {
    await projectHandle.getDirectoryHandle(directory, { create: true });
  }

  const project = Object.freeze({
    projectId,
    projectName: cleanName,
    aspectRatio,
    schemaVersion: '1.0.0',
    createdAt: new Date().toISOString(),
  });
  await writeJson(projectHandle, 'project.json', project);
  return Object.freeze({ projectHandle, folderName, project });
}

export async function importBrowserProjectInputs({ projectHandle, project, baseVideoFile, finalSrtFile } = {}) {
  if (!projectHandle || !project) throw new Error('Create a Project Workspace before importing materials.');
  const material = await validateBrowserMaterials({ baseVideoFile, finalSrtFile, aspectRatio: project.aspectRatio });
  const inputHandle = await projectHandle.getDirectoryHandle('01_输入素材');
  await assertFileDoesNotExist(inputHandle, baseVideoFile.name);
  await assertFileDoesNotExist(inputHandle, finalSrtFile.name);
  await writeInputFile(inputHandle, baseVideoFile);
  await writeInputFile(inputHandle, finalSrtFile);

  const verifiedProject = {
    ...project,
    materialPreparation: materialRecord(material, baseVideoFile.name, finalSrtFile.name),
  };
  await writeJson(projectHandle, 'project.json', verifiedProject, { replace: true });
  return Object.freeze({ baseVideo: baseVideoFile.name, finalSrt: finalSrtFile.name, material, project: verifiedProject });
}

export async function listBrowserWorkspaceEntries(projectHandle) {
  const entries = [];
  for await (const [name, handle] of projectHandle.entries()) entries.push({ name, kind: handle.kind });
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

async function writeInputFile(inputHandle, file) {
  const fileHandle = await inputHandle.getFileHandle(file.name, { create: true });
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  try {
    await writable.write(file);
  } finally {
    await writable.close();
  }
}

async function writeJson(projectHandle, fileName, value, { replace = false } = {}) {
  let fileHandle;
  if (replace) {
    fileHandle = await projectHandle.getFileHandle(fileName);
  } else {
    fileHandle = await projectHandle.getFileHandle(fileName, { create: true });
  }
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  try {
    await writable.write(`${JSON.stringify(value, null, 2)}\n`);
  } finally {
    await writable.close();
  }
}

async function assertFileDoesNotExist(directoryHandle, fileName) {
  try {
    await directoryHandle.getFileHandle(fileName);
  } catch (error) {
    if (error?.name === 'NotFoundError') return;
    throw error;
  }
  throw new Error(`Input already exists in 01_输入素材: ${fileName}`);
}

function materialRecord(material, baseVideo, finalSrt) {
  return {
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
  };
}

function safeName(value) {
  const name = String(value ?? '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
  if (!name) throw new Error('Project name is required.');
  return name.slice(0, 80);
}

function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
}
