import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli } from '../src/cli.js';

test('generate then verify a locally installed dependency', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oss-license-guard-cli-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'node_modules', 'good-lib'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { 'good-lib': '1.0.0' } }));
  await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/good-lib': { name: 'good-lib', version: '1.0.0' } } }));
  await fs.writeFile(path.join(root, 'node_modules', 'good-lib', 'package.json'), JSON.stringify({ name: 'good-lib', version: '1.0.0', license: 'MIT' }));
  await fs.writeFile(path.join(root, 'node_modules', 'good-lib', 'LICENSE'), 'MIT license text');
  await fs.writeFile(path.join(root, 'license-guard.config.yaml'), 'schemaVersion: 1\nproject:\n  license: MPL-2.0\nreport:\n  path: THIRD-PARTY-LICENSES.md\n');
  const messages = [];
  const io = { log: value => messages.push(value), warn: value => messages.push(value), error: value => messages.push(value) };
  assert.equal(await runCli(['generate'], io, root), 0);
  assert.equal(await runCli(['verify'], io, root), 0);
  assert.match(await fs.readFile(path.join(root, 'THIRD-PARTY-LICENSES.md'), 'utf8'), /good-lib@1.0.0/);
  await fs.writeFile(path.join(root, 'license-guard.config.yaml'), 'schemaVersion: 1\nproject:\n  license: MPL-2.0\nreport:\n  workspaceMode: per-workspace\n  workspacePath: reports/{workspace}.md\n');
  assert.equal(await runCli(['generate', '--quiet'], io, root), 0);
  assert.match(await fs.readFile(path.join(root, 'reports', 'fixture.md'), 'utf8'), /good-lib@1.0.0/);
});

test('invalid option returns usage exit code', async () => {
  const io = { log() {}, warn() {}, error() {} };
  assert.equal(await runCli(['--bad'], io), 2);
  assert.equal(await runCli(['--config'], io), 2);
  assert.equal(await runCli(['--format', 'xml'], io), 2);
});

test('help and version do not require project configuration', async () => {
  const output = [];
  const io = { log: value => output.push(value), warn() {}, error() {} };
  assert.equal(await runCli(['--help'], io), 0);
  assert.match(output.pop(), /Commands:/);
  assert.equal(await runCli(['version'], io), 0);
  assert.match(output.pop(), /^0\.1\.0$/);
});

test('verify prints a useful diff for an outdated report', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oss-license-diff-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'node_modules', 'lib'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', dependencies: { lib: '1.0.0' } }));
  await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/lib': { version: '1.0.0' } } }));
  await fs.writeFile(path.join(root, 'node_modules', 'lib', 'package.json'), JSON.stringify({ name: 'lib', version: '1.0.0', license: 'MIT' }));
  await fs.writeFile(path.join(root, 'node_modules', 'lib', 'LICENSE'), 'MIT');
  await fs.writeFile(path.join(root, 'license-guard.config.json'), JSON.stringify({ schemaVersion: 1, project: { license: 'MIT' }, report: { path: 'licenses.md' } }));
  await fs.writeFile(path.join(root, 'licenses.md'), 'stale\n');
  const errors = [];
  const io = { log() {}, warn() {}, error: value => errors.push(value) };
  assert.equal(await runCli(['verify', '--quiet'], io, root), 1);
  assert.match(errors.join('\n'), /Diff/);
  assert.match(errors.join('\n'), /- stale/);
});
