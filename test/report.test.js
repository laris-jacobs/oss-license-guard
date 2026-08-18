import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renderReport, verifyReport, writeReport } from '../src/report.js';

test('markdown output is deterministic and sorted', async () => {
  const config = { root: '.', project: { license: 'MPL-2.0' }, report: { format: 'markdown', includeLicenseText: true, includeExemptions: true, title: 'Licenses' } };
  const check = { policy: {}, results: [
    { name: 'z-lib', version: '1.0.0', licenseExpression: 'MIT', licenseText: 'text z' },
    { name: 'a-lib', version: '2.0.0', licenseExpression: 'Apache-2.0', licenseText: 'text a' }
  ] };
  const report = await renderReport(config, check);
  assert.ok(report.indexOf('a-lib') < report.indexOf('z-lib'));
  assert.ok(report.endsWith('\n'));
});

test('renders JSON and writes/verifies atomically', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'license-report-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = { root, project: { license: 'MIT' }, report: { path: 'reports/licenses.json', format: 'json', includeLicenseText: false, includeExemptions: false } };
  const check = { policy: { preset: 'oss-distribution' }, results: [{ name: 'lib', version: '1.0.0', licenseExpression: 'MIT', licenseText: 'hidden' }] };
  const content = await renderReport(config, check);
  assert.equal(JSON.parse(content).packages[0].licenseText, undefined);
  const target = await writeReport(config, content);
  assert.equal((await verifyReport(config, content)).current, content);
  assert.equal(target, path.join(root, 'reports/licenses.json'));
});

test('renders a code-free custom template and reports missing output', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'license-template-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'template.md'), '# {{title}}\n{{#each packages}}{{name}} {{#if repository}}({{repository}}){{/if}}\n{{/each}}');
  const config = { root, project: { license: 'MIT' }, report: { path: 'missing.md', format: 'markdown', template: 'template.md', title: 'Custom', includeLicenseText: false, includeExemptions: false } };
  const content = await renderReport(config, { results: [{ name: 'lib', version: '1.0.0', repository: 'https://example.test' }] });
  assert.match(content, /lib \(https:\/\/example.test\)/);
  assert.equal((await verifyReport(config, content)).current, null);
});
