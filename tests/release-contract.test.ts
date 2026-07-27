import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageRoot = new URL("..", import.meta.url);

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, packageRoot), "utf8");
}

test("package manifest declares the public artifact and smoke entrypoint", async () => {
  const packageJson = JSON.parse(await readText("package.json"));

  assert.equal(packageJson.name, "@mapleluvr/visual-primitives");
  assert.equal(packageJson.engines?.node, ">=22.18");
  assert.equal(packageJson.repository?.url, "git+https://github.com/mapleluvr/visual-primitives.git");
  assert.equal(packageJson.publishConfig?.access, "public");
  assert.ok(packageJson.keywords?.includes("pi-package"));
  assert.equal(packageJson.scripts?.["package:smoke"], "node scripts/package-smoke.mjs");
  assert.deepEqual(packageJson.files, [
    "dist",
    "skills",
    "README.md",
    "README.zh-CN.md",
    "CHANGELOG.md",
    "RELEASE.md",
    "LICENSE",
  ]);
});

test("public release files and LF policy exist", async () => {
  const [license, changelog, releaseGuide, attributes] = await Promise.all([
    readText("LICENSE"),
    readText("CHANGELOG.md"),
    readText("RELEASE.md"),
    readText(".gitattributes"),
  ]);

  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 mapleluvr/i);
  assert.match(changelog, /## \[0\.2\.0\]/);
  assert.match(changelog, /vp CLI/i);
  assert.match(changelog, /Skill Set/i);
  assert.match(releaseGuide, /first publication bootstrap/i);
  assert.match(releaseGuide, /rename[\s\S]*mapleluvr\/visual-primitives/i);
  assert.match(releaseGuide, /0\.0\.0-bootstrap\.0/);
  assert.match(releaseGuide, /--tag bootstrap/);
  assert.match(releaseGuide, /trusted publisher[\s\S]*provenance/i);
  assert.match(releaseGuide, /npm view @mapleluvr\/visual-primitives@bootstrap name/);
  assert.match(releaseGuide, /RELEASE_BOOTSTRAPPED/);
  assert.match(releaseGuide, /separate authorization/i);
  assert.match(attributes, /^\* text=auto eol=lf$/m);
  assert.match(attributes, /^\*\.png binary$/m);
});

test("CI tests supported operating systems and Node versions", async () => {
  const workflow = await readText(".github/workflows/ci.yml");

  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /22\.18\.0/);
  assert.match(workflow, /24\.x/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run package:smoke/);
});

test("release workflow is tag-gated and uses npm trusted publishing", async () => {
  const [workflow, bootstrapVerifier] = await Promise.all([
    readText(".github/workflows/release.yml"),
    readText("scripts/verify-release-bootstrap.mjs"),
  ]);

  assert.match(workflow, /tags:\s*\n\s*- ['"]v\*\.\*\.\*['"]/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /npm run release:verify-tag/);
  assert.match(workflow, /vars\.RELEASE_BOOTSTRAPPED/);
  assert.match(workflow, /TARGET_REPOSITORY: mapleluvr\/visual-primitives/);
  assert.match(workflow, /test "\$\{GITHUB_REPOSITORY\}" = "\$\{TARGET_REPOSITORY\}"/);
  assert.match(workflow, /release:verify-bootstrap/);
  assert.match(bootstrapVerifier, /@bootstrap/);
  assert.match(bootstrapVerifier, /0\.0\.0-bootstrap\.0/);
  assert.match(workflow, /npm pack --json --ignore-scripts --pack-destination release/);
  assert.match(workflow, /id:\s*npm-state/);
  assert.match(workflow, /steps\.npm-state\.outputs\.publish == 'true'/);
  assert.match(workflow, /npm publish[\s\S]*--provenance[\s\S]*--access public/);
  assert.match(workflow, /gh release view[\s\S]*gh release create/);
  assert.match(workflow, /gh release upload[\s\S]*--clobber/);
  assert.match(workflow, /npm sbom/);
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN|npm_token/i);
});

test("English README documents installation, roles, versioning, and extension migration", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /npm install -g @mapleluvr\/visual-primitives/);
  assert.match(readme, /pi install npm:@mapleluvr\/visual-primitives@0\.2\.0/);
  assert.match(readme, /pi install git:github\.com\/mapleluvr\/visual-primitives@v0\.2\.0/);
  assert.match(readme, /Node\.js 22\.18 or newer/);
  assert.match(readme, /using-visual-primitives/);
  assert.match(readme, /frontend-replication/);
  assert.match(readme, /masked-oracle-diff[\s\S]*not a `vp` command/i);
  assert.match(readme, /one package version[\s\S]*one Git tag/i);
  assert.match(readme, /Migration from `pi-visual-primitives`/);
  assert.match(readme, /skills\/_shared\/run-vp\.mjs/);
  assert.match(readme, /run-masked-oracle-diff\.mjs/);
  assert.match(readme, /RELEASE\.md/);
  assert.doesNotMatch(readme, /pi -e \.\/pi-visual-primitives|loads both the extension tool and the Skill/i);
});

test("Chinese README documents the same installation and migration boundary", async () => {
  const readme = await readText("README.zh-CN.md");

  assert.match(readme, /npm install -g @mapleluvr\/visual-primitives/);
  assert.match(readme, /pi install npm:@mapleluvr\/visual-primitives@0\.2\.0/);
  assert.match(readme, /pi install git:github\.com\/mapleluvr\/visual-primitives@v0\.2\.0/);
  assert.match(readme, /Node\.js 22\.18/);
  assert.match(readme, /using-visual-primitives/);
  assert.match(readme, /frontend-replication/);
  assert.match(readme, /masked-oracle-diff/);
  assert.match(readme, /不是 `vp` 子命令/);
  assert.match(readme, /pi-visual-primitives/);
  assert.match(readme, /skills\/_shared\/run-vp\.mjs/);
  assert.match(readme, /run-masked-oracle-diff\.mjs/);
  assert.match(readme, /RELEASE\.md/);
  assert.doesNotMatch(readme, /同时加载扩展工具和技能/);
});
