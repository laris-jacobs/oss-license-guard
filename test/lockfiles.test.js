import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readLockInventory, verifyLockInventory } from '../src/lockfiles.js';

test('reads npm v3 and legacy nested inventories', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lock-npm-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/a': { version: '1.0.0' } }, dependencies: { b: { version: '2.0.0', dependencies: { c: { version: '3.0.0' } } } } }));
  const inventory = await readLockInventory(root, 'npm');
  assert.ok(inventory.has('a@1.0.0'));
  assert.ok(inventory.has('b@2.0.0'));
  assert.ok(inventory.has('c@3.0.0'));
});

test('reads pnpm package keys including scoped and peer-qualified versions', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lock-pnpm-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\npackages:\n  foo@1.2.3: {}\n  '@scope/lib@2.0.0(peer@1.0.0)': {}\n");
  const inventory = await readLockInventory(root, 'pnpm');
  assert.ok(inventory.has('foo@1.2.3'));
  assert.ok(inventory.has('@scope/lib@2.0.0'));
});

test('reads Yarn classic descriptors and verifies installed versions', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lock-yarn-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'yarn.lock'), 'foo@^1.0.0:\n  version "1.2.3"\n  resolved "https://example.test/foo.tgz"\n');
  const inventory = await readLockInventory(root, 'yarn');
  assert.ok(inventory.has('foo@1.2.3'));
  assert.doesNotThrow(() => verifyLockInventory([{ name: 'foo', version: '1.2.3' }], inventory, 'yarn'));
  assert.throws(() => verifyLockInventory([{ name: 'foo', version: '2.0.0' }], inventory, 'yarn'), /does not contain/);
});

test('reads Yarn Berry lockfiles', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lock-yarn-berry-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'yarn.lock'), '__metadata:\n  version: 8\n  cacheKey: 10c0\n\n"foo@npm:^1.0.0":\n  version: 1.2.3\n  resolution: "foo@npm:1.2.3"\n');
  const inventory = await readLockInventory(root, 'yarn');
  assert.ok(inventory.has('foo@1.2.3'));
});
