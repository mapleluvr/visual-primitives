#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join } from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";
import sharp from "sharp";
import { cropBoundingBox } from "./crop.ts";
import {
  annotateBoundingBoxes,
  cropAroundPoint,
  cropMultipleBoundingBoxes,
  sampleColors,
  type AnnotateBoundingBoxesInput,
  type CropAroundPointInput,
  type CropMultipleBoundingBoxesInput,
} from "./phase2.ts";
import {
  BOX_ORDERS,
  COORDINATE_SPACES,
  ORIGINS,
  type BoundingBoxTuple,
  type BoxOrder,
  type CoordinateOrigin,
  type CoordinateSpace,
  type CropBoundingBoxInput,
  type PointTuple,
  type SampleColorsInput,
} from "./schema.ts";

const packageMetadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown };
if (typeof packageMetadata.version !== "string" || packageMetadata.version.length === 0) {
  throw new Error("package.json must contain a non-empty version string");
}
const VERSION = packageMetadata.version;

class UsageError extends Error {}

const COLOR_ENABLED = Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;

function paint(code: number, text: string): string {
  return COLOR_ENABLED ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) dist[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dist[rows - 1][cols - 1];
}

function closestMatch(input: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(input.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best !== undefined && bestDistance <= Math.max(2, Math.floor(input.length / 3)) ? best : undefined;
}

let currentCommand: string | undefined;
const pendingWarnings: string[] = [];
const hintContext: { space?: string; coords?: number[] } = {};

function warnIfOverwriting(outputPath: string | undefined): void {
  if (!outputPath) return;
  const resolved = isAbsolute(outputPath) ? outputPath : join(process.cwd(), outputPath);
  if (existsSync(resolved)) pendingWarnings.push(`overwriting existing ${outputPath}`);
}

function warnIfNotPng(outputPath: string | undefined): void {
  if (!outputPath) return;
  const ext = extname(outputPath).toLowerCase();
  if (ext && ext !== ".png") {
    pendingWarnings.push(`output is always PNG data; "${outputPath}" keeps its ${ext} extension anyway`);
  }
}

const GLOBAL_HELP = `visual-primitives ${VERSION} — visual evidence primitives for images and screenshots

Usage: vp <command> [options]

Commands:
  crop        Crop one bounding box from an image
  crop-multi  Crop multiple labeled boxes from the same image (fail-fast)
  annotate    Draw provided boxes over the image as a same-size preview
  point       Crop a region centered on a point (requires --radius or --size)
  colors      Sample exact colors at provided points

Common options:
  -i, --image <path>       Source image (or first positional argument)
  -s, --space <space>      pixel | normalized-999 (default: pixel; aliases px, 999)
      --origin <origin>    top-left | bottom-left (default: top-left)
      --box-order <order>  ltrb | lbrt (default: ltrb, i.e. left-top-right-bottom)
      --padding <n>        Pixel padding around resolved boxes (default: 0)
      --no-clamp           Fail on out-of-bounds boxes instead of clipping
      --json <file|->      Read the full input as JSON (file path or - for stdin);
                           other input flags are then ignored. JSON payloads keep
                           the original tool defaults (space: normalized-999)
      --compact            Print compact JSON instead of pretty-printed
  -q, --quiet              Suppress the one-line summary on stderr
  -h, --help               Show help for a command
  -v, --version            Show version

Results are printed as JSON on stdout, plus a one-line summary on stderr.
Errors go to stderr with exit code 1 (usage errors: exit code 2).
Generated artifacts default to the current working directory.

Note: option values starting with "-" need "=" syntax, e.g. --box=-5,0,10,10.

Run "vp <command> --help" (or "vp help <command>") for command-specific
options and examples.`;

const COMMAND_HELP: Record<string, string> = {
  crop: `Usage: vp crop <image> --box <l,t,r,b> [options]

Crop one bounding box from a source image for focused visual inspection.

Options:
      --box <l,t,r,b>   Bounding box coordinates (required)
  -o, --out <path>      Output PNG path (default: generated in the current directory)
  plus common options (see "vp --help")

Examples:
  vp crop scene.png --box 50,40,250,180 -o scene-object.png
  vp crop scene.png --box 120,80,420,360 --space 999    # normalized 0-999
  vp crop plot.png --box 10,20,60,80 --origin bottom-left --box-order lbrt
  vp crop --json input.json`,
  "crop-multi": `Usage: vp crop-multi <image> --box <[label:]l,t,r,b> [--box ...] [options]

Crop several boxes from the same image in one fail-fast call. Labels feed
deterministic output filenames and metadata.

Options:
      --box <[label:]l,t,r,b>  Repeatable labeled box (at least one required)
      --out-dir <dir>          Directory for generated crops (default: current directory)
  plus common options (see "vp --help")

Examples:
  vp crop-multi scene.png --out-dir crops \\
    --box "title:10,20,180,80" --box "button:220,300,380,360"
  vp crop-multi --json input.json`,
  annotate: `Usage: vp annotate <image> --box <[label:]l,t,r,b[:color]> [--box ...] [options]

Draw provided boxes over the source image as a same-size annotated preview.
Use it to verify coordinate-space, origin, or box-order assumptions before
relying on them for visual conclusions.

Options:
      --box <[label:]l,t,r,b[:color]>  Repeatable box with optional label and
                                       outline color (default color: #ff0055)
  -o, --out <path>                     Output PNG path (default: generated in the current directory)
  plus common options (see "vp --help")

Examples:
  vp annotate scene.png -o scene-annotated.png \\
    --box "target:50,40,250,180" --box "header:0,0,800,64:#00aaff"
  vp annotate --json input.json`,
  point: `Usage: vp point <image> --point <x,y> (--radius <n> | --size <WxH>) [options]

Crop a region centered on a point of interest. An explicit --radius or --size
is required; pick it from the intended inspection area.

Options:
      --point <x,y>    Center point (required)
      --radius <n>     Half-size of the square crop (mutually exclusive with --size)
      --size <WxH>     Explicit crop size, e.g. 60x40 (also accepts W,H)
  -o, --out <path>     Output PNG path (default: generated in the current directory)
  plus common options (see "vp --help")

Examples:
  vp point scene.png --point 500,500 --radius 80
  vp point scene.png --point 120,90 --size 60x40 -o detail.png
  vp point --json input.json`,
  colors: `Usage: vp colors <image> --point <[label:]x,y> [--point ...] [options]

Sample exact colors at provided points for CSS-level color precision. Returns
RGB, hex, OKLab, and patch mean values per point. Use a small odd --patch such
as 3 or 5 when antialiasing or gradients make a single pixel misleading.

Options:
      --point <[label:]x,y>  Repeatable labeled point (at least one required)
      --patch <n>            Odd square patch size in pixels (default: 1)
  plus common options (see "vp --help")

Examples:
  vp colors scene.png --patch 3 \\
    --point "header-bg:130,40" --point "cta-button:620,340"
  vp colors --json input.json`,
};

function usageError(command: string, message: string): UsageError {
  const usageLine = COMMAND_HELP[command]?.split("\n")[0];
  return new UsageError(usageLine ? `${message}\n${usageLine}` : message);
}

function isValidCssColor(value: string): boolean {
  if (value.trim() === "") return false;
  try {
    sharp({ create: { width: 1, height: 1, channels: 4, background: value } });
    return true;
  } catch {
    return false;
  }
}

function assertValidColor(value: string, context: string): void {
  if (isValidCssColor(value)) return;
  const hint = /^[0-9a-f]{3,8}$/i.test(value) ? `; did you mean "#${value}"?` : "";
  throw new UsageError(`invalid ${context} color "${value}"; use a CSS name, hex, rgb(), or rgba() color${hint}`);
}

function validateJsonPayload(command: string, payload: unknown): void {
  const fail = (message: string): never => {
    throw new UsageError(`invalid --json payload: ${message}`);
  };
  const objectAt = (value: unknown, path: string): Record<string, unknown> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(path === "payload" ? "payload must be a JSON object" : `"${path}" must be an object`);
    }
    return value as Record<string, unknown>;
  };
  const rejectUnknown = (value: Record<string, unknown>, allowed: readonly string[], path = ""): void => {
    const allowedSet = new Set(allowed);
    for (const key of Object.keys(value)) {
      if (!allowedSet.has(key)) fail(`${path ? `${path}: ` : ""}unknown property "${key}"`);
    }
  };
  const requireString = (value: unknown, path: string, optional = false): void => {
    if (optional && value === undefined) return;
    if (typeof value !== "string" || (!optional && value.length === 0)) {
      fail(`"${path}" must be ${optional ? "a string" : "a non-empty string"}`);
    }
  };
  const requireBoolean = (value: unknown, path: string): void => {
    if (value !== undefined && typeof value !== "boolean") fail(`"${path}" must be a boolean`);
  };
  const requireFiniteNonNegative = (value: unknown, path: string): void => {
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      fail(`"${path}" must be a finite non-negative number`);
    }
  };
  const requireEnum = (value: unknown, path: string, allowed: readonly string[]): void => {
    if (value !== undefined && (typeof value !== "string" || !allowed.includes(value))) {
      fail(`"${path}" must be one of: ${allowed.join(", ")}`);
    }
  };
  const requireBox = (value: unknown, path: string): void => {
    if (!Array.isArray(value) || value.length !== 4 || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
      fail(`"${path}" must be [left, top, right, bottom] finite numbers`);
    }
  };
  const requirePoint = (value: unknown, path: string): void => {
    if (!Array.isArray(value) || value.length !== 2 || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
      fail(`"${path}" must be [x, y] finite numbers`);
    }
  };
  const validateCoordinates = (value: Record<string, unknown>, includeBoxOptions: boolean): void => {
    requireEnum(value.coordinateSpace, "coordinateSpace", COORDINATE_SPACES);
    requireEnum(value.origin, "origin", ORIGINS);
    if (includeBoxOptions) {
      requireEnum(value.boxOrder, "boxOrder", BOX_ORDERS);
      requireFiniteNonNegative(value.padding, "padding");
      requireBoolean(value.clamp, "clamp");
    }
  };

  const obj = objectAt(payload, "payload");
  requireString(obj.imagePath, "imagePath");

  switch (command) {
    case "crop": {
      rejectUnknown(obj, ["imagePath", "box", "coordinateSpace", "origin", "boxOrder", "outputPath", "padding", "clamp"]);
      requireBox(obj.box, "box");
      requireString(obj.outputPath, "outputPath", true);
      validateCoordinates(obj, true);
      break;
    }
    case "crop-multi":
    case "annotate": {
      const isAnnotate = command === "annotate";
      rejectUnknown(obj, isAnnotate
        ? ["imagePath", "boxes", "coordinateSpace", "origin", "boxOrder", "outputPath", "padding", "clamp"]
        : ["imagePath", "boxes", "coordinateSpace", "origin", "boxOrder", "outputDir", "padding", "clamp"]);
      if (!Array.isArray(obj.boxes) || obj.boxes.length === 0) fail('"boxes" must be a non-empty array');
      for (const [index, item] of obj.boxes.entries()) {
        const path = `boxes[${index}]`;
        const itemObj = objectAt(item, path);
        rejectUnknown(itemObj, isAnnotate ? ["box", "label", "color"] : ["box", "label", "outputPath"], path);
        requireBox(itemObj.box, `${path}.box`);
        requireString(itemObj.label, `${path}.label`, true);
        if (isAnnotate) {
          requireString(itemObj.color, `${path}.color`, true);
          if (typeof itemObj.color === "string" && !isValidCssColor(itemObj.color)) {
            fail(`"${path}.color" is not a valid CSS color: ${JSON.stringify(itemObj.color)}`);
          }
        } else {
          requireString(itemObj.outputPath, `${path}.outputPath`, true);
        }
      }
      requireString(isAnnotate ? obj.outputPath : obj.outputDir, isAnnotate ? "outputPath" : "outputDir", true);
      validateCoordinates(obj, true);
      break;
    }
    case "point": {
      rejectUnknown(obj, ["imagePath", "point", "radius", "size", "coordinateSpace", "origin", "boxOrder", "outputPath", "padding", "clamp"]);
      requirePoint(obj.point, "point");
      if (obj.radius === undefined && obj.size === undefined) fail('requires "radius" or "size"');
      if (obj.radius !== undefined && obj.size !== undefined) fail('"radius" and "size" are mutually exclusive');
      if (obj.radius !== undefined && (typeof obj.radius !== "number" || !Number.isFinite(obj.radius) || obj.radius <= 0)) {
        fail('"radius" must be a finite positive number');
      }
      if (obj.size !== undefined) {
        const size = objectAt(obj.size, "size");
        rejectUnknown(size, ["width", "height"], "size");
        for (const dimension of ["width", "height"] as const) {
          const value = size[dimension];
          if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
            fail(`"size.${dimension}" must be a finite positive number`);
          }
        }
      }
      requireString(obj.outputPath, "outputPath", true);
      validateCoordinates(obj, true);
      break;
    }
    case "colors": {
      rejectUnknown(obj, ["imagePath", "points", "coordinateSpace", "origin", "patchSize"]);
      if (!Array.isArray(obj.points) || obj.points.length === 0) fail('"points" must be a non-empty array');
      for (const [index, item] of obj.points.entries()) {
        const path = `points[${index}]`;
        const itemObj = objectAt(item, path);
        rejectUnknown(itemObj, ["point", "label"], path);
        requirePoint(itemObj.point, `${path}.point`);
        requireString(itemObj.label, `${path}.label`, true);
      }
      if (obj.patchSize !== undefined && (!Number.isInteger(obj.patchSize) || (obj.patchSize as number) < 1)) {
        fail('"patchSize" must be a positive integer');
      }
      validateCoordinates(obj, false);
      break;
    }
    default:
      fail(`unknown command contract "${command}"`);
  }
}

