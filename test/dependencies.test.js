import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectDependencies, detectPackageManager } from '../src/dependencies.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'license-deps-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function writePackage(directory, pkg, license) {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(pkg));
  if (license) await fs.writeFile(path.join(directory, 'LICENSE.txt'), license);
}

test('detects package managers and rejects ambiguous lockfiles', async t => {
  const root = await fixture(t);
  assert.equal(await detectPackageManager(root), null);
  await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
  assert.equal(await detectPackageManager(root), 'pnpm');
  await fs.writeFile(path.join(root, 'yarn.lock'), '');
  await assert.rejects(() => detectPackageManager(root), /Multiple lockfiles/);
  assert.equal(await detectPackageManager(root, 'npm'), 'npm');
});

test('collects root, transitive and workspace dependencies and skips missing optional packages', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {
    'node_modules/alpha': { name: 'alpha', version: '1.0.0' },
    'node_modules/beta': { name: 'beta', version: '2.0.0' },
    'node_modules/gamma': { name: 'gamma', version: '3.0.0' }
  } }));
  await writePackage(root, { name: 'root', version: '1.0.0', workspaces: ['packages/*'], dependencies: { alpha: '1.0.0' }, optionalDependencies: { absent: '1.0.0' } });
  await writePackage(path.join(root, 'node_modules', 'alpha'), { name: 'alpha', version: '1.0.0', license: 'MIT', dependencies: { beta: '2.0.0' } }, 'MIT text');
  await writePackage(path.join(root, 'node_modules', 'beta'), { name: 'beta', version: '2.0.0', license: 'Apache-2.0' }, 'Apache text');
  await writePackage(path.join(root, 'packages', 'web'), { name: 'web', version: '1.0.0', devDependencies: { gamma: '3.0.0' } });
  await writePackage(path.join(root, 'node_modules', 'gamma'), { name: 'gamma', version: '3.0.0', license: 'ISC' }, 'ISC text');
  const result = await collectDependencies({ root, dependencies: { include: 'all', packageManager: 'auto', includePeer: true, includeOptional: true, requireLockfile: true } });
  assert.deepEqual(result.packages.map(x => x.name).sort(), ['alpha', 'beta', 'gamma']);
  assert.deepEqual(result.workspaces, ['web']);
  assert.equal(result.packages.find(x => x.name === 'alpha').evidence, 'package.json#license');
  assert.deepEqual(result.packages.find(x => x.name === 'alpha').projects, ['root']);
});

test('requires lockfile and required installed package by default', async t => {
  const root = await fixture(t);
  await writePackage(root, { name: 'root', version: '1.0.0', dependencies: { missing: '1.0.0' } });
  const dependencies = { include: 'production', packageManager: 'auto', includePeer: false, includeOptional: false, requireLockfile: true };
  await assert.rejects(() => collectDependencies({ root, dependencies }), /No supported lockfile/);
  await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
  await assert.rejects(() => collectDependencies({ root, dependencies }), /Installed package not found/);
});
