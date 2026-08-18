# Implementation status

Status: 0.1.0 pre-release

This document maps the product specification to the current implementation. “Implemented” means covered by automated tests; it does not mean the policy constitutes legal advice.

## Implemented

- Selectable project SPDX license, independent of the tool's Apache-2.0 license
- Built-in `oss-distribution` and `internal-application` presets
- Project-license-specific additions and removals
- SPDX parsing with identifiers, `AND`, `OR`, parentheses and `WITH`
- npm, pnpm, Yarn Classic and Yarn Berry lockfile inventory adapters
- Exact installed-version comparison against lockfile inventory
- Production, development, peer and optional dependency selection
- Root projects and npm-style workspaces
- Local package metadata, multiple LICENSE/COPYING files and NOTICE evidence
- Package/SemVer/license-scoped exemptions, expiry and unused checks
- HTTPS policy overlays pinned and cached by SHA-256, including offline reuse
- Markdown, JSON and trusted project Handlebars templates
- Combined and per-workspace reports
- Atomic generation and read-only verification with a bounded line diff
- YAML, JSON and `package.json` configuration with JSON Schema validation
- Human and versioned JSON output, documented exit codes and common CI flags
- Linux/macOS/Windows and even Node-LTS CI matrix
- npm provenance release workflow, Dependabot and self-checking third-party report

## Deliberate 0.1.x limits

- Yarn Plug'n'Play without `node_modules` is unsupported.
- Lockfile inventory is verified, but every declared range is not independently resolved again.
- Arbitrary license prose is not classified heuristically. Missing or ambiguous SPDX metadata remains visible rather than guessed.
- The built-in compatibility matrix is intentionally small. Other project licenses require explicit local or pinned remote rows.
- Registry metadata is not consulted; checks remain local and reproducible after installation.

## Before 1.0

- Pilot migrations in real npm, pnpm, Yarn Classic and Yarn Berry repositories
- Policy review and cited rationale for every built-in matrix row
- Formal compatibility guarantees for the JSON result schema
- Published maintainer security contact and repository URLs
- npm package-name reservation and first provenance-signed preview release

The unscoped npm name `oss-license-guard` returned `404 Not Found` from the public npmjs.org registry on 2026-08-14 and therefore appeared available at that moment. Availability is not reserved until the first publication.