const NUMBER_PATTERN = "-?\\d+(?:\\.\\d+)?";
const BOX_COORDS_RE = new RegExp(`^${NUMBER_PATTERN}(?:\\s*,\\s*${NUMBER_PATTERN}){3}$`);
const POINT_COORDS_RE = new RegExp(`^${NUMBER_PATTERN}\\s*,\\s*${NUMBER_PATTERN}$`);

function parseNumbers(value: string): number[] {
  return value.split(",").map((part) => Number(part.trim()));
}

function parseBoxSpec(value: string, allowColor: boolean): { label?: string; box: BoundingBoxTuple; color?: string } {
  const segments = value.split(":").map((segment) => segment.trim());
  let label: string | undefined;
  let coords: string | undefined;
  let color: string | undefined;

  if (segments.length === 1) {
    [coords] = segments;
  } else if (segments.length === 2) {
    if (BOX_COORDS_RE.test(segments[0])) {
      [coords, color] = segments;
    } else {
      [label, coords] = segments;
    }
  } else if (segments.length === 3) {
    [label, coords, color] = segments;
  }

  if (!coords || !BOX_COORDS_RE.test(coords)) {
    throw new UsageError(`invalid --box value "${value}"; expected "[label:]left,top,right,bottom${allowColor ? "[:color]" : ""}"`);
  }
  if (color !== undefined && !allowColor) {
    throw new UsageError(`invalid --box value "${value}"; per-box colors are only supported by "vp annotate"`);
  }
  if (color !== undefined) assertValidColor(color, "--box");

  return { label, box: parseNumbers(coords) as BoundingBoxTuple, color };
}

