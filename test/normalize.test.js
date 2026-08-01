import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { analyzeCapture } from "../src/analyze.js";
import { sha256Bytes, sha256Json } from "../src/canonical-json.js";
import {
  inspectWavelengthInputFields,
  normalizeWavelengthCapture
} from "../src/normalize.js";
import {
  PINNED_WAVELENGTH_COMMIT,
  SUPPORTED_NETWORK
} from "../src/validate.js";

const PREIMAGE_HEX =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const PAYMENT_HASH_HEX =
  "630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd";
const SOURCE_METADATA = {
  network: SUPPORTED_NETWORK,
  version: PINNED_WAVELENGTH_COMMIT,
  interfaceName: "wallet-api"
};

test("normalizes snake_case proto JSON, integer strings, enum strings, and entry wrapper", () => {
  const rawIntentId = "intent-private-snake-case";
  const invoice = Buffer.from("lnsb1-private-invoice", "utf8");
  const requestBody = Buffer.from('{"prompt":"summarize"}', "utf8");
  const capture = normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    prepare: {
      prepare_send: snakePrepare({ send_intent_id: rawIntentId })
    },
    activity: {
      entry: snakeActivity()
    },
    captureId: "capture-snake-case",
    capturedAt: "2026-07-21T13:00:00Z",
    interactionId: "interaction-snake-case",
    resource: "https://agent.example/private/run?request=7#client-only",
    requestMethod: "post",
    requestBodyBytes: requestBody,
    invoiceBytes: invoice,
    interfaceName: "WAVECLI",
    recorder: "test-recorder",
    limitations: ["Test-only imported fixture."]
  });

  assert.equal(capture.mode, "IMPORTED_UNATTESTED");
  assert.deepEqual(capture.source, {
    implementation: "lightninglabs/wavelength",
    network: SUPPORTED_NETWORK,
    interface: "wavecli",
    version: PINNED_WAVELENGTH_COMMIT,
    recorder: "test-recorder"
  });
  assert.equal(
    capture.interaction.resource,
    "https://agent.example/private/run?request=7"
  );
  assert.equal(capture.interaction.requestMethod, "POST");
  assert.equal(capture.interaction.requestBodyDigest, sha256Bytes(requestBody));
  assert.equal(
    capture.interaction.requestDigest,
    sha256Json({
      method: "POST",
      resource: "https://agent.example/private/run?request=7",
      bodyDigest: sha256Bytes(requestBody)
    })
  );
  assert.equal(
    capture.prepareSend.sendIntentIdCommitment,
    sha256Bytes(Buffer.from(rawIntentId, "utf8"))
  );
  assert.equal(capture.prepareSend.invoiceCommitment, sha256Bytes(invoice));
  assert.deepEqual(
    {
      amountSat: capture.prepareSend.amountSat,
      expectedFeeSat: capture.prepareSend.expectedFeeSat,
      expectedTotalOutflowSat: capture.prepareSend.expectedTotalOutflowSat,
      rail: capture.prepareSend.rail,
      quoteStatus: capture.prepareSend.quoteStatus,
      paymentHash: capture.prepareSend.paymentHash,
      expiresAtUnix: capture.prepareSend.expiresAtUnix
    },
    {
      amountSat: 2100,
      expectedFeeSat: 4,
      expectedTotalOutflowSat: 2104,
      rail: "LIGHTNING",
      quoteStatus: "COMPLETE",
      paymentHash: PAYMENT_HASH_HEX,
      expiresAtUnix: 1784640000
    }
  );
  assert.deepEqual(capture.terminalActivity, {
    activityId: "activity-snake-case",
    status: "COMPLETE",
    kind: "SEND",
    amountSat: -2100,
    feeSat: 4,
    paymentHash: PAYMENT_HASH_HEX,
    preimage: PREIMAGE_HEX,
    settlement: "LIGHTNING"
  });
  assert.ok(capture.limitations.includes("Test-only imported fixture."));

  const serialized = JSON.stringify(capture);
  assert.equal(serialized.includes(rawIntentId), false);
  assert.equal(serialized.includes(invoice.toString("utf8")), false);
});

