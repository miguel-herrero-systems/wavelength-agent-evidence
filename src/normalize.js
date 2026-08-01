import { sha256Bytes, sha256Json } from "./canonical-json.js";
import {
  PINNED_WAVELENGTH_COMMIT,
  SUPPORTED_NETWORK,
  validateCapture
} from "./validate.js";

const DEFAULT_LIMITATIONS = [
  "Imported JSON is treated as untrusted recorder input; this profile does not authenticate the daemon or operator.",
  "Source network, version, and interface are operator-declared metadata, not values derived from the exported records.",
  "Normalization is offline and never invokes PrepareSend, Send, or any network endpoint.",
  "The capture is private because it can contain a payment preimage; publish only the derived report."
];

const PREPARE_WRAPPERS = ["prepare_send", "prepareSend", "response"];
const PREPARE_FIELDS = new Set([
  "send_intent_id", "sendIntentId", "amount_sat", "amountSat",
  "expected_fee_sat", "expectedFeeSat", "fee_known", "feeKnown",
  "expected_total_outflow_sat", "expectedTotalOutflowSat",
  "total_outflow_known", "totalOutflowKnown", "rail", "quote_status",
  "quoteStatus", "payment_hash", "paymentHash", "expires_at_unix",
  "expiresAtUnix"
]);
const ACTIVITY_WRAPPERS = ["entry", "activity", "result"];
const ACTIVITY_FIELDS = new Set([
  "id", "activity_id", "activityId", "status", "kind", "amount_sat",
  "amountSat", "fee_sat", "feeSat", "payment_hash", "paymentHash",
  "preimage", "settlement", "settlement_type", "settlementType",
  "progress", "trace"
]);
const PROGRESS_FIELDS = new Set(["payment_hash", "paymentHash", "preimage"]);
const TRACE_FIELDS = new Set(["settlement", "settlement_type", "settlementType"]);
const ACTIVITY_RESPONSE_SIBLINGS = new Map([
  ["swap", new Set(["settlement", "settlement_type", "settlementType"])]
]);
const MAX_RECORDED_UNKNOWN_FIELDS = 256;

export function inspectWavelengthInputFields({ prepare, activity }) {
  const unknownFieldPaths = [];
  collectUnknownFields({
    input: prepare,
    source: "prepare",
    wrappers: PREPARE_WRAPPERS,
    fields: PREPARE_FIELDS,
    nested: new Map()
  }, unknownFieldPaths);
  if (activity !== undefined) {
    collectUnknownFields({
      input: activity,
      source: "activity",
      wrappers: ACTIVITY_WRAPPERS,
      fields: ACTIVITY_FIELDS,
      nested: new Map([
        ["progress", PROGRESS_FIELDS],
        ["trace", TRACE_FIELDS]
      ]),
      wrapperSiblings: ACTIVITY_RESPONSE_SIBLINGS,
      wrapperSiblingsFor: "entry"
    }, unknownFieldPaths);
  }

  return {
    specVersion: "wavelength-evidence.normalization-manifest/0.1",
    policy: "ALLOWLIST_PROJECTION",
    valuesRetained: false,
    unknownFieldCount: unknownFieldPaths.length,
    unknownFieldPaths: unknownFieldPaths.slice(0, MAX_RECORDED_UNKNOWN_FIELDS),
    pathsTruncated: unknownFieldPaths.length > MAX_RECORDED_UNKNOWN_FIELDS
  };
}

