const PERMISSIVE = ['0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT', 'Unlicense'];
const WEAK_COPYLEFT = ['MPL-2.0', 'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later'];
const AGPL = new Set(['AGPL-1.0-only', 'AGPL-1.0-or-later', 'AGPL-3.0-only', 'AGPL-3.0-or-later']);
const OSS_MATRIX = Object.fromEntries(['0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT', 'Unlicense'].map(projectLicense => [projectLicense, PERMISSIVE]));
OSS_MATRIX['MPL-2.0'] = [...PERMISSIVE, 'MPL-2.0'];

export function buildPolicy(config) {
  const matrixAllowed = OSS_MATRIX[config.project.license] ?? [];
  const presetAllowed = config.policy.preset === 'internal-application' ? [...matrixAllowed, ...WEAK_COPYLEFT] : matrixAllowed;
  const remoteAdditions = config.policy.matrix?.remoteAdditions?.[config.project.license] ?? [];
  const remoteRemovals = new Set(config.policy.matrix?.remoteRemovals?.[config.project.license] ?? []);
  const additions = config.policy.matrix?.additions?.[config.project.license] ?? [];
  const removals = new Set(config.policy.matrix?.removals?.[config.project.license] ?? []);
  const remoteEffective = [...presetAllowed, ...remoteAdditions].filter(x => !remoteRemovals.has(x));
  return { allowed: new Set([...remoteEffective, ...additions].filter(x => !removals.has(x))), preset: config.policy.preset, projectLicense: config.project.license, builtinRowFound: Boolean(OSS_MATRIX[config.project.license]) };
}

export function evaluateExpression(expression, policy) {
  if (!expression) return { allowed: false, status: 'unlicensed', reason: 'No SPDX license expression found' };
  let ast;
  try { ast = parseSpdx(expression); } catch {
    return { allowed: false, status: 'ambiguous', reason: `Invalid SPDX expression: ${expression}` };
  }
  const result = evaluateNode(ast, policy);
  return { ...result, status: result.allowed ? 'allowed' : result.status ?? 'denied' };
}

function evaluateNode(node, policy) {
  if (node.conjunction === 'or') {
    const left = evaluateNode(node.left, policy);
    const right = evaluateNode(node.right, policy);
    return left.allowed ? left : right.allowed ? right : { allowed: false, reason: `${left.reason}; ${right.reason}` };
  }
  if (node.conjunction === 'and') {
    const left = evaluateNode(node.left, policy);
    const right = evaluateNode(node.right, policy);
    return left.allowed && right.allowed ? { allowed: true, selected: `${left.selected} AND ${right.selected}` } : { allowed: false, reason: left.allowed ? right.reason : left.reason };
  }
  const license = node.license;
  if (!spdxLicenseIds.includes(license)) return { allowed: false, status: 'unknown', reason: `${license} is not an allowed recognized SPDX identifier` };
  if (AGPL.has(license)) return { allowed: false, reason: `${license} is blocked by the built-in AGPL rule` };
  return policy.allowed.has(license)
    ? { allowed: true, selected: node.exception ? `${license} WITH ${node.exception}` : license }
    : { allowed: false, reason: `${license} is not allowed by ${policy.preset}` };
}

export const builtinPolicy = { matrix: OSS_MATRIX, weakCopyleft: WEAK_COPYLEFT, agpl: [...AGPL] };
import parseSpdx from 'spdx-expression-parse';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const spdxLicenseIds = require('spdx-license-ids');
