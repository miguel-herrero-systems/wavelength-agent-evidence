#!/usr/bin/env node

import { chmod, readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeCapture } from "./analyze.js";
import { canonicalJson } from "./canonical-json.js";
import {
  inspectWavelengthInputFields,
  normalizeWavelengthCapture
} from "./normalize.js";
import { renderReportMarkdown } from "./render-markdown.js";

const MAX_INPUT_BYTES = 1024 * 1024;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_NAMES = [
  "completed-lightning",
  "paid-then-job-failed",
  "ambiguous-after-dispatch"
];

main().catch(error => {
  process.stderr.write(`Error: ${safeError(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  const [command = "help", ...tokens] = process.argv.slice(2);
  const options = parseOptions(tokens);
  if (command === "help" || command === "--help" || options.help === true) return showHelp();
  if (command === "demo") return runDemo(options);
  if (command === "analyze") return runAnalyze(options);
  if (command === "normalize") return runNormalize(options);
  if (command === "verify") return runVerify(options);
  if (command === "verify-demo") return runVerifyDemo(options);
  throw new Error(`unknown command: ${command}`);
}

async function runDemo(options) {
  assertAllowed(options, ["out"]);
  const outputDirectory = resolve(requiredOption(options, "out"));
  await mkdir(outputDirectory, { recursive: true });
  for (const name of FIXTURE_NAMES) {
    const capture = await readJson(join(PROJECT_ROOT, "fixtures", `${name}.json`));
    const report = analyzeCapture(capture);
    await writeJson(join(outputDirectory, `${name}.report.json`), report);
    await writeText(join(outputDirectory, `${name}.report.md`), renderReportMarkdown(report));
  }
  process.stdout.write(`Generated ${FIXTURE_NAMES.length} report pairs in ${outputDirectory}\n`);
}

async function runAnalyze(options) {
  assertAllowed(options, ["capture", "out", "markdown"]);
  const capture = await readJson(requiredOption(options, "capture"));
  const report = analyzeCapture(capture);
  if (options.out !== undefined) await writeJson(resolve(options.out), report);
  if (options.markdown !== undefined) {
    await writeText(resolve(options.markdown), renderReportMarkdown(report));
  }
  if (options.out === undefined && options.markdown === undefined) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Analyzed capture as ${report.reportId}\n`);
  }
}

async function runNormalize(options) {
  assertAllowed(options, [
    "prepare",
    "activity",
    "resource",
    "interaction-id",
    "capture-id",
    "captured-at",
    "method",
    "request-body-file",
    "invoice-file",
    "network",
    "version",
    "interface",
    "recorder",
    "manifest-out",
    "out"
  ]);
  const prepare = await readJson(requiredOption(options, "prepare"));
  const activity =
    options.activity === undefined ? undefined : await readJson(options.activity);
  const requestBodyBytes =
    options["request-body-file"] === undefined
      ? Buffer.alloc(0)
      : await readBytes(options["request-body-file"]);
  const invoiceBytes =
    options["invoice-file"] === undefined
      ? undefined
      : await readBytes(options["invoice-file"]);
  const interactionId = requiredOption(options, "interaction-id");
  const outputPath = resolve(requiredOption(options, "out"));
  const manifestPath = resolve(
    options["manifest-out"] ?? `${outputPath}.normalization-manifest.json`
  );
  const normalizationManifest = inspectWavelengthInputFields({ prepare, activity });
  await writeJson(manifestPath, normalizationManifest, { privateFile: true });
  const capture = normalizeWavelengthCapture({
    prepare,
    activity,
    captureId: options["capture-id"] ?? `capture-${interactionId}`,
    capturedAt: options["captured-at"] ?? new Date().toISOString(),
    interactionId,
    resource: requiredOption(options, "resource"),
    requestMethod: options.method ?? "GET",
    requestBodyBytes,
    invoiceBytes,
    network: requiredOption(options, "network"),
    version: requiredOption(options, "version"),
    interfaceName: requiredOption(options, "interface"),
    recorder: options.recorder ?? "wavelength-evidence-cli"
  });
  await writeJson(outputPath, capture, { privateFile: true });
  process.stdout.write(
    `Wrote private normalized capture ${capture.captureId} and field manifest; do not publish either file.\n`
  );
}

async function runVerify(options) {
  assertAllowed(options, ["capture", "report"]);
  const capture = await readJson(requiredOption(options, "capture"));
  const observedReport = await readJson(requiredOption(options, "report"));
  verifyReport(capture, observedReport);
  process.stdout.write(`Verified ${observedReport.reportId}\n`);
}

