import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeCapture } from "../src/analyze.js";
import { canonicalJson, sha256Json } from "../src/canonical-json.js";
import { renderReportMarkdown } from "../src/render-markdown.js";
import {
  PINNED_WAVELENGTH_COMMIT,
  SUPPORTED_NETWORK,
  validateCapture
} from "../src/validate.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const completed = await readFixture("completed-lightning");
const failedJob = await readFixture("paid-then-job-failed");
const pending = await readFixture("ambiguous-after-dispatch");

test("completed Lightning fixture proves the bounded happy-path claims", () => {
  const report = analyzeCapture(completed);

  assert.deepEqual(report.summary, { proven: 8, notProven: 0, unknown: 2 });
  assert.equal(claim(report, "PREPARE_SEND_OBSERVED").status, "PROVEN");
  assert.equal(claim(report, "PREPARE_ACTIVITY_PAYMENT_HASH_MATCH").status, "PROVEN");
  assert.equal(claim(report, "PREPARE_ACTIVITY_AMOUNT_MATCH").status, "PROVEN");
  assert.equal(claim(report, "PREIMAGE_MATCHES_PAYMENT_HASH").status, "PROVEN");
  assert.equal(claim(report, "WALLET_TERMINAL_SUCCESS").status, "PROVEN");
  assert.equal(
    claim(report, "SETTLEMENT_RAIL_RECORDED").reasonCode,
    "WAVELENGTH_RECORDED_RAIL_LIGHTNING"
  );
  assert.equal(claim(report, "HTTP_ACCESS_RESPONSE").status, "PROVEN");
  assert.equal(claim(report, "CAPTURE_RECORDED_JOB_SUCCESS").status, "PROVEN");
  assert.equal(claim(report, "PAYER_IDENTITY").status, "UNKNOWN");
  assert.equal(claim(report, "OBLIGATION_FULFILLED").status, "UNKNOWN");
  assert.equal(report.economicAction, "NOT_EVALUATED");
});

test("a completed payment and accepted HTTP response do not hide a failed job", () => {
  const report = analyzeCapture(failedJob);

  assert.deepEqual(report.summary, { proven: 7, notProven: 1, unknown: 2 });
  assert.equal(claim(report, "WALLET_TERMINAL_SUCCESS").status, "PROVEN");
  assert.equal(claim(report, "HTTP_ACCESS_RESPONSE").status, "PROVEN");
  assert.deepEqual(
    pickClaim(report, "CAPTURE_RECORDED_JOB_SUCCESS"),
    {
      status: "NOT_PROVEN",
      reasonCode: "AUTHORITATIVE_SOURCE_REPORTED_FAILURE"
    }
  );
  assert.equal(claim(report, "OBLIGATION_FULFILLED").status, "UNKNOWN");
  assert.equal(report.economicAction, "NOT_EVALUATED");
});

test("a pending dispatch remains ambiguous instead of becoming success or failure", () => {
  const report = analyzeCapture(pending);

  assert.deepEqual(report.summary, { proven: 3, notProven: 0, unknown: 7 });
  assert.deepEqual(
    pickClaim(report, "WALLET_TERMINAL_SUCCESS"),
    {
      status: "UNKNOWN",
      reasonCode: "WALLET_TERMINAL_STATE_NOT_OBSERVED"
    }
  );
  assert.deepEqual(
    pickClaim(report, "SETTLEMENT_RAIL_RECORDED"),
    {
      status: "UNKNOWN",
      reasonCode: "SETTLEMENT_RAIL_NOT_RESOLVED"
    }
  );
  assert.equal(claim(report, "HTTP_ACCESS_RESPONSE").status, "UNKNOWN");
  assert.equal(claim(report, "CAPTURE_RECORDED_JOB_SUCCESS").status, "UNKNOWN");
});