export function normalizeWavelengthCapture({
  prepare,
  activity,
  captureId,
  capturedAt,
  interactionId,
  resource,
  requestMethod = "GET",
  requestBodyBytes = Buffer.alloc(0),
  invoiceBytes,
  network,
  version,
  interfaceName,
  recorder = "wavelength-evidence-cli",
  limitations = []
}) {
  const prepared = unwrapRecord(prepare, PREPARE_WRAPPERS, "prepare");
  const declaredNetwork = requiredString(network, "network").toLowerCase();
  const declaredVersion = requiredString(version, "version");
  if (declaredNetwork !== SUPPORTED_NETWORK) {
    throw new Error(`network must equal ${SUPPORTED_NETWORK}`);
  }
  if (declaredVersion !== PINNED_WAVELENGTH_COMMIT) {
    throw new Error(`version must equal ${PINNED_WAVELENGTH_COMMIT}`);
  }
  const normalizedResource = normalizeUrl(resource);
  const method = normalizeMethod(requestMethod);
  const requestBodyDigest = sha256Bytes(asBuffer(requestBodyBytes, "requestBodyBytes"));
  const requestDigest = sha256Json({
    method,
    resource: normalizedResource,
    bodyDigest: requestBodyDigest
  });

  const rawIntentId = requiredString(
    pick(prepared, ["send_intent_id", "sendIntentId"]),
    "prepare.send_intent_id"
  );
  const paymentHash = normalizeBytes32(
    pick(prepared, ["payment_hash", "paymentHash"]),
    "prepare.payment_hash"
  );

  const capture = {
    specVersion: "wavelength-evidence.capture/0.1",
    captureId: requiredString(captureId, "captureId"),
    capturedAt: requiredString(capturedAt, "capturedAt"),
    mode: "IMPORTED_UNATTESTED",
    source: {
      implementation: "lightninglabs/wavelength",
      network: declaredNetwork,
      interface: normalizeInterface(interfaceName),
      version: declaredVersion,
      recorder: requiredString(recorder, "recorder")
    },
    interaction: {
      interactionId: requiredString(interactionId, "interactionId"),
      resource: normalizedResource,
      requestMethod: method,
      requestBodyDigest,
      requestDigest
    },
    prepareSend: {
      sendIntentIdCommitment: sha256Bytes(Buffer.from(rawIntentId, "utf8")),
      invoiceCommitment:
        invoiceBytes === undefined
          ? undefined
          : sha256Bytes(asBuffer(invoiceBytes, "invoiceBytes")),
      amountSat: safeInteger(pick(prepared, ["amount_sat", "amountSat"]), "prepare.amount_sat"),
      expectedFeeSat: safeInteger(
        pick(prepared, ["expected_fee_sat", "expectedFeeSat"]),
        "prepare.expected_fee_sat"
      ),
      feeKnown: booleanValue(pick(prepared, ["fee_known", "feeKnown"]), "prepare.fee_known"),
      expectedTotalOutflowSat: safeInteger(
        pick(prepared, ["expected_total_outflow_sat", "expectedTotalOutflowSat"]),
        "prepare.expected_total_outflow_sat"
      ),
      totalOutflowKnown: booleanValue(
        pick(prepared, ["total_outflow_known", "totalOutflowKnown"]),
        "prepare.total_outflow_known"
      ),
      rail: normalizeRail(pick(prepared, ["rail"]), "prepare.rail"),
      quoteStatus: normalizeQuoteStatus(
        pick(prepared, ["quote_status", "quoteStatus"]),
        "prepare.quote_status"
      ),
      paymentHash,
      expiresAtUnix: safeInteger(
        pick(prepared, ["expires_at_unix", "expiresAtUnix"]),
        "prepare.expires_at_unix"
      )
    },
    terminalActivity:
      activity === undefined ? undefined : normalizeActivity(activity),
    httpObservation: undefined,
    jobObservation: undefined,
    limitations: [...DEFAULT_LIMITATIONS, ...limitations.map(String)]
  };

  return validateCapture(capture);
}

