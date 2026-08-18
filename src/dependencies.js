import fs from 'node:fs/promises';
import path from 'node:path';
import { TechnicalError } from './errors.js';
import { readLockInventory, verifyLockInventory } from './lockfiles.js';

const LOCKFILES = { npm: 'package-lock.json', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' };

export async function detectPackageManager(root, requested = 'auto') {
  if (requested !== 'auto') return requested;
  const found = [];
  for (const [manager, file] of Object.entries(LOCKFILES)) {
    try { await fs.access(path.join(root, file)); found.push(manager); } catch {}
  }
  if (found.length > 1) throw new TechnicalError(`Multiple lockfiles found (${found.join(', ')}); configure dependencies.packageManager.`);
  return found[0] ?? null;
}

export async function collectDependencies(config) {
  const manager = await detectPackageManager(config.root, config.dependencies.packageManager);
  if (!manager && config.dependencies.requireLockfile) throw new TechnicalError('No supported lockfile found.');
  if (manager) {
    try { await fs.access(path.join(config.root, LOCKFILES[manager])); } catch {
      if (config.dependencies.requireLockfile) throw new TechnicalError(`Expected ${LOCKFILES[manager]} for ${manager}.`);
    }
  }
  const project = JSON.parse(await fs.readFile(path.join(config.root, 'package.json'), 'utf8'));
  const manifests = [{ directory: config.root, package: project, workspace: project.name ?? 'root' }, ...(await workspaceManifests(config.root, project))];
  const traversalOptions = { ...config.dependencies, localWorkspacePaths: new Set(await Promise.all(manifests.map(item => fs.realpath(item.directory)))) };
  const packages = new Map();
  for (const manifest of manifests) {
    for (const entry of dependencyNames(manifest.package, config.dependencies)) await visitPackage(manifest.directory, entry.name, packages, new Set(), entry.optional, manifest.workspace ?? manifest.package.name, traversalOptions);
  }
  const collected = [...packages.values()];
  if (manager && config.dependencies.validateLockfile !== false) verifyLockInventory(collected, await readLockInventory(config.root, manager), manager);
  return { manager, packages: collected, projects: manifests.map(x => x.workspace ?? x.package.name), workspaces: manifests.slice(1).map(x => x.package.name ?? path.relative(config.root, x.directory)) };
}

async function workspaceManifests(root, project) {
  const patterns = Array.isArray(project.workspaces) ? project.workspaces : project.workspaces?.packages ?? [];
  if (!patterns.length) return [];
  const found = [];
  await walk(root);
  return found;

  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const child = path.join(directory, entry.name);
      const relative = path.relative(root, child).split(path.sep).join('/');
      const packageFile = path.join(child, 'package.json');
      if (patterns.some(pattern => workspacePatternMatches(relative, pattern))) {
        try { const pkg = JSON.parse(await fs.readFile(packageFile, 'utf8')); found.push({ directory: child, package: pkg, workspace: pkg.name ?? relative }); } catch {}
      }
      if (patterns.some(pattern => couldContainWorkspace(relative, pattern))) await walk(child);
    }
  }
}

function workspacePatternMatches(relative, pattern) {
  const regex = new RegExp(`^${pattern.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.+').replace(/\*/g, '[^/]+')}$`);
  return regex.test(relative);
}

function couldContainWorkspace(relative, pattern) {
  const fixedPrefix = pattern.split('*')[0].replace(/\/$/, '');
  return !fixedPrefix || fixedPrefix.startsWith(relative) || relative.startsWith(fixedPrefix);
}

function dependencyNames(pkg, options) {
  const entries = new Map();
  if (options.include === 'all' || options.include === 'production') for (const name of Object.keys(pkg.dependencies ?? {})) entries.set(name, { name, optional: false });
  if (options.include === 'all' || options.include === 'development') for (const name of Object.keys(pkg.devDependencies ?? {})) entries.set(name, { name, optional: false });
  if (options.includePeer) for (const name of Object.keys(pkg.peerDependencies ?? {})) entries.set(name, { name, optional: false });
  if (options.includeOptional) for (const name of Object.keys(pkg.optionalDependencies ?? {})) entries.set(name, { name, optional: true });
  return [...entries.values()];
}

