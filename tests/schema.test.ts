import test from "node:test";
import assert from "node:assert/strict";
import { cropAroundPointSchema } from "../src/schema.ts";

test("cropAroundPointSchema requires exactly one explicit crop size mode", () => {
  assert.deepEqual((cropAroundPointSchema as any).oneOf, [
    { required: ["radius"], not: { required: ["size"] } },
    { required: ["size"], not: { required: ["radius"] } },
  ]);
});

test("cropAroundPointSchema documents positive radius and size dimensions", () => {
  const schema = cropAroundPointSchema as any;

  assert.equal(schema.properties.radius.exclusiveMinimum, 0);
  assert.equal(schema.properties.size.properties.width.exclusiveMinimum, 0);
  assert.equal(schema.properties.size.properties.height.exclusiveMinimum, 0);
});
