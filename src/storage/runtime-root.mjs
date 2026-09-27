import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export const RUNTIME_DIRECTORIES = Object.freeze(['jobs', 'cache', 'preview', 'build', 'logs', 'temp']);

export function resolveRuntimePath(runtimeRoot, area, reference = '.') {
  if (!RUNTIME_DIRECTORIES.includes(area)) throw new Error(`Unknown Runtime area: ${area}`);
  const areaRoot = path.resolve(runtimeRoot, area);
  const target = path.resolve(areaRoot, reference);
  const relative = path.relative(areaRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Runtime reference escapes ${area}: ${reference}`);
  }
  return target;
}

export async function ensureRuntimeRoot(runtimeRoot) {
  const root = path.resolve(runtimeRoot);
  await mkdir(root, { recursive: true });
  await Promise.all(RUNTIME_DIRECTORIES.map((directory) => mkdir(path.join(root, directory), { recursive: true })));
  return Object.freeze(Object.fromEntries(RUNTIME_DIRECTORIES.map((directory) => [directory, path.join(root, directory)])));
}
