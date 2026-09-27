import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const HYPERFRAMES_VERSION = '0.8.46';

const require = createRequire(import.meta.url);

export function resolveHyperframesPackage() {
  const packageJsonPath = require.resolve('hyperframes/package.json');
  const packageJson = require(packageJsonPath);

  if (packageJson.version !== HYPERFRAMES_VERSION) {
    throw new Error(
      `Expected hyperframes@${HYPERFRAMES_VERSION}, received ${packageJson.version}.`,
    );
  }

  return {
    packageJsonPath,
    packageRoot: dirname(packageJsonPath),
    version: packageJson.version,
  };
}

export function resolveFoundationRuntimeFiles() {
  const { packageRoot, version } = resolveHyperframesPackage();
  const gsapPackageJsonPath = require.resolve('gsap/package.json');

  return {
    version,
    hyperframeRuntime: join(packageRoot, 'dist', 'hyperframe.runtime.iife.js'),
    playerRuntime: join(packageRoot, 'dist', 'hyperframes-player.global.js'),
    gsapRuntime: join(dirname(gsapPackageJsonPath), 'dist', 'gsap.min.js'),
  };
}

export function createRuntimeEntries(baseUrl) {
  const origin = new URL(baseUrl).origin;
  return Object.freeze({
    origin,
    hyperframeRuntime: new URL('/runtime/hyperframe.runtime.iife.js', origin).toString(),
    playerRuntime: new URL('/runtime/hyperframes-player.global.js', origin).toString(),
    gsapRuntime: new URL('/runtime/gsap.min.js', origin).toString(),
  });
}
