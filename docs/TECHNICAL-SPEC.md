# Technical specification

Status: implementation contract for 0.1.x

## Pipeline

```text
config + schema validation
        ↓
package-manager and lockfile adapter
        ↓
installed dependency graph and local evidence
        ↓
SPDX policy evaluation
        ↓
exemption evaluation
        ↓
console/JSON result + deterministic reports
```

## Inputs

- YAML, JSON or `package.json#ossLicenseGuard` configuration
- npm `package-lock.json`, pnpm `pnpm-lock.yaml`, Yarn Classic or Berry `yarn.lock`
- matching installed `node_modules` tree
- package metadata, all matching LICENSE/COPYING files, and NOTICE
- optional HTTPS policy overlays pinned by SHA-256

Lockfile inventory and installed `name@version` values must agree. Yarn PnP without a `node_modules` linker is outside 0.1.x.

## Security boundaries

- Templates are Handlebars data templates and cannot register project-provided helpers or execute JavaScript.
- Evidence files are restricted to direct package-directory children and one MiB each.
- Remote policies require HTTPS, reject redirects, time out, are limited to one MiB, and are validated against their configured digest.
- Report writes use a temporary sibling followed by atomic rename.
- `verify` does not write report files.

## Stable commands and exit codes

- `check`: policy only
- `generate`: policy followed by report write
- `verify`: policy and byte-stable report verification
- `policy explain`: one SPDX expression
- `config validate`: schema validation
- `init`: starter configuration

Exit codes: `0` success, `1` compliance/report failure, `2` configuration/usage error, `3` technical failure.

## Determinism

Packages sort by name then version. Duplicate `name@version` instances are merged while preserving project/workspace membership. Reports normalize LF line endings, omit timestamps and end with exactly one newline.

## Known limits

- Lockfile validation confirms inventory agreement but does not independently solve every manifest range.
- License-text classification is not inferred from arbitrary prose; explicit SPDX metadata remains primary evidence.
- Per-workspace mode emits reports only for workspaces/projects that have discovered third-party dependencies.
