import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export const APP_DATA_DIRECTORIES = Object.freeze([
  'asset-library',
  'product-skills',
  'settings',
  'registries',
]);

function resolveInside(root, reference) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, reference);
  const relative = path.relative(resolvedRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`AppData reference escapes AppDataRoot: ${reference}`);
  }
  return target;
}

export function resolveAppDataPath(appDataRoot, area, reference) {
  if (!APP_DATA_DIRECTORIES.includes(area)) throw new Error(`Unknown AppData area: ${area}`);
  return resolveInside(path.join(appDataRoot, area), reference);
}

export async function ensureAppDataRoot(appDataRoot) {
  const root = path.resolve(appDataRoot);
  await mkdir(root, { recursive: true });
  await Promise.all(APP_DATA_DIRECTORIES.map((directory) => mkdir(path.join(root, directory), { recursive: true })));
  return Object.freeze(Object.fromEntries(APP_DATA_DIRECTORIES.map((directory) => [directory, path.join(root, directory)])));
}