function parsePointSpec(value: string): { label?: string; point: PointTuple } {
  const segments = value.split(":").map((segment) => segment.trim());
  let label: string | undefined;
  let coords: string | undefined;

  if (segments.length === 1) {
    [coords] = segments;
  } else if (segments.length === 2) {
    [label, coords] = segments;
  }

  if (!coords || !POINT_COORDS_RE.test(coords)) {
    throw new UsageError(`invalid --point value "${value}"; expected "[label:]x,y"`);
  }

  return { label, point: parseNumbers(coords) as PointTuple };
}

function parseSizeSpec(value: string): { width: number; height: number } {
  const match = value.trim().match(new RegExp(`^(${NUMBER_PATTERN})\\s*[x,]\\s*(${NUMBER_PATTERN})$`));
  if (!match) {
    throw new UsageError(`invalid --size value "${value}"; expected "WxH" such as 60x40`);
  }
  const size = { width: Number(match[1]), height: Number(match[2]) };
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
    throw new UsageError("--size width and height must be positive numbers");
  }
  return size;
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[], aliases: Record<string, T>, flag: string): T | undefined {
  if (value === undefined) return undefined;
  const normalized = aliases[value] ?? value;
  if (!(allowed as readonly string[]).includes(normalized)) {
    throw new UsageError(`invalid ${flag} value "${value}"; expected one of: ${allowed.join(", ")}${Object.keys(aliases).length ? ` (aliases: ${Object.keys(aliases).join(", ")})` : ""}`);
  }
  return normalized as T;
}

