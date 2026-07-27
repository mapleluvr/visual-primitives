import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = new URL("..", import.meta.url);
const packageRootPath = decodeURIComponent(packageRoot.pathname).replace(/^\/(?:([A-Za-z]:))/, "$1");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function runNpm(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  if (process.platform === "win32") {
    return execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npmCommand, ...args], { cwd });
  }
  return execFileAsync(npmCommand, args, { cwd });
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "visual-primitives-package-runtime-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runInstalledAlias(aliasPath: string): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : aliasPath;
    const args = process.platform === "win32" ? ["/d", "/s", "/c", aliasPath, "--version"] : ["--version"];
    const { stdout, stderr } = await execFileAsync(command, args);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
  }
}

async function assertInstalledAliases(installDir: string): Promise<void> {
  const packageJson = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));
  for (const alias of ["vp", "visual-primitives"]) {
    const executable = join(installDir, "node_modules", ".bin", process.platform === "win32" ? `${alias}.cmd` : alias);
    const result = await runInstalledAlias(executable);
    assert.equal(result.code, 0, `${alias}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), packageJson.version);
  }
}

async function initializeInstallDir(installDir: string): Promise<void> {
  await mkdir(installDir);
  await writeFile(join(installDir, "package.json"), JSON.stringify({ private: true }));
}

async function assertInstalledSkillResources(installDir: string): Promise<void> {
  const packageDir = join(installDir, "node_modules", "@mapleluvr", "visual-primitives");
  const launcher = join(packageDir, "skills", "_shared", "run-vp.mjs");
  const { stdout, stderr } = await execFileAsync(process.execPath, [launcher, "--help"], {
    cwd: installDir,
    env: { ...process.env, PATH: "" },
  });
  assert.equal(stderr, "");
  for (const command of ["crop", "crop-multi", "annotate", "point", "colors"]) {
    assert.match(stdout, new RegExp(`\\b${command.replace("-", "\\-")}\\b`));
  }

  for (const skill of [
    "finalizing-replication",
    "frontend-replication",
    "inline-replication",
    "refining-with-feedback",
    "subagent-driven-replication",
    "using-visual-primitives",
  ]) {
    await access(join(packageDir, "skills", skill, "SKILL.md"));
  }
  await access(join(packageDir, "skills", "frontend-replication", "scripts", "masked-oracle-diff.ts"));
  await access(join(packageDir, "skills", "frontend-replication", "scripts", "masked-oracle-diff.js"));
}

test("packed package installs runnable vp and visual-primitives aliases", async () => {
  await withTempDir(async (dir) => {
    const packDir = join(dir, "pack");
    const installDir = join(dir, "install");
    await mkdir(packDir);
    await initializeInstallDir(installDir);

    const { stdout: packStdout } = await runNpm([
      "pack",
      "--json",
      "--pack-destination",
      packDir,
    ], packageRootPath);
    const [packResult] = JSON.parse(packStdout) as Array<{ filename: string }>;
    const tarballPath = join(packDir, packResult.filename);

    await runNpm([
      "install",
      "--no-audit",
      "--no-fund",
      tarballPath,
    ], installDir);

    await assertInstalledAliases(installDir);
    await assertInstalledSkillResources(installDir);
  });
});

test("pinned Git package installs runnable vp and visual-primitives aliases", async () => {
  await withTempDir(async (dir) => {
    const installDir = join(dir, "install");
    await initializeInstallDir(installDir);

    const { stdout: commit } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: packageRootPath });
    const gitUrl = `git+${pathToFileURL(packageRootPath).href}#${commit.trim()}`;
    await runNpm([
      "install",
      "--no-audit",
      "--no-fund",
      gitUrl,
    ], installDir);

    await assertInstalledAliases(installDir);
  });
});
