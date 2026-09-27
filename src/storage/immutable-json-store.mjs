import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class ImmutableJsonStore {
  constructor(root) {
    this.root = path.resolve(root);
  }

  resolve(reference) {
    const target = path.resolve(this.root, reference);
    const relative = path.relative(this.root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Immutable record escapes its declared root.');
    return target;
  }

  async write(reference, value) {
    const target = this.resolve(reference);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await readFile(target);
      throw new Error(`Immutable record already exists: ${reference}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, target);
    return target;
  }
}
