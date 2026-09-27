import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const distRoot = path.join(repositoryRoot, 'dist');
for (const required of ['index.html', 'development-control-center.html', 'release-manifest.json', 'licenses/THIRD_PARTY_NOTICES.md', 'engine/hyperframes/hyperframe.runtime.iife.js', 'engine/hyperframes/hyperframes-player.global.js', 'engine/hyperframes/gsap.min.js']) await access(path.join(distRoot, required));
const manifest = JSON.parse(await readFile(path.join(distRoot, 'release-manifest.json'), 'utf8'));
assert.equal(manifest.applicationId, 'com.hao.aivideodirector.r3');
assert.equal(manifest.engine.files.length, 3);
const compositions = await readdir(path.join(distRoot, 'hyperframes-assets/compositions'));
assert.equal(compositions.filter((entry) => entry.endsWith('.html')).length, 19);
const forbiddenTopLevel = ['project.json', 'runtime', 'cache', 'logs', 'temp', 'preview', 'jobs', '.r3-test-artifacts'];
const releaseEntries = await readdir(distRoot);
for (const forbidden of forbiddenTopLevel) assert.ok(!releaseEntries.includes(forbidden), `release package must exclude ${forbidden}`);
async function allFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const candidate = path.join(root, entry.name);
    return entry.isDirectory() ? allFiles(candidate) : [candidate];
  }))).flat();
}
for (const file of (await allFiles(distRoot)).filter((entry) => /\.(?:html|js|css|json|md)$/.test(entry))) {
  const content = await readFile(file, 'utf8');
  assert.doesNotMatch(content, /\/Users\/skyai\/Desktop\/视频生产线流程|\/workbench-src|\/hf-runtime|(?:fetch|import)\([^)]*development-state\.json|\/Users\/skyai\/Documents\/Ai视频导演工作台\//);
}
console.log('M0-C release package acceptance: PASS (2 entries, self-contained engine runtime, 19 asset seeds, no project/runtime data).');
