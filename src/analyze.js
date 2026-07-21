import { sha256Bytes, sha256HexBytes, sha256Json } from "./canonical-json.js";
import { validateCapture } from "./validate.js";

export function analyzeCapture(input) {
  const capture = validateCapture(structuredClone(input));
  const captureDigest = sha256Json(capture);
  const claims = [
    prepareObserved(capture),
    paymentHashBinding(capture),
    amountBinding(capture),
    preimageBinding(capture),
    walletTerminalSuccess(capture),
    settlementRailRecorded(capture),
    httpAccessObserved(capture),
    jobTerminalSuccess(capture),
    unknownClaim(
      "payer-identity",
      "PAYER_IDENTITY",
      "PAYER_IDENTITY_NOT_ESTABLISHED",
      ["A payment hash, preimage, and local wallet record do not identify the economic payer."]
    ),
    unknownClaim(
      "obligation-fulfilled",
      "OBLIGATION_FULFILLED",
      "COMMERCIAL_OBLIGATION_NOT_EVALUATED",
      [
        "Payment and transport observations do not establish correctness, utility, or full commercial fulfilment.",
        "No economic action follows from this report."
      ]
    )
  ];
  const summary = claims.reduce(
    (counts, claim) => {
      counts[toSummaryKey(claim.status)] += 1;
      return counts;
    },
    { proven: 0, notProven: 0, unknown: 0 }
  );

  return {
    specVersion: "wavelength-evidence.report/0.1",
    reportId: `wer-${captureDigest.slice("sha256:".length, "sha256:".length + 24)}`,
    capturedAt: capture.capturedAt,
    input: {
      captureIdCommitment: sha256Bytes(Buffer.from(capture.captureId, "utf8")),
      captureDigest,
      mode: capture.mode,
      implementation: capture.source.implementation,
      network: capture.source.network,
      interface: capture.source.interface,
      sourceVersion: capture.source.version
    },
    subject: {
      interactionIdCommitment: sha256Bytes(
        Buffer.from(capture.interaction.interactionId, "utf8")
      ),
      resourceOrigin: resourceOrigin(capture.interaction.resource),
      resourceCommitment: sha256Bytes(Buffer.from(capture.interaction.resource, "utf8")),
      requestDigest: capture.interaction.requestDigest
    },
    claims,
    summary,
    publicDisclosure: {
      policy: "REDACTED_DERIVED_REPORT",
      omittedFields: [
        "invoice",
        "send_intent_id",
        "preimage",
        "L402 authorization",
        "macaroon",
        "captureId",
        "interactionId",
        "URL path, query, and fragment"
      ],
      note: "The report contains derived results, commitments, and coarse metadata; it omits bearer credentials and raw payment secrets."
    },
    economicAction: "NOT_EVALUATED",
    disclaimerCode: "EVIDENCE_ANALYSIS_ONLY"
  };
}

function prepareObserved(capture) {
  const limitations = [
    "The capture records a prepared Wavelength intent; it does not show that Send was called.",
    "The recorder and Wavelength daemon identity are not independently authenticated by this profile."
  ];
  if (capture.prepareSend.quoteStatus === "LOCAL_ONLY") {
    limitations.push("The quote was local-only and may not include a binding remote fee or rail quote.");
  }
  return claim(
    "prepare-send-observed",
    "PREPARE_SEND_OBSERVED",
    "PROVEN",
    "PREPARE_SEND_CAPTURE_VALID",
    ["prepareSend"],
    limitations
  );
}

function paymentHashBinding(capture) {
  const activity = capture.terminalActivity;
  if (activity === undefined || activity.status === "UNOBSERVED") {
    return unknownClaim(
      "payment-hash-binding",
      "PREPARE_ACTIVITY_PAYMENT_HASH_MATCH",
      "TERMINAL_ACTIVITY_NOT_OBSERVED",
      ["There is no terminal wallet activity to correlate with the prepared payment hash."]
    );
  }
  return activity.paymentHash === capture.prepareSend.paymentHash
    ? claim(
        "payment-hash-binding",
        "PREPARE_ACTIVITY_PAYMENT_HASH_MATCH",
        "PROVEN",
        "PAYMENT_HASH_MATCHED",
        ["prepareSend.paymentHash", "terminalActivity.paymentHash"],
        ["This binds two recorder-supplied fields; it does not independently identify a network payment."]
      )
    : claim(
        "payment-hash-binding",
        "PREPARE_ACTIVITY_PAYMENT_HASH_MATCH",
        "NOT_PROVEN",
        "PAYMENT_HASH_MISMATCH",
        ["prepareSend.paymentHash", "terminalActivity.paymentHash"],
        ["The terminal activity cannot be attributed to the prepared invoice under this profile."]
      );
}

