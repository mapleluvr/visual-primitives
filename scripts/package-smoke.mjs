import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const packageRoot = new URL("../", import.meta.url);
const packageRootPath = decodeURIComponent(packageRoot.pathname).replace(/^\/(?:([A-Za-z]:))/, "$1");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const expectedSkills = [
  "finalizing-replication",
  "frontend-replication",
  "inline-replication",
  "refining-with-feedback",
  "subagent-driven-replication",
  "using-visual-primitives",
];

async function runNpm(args, cwd) {
  if (process.platform === "win32") {
    return execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npmCommand, ...args], { cwd });
  }
  return execFileAsync(npmCommand, args, { cwd });
}

async function runNode(script, args, options = {}) {
  return execFileAsync(process.execPath, [script, ...args], options);
}

async function parsePackResult(packDir) {
  const { stdout } = await runNpm(["pack", "--json", "--pack-destination", packDir], packageRootPath);
  const jsonStart = stdout.indexOf("[");
  assert.notEqual(jsonStart, -1, `npm pack did not return JSON: ${stdout}`);
  const [result] = JSON.parse(stdout.slice(jsonStart));
  return result;
}

async function assertArtifactEntries(files) {
  const entries = files.map((file) => file.path).sort();
  const required = [
    "CHANGELOG.md",
    "LICENSE",
    "README.md",
    "README.zh-CN.md",
    "RELEASE.md",
    "dist/cli.js",
    "package.json",
    "skills/_shared/run-vp.mjs",
    ...expectedSkills.map((skill) => `skills/${skill}/SKILL.md`),
    "skills/frontend-replication/scripts/masked-oracle-diff.js",
    "skills/frontend-replication/scripts/masked-oracle-diff.ts",
    "skills/frontend-replication/scripts/run-masked-oracle-diff.mjs",
  ];
  for (const entry of required) assert.ok(entries.includes(entry), `missing packed entry: ${entry}`);

  for (const entry of entries) {
    assert.doesNotMatch(entry, /^(?:tests?|docs\/superpowers|\.superpowers|\.pi-subagents|index\.ts|src\/extension\.ts)/, `unexpected packed entry: ${entry}`);
  }
}

async function runInstalledAlias(binDir, alias, args, cwd) {
  const executable = join(binDir, process.platform === "win32" ? `${alias}.cmd` : alias);
  if (process.platform === "win32") {
    return execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", executable, ...args], { cwd });
  }
  return execFileAsync(executable, args, { cwd });
}

async function readJsonResult(result, command) {
  assert.equal(result.stderr.includes("error:"), false, `${command}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const tempRoot = await mkdtemp(join(tmpdir(), "visual-primitives-package-smoke-"));
try {
  const packDir = join(tempRoot, "pack");
  const installDir = join(tempRoot, "install");
  await mkdir(packDir);
  await mkdir(installDir);
  await writeFile(join(installDir, "package.json"), JSON.stringify({ private: true }));

  const packResult = await parsePackResult(packDir);
  await assertArtifactEntries(packResult.files);
  const tarballPath = join(packDir, packResult.filename);
  const tarballBytes = await readFile(tarballPath);
  assert.ok(tarballBytes.length > 0);

  await runNpm(["install", "--no-audit", "--no-fund", tarballPath], installDir);
  const packageDir = join(installDir, "node_modules", "@mapleluvr", "visual-primitives");
  const binDir = join(installDir, "node_modules", ".bin");
  const fixture = join(installDir, "fixture.png");
  await sharp({
    create: { width: 24, height: 20, channels: 4, background: { r: 30, g: 80, b: 140, alpha: 1 } },
  }).png().toFile(fixture);

  for (const alias of ["vp", "visual-primitives"]) {
    const version = await runInstalledAlias(binDir, alias, ["--version"], installDir);
    assert.equal(version.stdout.trim(), packResult.version);
  }

  const operations = [
    ["crop", fixture, "--space", "pixel", "--box", "1,1,12,12", "--out", join(installDir, "crop.png")],
    ["crop-multi", fixture, "--space", "pixel", "--box", "left:1,1,8,8", "--box", "right:10,2,20,12", "--out-dir", join(installDir, "crops")],
    ["annotate", fixture, "--space", "pixel", "--box", "target:2,2,18,15:#ff0000", "--out", join(installDir, "annotated.png")],
    ["point", fixture, "--space", "pixel", "--point", "12,10", "--radius", "4", "--out", join(installDir, "point.png")],
    ["colors", fixture, "--space", "pixel", "--point", "sample:5,5", "--patch", "1"],
  ];
  for (const args of operations) {
    const result = await runInstalledAlias(binDir, "vp", args, installDir);
    await readJsonResult(result, args[0]);
  }

  for (const skill of expectedSkills) await access(join(packageDir, "skills", skill, "SKILL.md"));
  await access(join(packageDir, "skills", "frontend-replication", "scripts", "masked-oracle-diff.ts"));
  await access(join(packageDir, "skills", "frontend-replication", "scripts", "masked-oracle-diff.js"));
  const diffRunner = join(packageDir, "skills", "frontend-replication", "scripts", "run-masked-oracle-diff.mjs");
  await access(diffRunner);

  const launcher = join(packageDir, "skills", "_shared", "run-vp.mjs");
  const launcherEnv = { ...process.env, PATH: "" };
  const help = await runNode(launcher, ["--help"], { cwd: installDir, env: launcherEnv });
  assert.match(help.stdout, /crop-multi/);
  const launcherCrop = join(installDir, "launcher-crop.png");
  const launcherResult = await runNode(launcher, [
    "crop", fixture, "--space", "pixel", "--box", "2,2,10,10", "--out", launcherCrop,
  ], { cwd: installDir, env: launcherEnv });
  await readJsonResult(launcherResult, "package-local launcher crop");
  await access(launcherCrop);

  const diffManifest = join(installDir, "diff-manifest.json");
  await writeFile(diffManifest, JSON.stringify({
    oracleImage: "fixture.png",
    renderedImage: "fixture.png",
    outputDir: "diff-output",
  }));
  await runNode(diffRunner, ["--manifest", diffManifest], { cwd: installDir, env: launcherEnv });
  await access(join(installDir, "diff-output", "summary.json"));
  await access(join(installDir, "diff-output", "VERDICT.md"));

  process.stdout.write(`${JSON.stringify({
    status: "pass",
    package: packResult.id,
    tarball: packResult.filename,
    tarballBytes: tarballBytes.length,
    packedEntries: packResult.files.length,
    aliases: ["vp", "visual-primitives"],
    commands: operations.map(([command]) => command),
    skills: expectedSkills,
    packageLocalLauncher: true,
    packageLocalMaskedOracleDiffRunner: true,
    maskedOracleDiffOwner: "skills/frontend-replication/scripts",
  }, null, 2)}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