function parseOptionalNumber(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new UsageError(`invalid ${flag} value "${value}"; expected a number`);
  }
  return parsed;
}

interface CommonValues {
  image?: string;
  space?: string;
  origin?: string;
  "box-order"?: string;
  padding?: string;
  "no-clamp"?: boolean;
  json?: string;
  compact?: boolean;
  quiet?: boolean;
  help?: boolean;
  version?: boolean;
}

const COMMON_OPTIONS: ParseArgsConfig["options"] = {
  image: { type: "string", short: "i" },
  space: { type: "string", short: "s" },
  origin: { type: "string" },
  "box-order": { type: "string" },
  padding: { type: "string" },
  "no-clamp": { type: "boolean" },
  json: { type: "string" },
  compact: { type: "boolean" },
  quiet: { type: "boolean", short: "q" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
};

const outputState = { compact: false, quiet: false };

function resolveImage(values: CommonValues, positionals: string[]): string {
  const image = values.image ?? positionals[0];
  if (!image) {
    throw new UsageError("missing source image; pass it as the first argument or with --image");
  }
  if (values.image && positionals.length > 0) {
    throw new UsageError(`unexpected positional argument "${positionals[0]}" alongside --image`);
  }
  if (positionals.length > 1) {
    throw new UsageError(`unexpected positional argument "${positionals[1]}"`);
  }
  return image;
}

function coordinateOptions(values: CommonValues): Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp"> {
  const padding = parseOptionalNumber(values.padding, "--padding");
  if (padding !== undefined && padding < 0) {
    throw new UsageError("--padding must be zero or a positive number");
  }
  return {
    coordinateSpace: parseEnum<CoordinateSpace>(values.space, COORDINATE_SPACES, { px: "pixel", norm: "normalized-999", "999": "normalized-999" }, "--space") ?? "pixel",
    origin: parseEnum<CoordinateOrigin>(values.origin, ORIGINS, {}, "--origin"),
    boxOrder: parseEnum<BoxOrder>(values["box-order"], BOX_ORDERS, { ltrb: "left-top-right-bottom", lbrt: "left-bottom-right-top" }, "--box-order"),
    padding,
    clamp: values["no-clamp"] ? false : undefined,
  };
}

