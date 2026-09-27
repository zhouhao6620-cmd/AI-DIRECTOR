import path from "node:path";

export function resolveProjectRef(projectRoot, reference) {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, reference);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Input artifact reference escapes project root: ${reference}`);
  }
  return resolved;
}
