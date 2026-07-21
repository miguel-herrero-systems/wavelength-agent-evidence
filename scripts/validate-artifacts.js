import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { analyzeCapture } from "../src/analyze.js";
import { canonicalJson } from "../src/canonical-json.js";
import { renderReportMarkdown } from "../src/render-markdown.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CAPTURE_SCHEMA_PATH = join(PROJECT_ROOT, "schemas", "wavelength-capture.schema.json");
const REPORT_SCHEMA_PATH = join(PROJECT_ROOT, "schemas", "wavelength-report.schema.json");

const [captureSchema, reportSchema] = await Promise.all([
  readJson(CAPTURE_SCHEMA_PATH),
  readJson(REPORT_SCHEMA_PATH)
]);

const ajv = new Ajv2020({
  allErrors: true,
  strictSchema: true,
  strictTypes: false
});
addFormats(ajv);

// Compilation validates both schemas against the bundled Draft 2020-12 meta-schema.
const validateCaptureSchema = ajv.compile(captureSchema);
const validateReportSchema = ajv.compile(reportSchema);

const fixturePaths = await listFiles(join(PROJECT_ROOT, "fixtures"), ".json");
const generatedReportPaths = await listFiles(
  join(PROJECT_ROOT, "reports", "generated"),
  ".report.json"
);
const exampleReportPaths = await listFiles(join(PROJECT_ROOT, "examples"), ".report.json");

assertCount(fixturePaths, 3, "capture fixtures");
assertCount(generatedReportPaths, 3, "generated reports");
assertCount(exampleReportPaths, 1, "curated example reports");

for (const path of fixturePaths) {
  validateOrThrow(validateCaptureSchema, await readJson(path), path);
}
for (const path of [...generatedReportPaths, ...exampleReportPaths]) {
  validateOrThrow(validateReportSchema, await readJson(path), path);
}

for (const reportPath of exampleReportPaths) {
  const scenarioName = basename(reportPath, ".report.json");
  const capture = await readJson(join(PROJECT_ROOT, "fixtures", `${scenarioName}.json`));
  const observedReport = await readJson(reportPath);
  const expectedReport = analyzeCapture(capture);
  if (canonicalJson(observedReport) !== canonicalJson(expectedReport)) {
    throw new Error(`${reportPath} does not match deterministic analysis`);
  }
  const markdownPath = join(PROJECT_ROOT, "examples", `${scenarioName}.report.md`);
  const observedMarkdown = await readFile(markdownPath, "utf8");
  if (observedMarkdown !== renderReportMarkdown(expectedReport)) {
    throw new Error(`${markdownPath} does not match its JSON report`);
  }
}

process.stdout.write(
  `Validated 2 Draft 2020-12 schemas, ${fixturePaths.length} captures, ` +
  `${generatedReportPaths.length} generated reports, and ${exampleReportPaths.length} curated example.\n`
);

async function listFiles(directory, suffix) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith(suffix))
    .map(entry => join(directory, entry.name))
    .sort();
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`cannot parse JSON file ${path}: ${safeMessage(error)}`);
  }
}

function validateOrThrow(validate, value, path) {
  if (validate(value)) return;
  const details = (validate.errors ?? [])
    .map(error => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
  throw new Error(`${path} failed schema validation: ${details}`);
}

function assertCount(paths, expected, label) {
  if (paths.length !== expected) {
    throw new Error(`expected ${expected} ${label}, found ${paths.length}`);
  }
}

function safeMessage(error) {
  return error instanceof Error ? error.message.replace(/[\r\n]+/gu, " ") : "unknown error";
}