async function readJsonInput(source: string): Promise<unknown> {
  let raw: string;
  if (source === "-") {
    if (process.stdin.isTTY) {
      throw new UsageError('"--json -" expects JSON piped on stdin, but stdin is a terminal');
    }
    raw = await new Promise<string>((resolvePromise, rejectPromise) => {
      let buffer = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { buffer += chunk; });
      process.stdin.on("end", () => resolvePromise(buffer));
      process.stdin.on("error", rejectPromise);
    });
  } else {
    try {
      raw = await readFile(source, "utf8");
    } catch {
      throw new UsageError(`--json file not found or unreadable: ${source}`);
    }
  }
  try {
    // strip a UTF-8 BOM (common in PowerShell-generated files)
    return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch (error) {
    throw new UsageError(`--json input is not valid JSON: ${(error as Error).message}`);
  }
}

type CommandArgs = { values: CommonValues & Record<string, unknown>; positionals: string[] };

function parseCommandArgs(argv: string[], extraOptions: ParseArgsConfig["options"]): CommandArgs {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: { ...COMMON_OPTIONS, ...extraOptions },
      allowPositionals: true,
    });
    outputState.compact = Boolean((values as CommonValues).compact);
    outputState.quiet = Boolean((values as CommonValues).quiet);
    return { values: values as CommandArgs["values"], positionals };
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      const flag = err.message.match(/Unknown option '([^']+)'/)?.[1] ?? "";
      const known = Object.keys({ ...COMMON_OPTIONS, ...extraOptions }).map((name) => `--${name}`);
      const suggestion = closestMatch(flag, known);
      throw new UsageError(`unknown option '${flag}'${suggestion ? `; did you mean '${suggestion}'?` : ""}`);
    }
    throw new UsageError(err.message);
  }
}

const TOOL_CWD = { cwd: process.cwd() };

