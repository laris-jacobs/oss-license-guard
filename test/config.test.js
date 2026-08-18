import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, writeInitialConfig } from '../src/config.js';

test('init creates YAML that can be loaded', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oss-license-guard-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeInitialConfig(root);
  const config = await loadConfig(root);
  assert.equal(config.project.license, 'MIT');
  assert.equal(config.dependencies.include, 'all');
});

test('loads and validates package.json configuration', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oss-license-config-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ ossLicenseGuard: { schemaVersion: 1, project: { license: 'MPL-2.0' } } }));
  assert.equal((await loadConfig(root)).project.license, 'MPL-2.0');
});

test('rejects schema violations and ambiguous configuration sources', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oss-license-invalid-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'license-guard.config.json'), JSON.stringify({ schemaVersion: 2, project: {} }));
  await assert.rejects(() => loadConfig(root), /schema validation/);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ ossLicenseGuard: { schemaVersion: 1, project: { license: 'MIT' } } }));
  await assert.rejects(() => loadConfig(root), /Multiple configurations/);
});