async function runVerifyDemo(options) {
  assertAllowed(options, ["dir"]);
  const reportDirectory = resolve(requiredOption(options, "dir"));
  const entries = new Set(await readdir(reportDirectory));
  for (const name of FIXTURE_NAMES) {
    const jsonName = `${name}.report.json`;
    const markdownName = `${name}.report.md`;
    if (!entries.has(jsonName) || !entries.has(markdownName)) {
      throw new Error(`demo output is missing ${jsonName} or ${markdownName}`);
    }
    const capture = await readJson(join(PROJECT_ROOT, "fixtures", `${name}.json`));
    const report = await readJson(join(reportDirectory, jsonName));
    verifyReport(capture, report);
    const markdown = await readText(join(reportDirectory, markdownName));
    if (markdown !== renderReportMarkdown(report)) {
      throw new Error(`${markdownName} does not match its JSON report`);
    }
    assertNoPrivateValueLeak(capture, JSON.stringify(report), markdown);
  }
  process.stdout.write(`Verified ${FIXTURE_NAMES.length} demo report pairs\n`);
}

function verifyReport(capture, observedReport) {
  const expectedReport = analyzeCapture(capture);
  if (canonicalJson(observedReport) !== canonicalJson(expectedReport)) {
    throw new Error("report does not match deterministic analysis of the capture");
  }
  assertNoPrivateValueLeak(capture, JSON.stringify(observedReport));
}

function assertNoPrivateValueLeak(capture, ...outputs) {
  const privateValues = [capture.terminalActivity?.preimage].filter(
    value => typeof value === "string" && value.length > 0
  );
  for (const output of outputs) {
    for (const secret of privateValues) {
      if (output.includes(secret)) throw new Error("derived output contains a private capture value");
    }
  }
}

function parseOptions(tokens) {
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new Error(`unexpected positional argument: ${token}`);
    const key = token.slice(2);
    if (key.length === 0 || Object.hasOwn(options, key)) {
      throw new Error(`invalid or duplicate option: ${token}`);
    }
    if (key === "help") {
      options.help = true;
      continue;
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`option ${token} requires a value`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function assertAllowed(options, allowed) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(options)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported option: --${key}`);
  }
}

function requiredOption(options, key) {
  const value = options[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing required option: --${key}`);
  }
  return value;
}

async function readJson(path) {
  const text = await readText(path);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`invalid JSON in ${resolve(path)}`);
  }
}

async function readText(path) {
  const bytes = await readBytes(path);
  return bytes.toString("utf8");
}

async function readBytes(path) {
  const resolved = resolve(path);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error(`input is not a regular file: ${resolved}`);
  if (metadata.size > MAX_INPUT_BYTES) {
    throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes: ${resolved}`);
  }
  return readFile(resolved);
}

async function writeJson(path, value, { privateFile = false } = {}) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`, { privateFile });
}

async function writeText(path, text, { privateFile = false } = {}) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, text, { encoding: "utf8", mode: privateFile ? 0o600 : 0o644 });
  if (privateFile) await chmod(resolved, 0o600);
}

function safeError(error) {
  if (error instanceof Error) return error.message.replace(/[\r\n]+/gu, " ");
  return "unexpected failure";
}

function showHelp() {
  process.stdout.write(`Wavelength evidence demo (offline, signet-only)\n\n`);
  process.stdout.write(`Commands:\n`);
  process.stdout.write(`  demo --out DIR\n`);
  process.stdout.write(`  analyze --capture FILE [--out FILE] [--markdown FILE]\n`);
  process.stdout.write(`  verify --capture FILE --report FILE\n`);
  process.stdout.write(`  verify-demo --dir DIR\n`);
  process.stdout.write(
    `  normalize --prepare FILE [--activity FILE] --resource URL --interaction-id ID --out FILE\n`
  );
  process.stdout.write(`\nNormalize options:\n`);
  process.stdout.write(`  --capture-id ID --captured-at ISO --method METHOD\n`);
  process.stdout.write(`  --request-body-file FILE --invoice-file FILE\n`);
  process.stdout.write(`  --network signet --version COMMIT --interface wallet-api|wavecli\n`);
  process.stdout.write(`  --recorder NAME --manifest-out FILE\n`);
  process.stdout.write(`\nNo command invokes Wavelength or performs a network/economic action.\n`);
}
