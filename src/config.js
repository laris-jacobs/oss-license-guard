import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { UsageError } from './errors.js';

const CONFIG_NAMES = ['license-guard.config.yaml', 'license-guard.config.yml', 'license-guard.config.json'];

export async function loadConfig(cwd, explicitPath) {
  let filename = explicitPath ? path.resolve(cwd, explicitPath) : undefined;
  if (!filename) {
    const candidates = [];
    for (const name of CONFIG_NAMES) {
      try { await fs.access(path.join(cwd, name)); candidates.push(path.join(cwd, name)); } catch {}
    }
    const packageFile = path.join(cwd, 'package.json');
    let packageConfig;
    try {
      const pkg = JSON.parse(await fs.readFile(packageFile, 'utf8'));
      packageConfig = pkg.ossLicenseGuard;
    } catch {}
    if (candidates.length + (packageConfig ? 1 : 0) > 1) {
      throw new UsageError('Multiple configurations found; select one with --config.');
    }
    if (packageConfig) { await validateSchema(packageConfig); return normalizeConfig(packageConfig, packageFile); }
    filename = candidates[0];
  }
  if (!filename) throw new UsageError('No configuration found. Run `oss-license-guard init`.');
  let raw;
  try { raw = await fs.readFile(filename, 'utf8'); } catch (error) {
    throw new UsageError(`Cannot read configuration ${filename}: ${error.message}`);
  }
  try {
    const value = filename.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
    await validateSchema(value);
    return normalizeConfig(value, filename);
  } catch (error) {
    throw new UsageError(`Invalid configuration ${filename}: ${error.message}`);
  }
}

let validator;
async function validateSchema(value) {
  if (!validator) {
    const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../schemas/config.schema.json');
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    validator = ajv.compile(schema);
  }
  if (!validator(value)) throw new UsageError(`Configuration schema validation failed: ${validator.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
}

function normalizeConfig(value, filename) {
  if (!value || typeof value !== 'object') throw new UsageError('Configuration must be an object.');
  if (value.schemaVersion !== 1) throw new UsageError('Only schemaVersion 1 is supported.');
  if (!value.project?.license) throw new UsageError('project.license is required.');
  const root = path.dirname(filename);
  return {
    ...value,
    filename,
    root,
    dependencies: { include: 'all', packageManager: 'auto', includePeer: true, includeOptional: true, requireLockfile: true, validateLockfile: true, ...value.dependencies },
    policy: { preset: 'oss-distribution', unknownLicense: 'deny', unlicensedPackage: 'deny', ambiguousExpression: 'deny', missingLicenseText: 'warn', ...value.policy },
    exemptions: value.exemptions ?? [],
    report: { path: 'THIRD-PARTY-LICENSES.md', format: 'markdown', includeLicenseText: true, includeExemptions: true, sortBy: 'name', workspaceMode: 'combined', ...value.report }
  };
}

export async function writeInitialConfig(cwd) {
  const filename = path.join(cwd, 'license-guard.config.yaml');
  try { await fs.access(filename); throw new UsageError(`${filename} already exists.`); } catch (e) { if (e instanceof UsageError) throw e; }
  let projectLicense = 'MIT';
  try { projectLicense = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf8')).license || projectLicense; } catch {}
  const content = `schemaVersion: 1\nproject:\n  license: ${JSON.stringify(projectLicense)}\npolicy:\n  preset: oss-distribution\ndependencies:\n  include: all\nreport:\n  path: THIRD-PARTY-LICENSES.md\n  format: markdown\n  includeLicenseText: true\nexemptions: []\n`;
  await fs.writeFile(filename, content, { flag: 'wx' });
  return filename;
}
