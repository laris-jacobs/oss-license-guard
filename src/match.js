import { minimatch } from 'minimatch';
import semver from 'semver';

export function globMatch(value, pattern) { return minimatch(value, pattern, { dot: true, nocase: false }); }
export function semverSatisfies(version, range = '*') { return semver.valid(version) !== null && semver.satisfies(version, range || '*', { includePrerelease: true }); }
