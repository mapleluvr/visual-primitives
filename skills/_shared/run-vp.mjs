#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(`failed to start packaged vp CLI: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
