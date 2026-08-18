import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPolicy, evaluateExpression } from '../src/policy.js';

const config = preset => ({ project: { license: 'MPL-2.0' }, policy: { preset } });

test('OR accepts one allowed branch and AND requires both', () => {
  const policy = buildPolicy(config('oss-distribution'));
  assert.equal(evaluateExpression('GPL-3.0-only OR MIT', policy).allowed, true);
  assert.equal(evaluateExpression('MIT AND GPL-3.0-only', policy).allowed, false);
});

test('internal policy permits weak copyleft but not AGPL', () => {
  const policy = buildPolicy(config('internal-application'));
  assert.equal(evaluateExpression('MPL-2.0', policy).allowed, true);
  assert.equal(evaluateExpression('LGPL-3.0-only', policy).allowed, true);
  assert.equal(evaluateExpression('AGPL-3.0-only', policy).allowed, false);
});

test('local additions and removals are selected by project license', () => {
  const policy = buildPolicy({ project: { license: 'MPL-2.0' }, policy: { preset: 'oss-distribution', matrix: { additions: { 'MPL-2.0': ['Zlib'] }, removals: { 'MPL-2.0': ['MIT'] } } } });
  assert.equal(evaluateExpression('Zlib', policy).allowed, true);
  assert.equal(evaluateExpression('MIT', policy).allowed, false);
});

test('validates SPDX identifiers and preserves WITH exceptions', () => {
  const policy = buildPolicy(config('oss-distribution'));
  assert.equal(evaluateExpression('Definitely-Not-SPDX', policy).status, 'ambiguous');
  const withException = evaluateExpression('Apache-2.0 WITH LLVM-exception', policy);
  assert.equal(withException.allowed, true);
  assert.equal(withException.selected, 'Apache-2.0 WITH LLVM-exception');
});

test('local policy overrides remote policy and local removals win', () => {
  const policy = buildPolicy({ project: { license: 'MPL-2.0' }, policy: { preset: 'oss-distribution', matrix: {
    remoteAdditions: { 'MPL-2.0': ['Zlib'] },
    remoteRemovals: { 'MPL-2.0': ['MIT', 'BSD-4-Clause'] },
    additions: { 'MPL-2.0': ['MIT', 'BSD-4-Clause'] },
    removals: { 'MPL-2.0': ['BSD-4-Clause'] }
  } } });
  assert.equal(evaluateExpression('MIT', policy).allowed, true);
  assert.equal(evaluateExpression('Zlib', policy).allowed, true);
  assert.equal(evaluateExpression('BSD-4-Clause', policy).allowed, false);
});
