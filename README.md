# Wavelength Agent Evidence

[![CI](https://github.com/miguel-herrero-systems/wavelength-agent-evidence/actions/workflows/ci.yml/badge.svg)](https://github.com/miguel-herrero-systems/wavelength-agent-evidence/actions/workflows/ci.yml)

A small, offline demo that turns exported Wavelength payment records into a deterministic evidence report for agent-to-service interactions.

The central idea is intentionally narrow: **“the wallet recorded a completed payment” and “the provider fulfilled the job” are different claims**. The report keeps those claims separate, preserves ambiguous states, and never initiates an economic action.

This is an independent experiment for maintainer feedback, not an official Lightning Labs project.

## Try it in under a minute

Requirements: Node.js 20.19 or newer and npm. The application has no runtime dependencies; two pinned development-only packages validate the JSON Schemas.

```sh
npm ci
npm test
npm run demo
npm run check
```

The demo writes three JSON/Markdown report pairs to `reports/generated/`:

| Scenario | What the report demonstrates |
| --- | --- |
| `completed-lightning` | Matching intent/activity hash and amount, valid preimage relation, recorded Lightning settlement, HTTP success, and reported job success. |
| `paid-then-job-failed` | Payment and HTTP acceptance can be established while the provider's deferred job is explicitly not successful. The recorded rail is `IN_ARK`, not inferred from an invoice format. |
| `ambiguous-after-dispatch` | A pending activity remains `UNKNOWN`; the demo does not guess success, failure, or retry safety. |

All three bundled captures are synthetic, documentation-derived fixtures. They do not represent live Wavelength transactions.

## What it produces

The analyzer emits ten independent claims, each with `PROVEN`, `NOT_PROVEN`, or `UNKNOWN`, an explicit reason code, evidence-field references, and limitations. Among them:

- prepared intent observed;
- prepared/activity payment-hash match;
- prepared/activity amount match;
- preimage/hash relation;
- local Wavelength terminal status;
- recorded settlement rail;
- bound HTTP response;
- deferred-job status;
- payer identity; and
- commercial obligation fulfilment.

The last two deliberately remain `UNKNOWN`. Every report also contains:

```json
{
  "economicAction": "NOT_EVALUATED",
  "disclaimerCode": "EVIDENCE_ANALYSIS_ONLY"
}
```

## Safety and trust boundary

Version 0.1 is fail-closed to:

- Wavelength commit `a1094c9f7787d8b91cecc1ee7ae9117e811478d3`;
- signet only; and
- exported `wallet-api` or `wavecli` JSON.

The code has no HTTP, gRPC, MCP, wallet, or shell integration. It never calls `PrepareSend` or `Send`, never retries a payment, and never connects to Wavelength. Inputs are capped at 1 MiB by the CLI.

The normalized capture is private: terminal activity may contain a preimage. The redacted derived report omits raw invoices, `send_intent_id`, preimages, L402 authorization, macaroons, response bodies, capture/interaction IDs, and the URL path/query/fragment. It publishes commitments plus coarse metadata such as the resource origin. Commitments are tamper-evident references, not authentication of the recorder or daemon.

Read [SECURITY.md](./SECURITY.md) before importing any real signet export.

## Analyze a capture

```sh
node src/cli.js analyze \
  --capture fixtures/paid-then-job-failed.json \
  --out /tmp/wavelength-report.json \
  --markdown /tmp/wavelength-report.md

node src/cli.js verify \
  --capture fixtures/paid-then-job-failed.json \
  --report /tmp/wavelength-report.json
```

Verification recomputes the complete deterministic report. It detects report tampering but does not prove where the capture originated.

## Normalize existing exported JSON

The normalizer accepts documented snake_case or camelCase fields, protobuf-style base64 or hexadecimal 32-byte values, int64-safe decimal strings, compact `wavecli` output, and common wallet API wrappers.

```sh
node src/cli.js normalize \
  --prepare /private/path/prepare.json \
  --activity /private/path/activity.json \
  --resource https://service.example/paid-task \
  --interaction-id signet-demo-001 \
  --network signet \
  --version a1094c9f7787d8b91cecc1ee7ae9117e811478d3 \
  --interface wallet-api \
  --out /private/path/capture.private.json
```

The required network, version, and interface values are operator-declared provenance; they are not inferred from the two exported records. Optional flags include `--invoice-file`, `--request-body-file`, `--method`, `--captured-at`, `--capture-id`, and `--recorder`. Secret material is accepted only through files, never command-line values. The output file is created with owner-only permissions where the platform honors POSIX modes.

The HTTP request digest is derived rather than trusted:

```text
sha256(canonical-json({ bodyDigest, method, resource }))
```

This binds an HTTP observation to its request envelope. The body itself is not retained.

For a careful optional compatibility run using a payment that an authorized operator already made, follow [the live signet capture runbook](./docs/LIVE_SIGNET_CAPTURE.md). The runbook does not authorize a new payment.

Version 0.1 normalizes only the Wavelength prepare/terminal wallet records. The HTTP and deferred-job observations in the synthetic scenarios demonstrate the proposed evidence contract, but there is intentionally no live sidecar importer until maintainers can recommend a stable correlation source. A job observation in the private capture must bind to the same canonical request digest; its `authoritative` flag remains an unverified capture assertion.

## Why this may be useful to Wavelength

Wavelength exposes the pieces an agent-payment evidence layer needs—two-phase send preparation, a payment hash, durable wallet activity, a preimage when available, and an explicit recorded settlement rail. This demo exercises those pieces as a conservative external-consumer contract.

It also makes several integration questions concrete and testable:

1. Is `payment_hash` the intended stable correlator from `PrepareSendResponse` to terminal `WalletEntry`?
2. Which field is the canonical settlement rail across the wallet API and `wavecli`?
3. Can Lightning Labs provide a redacted signet conformance fixture or read-only export shape?
4. Should original enum values be preserved alongside normalized values for forward compatibility?

A ready-to-edit collaboration proposal is in [docs/LIGHTNING_LABS_ISSUE_DRAFT.md](./docs/LIGHTNING_LABS_ISSUE_DRAFT.md).

## Project map

```text
fixtures/                  synthetic input captures
examples/                  versioned, human-readable synthetic report
schemas/                   capture and report JSON Schemas
scripts/                   reproducible artifact/schema validation
src/normalize.js           exported Wavelength JSON -> private normalized capture
src/analyze.js             capture -> deterministic public report
src/render-markdown.js     public report -> readable Markdown
src/cli.js                 offline commands and verification
test/                      behavior, adversarial, confidentiality, and CLI tests
docs/                      upstream proposal and optional signet runbook
```

## Claim limits worth preserving

- `sha256(preimage) == payment_hash` proves a hashlock relation, not payer identity.
- An invoice format does not prove the selected settlement rail.
- A local `COMPLETE` record is not an independent network attestation.
- HTTP 2xx is not proof that a deferred task eventually succeeded.
- A self-declared authoritative job source is still a capture input.
- Payment evidence alone does not establish correctness, utility, or commercial fulfilment.

These limits are the feature: the output should be useful precisely because it says what the available evidence does **not** establish.

## Upstream references

- [Wavelength launch post](https://lightning.engineering/posts/2026-07-21-wavelength-launch/)
- [Lightning Labs Wavelength repository](https://github.com/lightninglabs/wavelength)
- [Pinned source revision](https://github.com/lightninglabs/wavelength/tree/a1094c9f7787d8b91cecc1ee7ae9117e811478d3)

Licensed under MIT. See [LICENSE](./LICENSE).
