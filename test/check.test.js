import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPackages } from '../src/check.js';

const base = { project: { license: 'MPL-2.0' }, policy: { preset: 'oss-distribution' }, exemptions: [] };

test('collects all findings and applies an exact exemption', () => {
  const config = { ...base, exemptions: [{ package: 'gpl-lib', versions: '2.x', reason: 'reviewed' }] };
  const result = checkPackages(config, [
    { name: 'good', version: '1.0.0', licenseExpression: 'MIT', licenseText: 'MIT text' },
    { name: 'gpl-lib', version: '2.1.0', licenseExpression: 'GPL-3.0-only', licenseText: 'GPL text' },
    { name: 'unknown', version: '1.0.0', licenseExpression: null, licenseText: null }
  ]);
  assert.deepEqual(result.results.map(x => x.status), ['allowed', 'exempted', 'unlicensed']);
});

test('missing text warns when SPDX expression is valid', () => {
  const result = checkPackages(base, [{ name: 'good', version: '1.0.0', licenseExpression: 'MIT', licenseText: null }]);
  assert.match(result.results[0].warnings[0], /missing/);
});

test('can deny missing texts, allow unknown licenses with warning, and enforce unused exemptions', () => {
  const config = { ...base, strictUnusedExemptions: true, policy: { ...base.policy, missingLicenseText: 'deny', unknownLicense: 'warn' }, exemptions: [{ package: 'unused' }] };
  const result = checkPackages(config, [
    { name: 'missing-text', version: '1.0.0', licenseExpression: 'MIT', licenseText: null },
    { name: 'custom', version: '1.0.0', licenseExpression: 'LicenseRef-Custom', licenseText: 'custom' }
  ]);
  assert.equal(result.results[0].status, 'missing-license-text');
  assert.equal(result.results[1].status, 'allowed-with-warning');
  assert.match(result.errors.join(' '), /Unused exemption/);
});
