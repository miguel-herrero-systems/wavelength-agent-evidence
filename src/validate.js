const captureKeys = new Set([
  "specVersion",
  "captureId",
  "capturedAt",
  "mode",
  "source",
  "interaction",
  "prepareSend",
  "terminalActivity",
  "httpObservation",
  "jobObservation",
  "limitations"
]);

const sourceKeys = new Set([
  "implementation",
  "network",
  "interface",
  "version",
  "recorder"
]);
const interactionKeys = new Set([
  "interactionId",
  "resource",
  "requestMethod",
  "requestBodyDigest",
  "requestDigest"
]);
const prepareKeys = new Set([
  "sendIntentIdCommitment",
  "invoiceCommitment",
  "amountSat",
  "expectedFeeSat",
  "feeKnown",
  "expectedTotalOutflowSat",
  "totalOutflowKnown",
  "rail",
  "quoteStatus",
  "paymentHash",
  "expiresAtUnix"
]);
const activityKeys = new Set([
  "activityId",
  "status",
  "kind",
  "amountSat",
  "feeSat",
  "paymentHash",
  "preimage",
  "settlement"
]);
const httpKeys = new Set([
  "requestDigest",
  "status",
  "responseBodyDigest",
  "observedAfterPayment"
]);
const jobKeys = new Set([
  "status",
  "sourceId",
  "sourceControl",
  "authoritative",
  "interactionRequestDigest"
]);

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const shaPattern = /^sha256:[a-f0-9]{64}$/u;
const hex32Pattern = /^[a-f0-9]{64}$/u;
const rails = new Set([
  "LIGHTNING",
  "IN_ARK",
  "ONCHAIN",
  "CREDIT",
  "MIXED",
  "OFFCHAIN_UNKNOWN",
  "UNKNOWN"
]);

export const PINNED_WAVELENGTH_COMMIT =
  "a1094c9f7787d8b91cecc1ee7ae9117e811478d3";
export const SUPPORTED_NETWORK = "signet";

