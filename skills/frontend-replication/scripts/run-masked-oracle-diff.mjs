#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(new URL("./masked-oracle-diff.js", import.meta.url));
const child = spawn(process.execPath, [helperPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(`failed to start packaged masked-oracle-diff helper: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