async function runCrop(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseCommandArgs(argv, {
    box: { type: "string", multiple: true },
    out: { type: "string", short: "o" },
  });
  if (values.help) return COMMAND_HELP.crop;
  if (values.version) return VERSION;
  if (values.json) {
    const payload = await readJsonInput(values.json);
    validateJsonPayload("crop", payload);
    return cropBoundingBox(payload as CropBoundingBoxInput, TOOL_CWD);
  }

  const boxSpecs = (values.box as string[] | undefined) ?? [];
  const missing: string[] = [];
  if (!values.image && positionals.length === 0) missing.push("<image>");
  if (boxSpecs.length === 0) missing.push('--box "left,top,right,bottom"');
  if (missing.length > 0) throw usageError("crop", `missing ${missing.join(" and ")}`);
  if (boxSpecs.length > 1) throw new UsageError('"vp crop" accepts exactly one --box; use "vp crop-multi" to crop several boxes in one call');
  const { label, box } = parseBoxSpec(boxSpecs[0], false);
  if (label) throw new UsageError('"vp crop" does not accept a box label; use "vp crop-multi" for labeled boxes');

  const options = coordinateOptions(values);
  hintContext.space = options.coordinateSpace;
  hintContext.coords = box;
  warnIfOverwriting(values.out as string | undefined);
  warnIfNotPng(values.out as string | undefined);

  return cropBoundingBox({
    imagePath: resolveImage(values, positionals),
    box,
    outputPath: values.out as string | undefined,
    ...options,
  }, TOOL_CWD);
}

async function runCropMulti(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseCommandArgs(argv, {
    box: { type: "string", multiple: true },
    "out-dir": { type: "string" },
  });
  if (values.help) return COMMAND_HELP["crop-multi"];
  if (values.version) return VERSION;
  if (values.json) {
    const payload = await readJsonInput(values.json);
    validateJsonPayload("crop-multi", payload);
    return cropMultipleBoundingBoxes(payload as CropMultipleBoundingBoxesInput, TOOL_CWD);
  }

  const boxSpecs = (values.box as string[] | undefined) ?? [];
  const missing: string[] = [];
  if (!values.image && positionals.length === 0) missing.push("<image>");
  if (boxSpecs.length === 0) missing.push('--box "[label:]left,top,right,bottom" (repeatable)');
  if (missing.length > 0) throw usageError("crop-multi", `missing ${missing.join(" and ")}`);

  const boxes = boxSpecs.map((spec) => {
    const { label, box } = parseBoxSpec(spec, false);
    return { label, box };
  });
  const options = coordinateOptions(values);
  hintContext.space = options.coordinateSpace;
  hintContext.coords = boxes.flatMap((item) => item.box);

  return cropMultipleBoundingBoxes({
    imagePath: resolveImage(values, positionals),
    boxes,
    outputDir: values["out-dir"] as string | undefined,
    ...options,
  }, TOOL_CWD);
}

async function runAnnotate(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseCommandArgs(argv, {
    box: { type: "string", multiple: true },
    out: { type: "string", short: "o" },
  });
  if (values.help) return COMMAND_HELP.annotate;
  if (values.version) return VERSION;
  if (values.json) {
    const payload = await readJsonInput(values.json);
    validateJsonPayload("annotate", payload);
    return annotateBoundingBoxes(payload as AnnotateBoundingBoxesInput, TOOL_CWD);
  }

  const boxSpecs = (values.box as string[] | undefined) ?? [];
  const missing: string[] = [];
  if (!values.image && positionals.length === 0) missing.push("<image>");
  if (boxSpecs.length === 0) missing.push('--box "[label:]left,top,right,bottom[:color]" (repeatable)');
  if (missing.length > 0) throw usageError("annotate", `missing ${missing.join(" and ")}`);

  const boxes = boxSpecs.map((spec) => parseBoxSpec(spec, true));
  const options = coordinateOptions(values);
  hintContext.space = options.coordinateSpace;
  hintContext.coords = boxes.flatMap((item) => item.box);
  warnIfOverwriting(values.out as string | undefined);
  warnIfNotPng(values.out as string | undefined);

  return annotateBoundingBoxes({
    imagePath: resolveImage(values, positionals),
    boxes,
    outputPath: values.out as string | undefined,
    ...options,
  }, TOOL_CWD);
}

