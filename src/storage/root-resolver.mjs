import os from 'node:os';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

export const R3_APPLICATION_ID = 'com.hao.aivideodirector.r3';
export const R3_APPLICATION_DIRECTORY = 'AI视频导演剪辑工作台_R3';
export const R3_DEFAULT_PROJECTS_DIRECTORY = 'Ai视频导演工作台';

function absoluteRoot(name, value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  if (!path.isAbsolute(value)) throw new Error(`${name} must be an absolute path.`);
  return path.resolve(value);
}

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function assertRootSeparation(roots) {
  const entries = Object.entries(roots)
    .filter(([, value]) => value != null)
    .map(([name, value]) => [name, absoluteRoot(name, value)]);

  for (let index = 0; index < entries.length; index += 1) {
    for (let candidate = index + 1; candidate < entries.length; candidate += 1) {
      const [leftName, left] = entries[index];
      const [rightName, right] = entries[candidate];
      if (contains(left, right) || contains(right, left)) {
        throw new Error(`${leftName} and ${rightName} must be physically separate roots.`);
      }
    }
  }
  return Object.freeze(Object.fromEntries(entries));
}

export async function assertPhysicalRootSeparation(roots) {
  const physicalRoots = Object.fromEntries(await Promise.all(
    Object.entries(roots)
      .filter(([, value]) => value != null)
      .map(async ([name, value]) => [name, await realpath(absoluteRoot(name, value))]),
  ));
  return assertRootSeparation(physicalRoots);
}

export function resolveStorageRoots({
  platform = process.platform,
  homeDir = os.homedir(),
  settings = {},
  projectsRoot,
  appDataRoot,
  runtimeRoot,
  productRepository,
} = {}) {
  if (platform !== 'darwin' && (!projectsRoot || !appDataRoot || !runtimeRoot)) {
    throw new Error(`Storage root defaults are not defined for platform: ${platform}`);
  }

  const home = absoluteRoot('homeDir', homeDir);
  const resolved = {
    projectsRoot: projectsRoot ?? settings.projectsRoot ?? path.join(home, 'Documents', R3_DEFAULT_PROJECTS_DIRECTORY),
    appDataRoot: appDataRoot ?? settings.appDataRoot ?? path.join(home, 'Library', 'Application Support', R3_APPLICATION_DIRECTORY),
    runtimeRoot: runtimeRoot ?? settings.runtimeRoot ?? path.join(home, 'Library', 'Caches', R3_APPLICATION_DIRECTORY),
  };
  if (productRepository != null) resolved.productRepository = productRepository;

  return assertRootSeparation(resolved);
}