function normalizeActivity(input) {
  const selected = selectRecord(input, ACTIVITY_WRAPPERS, "activity");
  const activity = selected.record;
  const progress = optionalRecord(activity.progress);
  const trace = optionalRecord(activity.trace);
  const swap = selected.wrapperName === "entry" ? optionalRecord(input.swap) : undefined;
  const paymentHash = pick(activity, ["payment_hash", "paymentHash"])
    ?? pick(progress, ["payment_hash", "paymentHash"]);
  const preimageValue = pick(activity, ["preimage"])
    ?? pick(progress, ["preimage"]);
  const settlementValue = pick(activity, ["settlement", "settlement_type", "settlementType"])
    ?? pick(trace, ["settlement", "settlement_type", "settlementType"])
    ?? pick(swap, ["settlement", "settlement_type", "settlementType"]);

  return {
    activityId: requiredString(
      pick(activity, ["id", "activity_id", "activityId"]),
      "activity.id"
    ),
    status: normalizeActivityStatus(pick(activity, ["status"]), "activity.status"),
    kind: normalizeActivityKind(pick(activity, ["kind"]), "activity.kind"),
    amountSat: safeInteger(pick(activity, ["amount_sat", "amountSat"]), "activity.amount_sat"),
    feeSat: safeInteger(pick(activity, ["fee_sat", "feeSat"]), "activity.fee_sat"),
    paymentHash: normalizeBytes32(paymentHash, "activity.payment_hash"),
    preimage:
      preimageValue === undefined || preimageValue === null || preimageValue === ""
        ? undefined
        : normalizeBytes32(preimageValue, "activity.preimage"),
    settlement:
      settlementValue === undefined || settlementValue === null || settlementValue === ""
        ? "UNKNOWN"
        : normalizeRail(settlementValue, "activity.settlement")
  };
}

function normalizeUrl(value) {
  const text = requiredString(value, "resource");
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error("resource must be an absolute URL");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("resource must not contain URL credentials");
  }
  parsed.hash = "";
  return parsed.toString();
}

function normalizeMethod(value) {
  const method = requiredString(value, "requestMethod").toUpperCase();
  if (!new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]).has(method)) {
    throw new Error("requestMethod is unsupported");
  }
  return method;
}

function normalizeInterface(value) {
  const normalized = requiredString(value, "interfaceName").toLowerCase();
  if (!new Set(["wallet-api", "wavecli"]).has(normalized)) {
    throw new Error("interfaceName must be wallet-api or wavecli");
  }
  return normalized;
}

function normalizeRail(value, path) {
  const token = enumToken(value, path);
  if (token.includes("LIGHTNING")) return "LIGHTNING";
  if (token.includes("IN_ARK") || token === "ARK" || token.endsWith("_ARK")) return "IN_ARK";
  if (token.includes("ONCHAIN") || token.includes("ON_CHAIN")) return "ONCHAIN";
  if (token.includes("CREDIT")) return "CREDIT";
  if (token.includes("MIXED")) return "MIXED";
  if (token.includes("OFFCHAIN_UNKNOWN") || token.includes("OFF_CHAIN_UNKNOWN")) {
    return "OFFCHAIN_UNKNOWN";
  }
  if (token === "UNKNOWN" || token.endsWith("_UNKNOWN") || token.endsWith("_UNSPECIFIED")) {
    return "UNKNOWN";
  }
  throw new Error(`${path} is an unsupported rail`);
}

function normalizeQuoteStatus(value, path) {
  const token = enumToken(value, path);
  if (token === "COMPLETE" || token.endsWith("_COMPLETE")) return "COMPLETE";
  if (token === "LOCAL_ONLY" || token.endsWith("_LOCAL_ONLY")) return "LOCAL_ONLY";
  throw new Error(`${path} is an unsupported quote status`);
}

function normalizeActivityStatus(value, path) {
  const token = enumToken(value, path);
  for (const status of ["COMPLETE", "FAILED", "PENDING", "UNOBSERVED"]) {
    if (token === status || token.endsWith(`_${status}`)) return status;
  }
  throw new Error(`${path} is unsupported`);
}

