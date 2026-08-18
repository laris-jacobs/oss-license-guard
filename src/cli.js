import path from 'node:path';
import { createRequire } from 'node:module';
import { loadConfig, writeInitialConfig } from './config.js';
import { collectDependencies } from './dependencies.js';
import { checkPackages } from './check.js';
import { buildPolicy, builtinPolicy, evaluateExpression } from './policy.js';
import { renderReport, verifyReport, writeReport } from './report.js';
import { UsageError, TechnicalError } from './errors.js';
import { resolvePolicySources } from './remote-policy.js';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

export async function runCli(argv, io = console, cwd = process.cwd()) {
  try {
    const args = [...argv];
    const command = args[0]?.startsWith('-') || !args[0] ? 'verify' : args.shift();
    const options = parseOptions(args);
    if (options.help || command === 'help') { io.log(helpText()); return 0; }
    if (options.version || command === 'version') { io.log(packageJson.version); return 0; }
    if (command === 'init') { io.log(`Created ${await writeInitialConfig(cwd)}`); return 0; }
    let config = await loadConfig(cwd, options.config);
    if (options.out) config.report.path = options.out;
    if (options.format) config.report.format = options.format;
    if (command === 'config' && options.positionals[0] === 'validate') { io.log(`Valid configuration: ${config.filename}`); return 0; }
    if (command === 'policy' && options.positionals[0] === 'explain') {
      config = await resolvePolicySources(config, { offline: options.offline });
      const expression = options.positionals[1];
      if (!expression) throw new UsageError('Usage: policy explain <spdx-expression>');
      const result = evaluateExpression(expression, buildPolicy(config));
      io.log(options.json ? JSON.stringify(result, null, 2) : `${expression}: ${result.allowed ? 'allowed' : 'denied'}${result.reason ? ` (${result.reason})` : ''}`);
      return result.allowed ? 0 : 1;
    }
    if (!['check', 'generate', 'verify'].includes(command)) throw new UsageError(`Unknown command: ${command}`);
    config = await resolvePolicySources(config, { offline: options.offline });
    const discovered = await collectDependencies(config);
    const checked = checkPackages(config, discovered.packages);
    const output = { packageManager: discovered.manager, ...checked };
    if (options.json) io.log(JSON.stringify(output, null, 2)); else if (!options.quiet) printSummary(io, output, options);
    if (checked.errors.length || checked.results.some(x => !x.allowed)) return 1;
    if (command === 'check') return 0;
    const reports = await renderReports(config, checked);
    if (command === 'generate') {
      for (const report of reports) { const target = await writeReport(report.config, report.content); (options.json ? io.error : io.log)(`Wrote ${target}`); }
      return 0;
    }
    for (const report of reports) {
      const existing = await verifyReport(report.config, report.content);
      if (existing.current !== report.content) { io.error(`Third-party report is missing or outdated: ${existing.target}\n${lineDiff(existing.current ?? '', report.content)}\nRun oss-license-guard generate.`); return 1; }
      if (!options.quiet) (options.json ? io.error : io.log)(`Third-party report is up to date: ${existing.target}`);
    }
    return 0;
  } catch (error) {
    io.error(error.message);
    if (error instanceof UsageError) return 2;
    if (error instanceof TechnicalError) return 3;
    if (process.env.OSS_LICENSE_GUARD_DEBUG) io.error(error.stack);
    return 3;
  }
}

function parseOptions(args) {
  const result = { positionals: [], json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') result.json = true;
    else if (args[i] === '--offline') result.offline = true;
    else if (args[i] === '--quiet') result.quiet = true;
    else if (args[i] === '--verbose') result.verbose = true;
    else if (args[i] === '--no-color') result.noColor = true;
    else if (args[i] === '--help' || args[i] === '-h') result.help = true;
    else if (args[i] === '--version' || args[i] === '-v') result.version = true;
    else if (args[i] === '--config') result.config = optionValue(args, ++i, '--config');
    else if (args[i] === '--out') result.out = optionValue(args, ++i, '--out');
    else if (args[i] === '--format') {
      result.format = optionValue(args, ++i, '--format');
      if (!['markdown', 'json'].includes(result.format)) throw new UsageError('--format must be markdown or json');
    }
    else if (args[i].startsWith('-')) throw new UsageError(`Unknown option: ${args[i]}`);
    else result.positionals.push(args[i]);
  }
  return result;
}

function optionValue(args, index, option) {
  if (!args[index] || args[index].startsWith('-')) throw new UsageError(`${option} requires a value`);
  return args[index];
}

function printSummary(io, output, options = {}) {
  for (const item of output.results) {
    io.log(`${item.allowed ? '✓' : '✗'} ${item.name}@${item.version}: ${item.licenseExpression ?? 'UNKNOWN'} (${item.status})`);
    if (options.verbose) io.log(`  evidence=${(item.evidenceSources ?? [item.evidence]).join(',')} projects=${(item.projects ?? []).join(',')}`);
  }
  for (const warning of [...output.warnings, ...output.results.flatMap(x => x.warnings.map(w => `${x.name}@${x.version}: ${w}`))]) io.warn(`WARN ${warning}`);
  for (const error of output.errors) io.error(`ERROR ${error}`);
  const denied = output.results.filter(x => !x.allowed).length;
  io.log(`Checked ${output.results.length} packages: ${output.results.length - denied} accepted, ${denied} denied.`);
}

export { builtinPolicy };

function lineDiff(actual, expected) {
  const left = actual.replace(/\r\n/g, '\n').split('\n');
  const right = expected.replace(/\r\n/g, '\n').split('\n');
  const lines = [];
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length && lines.length < 40; i++) {
    if (left[i] === right[i]) continue;
    if (left[i] !== undefined) lines.push(`- ${left[i]}`);
    if (right[i] !== undefined) lines.push(`+ ${right[i]}`);
  }
  return lines.length ? `Diff (first ${lines.length} changed lines):\n${lines.join('\n')}` : 'Content differs.';
}

function helpText() {
  return `oss-license-guard ${packageJson.version}\n\nCommands:\n  init\n  check\n  generate\n  verify\n  policy explain <expression>\n  config validate\n\nOptions:\n  --config <path>  --out <path>  --format <markdown|json>\n  --json  --offline  --quiet  --verbose  --no-color  --help  --version`;
}

async function renderReports(config, checked) {
  if (config.report.workspaceMode !== 'per-workspace') return [{ config, content: await renderReport(config, checked) }];
  const projects = [...new Set(checked.results.flatMap(item => item.projects ?? []))].sort();
  if (!projects.length) return [{ config, content: await renderReport(config, checked) }];
  const pattern = config.report.workspacePath ?? 'THIRD-PARTY-LICENSES-{workspace}.md';
  return Promise.all(projects.map(async project => {
    const workspace = project.replace(/^@/, '').replace(/[^A-Za-z0-9._-]+/g, '-');
    const scopedConfig = { ...config, report: { ...config.report, path: pattern.replaceAll('{workspace}', workspace), title: `${config.report.title ?? 'Third-Party Licenses'} – ${project}` } };
    const scopedCheck = { ...checked, results: checked.results.filter(item => item.projects?.includes(project)) };
    return { config: scopedConfig, content: await renderReport(scopedConfig, scopedCheck) };
  }));
}
