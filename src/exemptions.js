import { globMatch, semverSatisfies } from './match.js';

export function findExemption(pkg, exemptions, now = new Date()) {
  for (const exemption of exemptions) {
    if (!globMatch(pkg.name, exemption.package)) continue;
    if (exemption.versions && !semverSatisfies(pkg.version, exemption.versions)) continue;
    if (exemption.licenses?.length && !exemption.licenses.includes(pkg.licenseExpression)) continue;
    if (exemption.expires && new Date(`${exemption.expires}T23:59:59Z`) < now) return { exemption, expired: true };
    return { exemption, expired: false };
  }
  return null;
}

export function validateExemptions(exemptions) {
  const errors = [];
  const warnings = [];
  for (const [index, item] of exemptions.entries()) {
    if (!item.package) errors.push(`exemptions[${index}].package is required`);
    if (/[*?{}]/.test(item.package ?? '') && !item.versions && !item.licenses?.length) errors.push(`exemptions[${index}] uses a package wildcard and must restrict versions or licenses`);
    if (!item.reason) warnings.push(`Exemption ${item.package ?? index} has no reason`);
  }
  return { errors, warnings };
}
