import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import yarnClassicLockfile from '@yarnpkg/lockfile';
import { TechnicalError } from './errors.js';

const FILENAMES = { npm: 'package-lock.json', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' };

export async function readLockInventory(root, manager) {
  const filename = path.join(root, FILENAMES[manager]);
  let content;
  try { content = await fs.readFile(filename, 'utf8'); } catch (error) { throw new TechnicalError(`Cannot read ${FILENAMES[manager]}: ${error.message}`); }
  try {
    if (manager === 'npm') return npmInventory(JSON.parse(content));
    if (manager === 'pnpm') return pnpmInventory(YAML.parse(content));
    if (manager === 'yarn') return yarnInventory(content.includes('__metadata:') ? parseSyml(content) : yarnClassicLockfile.parse(content).object);
  } catch (error) {
    throw new TechnicalError(`Cannot parse ${FILENAMES[manager]}: ${error.message}`);
  }
  throw new TechnicalError(`Unsupported package manager: ${manager}`);
}

export function verifyLockInventory(packages, inventory, manager) {
  const missing = packages.filter(pkg => !inventory.has(`${pkg.name}@${pkg.version}`));
  if (missing.length) throw new TechnicalError(`${manager} lockfile does not contain installed package versions: ${missing.map(x => `${x.name}@${x.version}`).join(', ')}`);
}

function npmInventory(lock) {
  const result = new Set();
  if (lock.packages) {
    for (const [location, value] of Object.entries(lock.packages)) {
      if (!location || !value?.version || !location.includes('node_modules/')) continue;
      const name = value.name ?? location.slice(location.lastIndexOf('node_modules/') + 13);
      result.add(`${name}@${value.version}`);
    }
  }
  visitNpmDependencies(lock.dependencies, result);
  return result;
}

function visitNpmDependencies(dependencies, result) {
  for (const [name, value] of Object.entries(dependencies ?? {})) {
    if (value?.version) result.add(`${name}@${value.version}`);
    visitNpmDependencies(value?.dependencies, result);
  }
}

function pnpmInventory(lock) {
  const result = new Set();
  for (const [raw, value] of Object.entries(lock.packages ?? lock.snapshots ?? {})) {
    const parsed = packageFromPnpmKey(raw);
    const name = value?.name ?? parsed?.name;
    const version = value?.version ?? parsed?.version;
    if (name && version && !String(version).startsWith('link:')) result.add(`${name}@${stripPeerSuffix(String(version))}`);
  }
  return result;
}

function packageFromPnpmKey(raw) {
  const clean = stripPeerSuffix(raw.replace(/^\//, ''));
  const split = clean.lastIndexOf('@');
  if (split <= 0) return null;
  return { name: clean.slice(0, split), version: clean.slice(split + 1) };
}

function yarnInventory(lock) {
  const result = new Set();
  const entries = lock instanceof Map ? lock.entries() : Object.entries(lock);
  for (const [descriptors, value] of entries) {
    if (!value?.version) continue;
    for (const descriptor of String(descriptors).split(/,\s*/)) {
      const name = yarnDescriptorName(descriptor.replace(/^"|"$/g, ''));
      if (name) result.add(`${name}@${value.version}`);
    }
  }
  return result;
}

function yarnDescriptorName(descriptor) {
  if (descriptor.startsWith('@')) {
    const slash = descriptor.indexOf('/');
    const split = descriptor.indexOf('@', slash);
    return split > slash ? descriptor.slice(0, split) : null;
  }
  const split = descriptor.indexOf('@');
  return split > 0 ? descriptor.slice(0, split) : null;
}

function stripPeerSuffix(value) { return value.replace(/\(.+\)$/, ''); }
