import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createPatchAck,
  createPatchEnvelope,
  validatePatchAck,
  validatePatchEnvelope,
} from '../../../src/hyperframes-foundation/component-kit/patch-contract.mjs';
import { FoundationRegistry } from '../../../src/hyperframes-foundation/registry/foundation-registry.mjs';
import {
  HYPERFRAMES_VERSION,
  resolveFoundationRuntimeFiles,
  resolveHyperframesPackage,
} from '../../../src/hyperframes-foundation/runtime/runtime-resolver.mjs';

const projectRoot = fileURLToPath(new URL('../../..', import.meta.url));

test('Runtime Resolver resolves the R3-owned hyperframes dependency at the approved version', () => {
  const packageInfo = resolveHyperframesPackage();
  const files = resolveFoundationRuntimeFiles();

  assert.equal(packageInfo.version, HYPERFRAMES_VERSION);
  assert.equal(HYPERFRAMES_VERSION, '0.8.46');
  assert.ok(existsSync(files.hyperframeRuntime));
  assert.ok(existsSync(files.playerRuntime));
  assert.ok(existsSync(files.gsapRuntime));
  assert.match(packageInfo.packageJsonPath, /node_modules/);
  assert.doesNotMatch(packageInfo.packageJsonPath, /视频生产线流程/);
});

test('Patch/Ack contract accepts deterministic data and rejects malformed envelopes', () => {
  const patch = createPatchEnvelope('request-1', { label: 'Patched', enabled: true, score: 2 });
  assert.deepEqual(validatePatchEnvelope(patch), { ok: true });
  assert.deepEqual(validatePatchEnvelope({ ...patch, variables: { score: Number.NaN } }), {
    ok: false,
    errorCode: 'INVALID_VARIABLE_VALUE',
  });

  const ack = createPatchAck('request-1', { ok: true });
  assert.deepEqual(validatePatchAck(ack), { ok: true });
  assert.deepEqual(validatePatchAck({ protocol: ack.protocol, requestId: 'request-1' }), {
    ok: false,
    errorCode: 'INVALID_PATCH_ACK',
  });
});

test('Foundation registry only accepts its non-formal test fixture', () => {
  const registry = new FoundationRegistry();
  const fixture = registry.register({
    id: 'R3-HF-FOUNDATION-FIXTURE',
    kind: 'foundation-fixture',
    entry: '/fixture/foundation-fixture.html',
  });

  assert.equal(registry.get(fixture.id), fixture);
  assert.throws(
    () => registry.register({ id: 'CMP-NOT-ALLOWED', kind: 'foundation-fixture', entry: '/fixture/nope.html' }),
    /cannot accept formal CMP assets/,
  );
});

function allFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? allFiles(path) : [path];
  });
}

test('R3-authored Foundation files contain no forbidden legacy coupling or wildcard messaging', () => {
  const forbidden = [
    new RegExp(`/${['workbench', 'src'].join('-')}`),
    new RegExp(`\\.\\./${['workbench', 'v0'].join('-')}`),
    new RegExp(`/${['hf', 'runtime'].join('-')}`),
    new RegExp(`postMessage\\s*\\([^,]+,\\s*['"]${String.fromCharCode(42)}['"]\\s*\\)`),
    new RegExp(`/${['Users', 'skyai', 'Desktop', '视频生产线流程'].join('/')}`),
  ];
  const roots = [join(projectRoot, 'src', 'hyperframes-foundation')];

  for (const file of roots.flatMap(allFiles)) {
    const source = readFileSync(file, 'utf8');
    for (const expression of forbidden) {
      assert.doesNotMatch(source, expression, `${file} must not contain ${expression}`);
    }
  }
});