test("normalizes camelCase fields, base64 bytes, nested progress/trace, and response/result wrappers", () => {
  const preimageBytes = Buffer.alloc(32, 0xff);
  const paymentHashBytes = createHash("sha256").update(preimageBytes).digest();
  const preimageUrlBase64 = preimageBytes
    .toString("base64")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
  const capture = normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    prepare: {
      response: {
        sendIntentId: "intent-private-camel-case",
        amountSat: "7000",
        expectedFeeSat: "9",
        feeKnown: true,
        expectedTotalOutflowSat: "7009",
        totalOutflowKnown: true,
        rail: "send rail in ark",
        quoteStatus: "quote-status-complete",
        paymentHash: paymentHashBytes.toString("base64"),
        expiresAtUnix: "1784643600"
      }
    },
    activity: {
      result: {
        activityId: "activity-camel-case",
        status: "entry status complete",
        kind: "entry-kind-send",
        amountSat: "-7000",
        feeSat: "9",
        progress: {
          paymentHash: paymentHashBytes.toString("base64url"),
          preimage: preimageUrlBase64
        },
        trace: {
          settlementType: "settlement_type_in_ark"
        }
      }
    },
    captureId: "capture-camel-case",
    capturedAt: "2026-07-21T13:05:00+00:00",
    interactionId: "interaction-camel-case",
    resource: "https://agent.example/camel",
    interfaceName: "wallet-api"
  });

  assert.equal(capture.prepareSend.paymentHash, paymentHashBytes.toString("hex"));
  assert.equal(capture.prepareSend.rail, "IN_ARK");
  assert.equal(capture.terminalActivity.paymentHash, paymentHashBytes.toString("hex"));
  assert.equal(capture.terminalActivity.preimage, preimageBytes.toString("hex"));
  assert.equal(capture.terminalActivity.settlement, "IN_ARK");
  assert.equal(capture.terminalActivity.status, "COMPLETE");

  const report = analyzeCapture(capture);
  assert.equal(findClaim(report, "PREIMAGE_MATCHES_PAYMENT_HASH").status, "PROVEN");
  assert.equal(
    findClaim(report, "SETTLEMENT_RAIL_RECORDED").reasonCode,
    "WAVELENGTH_RECORDED_RAIL_IN_ARK"
  );
});

test("prepareSend and activity wrappers are accepted without leaking raw intent data", () => {
  const capture = normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    prepare: { prepareSend: snakePrepare({ send_intent_id: "wrapped-secret-intent" }) },
    activity: { activity: snakeActivity() },
    captureId: "capture-alternate-wrappers",
    capturedAt: "2026-07-21T13:10:00Z",
    interactionId: "interaction-alternate-wrappers",
    resource: "https://agent.example/wrappers"
  });

  assert.equal(capture.prepareSend.amountSat, 2100);
  assert.equal(capture.terminalActivity.activityId, "activity-snake-case");
  assert.equal(JSON.stringify(capture).includes("wrapped-secret-intent"), false);
});

