import test from 'node:test';
import assert from 'node:assert/strict';
import { globMatch, semverSatisfies } from '../src/match.js';

test('glob matching handles scopes, stars and question marks', () => {
  assert.equal(globMatch('@vendor/codec', '@vendor/*'), true);
  assert.equal(globMatch('@other/codec', '@vendor/*'), false);
  assert.equal(globMatch('lib-a', 'lib-?'), true);
  assert.equal(globMatch('@vendor/nested/codec', '@vendor/**'), true);
});

test('semver matching supports exact, wildcard, caret, tilde, comparisons and OR', () => {
  assert.equal(semverSatisfies('2.4.1', '2.4.1'), true);
  assert.equal(semverSatisfies('2.4.1', '2.x'), true);
  assert.equal(semverSatisfies('3.2.0', '^3.0.0'), true);
  assert.equal(semverSatisfies('4.0.0', '^3.0.0'), false);
  assert.equal(semverSatisfies('1.2.9', '~1.2.0'), true);
  assert.equal(semverSatisfies('1.3.0', '~1.2.0'), false);
  assert.equal(semverSatisfies('2.5.0', '>=2 <3'), true);
  assert.equal(semverSatisfies('4.0.0', '<2 || >=4'), true);
  assert.equal(semverSatisfies('not-semver', '*'), false);
});
