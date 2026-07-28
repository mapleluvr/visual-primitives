import test from "node:test";
import assert from "node:assert/strict";
import { decideNpmPublish } from "../scripts/release-state.mjs";

const local = {
  id: "@mapleluvr/visual-primitives@0.2.0",
  name: "@mapleluvr/visual-primitives",
  version: "0.2.0",
  integrity: "sha512-local",
  shasum: "local-shasum",
};

test("release state publishes an unpublished version", () => {
  assert.deepEqual(decideNpmPublish(local, null), {
    action: "publish",
    reason: "version-unpublished",
  });
});

test("release state skips an already-published identical artifact", () => {
  assert.deepEqual(decideNpmPublish(local, {
    name: local.name,
    version: local.version,
    dist: { integrity: local.integrity, shasum: local.shasum },
  }), {
    action: "skip-identical",
    reason: "version-already-published-with-matching-integrity",
  });
});

test("release state rejects an already-published different artifact", () => {
  assert.throws(
    () => decideNpmPublish(local, {
      name: local.name,
      version: local.version,
      dist: { integrity: "sha512-other", shasum: "other-shasum" },
    }),
    /already exists with different integrity/i,
  );
});

test("release state rejects mismatched registry identity", () => {
  assert.throws(
    () => decideNpmPublish(local, {
      name: "@mapleluvr/not-visual-primitives",
      version: local.version,
      dist: { integrity: local.integrity, shasum: local.shasum },
    }),
    /identity mismatch/i,
  );
});
