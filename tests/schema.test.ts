import test from "node:test";
import assert from "node:assert/strict";
import { cropAroundPointSchema, sampleColorsSchema } from "../src/schema.ts";

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

test("sampleColorsSchema requires image path and points", () => {
  const schema = sampleColorsSchema as any;

  assert.deepEqual(schema.required, ["imagePath", "points"]);
  assert.equal(schema.properties.points.minItems, 1);
  assert.deepEqual(schema.properties.coordinateSpace.enum, ["normalized-999", "pixel"]);
  assert.deepEqual(schema.properties.origin.enum, ["top-left", "bottom-left"]);
});

test("sampleColorsSchema documents odd positive patch size", () => {
  const schema = sampleColorsSchema as any;

  assert.equal(schema.properties.patchSize.type, "integer");
  assert.equal(schema.properties.patchSize.minimum, 1);
  assert.equal(schema.properties.patchSize.default, 1);
  assert.match(schema.properties.patchSize.description, /odd/i);
});
