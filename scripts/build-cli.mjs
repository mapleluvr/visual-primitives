import { chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = new URL("../", import.meta.url);
const outputs = [
  {
    entry: new URL("src/cli.ts", packageRoot),
    output: new URL("dist/cli.js", packageRoot),
    executable: true,
  },
  {
    entry: new URL("skills/frontend-replication/scripts/masked-oracle-diff.ts", packageRoot),
    output: new URL("skills/frontend-replication/scripts/masked-oracle-diff.js", packageRoot),
    executable: false,
  },
];

for (const item of outputs) {
  await mkdir(dirname(fileURLToPath(item.output)), { recursive: true });
  await build({
    entryPoints: [fileURLToPath(item.entry)],
    outfile: fileURLToPath(item.output),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22.18",
    packages: "external",
    legalComments: "none",
    logLevel: "info",
  });
  if (item.executable) await chmod(item.output, 0o755);
}