test("a payment-hash mismatch gates claims derived from the terminal activity", () => {
  const capture = clone(completed);
  capture.terminalActivity.paymentHash = "f".repeat(64);
  const report = analyzeCapture(capture);

  assert.deepEqual(
    pickClaim(report, "PREPARE_ACTIVITY_PAYMENT_HASH_MATCH"),
    { status: "NOT_PROVEN", reasonCode: "PAYMENT_HASH_MISMATCH" }
  );
  assert.equal(claim(report, "PREPARE_ACTIVITY_AMOUNT_MATCH").status, "PROVEN");
  for (const type of [
    "PREIMAGE_MATCHES_PAYMENT_HASH",
    "WALLET_TERMINAL_SUCCESS",
    "SETTLEMENT_RAIL_RECORDED"
  ]) {
    assert.deepEqual(pickClaim(report, type), {
      status: "UNKNOWN",
      reasonCode: "TERMINAL_ACTIVITY_NOT_BOUND_TO_PREPARE"
    });
  }
});

test("an amount mismatch independently gates preimage, wallet, and rail claims", () => {
  const capture = clone(completed);
  capture.terminalActivity.amountSat = -2101;
  const report = analyzeCapture(capture);

  assert.equal(claim(report, "PREPARE_ACTIVITY_PAYMENT_HASH_MATCH").status, "PROVEN");
  assert.deepEqual(pickClaim(report, "PREPARE_ACTIVITY_AMOUNT_MATCH"), {
    status: "NOT_PROVEN",
    reasonCode: "PAYMENT_AMOUNT_MISMATCH"
  });
  for (const type of [
    "PREIMAGE_MATCHES_PAYMENT_HASH",
    "WALLET_TERMINAL_SUCCESS",
    "SETTLEMENT_RAIL_RECORDED"
  ]) {
    assert.deepEqual(pickClaim(report, type), {
      status: "UNKNOWN",
      reasonCode: "TERMINAL_ACTIVITY_NOT_BOUND_TO_PREPARE"
    });
  }
});

test("a wrong preimage is reported as not proven without invalidating a bound wallet record", () => {
  const capture = clone(completed);
  capture.terminalActivity.preimage = "ff".repeat(32);
  const report = analyzeCapture(capture);

  assert.deepEqual(pickClaim(report, "PREIMAGE_MATCHES_PAYMENT_HASH"), {
    status: "NOT_PROVEN",
    reasonCode: "SHA256_PREIMAGE_MISMATCH"
  });
  assert.equal(claim(report, "WALLET_TERMINAL_SUCCESS").status, "PROVEN");
  assert.equal(claim(report, "SETTLEMENT_RAIL_RECORDED").status, "PROVEN");
});

test("an absent normalized preimage does not imply absence from upstream source data", () => {
  const capture = clone(completed);
  delete capture.terminalActivity.preimage;
  const preimageClaim = claim(analyzeCapture(capture), "PREIMAGE_MATCHES_PAYMENT_HASH");

  assert.equal(preimageClaim.status, "UNKNOWN");
  assert.equal(preimageClaim.reasonCode, "PAYMENT_PREIMAGE_NOT_OBSERVED");
  assert.deepEqual(preimageClaim.limitations, [
    "No preimage is present in the analyzed normalized capture, so this analyzer treats the hashlock predicate as unobserved.",
    "That absence does not establish that an upstream export contained no preimage; public reports never include raw preimages."
  ]);
});

test("HTTP evidence must bind to the canonical interaction request", () => {
  const capture = clone(completed);
  capture.httpObservation.requestDigest = `sha256:${"f".repeat(64)}`;
  const report = analyzeCapture(capture);

  assert.deepEqual(pickClaim(report, "HTTP_ACCESS_RESPONSE"), {
    status: "NOT_PROVEN",
    reasonCode: "HTTP_REQUEST_BINDING_MISMATCH"
  });
});

test("changing canonical request fields without recomputing the digest is rejected", () => {
  const capture = clone(completed);
  capture.interaction.resource = "https://demo.example/wavelength/other";

  assert.throws(
    () => analyzeCapture(capture),
    /interaction\.requestDigest must equal sha256:/u
  );
});

