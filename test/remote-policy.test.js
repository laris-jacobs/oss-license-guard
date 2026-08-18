import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePolicySources } from '../src/remote-policy.js';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('offline mode rejects a configured remote source without network access', async () => {
  const config = { policy: { matrix: { sources: [{ url: 'https://example.invalid/policy.yaml', sha256: 'a'.repeat(64) }] } } };
  await assert.rejects(() => resolvePolicySources(config, { offline: true }), /offline cache/);
});

test('downloads and merges a correctly pinned remote policy', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-cache-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  const body = 'additions:\n  MPL-2.0:\n    - Zlib\nremovals:\n  MPL-2.0:\n    - MIT\n';
  const digest = createHash('sha256').update(body).digest('hex');
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(body, { status: 200, headers: { 'content-length': String(body.length) } });
  const config = { policy: { cacheDir, matrix: { sources: ['builtin', { url: 'https://example.test/policy.yaml', sha256: digest }], additions: { 'MPL-2.0': ['BSD-4-Clause'] } } } };
  const resolved = await resolvePolicySources(config);
  assert.deepEqual(resolved.policy.matrix.additions['MPL-2.0'], ['BSD-4-Clause']);
  assert.deepEqual(resolved.policy.matrix.remoteAdditions['MPL-2.0'], ['Zlib']);
  assert.deepEqual(resolved.policy.matrix.remoteRemovals['MPL-2.0'], ['MIT']);
  globalThis.fetch = async () => { throw new Error('network must not be used'); };
  const cached = await resolvePolicySources(config, { offline: true });
  assert.deepEqual(cached.policy.matrix.remoteAdditions['MPL-2.0'], ['Zlib']);
});

test('rejects insecure, unpinned and digest-mismatched sources', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-bad-cache-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  await assert.rejects(() => resolvePolicySources({ policy: { matrix: { sources: [{ url: 'http://example.test/policy' }] } } }), /require url and sha256/);
  await assert.rejects(() => resolvePolicySources({ policy: { matrix: { sources: [{ url: 'http://example.test/policy', sha256: 'a'.repeat(64) }] } } }), /HTTPS/);
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  await assert.rejects(() => resolvePolicySources({ policy: { cacheDir, matrix: { sources: [{ url: 'https://example.test/policy.json', sha256: 'b'.repeat(64) }] } } }), /mismatch/);
});