function amountBinding(capture) {
  const activity = capture.terminalActivity;
  if (activity === undefined || activity.status === "UNOBSERVED") {
    return unknownClaim(
      "amount-binding",
      "PREPARE_ACTIVITY_AMOUNT_MATCH",
      "TERMINAL_ACTIVITY_NOT_OBSERVED",
      ["There is no terminal wallet activity to compare with the prepared amount."]
    );
  }
  return Math.abs(activity.amountSat) === capture.prepareSend.amountSat
    ? claim(
        "amount-binding",
        "PREPARE_ACTIVITY_AMOUNT_MATCH",
        "PROVEN",
        "PAYMENT_AMOUNT_MATCHED",
        ["prepareSend.amountSat", "terminalActivity.amountSat"],
        ["The terminal amount may be signed as an outflow; this profile compares its absolute value."]
      )
    : claim(
        "amount-binding",
        "PREPARE_ACTIVITY_AMOUNT_MATCH",
        "NOT_PROVEN",
        "PAYMENT_AMOUNT_MISMATCH",
        ["prepareSend.amountSat", "terminalActivity.amountSat"],
        ["The terminal activity is not treated as the prepared interaction under this profile."]
      );
}

function preimageBinding(capture) {
  const activity = capture.terminalActivity;
  if (activity?.preimage === undefined) {
    return unknownClaim(
      "preimage-binding",
      "PREIMAGE_MATCHES_PAYMENT_HASH",
      "PAYMENT_PREIMAGE_NOT_OBSERVED",
      ["No preimage was supplied to the private capture; the public report never includes it."]
    );
  }
  if (!activityContextMatches(capture)) {
    return unknownClaim(
      "preimage-binding",
      "PREIMAGE_MATCHES_PAYMENT_HASH",
      "TERMINAL_ACTIVITY_NOT_BOUND_TO_PREPARE",
      ["The activity payment hash and amount must match the prepared intent before its preimage is used."]
    );
  }
  const matches = sha256HexBytes(activity.preimage) === capture.prepareSend.paymentHash;
  return matches
    ? claim(
        "preimage-binding",
        "PREIMAGE_MATCHES_PAYMENT_HASH",
        "PROVEN",
        "SHA256_PREIMAGE_MATCHED_PAYMENT_HASH",
        ["prepareSend.paymentHash", "terminalActivity.preimage"],
        [
          "The hashlock relation is established, but it does not identify who paid.",
          "It does not by itself prove whether settlement used Lightning, Ark, credit, or another recorded rail."
        ]
      )
    : claim(
        "preimage-binding",
        "PREIMAGE_MATCHES_PAYMENT_HASH",
        "NOT_PROVEN",
        "SHA256_PREIMAGE_MISMATCH",
        ["prepareSend.paymentHash", "terminalActivity.preimage"],
        []
      );
}

function walletTerminalSuccess(capture) {
  const activity = capture.terminalActivity;
  if (activity === undefined || new Set(["PENDING", "UNOBSERVED"]).has(activity.status)) {
    return unknownClaim(
      "wallet-terminal-success",
      "WALLET_TERMINAL_SUCCESS",
      "WALLET_TERMINAL_STATE_NOT_OBSERVED",
      ["A dispatched payment can have an ambiguous outcome until durable terminal activity is observed."]
    );
  }
  if (!activityContextMatches(capture)) {
    return unknownClaim(
      "wallet-terminal-success",
      "WALLET_TERMINAL_SUCCESS",
      "TERMINAL_ACTIVITY_NOT_BOUND_TO_PREPARE",
      ["A terminal status from an activity with a different hash or amount cannot prove this interaction."]
    );
  }
  return activity.status === "COMPLETE"
    ? claim(
        "wallet-terminal-success",
        "WALLET_TERMINAL_SUCCESS",
        "PROVEN",
        "WAVELENGTH_RECORDED_COMPLETE",
        ["terminalActivity.status"],
        ["This is the local Wavelength wallet's durable status, not an independent network attestation."]
      )
    : claim(
        "wallet-terminal-success",
        "WALLET_TERMINAL_SUCCESS",
        "NOT_PROVEN",
        "WAVELENGTH_RECORDED_FAILED",
        ["terminalActivity.status"],
        []
      );
}

function settlementRailRecorded(capture) {
  const rail = capture.terminalActivity?.settlement;
  if (rail === undefined || new Set(["UNKNOWN", "OFFCHAIN_UNKNOWN"]).has(rail)) {
    return unknownClaim(
      "settlement-rail",
      "SETTLEMENT_RAIL_RECORDED",
      "SETTLEMENT_RAIL_NOT_RESOLVED",
      ["A BOLT-11 invoice must not be treated as proof that the payment traversed Lightning."]
    );
  }
  if (!activityContextMatches(capture)) {
    return unknownClaim(
      "settlement-rail",
      "SETTLEMENT_RAIL_RECORDED",
      "TERMINAL_ACTIVITY_NOT_BOUND_TO_PREPARE",
      ["A rail recorded on a different activity cannot be attributed to this interaction."]
    );
  }
  return claim(
    "settlement-rail",
    "SETTLEMENT_RAIL_RECORDED",
    "PROVEN",
    `WAVELENGTH_RECORDED_RAIL_${rail}`,
    ["terminalActivity.settlement"],
    [
      `The recorder reports ${rail}; this report does not independently replay or verify that rail.`,
      "The rail declaration is intentionally separate from the preimage/hashlock predicate."
    ]
  );
}

