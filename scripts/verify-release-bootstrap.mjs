#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const expected = {
  name: "@mapleluvr/visual-primitives",
  version: "0.0.0-bootstrap.0",
};
const viewArgs = [
  "view",
  `${expected.name}@bootstrap`,
  "name",
  "version",
  "--json",
];
const npmCommand = process.env.NPM_CLI_PATH;
const npmPrefix = process.env.NPM_CLI_PREFIX ? [process.env.NPM_CLI_PREFIX] : [];
const invocation = npmCommand
  ? { command: npmCommand, args: [...npmPrefix, ...viewArgs] }
  : process.platform === "win32"
    ? {
        command: process.env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", "npm.cmd", ...viewArgs],
      }
    : { command: "npm", args: viewArgs };

try {
  const { stdout } = await execFileAsync(invocation.command, invocation.args);
  const metadata = JSON.parse(stdout);
  if (metadata?.name !== expected.name || metadata?.version !== expected.version) {
    throw new Error(`expected ${expected.name}@bootstrap to resolve to ${expected.version}`);
  }
  process.stdout.write(`${metadata.name}@${metadata.version} bootstrap verified\n`);
} catch (error) {
  const detail = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`.trim();
  throw new Error(`bootstrap verification failed${detail ? `: ${detail}` : ""}`, { cause: error });
}
