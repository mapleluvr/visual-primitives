#!/usr/bin/env node
import { execFile } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { decideNpmPublish } from "./release-state.mjs";

const execFileAsync = promisify(execFile);
const packJsonPath = process.argv[2];
if (!packJsonPath) throw new Error("Usage: resolve-release-state <npm-pack.json>");

const parsed = JSON.parse(await readFile(packJsonPath, "utf8"));
const local = Array.isArray(parsed) ? parsed[0] : parsed;
if (!local) throw new Error("npm pack metadata is empty");

let published = null;
try {
  const viewArgs = [
    "view",
    `${local.name}@${local.version}`,
    "name",
    "version",
    "dist",
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
  const { stdout } = await execFileAsync(invocation.command, invocation.args);
  published = JSON.parse(stdout);
} catch (error) {
  const output = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;
  if (!/E404|404 Not Found|is not in this registry/i.test(output)) throw error;
}

const decision = decideNpmPublish(local, published);
const publish = decision.action === "publish";
const output = {
  package: `${local.name}@${local.version}`,
  publish,
  ...decision,
};
process.stdout.write(`${JSON.stringify(output)}\n`);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\naction=${decision.action}\nreason=${decision.reason}\n`);
}