export function validateCapture(capture) {
  assertRecord(capture, "capture");
  assertExactKeys(capture, captureKeys, "capture");
  assertEqual(capture.specVersion, "wavelength-evidence.capture/0.1", "specVersion");
  assertStringPattern(capture.captureId, idPattern, "captureId");
  assertDateTime(capture.capturedAt, "capturedAt");
  assertEnum(
    capture.mode,
    ["SYNTHETIC_DOCUMENTATION_FIXTURE", "IMPORTED_UNATTESTED"],
    "mode"
  );

  assertRecord(capture.source, "source");
  assertExactKeys(capture.source, sourceKeys, "source");
  assertEqual(capture.source.implementation, "lightninglabs/wavelength", "source.implementation");
  assertEqual(capture.source.network, SUPPORTED_NETWORK, "source.network");
  assertEnum(capture.source.interface, ["wallet-api", "wavecli"], "source.interface");
  assertEqual(capture.source.version, PINNED_WAVELENGTH_COMMIT, "source.version");
  assertNonEmptyString(capture.source.recorder, "source.recorder");

  assertRecord(capture.interaction, "interaction");
  assertExactKeys(capture.interaction, interactionKeys, "interaction");
  assertStringPattern(capture.interaction.interactionId, idPattern, "interaction.interactionId");
  assertUrl(capture.interaction.resource, "interaction.resource");
  assertEnum(
    capture.interaction.requestMethod,
    ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    "interaction.requestMethod"
  );
  assertStringPattern(
    capture.interaction.requestBodyDigest,
    shaPattern,
    "interaction.requestBodyDigest"
  );
  assertStringPattern(capture.interaction.requestDigest, shaPattern, "interaction.requestDigest");
  const expectedRequestDigest = sha256Json({
    method: capture.interaction.requestMethod,
    resource: capture.interaction.resource,
    bodyDigest: capture.interaction.requestBodyDigest
  });
  assertEqual(capture.interaction.requestDigest, expectedRequestDigest, "interaction.requestDigest");

  assertRecord(capture.prepareSend, "prepareSend");
  assertExactKeys(capture.prepareSend, prepareKeys, "prepareSend");
  assertStringPattern(
    capture.prepareSend.sendIntentIdCommitment,
    shaPattern,
    "prepareSend.sendIntentIdCommitment"
  );
  if (capture.prepareSend.invoiceCommitment !== undefined) {
    assertStringPattern(
      capture.prepareSend.invoiceCommitment,
      shaPattern,
      "prepareSend.invoiceCommitment"
    );
  }
  assertSafeInteger(capture.prepareSend.amountSat, 1, "prepareSend.amountSat");
  assertSafeInteger(capture.prepareSend.expectedFeeSat, 0, "prepareSend.expectedFeeSat");
  assertBoolean(capture.prepareSend.feeKnown, "prepareSend.feeKnown");
  assertSafeInteger(
    capture.prepareSend.expectedTotalOutflowSat,
    0,
    "prepareSend.expectedTotalOutflowSat"
  );
  assertBoolean(capture.prepareSend.totalOutflowKnown, "prepareSend.totalOutflowKnown");
  if (capture.prepareSend.feeKnown && capture.prepareSend.totalOutflowKnown) {
    assertEqual(
      capture.prepareSend.expectedTotalOutflowSat,
      capture.prepareSend.amountSat + capture.prepareSend.expectedFeeSat,
      "prepareSend.expectedTotalOutflowSat"
    );
  }
  assertEnum(capture.prepareSend.rail, rails, "prepareSend.rail");
  assertEnum(capture.prepareSend.quoteStatus, ["COMPLETE", "LOCAL_ONLY"], "prepareSend.quoteStatus");
  assertStringPattern(capture.prepareSend.paymentHash, hex32Pattern, "prepareSend.paymentHash");
  assertSafeInteger(capture.prepareSend.expiresAtUnix, 1, "prepareSend.expiresAtUnix");

  if (capture.terminalActivity !== undefined) {
    assertRecord(capture.terminalActivity, "terminalActivity");
    assertExactKeys(capture.terminalActivity, activityKeys, "terminalActivity");
    assertNonEmptyString(capture.terminalActivity.activityId, "terminalActivity.activityId");
    assertEnum(
      capture.terminalActivity.status,
      ["COMPLETE", "FAILED", "PENDING", "UNOBSERVED"],
      "terminalActivity.status"
    );
    assertEqual(capture.terminalActivity.kind, "SEND", "terminalActivity.kind");
    assertSafeInteger(capture.terminalActivity.amountSat, Number.MIN_SAFE_INTEGER, "terminalActivity.amountSat");
    assertSafeInteger(capture.terminalActivity.feeSat, 0, "terminalActivity.feeSat");
    assertStringPattern(
      capture.terminalActivity.paymentHash,
      hex32Pattern,
      "terminalActivity.paymentHash"
    );
    if (capture.terminalActivity.preimage !== undefined) {
      assertStringPattern(capture.terminalActivity.preimage, hex32Pattern, "terminalActivity.preimage");
    }
    assertEnum(capture.terminalActivity.settlement, rails, "terminalActivity.settlement");
  }

  if (capture.httpObservation !== undefined) {
    assertRecord(capture.httpObservation, "httpObservation");
    assertExactKeys(capture.httpObservation, httpKeys, "httpObservation");
    assertStringPattern(capture.httpObservation.requestDigest, shaPattern, "httpObservation.requestDigest");
    assertSafeInteger(capture.httpObservation.status, 100, "httpObservation.status", 599);
    assertStringPattern(
      capture.httpObservation.responseBodyDigest,
      shaPattern,
      "httpObservation.responseBodyDigest"
    );
    assertBoolean(capture.httpObservation.observedAfterPayment, "httpObservation.observedAfterPayment");
  }

  if (capture.jobObservation !== undefined) {
    assertRecord(capture.jobObservation, "jobObservation");
    assertExactKeys(capture.jobObservation, jobKeys, "jobObservation");
    assertEnum(
      capture.jobObservation.status,
      ["SUCCEEDED", "FAILED", "PENDING", "UNOBSERVED"],
      "jobObservation.status"
    );
    assertStringPattern(capture.jobObservation.sourceId, idPattern, "jobObservation.sourceId");
    assertEnum(
      capture.jobObservation.sourceControl,
      ["PROVIDER", "CLIENT", "THIRD_PARTY", "UNKNOWN"],
      "jobObservation.sourceControl"
    );
    assertBoolean(capture.jobObservation.authoritative, "jobObservation.authoritative");
    assertStringPattern(
      capture.jobObservation.interactionRequestDigest,
      shaPattern,
      "jobObservation.interactionRequestDigest"
    );
  }

  if (!Array.isArray(capture.limitations) || capture.limitations.length > 64) {
    throw new Error("limitations must be an array with at most 64 entries");
  }
  for (const [index, limitation] of capture.limitations.entries()) {
    assertNonEmptyString(limitation, `limitations[${index}]`);
  }
  return capture;
}

function assertRecord(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function assertExactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${path} contains unsupported field: ${key}`);
    }
  }
}

function assertEqual(actual, expected, path) {
  if (actual !== expected) {
    throw new Error(`${path} must equal ${expected}`);
  }
}

function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) {
    throw new Error(`${path} must be a non-empty bounded string`);
  }
}

function assertStringPattern(value, pattern, path) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${path} has an invalid format`);
  }
}

function assertDateTime(value, path) {
  assertNonEmptyString(value, path);
  const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
  if (!isoDateTime.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${path} must be an ISO date-time`);
  }
}

function assertUrl(value, path) {
  assertNonEmptyString(value, path);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${path} must be an absolute URL`);
  }
  const loopback = new Set(["127.0.0.1", "[::1]", "localhost"]).has(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error(`${path} must use https (http is accepted only for loopback)`);
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error(`${path} must not contain URL credentials`);
  }
}

function assertEnum(value, allowed, path) {
  const values = allowed instanceof Set ? allowed : new Set(allowed);
  if (!values.has(value)) {
    throw new Error(`${path} must be one of: ${[...values].join(", ")}`);
  }
}

function assertSafeInteger(value, minimum, path, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${path} must be a safe integer between ${minimum} and ${maximum}`);
  }
}

function assertBoolean(value, path) {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`);
  }
}
import { sha256Json } from "./canonical-json.js";
