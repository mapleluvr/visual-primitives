import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const verifier = new URL("../scripts/verify-release-bootstrap.mjs", import.meta.url);

async function runVerifier(state: "bootstrap-only" | "missing") {
  const root = await mkdtemp(join(tmpdir(), "visual-primitives-bootstrap-"));
  try {
    const mockPath = join(root, "mock-npm.mjs");
    await writeFile(mockPath, `
const args = process.argv.slice(2);
const explicitBootstrap = args.includes("@mapleluvr/visual-primitives@bootstrap");
if (!explicitBootstrap || process.env.MOCK_BOOTSTRAP_STATE === "missing") {
  console.error("npm error code E404");
  process.exit(1);
}
process.stdout.write(JSON.stringify({
  name: "@mapleluvr/visual-primitives",
  version: "0.0.0-bootstrap.0"
}));
`);
    try {
      const result = await execFileAsync(process.execPath, [
        verifier.pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"),
      ], {
        env: {
          ...process.env,
          MOCK_BOOTSTRAP_STATE: state,
          NPM_CLI_PATH: process.execPath,
          NPM_CLI_PREFIX: mockPath,
        },
      });
      return { status: "fulfilled" as const, stdout: result.stdout };
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

test("bootstrap verifier succeeds when bootstrap exists without latest", async () => {
  const result = await runVerifier("bootstrap-only");
  assert.equal(result.status, "fulfilled");
  if (result.status !== "fulfilled") return;
  assert.match(result.stdout, /0\.0\.0-bootstrap\.0/);
});

test("bootstrap verifier fails when the explicit bootstrap tag is missing", async () => {
  const result = await runVerifier("missing");
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.stderr, /bootstrap verification failed/i);
});
