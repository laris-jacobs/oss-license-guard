# Policy specification

Status: release candidate policy contract  
Scope: built-in policy behavior of `oss-license-guard`

## Purpose and disclaimer

The built-in matrix is a conservative automation policy, not legal advice. It determines whether a dependency proceeds through CI; it does not replace review of license obligations, linking, distribution model, modifications, notices, patents, trademarks or jurisdiction-specific questions.

Every policy decision is keyed by both:

1. the SPDX expression selected by the consuming project in `project.license`; and
2. the selected usage preset.

The Apache-2.0 license of `oss-license-guard` itself has no influence on that selection.

## Built-in project-license rows

The initial `oss-distribution` matrix provides explicit rows for these project licenses:

- `0BSD`
- `Apache-2.0`
- `BSD-2-Clause`
- `BSD-3-Clause`
- `ISC`
- `MIT`
- `MPL-2.0`
- `Unlicense`

The permissive rows accept `0BSD`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `MIT` and `Unlicense` dependencies. The `MPL-2.0` row additionally accepts `MPL-2.0` dependencies.

This is intentionally a workflow baseline rather than an assertion that every listed license is universally compatible in every distribution scenario. Downstream users remain responsible for complying with attribution, NOTICE, source-offer and other obligations.

An unknown project license has no implicit built-in allow-list. It must receive an explicit local or pinned remote matrix row. This permits any valid project SPDX license without silently guessing compatibility.

## Internal application preset

`internal-application` starts with the selected project-license row and additionally permits:

- `MPL-2.0`
- `LGPL-2.1-only`
- `LGPL-2.1-or-later`
- `LGPL-3.0-only`
- `LGPL-3.0-or-later`

GPL is not allowed implicitly. AGPL identifiers are denied by a hard built-in rule in every preset and require a package-specific exemption.

## Expression semantics

- For `A OR B`, at least one branch must be allowed. The chosen branch is recorded.
- For `A AND B`, every branch must be allowed.
- Parentheses follow SPDX precedence.
- `WITH` exceptions are parsed and retained in the selected expression.
- Unknown identifiers, malformed expressions and `LicenseRef-*` without an explicit rule are denied by default.

## Overrides

Local and remote policies may add or remove dependency licenses for an exact project-license key. Removals win over additions. Remote inputs require HTTPS and a SHA-256 digest; the verified body is cached by digest.

## Exemptions

An exemption is evaluated only after normal policy denial. Matching can include package glob, SemVer range and exact license expression. AGPL may therefore be accepted only through a visible, package-specific exemption. Missing reasons warn; expired exemptions deny; unused exemptions warn by default.

## Change governance

Any built-in matrix change requires:

- a changelog entry;
- tests for allowed and denied outcomes;
- a plain-language rationale;
- links to authoritative license text or SPDX metadata;
- separate review from unrelated implementation changes.

The initial authoritative identifier vocabulary is the SPDX License List distributed by the `spdx-license-ids` package. License compatibility remains this project's documented policy decision.
