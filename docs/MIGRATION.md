# Migration from apache2-license-checker

The old setup commonly uses two tools:

```json
{
  "scripts": {
    "check-licenses": "apache2-license-checker",
    "generateLicenseFile": "license-checker --markdown > ../THIRD-PARTY-FRONTEND-LICENSES.md"
  },
  "devDependencies": {
    "@bbc/apache2-license-checker": "^1.1.4",
    "license-checker": "^25.0.1"
  }
}
```

Replace both dependencies with `oss-license-guard`:

```sh
npm uninstall @bbc/apache2-license-checker license-checker
npm install --save-dev oss-license-guard --registry=https://registry.npmjs.org
```

Create `license-guard.config.yaml`:

```yaml
schemaVersion: 1
project:
  license: Apache-2.0
policy:
  preset: oss-distribution
dependencies:
  include: all
report:
  path: ../THIRD-PARTY-FRONTEND-LICENSES.md
  format: markdown
  includeLicenseText: true
exemptions: []
```

Use the new scripts:

```json
{
  "scripts": {
    "licenses:generate": "oss-license-guard generate",
    "check-licenses": "oss-license-guard verify"
  }
}
```

Generate and review the first report:

```sh
npm run licenses:generate
git diff -- ../THIRD-PARTY-FRONTEND-LICENSES.md
npm run check-licenses
```

Do not mechanically exempt every initial violation. Decide whether the matrix needs an explicit project-license row, the package metadata is incomplete, or a narrow exemption is justified.