test("the public report reduces a resource URL to its origin and commitments", () => {
  const capture = clone(completed);
  const secret = "macaroon-secret-that-must-not-leak";
  capture.interaction.resource =
    `https://demo.example/wavelength/report?authorization=${secret}#private-fragment`;
  capture.interaction.requestDigest = sha256Json({
    method: capture.interaction.requestMethod,
    resource: capture.interaction.resource,
    bodyDigest: capture.interaction.requestBodyDigest
  });
  capture.httpObservation.requestDigest = capture.interaction.requestDigest;

  const report = analyzeCapture(capture);
  const serialized = JSON.stringify(report);
  assert.equal(report.subject.resourceOrigin, "https://demo.example");
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("private-fragment"), false);
  assert.equal(serialized.includes("/wavelength/report"), false);
  assert.equal(serialized.includes(capture.captureId), false);
  assert.equal(serialized.includes(capture.interaction.interactionId), false);
});

test("a job result must bind to the same canonical request", () => {
  const capture = clone(completed);
  capture.jobObservation.interactionRequestDigest = `sha256:${"f".repeat(64)}`;
  const report = analyzeCapture(capture);
  assert.deepEqual(pickClaim(report, "CAPTURE_RECORDED_JOB_SUCCESS"), {
    status: "NOT_PROVEN",
    reasonCode: "JOB_REQUEST_BINDING_MISMATCH"
  });
});

test("unsupported source commit and network fail closed", () => {
  const wrongCommit = clone(completed);
  wrongCommit.source.version = "0".repeat(40);
  assert.throws(
    () => validateCapture(wrongCommit),
    new RegExp(`source\\.version must equal ${PINNED_WAVELENGTH_COMMIT}`, "u")
  );

  const wrongNetwork = clone(completed);
  wrongNetwork.source.network = "mainnet";
  assert.throws(
    () => analyzeCapture(wrongNetwork),
    new RegExp(`source\\.network must equal ${SUPPORTED_NETWORK}`, "u")
  );
});

test("capture digest and report identifier are deterministic across object key order", () => {
  const originalBytes = JSON.stringify(completed);
  const first = analyzeCapture(completed);
  const reordered = reverseObjectKeys(completed);
  const second = analyzeCapture(reordered);

  assert.equal(first.input.captureDigest, second.input.captureDigest);
  assert.equal(first.reportId, second.reportId);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(JSON.stringify(completed), originalBytes, "analysis must not mutate its input");
});

test("JSON and Markdown reports omit the raw private preimage", () => {
  const report = analyzeCapture(completed);
  const json = JSON.stringify(report);
  const markdown = renderReportMarkdown(report);
  const secret = completed.terminalActivity.preimage;

  assert.equal(json.includes(secret), false);
  assert.equal(markdown.includes(secret), false);
  assert.equal(report.publicDisclosure.policy, "REDACTED_DERIVED_REPORT");
  assert.ok(report.publicDisclosure.omittedFields.includes("preimage"));
  assert.equal(report.economicAction, "NOT_EVALUATED");
});

test("unsafe integers are rejected by capture validation", () => {
  const capture = clone(completed);
  capture.prepareSend.amountSat = Number.MAX_SAFE_INTEGER + 1;

  assert.throws(
    () => analyzeCapture(capture),
    /prepareSend\.amountSat must be a safe integer/u
  );
});

test("unknown fields and inconsistent known totals fail closed", () => {
  const unknownField = clone(completed);
  unknownField.debug = true;
  assert.throws(
    () => analyzeCapture(unknownField),
    /capture contains unsupported field: debug/u
  );

  const inconsistentTotal = clone(completed);
  inconsistentTotal.prepareSend.expectedTotalOutflowSat += 1;
  assert.throws(
    () => analyzeCapture(inconsistentTotal),
    /prepareSend\.expectedTotalOutflowSat must equal 2104/u
  );
});

async function readFixture(name) {
  const text = await readFile(join(PROJECT_ROOT, "fixtures", `${name}.json`), "utf8");
  return JSON.parse(text);
}

function clone(value) {
  return structuredClone(value);
}

function claim(report, type) {
  const result = report.claims.find(candidate => candidate.type === type);
  assert.ok(result, `missing claim ${type}`);
  return result;
}

function pickClaim(report, type) {
  const result = claim(report, type);
  return { status: result.status, reasonCode: result.reasonCode };
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reverseObjectKeys(child)])
  );
}