function normalizeActivityKind(value, path) {
  const token = enumToken(value, path);
  if (token === "SEND" || token.endsWith("_SEND")) return "SEND";
  throw new Error(`${path} must describe a SEND activity`);
}

function enumToken(value, path) {
  return requiredString(value, path)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function normalizeBytes32(value, path) {
  const text = requiredString(value, path).trim();
  const hex = text.replace(/^0x/iu, "");
  if (/^[a-f0-9]{64}$/iu.test(hex)) return hex.toLowerCase();

  const base64Input = text.replace(/-/gu, "+").replace(/_/gu, "/").replace(/=+$/u, "");
  if (!/^[A-Za-z0-9+/]+$/u.test(base64Input)) {
    throw new Error(`${path} must be 32-byte hex or base64`);
  }
  const decoded = Buffer.from(base64Input, "base64");
  const canonical = decoded.toString("base64").replace(/=+$/u, "");
  if (decoded.length !== 32 || canonical !== base64Input) {
    throw new Error(`${path} must be 32-byte hex or base64`);
  }
  return decoded.toString("hex");
}

function safeInteger(value, path) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`${path} must be a safe integer`);
    return value;
  }
  if (typeof value === "string" && /^-?(?:0|[1-9][0-9]*)$/u.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error(`${path} must be a base-10 safe integer`);
}

function booleanValue(value, path) {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
}

function requiredString(value, path) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) {
    throw new Error(`${path} must be a non-empty bounded string`);
  }
  return value;
}

function unwrapRecord(value, wrapperNames, path) {
  return selectRecord(value, wrapperNames, path).record;
}

function selectRecord(value, wrapperNames, path) {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  for (const name of wrapperNames) {
    if (isRecord(value[name])) return { record: value[name], wrapperName: name };
  }
  return { record: value, wrapperName: undefined };
}

function collectUnknownFields({
  input,
  source,
  wrappers,
  fields,
  nested,
  wrapperSiblings = new Map(),
  wrapperSiblingsFor
}, output) {
  const selected = selectRecord(input, wrappers, source);
  const rootPath = selected.wrapperName === undefined
    ? `/${source}`
    : `/${source}/${jsonPointerToken(selected.wrapperName)}`;

  if (selected.wrapperName !== undefined) {
    for (const key of Object.keys(input)) {
      if (key === selected.wrapperName) continue;
      const siblingFields = selected.wrapperName === wrapperSiblingsFor
        ? wrapperSiblings.get(key)
        : undefined;
      if (siblingFields === undefined || !isRecord(input[key])) {
        output.push(`/${source}/${jsonPointerToken(key)}`);
        continue;
      }
      for (const siblingKey of Object.keys(input[key])) {
        if (!siblingFields.has(siblingKey)) {
          output.push(
            `/${source}/${jsonPointerToken(key)}/${jsonPointerToken(siblingKey)}`
          );
        }
      }
    }
  }

  for (const key of Object.keys(selected.record)) {
    if (!fields.has(key)) {
      output.push(`${rootPath}/${jsonPointerToken(key)}`);
      continue;
    }
    const nestedFields = nested.get(key);
    const nestedValue = selected.record[key];
    if (nestedFields !== undefined && isRecord(nestedValue)) {
      for (const nestedKey of Object.keys(nestedValue)) {
        if (!nestedFields.has(nestedKey)) {
          output.push(`${rootPath}/${jsonPointerToken(key)}/${jsonPointerToken(nestedKey)}`);
        }
      }
    }
  }
}

function jsonPointerToken(value) {
  return value.replace(/~/gu, "~0").replace(/\//gu, "~1");
}

function optionalRecord(value) {
  return isRecord(value) ? value : undefined;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pick(record, names) {
  if (record === undefined) return undefined;
  for (const name of names) {
    if (Object.hasOwn(record, name)) return record[name];
  }
  return undefined;
}

function asBuffer(value, path) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value);
  throw new Error(`${path} must contain bytes`);
}
