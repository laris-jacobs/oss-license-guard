# Release checklist

## One-time setup

- Reserve `oss-license-guard` on npmjs.org by publishing the first preview.
- Add repository, homepage, bugs and author metadata to `package.json` once the personal repository URL is known.
- Enable npm trusted publishing for the GitHub Actions release workflow.
- Create the protected GitHub environment named `npm`.
- Enable private vulnerability reporting and replace the temporary security-contact wording.

## Every release

```sh
npm ci --registry=https://registry.npmjs.org
npm test
npm run test:coverage
npm run check
npm run licenses
npm audit --registry=https://registry.npmjs.org
npm pack --dry-run --registry=https://registry.npmjs.org
```

- Update `CHANGELOG.md` and remove `Unreleased` from the target version.
- Verify the package contents and generated third-party report.
- Tag exactly the version from `package.json` as `v<version>`.
- Let the release workflow publish with npm provenance.
- Verify the npm package page, provenance and CLI installation in a clean project.
