# Release Runbook

This file documents live release effects. It does not authorize them. Repository renames, pushes, npm publication, GitHub environment changes, tag creation, and GitHub Releases each require separate authorization.

## First Publication Bootstrap

The automated release workflow is intentionally blocked until the public repository and npm package already exist and npm Trusted Publishing is configured. At the time this runbook was added, those live prerequisites had not been performed.

Perform the following only in an authorized release session:

1. Rename or create the target GitHub repository as `mapleluvr/visual-primitives`.
2. Update the local Git remote to the target repository, push the reviewed branch, and wait for the CI matrix to pass.
3. Create the npm package settings entry without consuming the formal release version. In a temporary directory outside this repository, create a minimal package named `@mapleluvr/visual-primitives` at prerelease version `0.0.0-bootstrap.0`, then publish it interactively under the non-default `bootstrap` dist-tag with an authorized npm account and required second factor:

   ```bash
   mkdir visual-primitives-bootstrap && cd visual-primitives-bootstrap
   npm init --yes
   npm pkg set name=@mapleluvr/visual-primitives version=0.0.0-bootstrap.0 license=MIT
   npm publish --access public --tag bootstrap
   ```

   Do not store a long-lived npm token in the repository or GitHub. The bootstrap prerelease is not the CLI + Skill Set release and must not receive the `latest` dist-tag.
4. In the npm package settings for `@mapleluvr/visual-primitives`, configure a Trusted Publisher for:
   - GitHub organization/user: `mapleluvr`
   - repository: `visual-primitives`
   - workflow: `release.yml`
   - GitHub environment: `npm`
5. In the target GitHub repository, create or configure the `npm` Environment. Add required reviewers if desired. Add the environment variable `RELEASE_BOOTSTRAPPED=true` only after the target repository exists, the bootstrap prerelease is visible, and the Trusted Publisher relationship is active.
6. Verify that `npm view @mapleluvr/visual-primitives@bootstrap name version --json` resolves to `@mapleluvr/visual-primitives@0.0.0-bootstrap.0` (or run `npm run release:verify-bootstrap`) and that the repository Actions page can see the `npm` Environment. Do not use the unqualified package query before the formal release because no `latest` dist-tag exists yet.
7. From the exact reviewed formal-release commit, run the local release suite:

   ```bash
   npm ci --ignore-scripts
   npm run check
   npm test
   npm run package:smoke
   npm audit --audit-level=high
   npm pack --json --ignore-scripts --pack-destination release
   ```

   Inspect and preserve the formal tarball metadata, SHA-256, integrity, and shasum. Do not publish this tarball manually.
8. Create and push the matching `vX.Y.Z` tag only after a separate authorization. The workflow publishes the formal version through the Trusted Publisher with provenance, then creates or repairs the GitHub Release assets.
9. After the formal release succeeds and the `latest` dist-tag points to it, optionally remove the bootstrap dist-tag with a separately authorized `npm dist-tag rm @mapleluvr/visual-primitives bootstrap`. The immutable bootstrap prerelease remains in history.

The workflow rejects a tag in the legacy repository, a missing target repository, a missing npm package, or an unset bootstrap variable before any publish step.

## Routine Release

For later versions:

1. Update `package.json`, `package-lock.json`, and `CHANGELOG.md` together.
2. Run the local release suite and obtain review approval on the exact commit.
3. Confirm the target repository, npm Trusted Publisher, and `npm` Environment remain configured.
4. With separate authorization, create and push tag `vX.Y.Z`, where `X.Y.Z` exactly matches `package.json`.
5. Inspect the workflow result, npm provenance, tarball checksum, SBOM, and GitHub Release assets.

Ordinary branch pushes and pull requests run CI only; they never publish.

## Restart And Recovery

The release workflow is restartable across its two external effects:

- Before npm publication it compares the locally packed tarball with the registry's integrity and shasum.
- If the version is unpublished, it publishes the tarball with OIDC provenance.
- If the same version already contains an identical artifact, it skips npm publication.
- If the immutable version exists with different integrity or shasum, it stops instead of overwriting or attaching misleading release assets.
- GitHub Release creation is `view-or-create`; asset upload uses `--clobber`. A rerun can therefore repair a missing or partial GitHub Release after npm publication succeeded.

If any bootstrap or release step fails, stop and inspect the exact remote state before retrying. Do not create a replacement tag or version merely to bypass a failed transaction.
