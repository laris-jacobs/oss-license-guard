import test from 'node:test';
import assert from 'node:assert/strict';
import { findExemption, validateExemptions } from '../src/exemptions.js';

test('matches scoped glob and semver range', () => {
  const exemption = { package: '@vendor/*', versions: '^3.0.0' };
  assert.ok(findExemption({ name: '@vendor/codec', version: '3.2.1', licenseExpression: 'GPL-3.0-only' }, [exemption]));
  assert.equal(findExemption({ name: '@vendor/codec', version: '4.0.0', licenseExpression: 'GPL-3.0-only' }, [exemption]), null);
});

test('rejects unrestricted package glob and warns on missing reason', () => {
  const result = validateExemptions([{ package: '@vendor/*' }]);
  assert.equal(result.errors.length, 1);
  assert.equal(result.warnings.length, 1);
});

test('reports an expired exemption', () => {
  const result = findExemption({ name: 'old', version: '1.0.0', licenseExpression: 'GPL-3.0-only' }, [{ package: 'old', expires: '2024-01-01' }], new Date('2025-01-01'));
  assert.equal(result.expired, true);
});
