import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { TechnicalError, UsageError } from './errors.js';

const MAX_POLICY_BYTES = 1024 * 1024;

export async function resolvePolicySources(config, { offline = false } = {}) {
  const sources = config.policy.matrix?.sources ?? [];
  const merged = structuredClone(config.policy.matrix ?? {});
  merged.remoteAdditions = {};
  merged.remoteRemovals = {};
  for (const source of sources) {
    if (source === 'builtin') continue;
    if (!source?.url || !source.sha256) throw new UsageError('Remote policy sources require url and sha256.');
    if (!/^[a-f0-9]{64}$/i.test(source.sha256)) throw new UsageError(`Remote policy sha256 must be 64 hexadecimal characters: ${safeUrl(source.url)}`);
    if (!source.url.startsWith('https://')) throw new UsageError(`Remote policy must use HTTPS: ${safeUrl(source.url)}`);
    const cacheDir = path.resolve(config.policy.cacheDir ?? path.join(os.homedir(), '.cache', 'oss-license-guard', 'policies'));
    const cacheFile = path.join(cacheDir, `${source.sha256.toLowerCase()}.policy`);
    let body = await readValidCache(cacheFile, source.sha256);
    if (!body && offline) throw new TechnicalError(`Remote policy unavailable in offline cache: ${safeUrl(source.url)}`);
    if (!body) {
      body = await download(source.url);
      await fs.mkdir(cacheDir, { recursive: true });
      const temporary = `${cacheFile}.${process.pid}.tmp`;
      await fs.writeFile(temporary, body);
      await fs.rename(temporary, cacheFile);
    }
    const digest = createHash('sha256').update(body).digest('hex');
    if (digest.toLowerCase() !== String(source.sha256).toLowerCase()) throw new TechnicalError(`SHA-256 mismatch for remote policy ${safeUrl(source.url)}.`);
    let policy;
    try { policy = source.url.endsWith('.json') ? JSON.parse(body) : YAML.parse(body); } catch (error) { throw new TechnicalError(`Invalid remote policy ${safeUrl(source.url)}: ${error.message}`); }
    mergeRows(merged.remoteAdditions, policy.additions ?? policy.matrix?.additions ?? {});
    mergeRows(merged.remoteRemovals, policy.removals ?? policy.matrix?.removals ?? {});
  }
  return { ...config, policy: { ...config.policy, matrix: merged } };
}

async function readValidCache(filename, expected) {
  try {
    const body = await fs.readFile(filename, 'utf8');
    return createHash('sha256').update(body).digest('hex').toLowerCase() === String(expected).toLowerCase() ? body : null;
  } catch { return null; }
}

async function download(url) {
  const signal = AbortSignal.timeout(10_000);
  let response;
  try { response = await fetch(url, { redirect: 'error', signal }); } catch (error) { throw new TechnicalError(`Cannot download remote policy ${safeUrl(url)}: ${error.message}`); }
  if (!response.ok) throw new TechnicalError(`Remote policy ${safeUrl(url)} returned HTTP ${response.status}.`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_POLICY_BYTES) throw new TechnicalError(`Remote policy exceeds ${MAX_POLICY_BYTES} bytes.`);
  const body = await response.text();
  if (Buffer.byteLength(body) > MAX_POLICY_BYTES) throw new TechnicalError(`Remote policy exceeds ${MAX_POLICY_BYTES} bytes.`);
  return body;
}

function mergeRows(target, incoming) {
  for (const [license, values] of Object.entries(incoming)) {
    if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) throw new TechnicalError(`Policy row ${license} must be an array of SPDX identifiers.`);
    target[license] = [...new Set([...(target[license] ?? []), ...values])];
  }
}

function safeUrl(value) { try { const url = new URL(value); url.username = ''; url.password = ''; return url.toString(); } catch { return '<invalid-url>'; } }
