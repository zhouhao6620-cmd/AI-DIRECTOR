import path from 'node:path';
import { realpath } from 'node:fs/promises';

export const WORKSPACE_DIRECTORIES = Object.freeze(['01_输入素材', '02_导演计划', '03_项目实现', '04_导出成片']);

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertExternalRoot(projectRoot, externalRoot, label) {
  const project = path.resolve(projectRoot);
  const external = path.resolve(externalRoot);
  if (contains(project, external) || contains(external, project)) {
    throw new Error(`${label} must be physically outside the Project Workspace.`);
  }
  return external;
}

export function resolveWorkspacePath(projectRoot, reference, { area = '01_输入素材' } = {}) {
  if (!WORKSPACE_DIRECTORIES.includes(area)) throw new Error(`Unknown Workspace area: ${area}`);
  const root = path.resolve(projectRoot);
  const areaRoot = path.resolve(root, area);
  const resolved = path.resolve(areaRoot, reference);
  const relative = path.relative(areaRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Workspace reference escapes ${area}: ${reference}`);
  }
  return resolved;
}

export async function resolveExistingWorkspacePath(projectRoot, reference, options = {}) {
  const area = options.area ?? '01_输入素材';
  const lexicalPath = resolveWorkspacePath(projectRoot, reference, { area });
  const [physicalArea, physicalTarget] = await Promise.all([
    realpath(path.resolve(projectRoot, area)),
    realpath(lexicalPath),
  ]);
  if (!contains(physicalArea, physicalTarget) || physicalArea === physicalTarget) {
    throw new Error(`Workspace reference escapes ${area} through a symbolic link: ${reference}`);
  }
  return physicalTarget;
}

export function assertExternalRuntimeRoot(projectRoot, runtimeRoot) {
  return assertExternalRoot(projectRoot, runtimeRoot, 'Runtime Root');
}

export function assertExternalAppDataRoot(projectRoot, appDataRoot) {
  return assertExternalRoot(projectRoot, appDataRoot, 'AppDataRoot');
}

export function assertProjectStorageIsolation({ projectRoot, appDataRoot, runtimeRoot }) {
  return Object.freeze({
    projectRoot: path.resolve(projectRoot),
    appDataRoot: assertExternalAppDataRoot(projectRoot, appDataRoot),
    runtimeRoot: assertExternalRuntimeRoot(projectRoot, runtimeRoot),
  });
}
