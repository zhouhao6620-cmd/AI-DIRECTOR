import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const outputRoot = join(import.meta.dirname, '..', 'dist');
const basePath = '/AI-DIRECTOR';
const textExtensions = new Set(['.html', '.js', '.mjs', '.css']);
const rootedAsset = /(["'`=(\s])\/(?!\/)(shared-ui|engine|project|assets|component-previews|player|vendor)\//g;

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(filePath);
      continue;
    }
    if (entry.name === '.DS_Store') {
      await unlink(filePath);
      continue;
    }
    if (!textExtensions.has(filePath.slice(filePath.lastIndexOf('.')))) continue;

    const source = await readFile(filePath, 'utf8');
    const output = source.replace(rootedAsset, `$1${basePath}/$2/`);
    if (output !== source) await writeFile(filePath, output);
  }
}

await visit(outputRoot);
console.log(`Prepared ${relative(process.cwd(), outputRoot)} for Pages at ${basePath}/`);