test("normalizes the live InspectActivityResponse shape and allowlists only swap settlement", () => {
  const privateInvoice = "lntbs1-private-live-invoice";
  const privateSession = "private-funding-session";
  const activity = {
    entry: {
      ...snakeActivity({ trace: undefined }),
      request: { lightning_invoice: { invoice: privateInvoice } },
      counterparty: "private-counterparty"
    },
    swap: {
      settlement_type: "SETTLEMENT_TYPE_IN_ARK",
      invoice: privateInvoice,
      funding_session_id: privateSession
    },
    vtxos: [{ private_outpoint: "private-vtxo" }],
    ledger_rows: [{ private_row: "private-ledger-row" }],
    notes: ["private-note"]
  };
  const manifest = inspectWavelengthInputFields({
    prepare: snakePrepare(),
    activity
  });
  const capture = normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    prepare: snakePrepare(),
    activity,
    captureId: "capture-live-inspect-shape",
    capturedAt: "2026-08-01T00:00:00Z",
    interactionId: "interaction-live-inspect-shape",
    resource: "https://agent.example/live-inspect-shape"
  });

  assert.equal(capture.terminalActivity.settlement, "IN_ARK");
  assert.ok(manifest.unknownFieldPaths.includes("/activity/swap/invoice"));
  assert.ok(manifest.unknownFieldPaths.includes("/activity/swap/funding_session_id"));
  assert.ok(manifest.unknownFieldPaths.includes("/activity/vtxos"));
  assert.equal(manifest.unknownFieldPaths.includes("/activity/swap/settlement_type"), false);
  const serialized = JSON.stringify(capture);
  assert.equal(serialized.includes(privateInvoice), false);
  assert.equal(serialized.includes(privateSession), false);
});

test("normalization omits optional activity and invoice fields when they are not supplied", () => {
  const capture = normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    prepare: snakePrepare(),
    captureId: "capture-prepare-only",
    capturedAt: "2026-07-21T13:15:00Z",
    interactionId: "interaction-prepare-only",
    resource: "http://localhost:8080/protected"
  });

  assert.equal(capture.terminalActivity, undefined);
  assert.equal(capture.prepareSend.invoiceCommitment, undefined);
  const report = analyzeCapture(capture);
  assert.equal(findClaim(report, "WALLET_TERMINAL_SUCCESS").status, "UNKNOWN");
});

test("unsafe protobuf integer strings and unsafe numeric values are rejected", () => {
  const stringOverflow = snakePrepare({ amount_sat: "9007199254740992" });
  assert.throws(
    () => normalizeBase(stringOverflow),
    /prepare\.amount_sat must be a base-10 safe integer/u
  );

  const numericOverflow = snakePrepare({ expires_at_unix: Number.MAX_SAFE_INTEGER + 1 });
  assert.throws(
    () => normalizeBase(numericOverflow),
    /prepare\.expires_at_unix must be a safe integer/u
  );
});

test("normalization requires explicit pinned provenance", () => {
  assert.throws(
    () => normalizeBase(snakePrepare(), { network: "mainnet" }),
    /network must equal signet/u
  );
  assert.throws(
    () => normalizeBase(snakePrepare(), { version: "0".repeat(40) }),
    new RegExp(`version must equal ${PINNED_WAVELENGTH_COMMIT}`, "u")
  );
  assert.throws(
    () => normalizeBase(snakePrepare(), { interfaceName: undefined }),
    /interfaceName must be a non-empty bounded string/u
  );
});

test("malformed or non-32-byte base64 payment material is rejected", () => {
  assert.throws(
    () => normalizeBase(snakePrepare({ payment_hash: Buffer.alloc(31).toString("base64") })),
    /prepare\.payment_hash must be 32-byte hex or base64/u
  );
  assert.throws(
    () => normalizeBase(snakePrepare({ payment_hash: "not-base64***" })),
    /prepare\.payment_hash must be 32-byte hex or base64/u
  );
});

test("derived report omits raw intent, invoice, preimage, and URL secrets", () => {
  const rawIntent = "send-intent-raw-top-secret";
  const rawInvoice = Buffer.from("lnsb1invoice-top-secret", "utf8");
  const querySecret = "query-macaroon-top-secret";
  const capture = normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    prepare: snakePrepare({ send_intent_id: rawIntent }),
    activity: snakeActivity(),
    captureId: "capture-secret-boundary",
    capturedAt: "2026-07-21T13:20:00Z",
    interactionId: "interaction-secret-boundary",
    resource: `https://agent.example/protected?macaroon=${querySecret}#fragment-secret`,
    invoiceBytes: rawInvoice
  });
  const report = analyzeCapture(capture);
  const serialized = JSON.stringify(report);

  for (const secret of [
    rawIntent,
    rawInvoice.toString("utf8"),
    PREIMAGE_HEX,
    querySecret,
    "fragment-secret"
  ]) {
    assert.equal(serialized.includes(secret), false, `report leaked ${secret}`);
  }
  assert.equal(report.economicAction, "NOT_EVALUATED");
});

