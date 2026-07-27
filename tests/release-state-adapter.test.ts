import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const resolver = new URL("../scripts/resolve-release-state.mjs", import.meta.url);
const local = {
  id: "@mapleluvr/visual-primitives@0.2.0",
  name: "@mapleluvr/visual-primitives",
  version: "0.2.0",
  integrity: "sha512-local",
  shasum: "local-shasum",
};

async function runResolver(state: "missing" | "identical" | "mismatch") {
  const root = await mkdtemp(join(tmpdir(), "visual-primitives-release-state-"));
  try {
    const packPath = join(root, "pack.json");
    const outputPath = join(root, "github-output.txt");
    const mockPath = join(root, "mock-npm.mjs");
    await writeFile(packPath, JSON.stringify([local]));
    await writeFile(mockPath, `
const state = process.env.MOCK_NPM_STATE;
if (state === "missing") {
  console.error("npm error code E404");
  process.exit(1);
}
const same = state === "identical";
process.stdout.write(JSON.stringify({
  name: "@mapleluvr/visual-primitives",
  version: "0.2.0",
  dist: {
    integrity: same ? "sha512-local" : "sha512-other",
    shasum: same ? "local-shasum" : "other-shasum"
  }
}));
`);
    try {
      const result = await execFileAsync(process.execPath, [resolver.pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"), packPath], {
        env: {
          ...process.env,
          GITHUB_OUTPUT: outputPath,
          MOCK_NPM_STATE: state,
          NPM_CLI_PATH: process.execPath,
          NPM_CLI_PREFIX: mockPath,
        },
      });
      return {
        status: "fulfilled" as const,
        stdout: result.stdout,
        githubOutput: await readFile(outputPath, "utf8"),
      };
    } catch (error) {
      return {
        status: "rejected" as const,
        stderr: String((error as { stderr?: string }).stderr ?? error),
      };
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("release adapter marks a registry 404 for publication", async () => {
  const result = await runResolver("missing");
  assert.equal(result.status, "fulfilled");
  if (result.status !== "fulfilled") return;
  assert.match(result.stdout, /"action":"publish"/);
  assert.match(result.githubOutput, /^publish=true$/m);
});

test("release adapter skips an identical published tarball", async () => {
  const result = await runResolver("identical");
  assert.equal(result.status, "fulfilled");
  if (result.status !== "fulfilled") return;
  assert.match(result.stdout, /"action":"skip-identical"/);
  assert.match(result.githubOutput, /^publish=false$/m);
});

test("release adapter blocks an immutable version mismatch", async () => {
  const result = await runResolver("mismatch");
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.stderr, /already exists with different integrity/i);
});