function httpAccessObserved(capture) {
  const observation = capture.httpObservation;
  if (observation === undefined) {
    return unknownClaim(
      "http-access",
      "HTTP_ACCESS_RESPONSE",
      "HTTP_RESPONSE_NOT_OBSERVED",
      ["Payment evidence alone does not show that a protected resource was returned."]
    );
  }
  if (observation.requestDigest !== capture.interaction.requestDigest) {
    return claim(
      "http-access",
      "HTTP_ACCESS_RESPONSE",
      "NOT_PROVEN",
      "HTTP_REQUEST_BINDING_MISMATCH",
      ["interaction.requestDigest", "httpObservation.requestDigest"],
      []
    );
  }
  if (!observation.observedAfterPayment) {
    return unknownClaim(
      "http-access",
      "HTTP_ACCESS_RESPONSE",
      "HTTP_PAYMENT_ORDER_NOT_ESTABLISHED",
      ["The recorder did not establish that the response followed the payment attempt."]
    );
  }
  return observation.status >= 200 && observation.status < 300
    ? claim(
        "http-access",
        "HTTP_ACCESS_RESPONSE",
        "PROVEN",
        "BOUND_HTTP_SUCCESS_OBSERVED",
        ["httpObservation"],
        [
          "A successful HTTP response does not establish semantic correctness or later job completion.",
          "The response ordering is a recorder-supplied assertion, not an independently authenticated timestamp.",
          "The profile commits response bytes by digest and does not disclose them."
        ]
      )
    : claim(
        "http-access",
        "HTTP_ACCESS_RESPONSE",
        "NOT_PROVEN",
        "BOUND_HTTP_NON_SUCCESS_OBSERVED",
        ["httpObservation"],
        []
      );
}

function jobTerminalSuccess(capture) {
  const observation = capture.jobObservation;
  if (observation === undefined) {
    return unknownClaim(
      "job-terminal-success",
      "CAPTURE_RECORDED_JOB_SUCCESS",
      "JOB_TERMINAL_STATE_NOT_OBSERVED",
      ["A synchronous payment or HTTP success does not establish a deferred job outcome."]
    );
  }
  if (observation.interactionRequestDigest !== capture.interaction.requestDigest) {
    return claim(
      "job-terminal-success",
      "CAPTURE_RECORDED_JOB_SUCCESS",
      "NOT_PROVEN",
      "JOB_REQUEST_BINDING_MISMATCH",
      ["interaction.requestDigest", "jobObservation.interactionRequestDigest"],
      ["A job result bound to another request cannot establish this interaction's outcome."]
    );
  }
  if (new Set(["PENDING", "UNOBSERVED"]).has(observation.status)) {
    return unknownClaim(
      "job-terminal-success",
      "CAPTURE_RECORDED_JOB_SUCCESS",
      "JOB_TERMINAL_STATE_NOT_OBSERVED",
      ["A synchronous payment or HTTP success does not establish a deferred job outcome."]
    );
  }
  if (!observation.authoritative) {
    return unknownClaim(
      "job-terminal-success",
      "CAPTURE_RECORDED_JOB_SUCCESS",
      "JOB_SOURCE_AUTHORITY_NOT_ESTABLISHED",
      [
        `A job source reported ${observation.status}, but the capture does not designate it as authoritative.`,
        `The source is declared as controlled by ${observation.sourceControl}.`
      ]
    );
  }
  return observation.status === "SUCCEEDED"
    ? claim(
        "job-terminal-success",
        "CAPTURE_RECORDED_JOB_SUCCESS",
        "PROVEN",
        "AUTHORITATIVE_SOURCE_REPORTED_SUCCESS",
      ["jobObservation"],
      [
          "Authority is a capture input; this profile does not establish the source's institutional identity.",
          `The source is declared as controlled by ${observation.sourceControl}.`
        ]
      )
    : claim(
        "job-terminal-success",
        "CAPTURE_RECORDED_JOB_SUCCESS",
        "NOT_PROVEN",
      "AUTHORITATIVE_SOURCE_REPORTED_FAILURE",
      ["jobObservation"],
      [
        "Authority is a capture input; this profile does not establish the source's institutional identity.",
        `The source is declared as controlled by ${observation.sourceControl}.`
      ]
      );
}

function unknownClaim(id, type, reasonCode, limitations) {
  return claim(id, type, "UNKNOWN", reasonCode, [], limitations);
}

function claim(id, type, status, reasonCode, evidence, limitations) {
  return { id, type, status, reasonCode, evidence, limitations };
}

function toSummaryKey(status) {
  return status === "PROVEN" ? "proven" : status === "NOT_PROVEN" ? "notProven" : "unknown";
}

function activityContextMatches(capture) {
  const activity = capture.terminalActivity;
  return (
    activity !== undefined &&
    activity.status !== "UNOBSERVED" &&
    activity.paymentHash === capture.prepareSend.paymentHash &&
    Math.abs(activity.amountSat) === capture.prepareSend.amountSat
  );
}

function resourceOrigin(resource) {
  const parsed = new URL(resource);
  return parsed.origin;
}
