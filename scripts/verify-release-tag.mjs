import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

assert.equal(typeof tag, "string", "release tag is required as argv[2] or GITHUB_REF_NAME");
assert.match(tag, /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `invalid release tag: ${tag}`);
assert.equal(tag, `v${packageJson.version}`, `tag ${tag} does not match package version ${packageJson.version}`);

process.stdout.write(`${packageJson.name}@${packageJson.version} matches ${tag}\n`);