async function runPoint(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseCommandArgs(argv, {
    point: { type: "string" },
    radius: { type: "string" },
    size: { type: "string" },
    out: { type: "string", short: "o" },
  });
  if (values.help) return COMMAND_HELP.point;
  if (values.version) return VERSION;
  if (values.json) {
    const payload = await readJsonInput(values.json);
    validateJsonPayload("point", payload);
    return cropAroundPoint(payload as CropAroundPointInput, TOOL_CWD);
  }

  const missing: string[] = [];
  if (!values.image && positionals.length === 0) missing.push("<image>");
  if (!values.point) missing.push('--point "x,y"');
  if (values.radius === undefined && values.size === undefined) missing.push("--radius or --size");
  if (missing.length > 0) throw usageError("point", `missing ${missing.join(" and ")}`);
  if (values.radius !== undefined && values.size !== undefined) {
    throw new UsageError("--radius and --size are mutually exclusive");
  }
  const { label, point } = parsePointSpec(values.point as string);
  if (label) throw new UsageError('"vp point" does not accept a point label');

  const radius = parseOptionalNumber(values.radius as string | undefined, "--radius");
  if (radius !== undefined && radius <= 0) {
    throw new UsageError("--radius must be a positive number");
  }

  const options = coordinateOptions(values);
  hintContext.space = options.coordinateSpace;
  hintContext.coords = point;
  warnIfOverwriting(values.out as string | undefined);
  warnIfNotPng(values.out as string | undefined);

  return cropAroundPoint({
    imagePath: resolveImage(values, positionals),
    point,
    radius,
    size: values.size !== undefined ? parseSizeSpec(values.size as string) : undefined,
    outputPath: values.out as string | undefined,
    ...options,
  }, TOOL_CWD);
}

async function runColors(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseCommandArgs(argv, {
    point: { type: "string", multiple: true },
    patch: { type: "string" },
  });
  if (values.help) return COMMAND_HELP.colors;
  if (values.version) return VERSION;
  for (const [key, flag] of [["box-order", "--box-order"], ["padding", "--padding"], ["no-clamp", "--no-clamp"]] as const) {
    if (values[key] !== undefined) throw new UsageError(`${flag} does not apply to "vp colors"`);
  }
  if (values.json) {
    const payload = await readJsonInput(values.json);
    validateJsonPayload("colors", payload);
    return sampleColors(payload as SampleColorsInput, TOOL_CWD);
  }

  const pointSpecs = (values.point as string[] | undefined) ?? [];
  const missing: string[] = [];
  if (!values.image && positionals.length === 0) missing.push("<image>");
  if (pointSpecs.length === 0) missing.push('--point "[label:]x,y" (repeatable)');
  if (missing.length > 0) throw usageError("colors", `missing ${missing.join(" and ")}`);

  const patchSize = parseOptionalNumber(values.patch as string | undefined, "--patch");
  if (patchSize !== undefined && (!Number.isInteger(patchSize) || patchSize < 1)) {
    throw new UsageError("--patch must be a positive integer");
  }
  if (patchSize !== undefined && Number.isInteger(patchSize) && patchSize > 0 && patchSize % 2 === 0) {
    pendingWarnings.push(`--patch ${patchSize} is even; using ${patchSize + 1} (patch must be odd)`);
  }

  const coordinate = coordinateOptions(values);
  return sampleColors({
    imagePath: resolveImage(values, positionals),
    points: pointSpecs.map(parsePointSpec),
    coordinateSpace: coordinate.coordinateSpace,
    origin: coordinate.origin,
    patchSize,
  }, TOOL_CWD);
}

const COMMANDS: Record<string, (argv: string[]) => Promise<unknown>> = {
  crop: runCrop,
  "crop-multi": runCropMulti,
  annotate: runAnnotate,
  point: runPoint,
  colors: runColors,
};