async function visitPackage(fromRoot, name, packages, trail, optional = false, workspace = 'root', options = {}) {
  const dir = await resolvePackageDir(fromRoot, name);
  if (!dir && optional) return;
  if (!dir) throw new TechnicalError(`Installed package not found: ${name}. Run the package manager install command.`);
  let real;
  try { real = await fs.realpath(dir); } catch { real = dir; }
  if (options.localWorkspacePaths?.has(real)) return;
  if (trail.has(real)) return;
  const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  if (!packages.has(key)) {
    const evidence = await readLicenseEvidence(dir, pkg);
    packages.set(key, { name: pkg.name, version: pkg.version, repository: repositoryUrl(pkg.repository), projects: [workspace], ...evidence });
  } else if (!packages.get(key).projects.includes(workspace)) packages.get(key).projects.push(workspace);
  const nextTrail = new Set(trail).add(real);
  for (const child of Object.keys(pkg.dependencies ?? {})) await visitPackage(dir, child, packages, nextTrail, false, workspace, options);
  if (options.includeOptional) for (const child of Object.keys(pkg.optionalDependencies ?? {})) await visitPackage(dir, child, packages, nextTrail, true, workspace, options);
  if (options.includePeer) {
    for (const child of Object.keys(pkg.peerDependencies ?? {})) await visitPackage(dir, child, packages, nextTrail, Boolean(pkg.peerDependenciesMeta?.[child]?.optional), workspace, options);
  }
}

async function resolvePackageDir(start, name) {
  let current = start;
  while (true) {
    const candidate = path.join(current, 'node_modules', ...name.split('/'));
    try { await fs.access(path.join(candidate, 'package.json')); return candidate; } catch {}
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function readLicenseEvidence(dir, pkg) {
  let expression = normalizeLicenseField(pkg.license ?? pkg.licenses);
  let referencedFile = null;
  const seeLicense = expression?.match(/^SEE LICEN[CS]E IN (.+)$/i);
  if (seeLicense) { referencedFile = path.basename(seeLicense[1]); expression = null; }
  const licenseFiles = [];
  let noticeText = null;
  const entries = await fs.readdir(dir);
  const candidates = entries.filter(x => /^(licen[cs]e|copying)(\.|$)/i.test(x) || x === referencedFile).sort();
  for (const candidate of candidates) {
    const target = path.resolve(dir, candidate);
    if (target.startsWith(`${path.resolve(dir)}${path.sep}`)) {
      const stat = await fs.stat(target);
      if (stat.isFile() && stat.size <= 1024 * 1024) licenseFiles.push({ name: candidate, text: await fs.readFile(target, 'utf8') });
    }
  }
  const notice = entries.find(x => /^notice(\.|$)/i.test(x));
  if (notice) {
    const target = path.resolve(dir, notice);
    const stat = await fs.stat(target);
    if (target.startsWith(`${path.resolve(dir)}${path.sep}`) && stat.isFile() && stat.size <= 1024 * 1024) noticeText = await fs.readFile(target, 'utf8');
  }
  const licenseText = licenseFiles.map(file => file.text.trim()).filter((value, index, all) => all.indexOf(value) === index).join('\n\n---\n\n') || null;
  const evidenceSources = [...(expression ? ['package.json#license'] : []), ...licenseFiles.map(file => `file:${file.name}`)];
  return { licenseExpression: expression, licenseText, licenseFiles, noticeText, copyright: pkg.copyright ?? null, evidence: evidenceSources[0] ?? 'none', evidenceSources };
}

function normalizeLicenseField(value) {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const expressions = value.map(item => typeof item === 'string' ? item : item?.type).filter(Boolean);
    return expressions.length ? expressions.join(' OR ') : null;
  }
  return typeof value?.type === 'string' ? value.type : null;
}

function repositoryUrl(repository) {
  if (typeof repository === 'string') return repository;
  return repository?.url ?? null;
}
