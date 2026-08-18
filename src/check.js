import { buildPolicy, evaluateExpression } from './policy.js';
import { findExemption, validateExemptions } from './exemptions.js';

export function checkPackages(config, packages, now = new Date()) {
  const policy = buildPolicy(config);
  const validation = validateExemptions(config.exemptions);
  const used = new Set();
  const results = packages.map(pkg => {
    let decision = evaluateExpression(pkg.licenseExpression, policy);
    const warnings = [];
    if (pkg.licenseExpression && !pkg.licenseText) {
      if (config.policy.missingLicenseText === 'deny') decision = { allowed: false, status: 'missing-license-text', reason: 'License text is missing' };
      else if (config.policy.missingLicenseText !== 'allow') warnings.push('License text is missing');
    }
    const behavior = decision.status === 'unlicensed' ? config.policy.unlicensedPackage : decision.status === 'ambiguous' ? config.policy.ambiguousExpression : decision.status === 'unknown' ? config.policy.unknownLicense : null;
    if (behavior === 'allow' || behavior === 'warn') {
      if (behavior === 'warn') warnings.push(decision.reason);
      decision = { ...decision, allowed: true, status: behavior === 'warn' ? 'allowed-with-warning' : 'allowed' };
    }
    if (decision.allowed) return { ...pkg, ...decision, warnings };
    const match = findExemption(pkg, config.exemptions, now);
    if (match) {
      used.add(match.exemption);
      if (match.expired) return { ...pkg, ...decision, status: 'denied', reason: 'Matching exemption has expired', exemption: match.exemption, warnings };
      return { ...pkg, allowed: true, status: 'exempted', reason: match.exemption.reason ?? 'No exemption reason provided', exemption: match.exemption, warnings };
    }
    return { ...pkg, ...decision, warnings };
  });
  for (const item of config.exemptions) {
    if (!used.has(item)) (config.strictUnusedExemptions ? validation.errors : validation.warnings).push(`Unused exemption: ${item.package}`);
  }
  if (!policy.builtinRowFound && !(config.policy.matrix?.additions?.[config.project.license]?.length)) {
    validation.errors.push(`No built-in matrix row exists for project license ${config.project.license}; add an explicit local policy matrix.`);
  }
  return { policy: { preset: policy.preset, projectLicense: config.project.license, allowed: [...policy.allowed].sort() }, results, errors: validation.errors, warnings: validation.warnings };
}