test("allowlist projection records unknown field paths privately without retaining values", () => {
  const unknownPrepareValue = "private-route-metadata-value";
  const unknownActivityValue = "private-node-identifier-value";
  const prepare = {
    response: {
      ...snakePrepare(),
      route_metadata: unknownPrepareValue
    },
    transport_envelope: "private-envelope-value"
  };
  const activity = {
    result: {
      ...snakeActivity(),
      progress: {
        payment_hash: PAYMENT_HASH_HEX,
        preimage: PREIMAGE_HEX,
        node_hint: unknownActivityValue
      }
    }
  };
  const manifest = inspectWavelengthInputFields({ prepare, activity });
  const capture = normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    prepare,
    activity,
    captureId: "capture-unknown-fields",
    capturedAt: "2026-08-01T00:00:00Z",
    interactionId: "interaction-unknown-fields",
    resource: "https://agent.example/unknown-fields"
  });
  const report = analyzeCapture(capture);
  const publicOutput = JSON.stringify(report);
  const privateManifest = JSON.stringify(manifest);

  assert.equal(manifest.policy, "ALLOWLIST_PROJECTION");
  assert.equal(manifest.valuesRetained, false);
  assert.deepEqual(manifest.unknownFieldPaths, [
    "/prepare/transport_envelope",
    "/prepare/response/route_metadata",
    "/activity/result/progress/node_hint"
  ]);
  assert.equal(manifest.unknownFieldCount, 3);
  assert.equal(manifest.pathsTruncated, false);
  assert.equal(privateManifest.includes(unknownPrepareValue), false);
  assert.equal(privateManifest.includes(unknownActivityValue), false);
  for (const token of [
    "route_metadata",
    "transport_envelope",
    "node_hint",
    unknownPrepareValue,
    unknownActivityValue
  ]) {
    assert.equal(JSON.stringify(capture).includes(token), false);
    assert.equal(publicOutput.includes(token), false);
  }
});

function normalizeBase(prepare, sourceOverrides = {}) {
  return normalizeWavelengthCapture({
    ...SOURCE_METADATA,
    ...sourceOverrides,
    prepare,
    captureId: "capture-normalize-base",
    capturedAt: "2026-07-21T13:30:00Z",
    interactionId: "interaction-normalize-base",
    resource: "https://agent.example/base"
  });
}

function snakePrepare(overrides = {}) {
  return {
    send_intent_id: "intent-private-default",
    amount_sat: "2100",
    expected_fee_sat: "4",
    fee_known: true,
    expected_total_outflow_sat: "2104",
    total_outflow_known: true,
    rail: "SEND_RAIL_LIGHTNING",
    quote_status: "QUOTE_STATUS_COMPLETE",
    payment_hash: PAYMENT_HASH_HEX,
    expires_at_unix: "1784640000",
    ...overrides
  };
}

function snakeActivity(overrides = {}) {
  return {
    id: "activity-snake-case",
    status: "ENTRY_STATUS_COMPLETE",
    kind: "ENTRY_KIND_SEND",
    amount_sat: "-2100",
    fee_sat: "4",
    progress: {
      payment_hash: PAYMENT_HASH_HEX,
      preimage: PREIMAGE_HEX
    },
    trace: {
      settlement_type: "SETTLEMENT_TYPE_LIGHTNING"
    },
    ...overrides
  };
}

function findClaim(report, type) {
  const result = report.claims.find(candidate => candidate.type === type);
  assert.ok(result, `missing claim ${type}`);
  return result;
}