function summarize(command: string, details: any): string | undefined {
  switch (command) {
    case "crop":
    case "point": {
      const box = details.resolvedPixelBox;
      return `cropped → ${details.outputPath} (${box.width}×${box.height}px${details.clamped ? ", clamped" : ""})`;
    }
    case "crop-multi": {
      const labels = details.crops.map((crop: any) => crop.label).filter(Boolean);
      const where = details.outputDir ?? (details.crops[0] ? dirname(details.crops[0].outputPath) : "");
      return `cropped ${details.crops.length} boxes${labels.length ? ` (${labels.join(", ")})` : ""} → ${where}`;
    }
    case "annotate":
      return `annotated ${details.boxes.length} box${details.boxes.length === 1 ? "" : "es"} → ${details.outputPath}`;
    case "colors":
      return `sampled ${details.samples.map((sample: any) => {
        const swatch = COLOR_ENABLED ? `\x1b[48;2;${sample.rgb.r};${sample.rgb.g};${sample.rgb.b}m  \x1b[0m ` : "";
        return `${swatch}${sample.label ?? `point-${sample.index + 1}`}=${sample.hex}`;
      }).join("  ")}`;
    default:
      return undefined;
  }
}

function clampWarning(item: any, label?: string): string | undefined {
  if (!item.clamped) return undefined;
  const kept = item.resolvedPixelBox.width * item.resolvedPixelBox.height;
  const asked = item.unclampedPixelBox.width * item.unclampedPixelBox.height;
  if (asked <= 0 || kept / asked >= 0.5) return undefined;
  const pct = (1 - kept / asked) * 100;
  const shown = pct >= 99.5 ? "over 99%" : `${Math.round(pct)}%`;
  return `${shown} of the requested box${label ? ` "${label}"` : ""} was outside the image and was clipped`;
}

function collectWarnings(command: string, details: any): string[] {
  const warnings: string[] = [];
  switch (command) {
    case "crop":
    case "point": {
      const warning = clampWarning(details);
      if (warning) warnings.push(warning);
      break;
    }
    case "crop-multi":
      for (const crop of details.crops) {
        const warning = clampWarning(crop, crop.label ?? `#${crop.index + 1}`);
        if (warning) warnings.push(warning);
      }
      break;
    case "annotate":
      for (const box of details.boxes) {
        const warning = clampWarning(box, box.label ?? `#${box.index + 1}`);
        if (warning) warnings.push(warning);
      }
      break;
    case "colors":
      for (const sample of details.samples) {
        if (sample.clamped) {
          warnings.push(`point ${sample.label ?? `#${sample.index + 1}`} [${sample.inputPoint.join(", ")}] is outside the image; sampled the nearest edge pixel (${sample.resolvedPixelPoint.x}, ${sample.resolvedPixelPoint.y})`);
        }
      }
      break;
  }
  const orientation = command === "crop-multi" ? details.crops[0]?.source?.orientation : details.source?.orientation;
  if (orientation !== undefined && orientation > 1) {
    warnings.push(`image has EXIF orientation ${orientation}; coordinates apply to the stored (un-rotated) pixels`);
  }
  return warnings;
}

function augmentError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;

  if (error.message.includes("completely outside")
    && hintContext.space === "pixel"
    && hintContext.coords?.every((value) => value >= 0 && value <= 999)) {
    error.message += "\nhint: all coordinates fall within 0-999 — if they are normalized visual-primitive coordinates, add --space 999";
  }

  const missingFile = error.message.match(/Input file is missing or cannot be read: (.+)/);
  if (missingFile) {
    const path = missingFile[1].trim();
    const dir = dirname(path);
    if (existsSync(dir)) {
      const suggestion = closestMatch(basename(path), readdirSync(dir));
      if (suggestion) error.message += `\nhint: did you mean "${join(dir, suggestion)}"?`;
    }
  }

  return error;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    console.log(GLOBAL_HELP);
    return;
  }
  if (command === "help") {
    const target = rest[0];
    if (!target) {
      console.log(GLOBAL_HELP);
      return;
    }
    if (COMMAND_HELP[target]) {
      console.log(COMMAND_HELP[target]);
      return;
    }
    const suggestion = closestMatch(target, Object.keys(COMMANDS));
    throw new UsageError(`unknown command "${target}"${suggestion ? `; did you mean "vp help ${suggestion}"?` : ""}`);
  }
  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }

  const run = COMMANDS[command];
  if (!run) {
    const suggestion = closestMatch(command, [...Object.keys(COMMANDS), "help"]);
    throw new UsageError(`unknown command "${command}"; ${suggestion ? `did you mean "${suggestion}"? ` : ""}expected one of: ${Object.keys(COMMANDS).join(", ")}`);
  }
  currentCommand = command;

  let result: unknown;
  try {
    result = await run(rest);
  } catch (error) {
    throw augmentError(error);
  }
  if (typeof result === "string") {
    console.log(result);
    return;
  }
  console.log(JSON.stringify(result, null, outputState.compact ? undefined : 2));
  if (!outputState.quiet) {
    for (const warning of [...pendingWarnings, ...collectWarnings(command, result)]) {
      console.error(paint(33, `warning: ${warning}`));
    }
    const summary = summarize(command, result);
    if (summary) console.error(summary);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(paint(31, `error: ${message}`));
  if (error instanceof UsageError && currentCommand && !message.includes("--help")) {
    console.error(`run "vp ${currentCommand} --help" for details`);
  }
  process.exit(error instanceof UsageError ? 2 : 1);
});
