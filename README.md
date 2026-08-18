# oss-license-guard

Policy-driven license checks and reproducible third-party license reports for npm, pnpm and Yarn projects.

> This project helps automate an organizational policy. It does not provide legal advice.

## Quickstart

Requires a supported even-numbered Node.js LTS release and an installed `node_modules` tree.

```sh
npm install --save-dev oss-license-guard
npx oss-license-guard init
npx oss-license-guard generate
npx oss-license-guard verify
```

When an environment defaults to a private registry, install directly from npmjs.org with `npm install --save-dev oss-license-guard --registry=https://registry.npmjs.org`.

Add the CI-safe command to `package.json`:

```json
{
  "scripts": {
    "licenses:generate": "oss-license-guard generate",
    "licenses:check": "oss-license-guard verify",
    "build": "npm run licenses:check && your-build-command"
  }
}
```

`verify` never changes project files. It exits with code 1 when a dependency violates policy or the generated report is missing/outdated.

## Configuration

The recommended file is `license-guard.config.yaml`. JSON and an `ossLicenseGuard` object in `package.json` are also supported.

```yaml
schemaVersion: 1
project:
  license: MPL-2.0
policy:
  preset: oss-distribution # or internal-application
dependencies:
  include: all
  packageManager: auto
  includePeer: true
  includeOptional: true
  requireLockfile: true
  validateLockfile: true
report:
  path: THIRD-PARTY-LICENSES.md
  format: markdown
  includeLicenseText: true
  includeExemptions: true
  workspaceMode: combined # or per-workspace
exemptions:
  - package: "legacy-package"
    versions: "2.x"
    reason: "Reviewed in issue #123"
  - package: "@vendor/*"
    versions: "^3.0.0"
```

The checked project's `project.license` is independent of the Apache-2.0 license used by `oss-license-guard` itself.

## Commands

- `oss-license-guard check`: check installed dependencies against policy.
- `oss-license-guard generate`: check and atomically write the report.
- `oss-license-guard verify`: check and verify the committed report without writing.
- `oss-license-guard policy explain <SPDX expression>`: explain a policy decision.
- `oss-license-guard config validate`: validate configuration.
- `oss-license-guard init`: create a starter YAML configuration.

Pass `--config <path>` to select a configuration or `--json` for machine-readable check output. Report commands also accept `--out <path>` and `--format markdown|json`; common automation flags are `--offline`, `--quiet`, `--verbose` and `--no-color`.

## Policies

`oss-distribution` starts with a conservative permissive set: 0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MIT and Unlicense.

`internal-application` additionally permits MPL-2.0 and LGPL 2.1/3.0 variants. AGPL is always denied by built-in policy and requires an explicit exemption. Local additions/removals can be scoped to the chosen project license.

See [the product specification](docs/SPEC.md) for the complete intended behavior and roadmap.

## Current MVP limitations

- Yarn Berry is supported when configured with the `node-modules` linker; Plug'n'Play without `node_modules` is not supported.
- npm, pnpm and Yarn lockfile inventories are checked against installed exact versions; every manifest range is not independently solved a second time.
- Workspaces support a combined report or `workspaceMode: per-workspace` with an optional `workspacePath` containing `{workspace}`.
- Remote HTTPS policy sources are SHA-256-pinned and cached by digest for `--offline` use.
- Custom templates use code-free Handlebars templates without project-provided JavaScript helpers.
- License evidence is deliberately conservative: metadata and local license/NOTICE files are reported, but arbitrary prose is not heuristically reclassified as a license.

Detailed contracts are in the [product specification](docs/SPEC.md), [technical specification](docs/TECHNICAL-SPEC.md) and [policy specification](docs/POLICY-SPEC.md). Existing projects can follow the [migration guide](docs/MIGRATION.md); maintainers use the [release checklist](docs/RELEASE.md).

## License

Apache-2.0.
