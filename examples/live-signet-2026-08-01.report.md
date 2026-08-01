# Wavelength evidence report

Report `wer-44ed84ac93ad0b0a10e35d6c` analyzes one captured interaction. It does **not** authorize, retry, refund, or otherwise trigger an economic action.

> Imported, unattested capture: the source files are untrusted input and the daemon/operator identity is not authenticated.

## Result

| Proven | Not proven | Unknown | Economic action |
| ---: | ---: | ---: | --- |
| 5 | 0 | 5 | NOT\_EVALUATED |

## Context

- Captured at: `2026-08-01T11:11:22Z`
- Capture ID commitment: `sha256:5c42968bc315cbff3527a189d046b1aaa00e19de8c9492f74f5b9d8d29a61db5`
- Private capture digest: `sha256:44ed84ac93ad0b0a10e35d6c8931430f8646e4a786e52be4ca8dc1d35161c9c2`
- Wavelength: `a1094c9f7787d8b91cecc1ee7ae9117e811478d3`, `signet`, `wallet-api`
- Interaction ID commitment: `sha256:fcd1a419fa326dc0e18980371053647b3a90a050cddfc221cae3c826309f7cff`
- Resource origin: https://operator-declared.invalid
- Private resource commitment: `sha256:615b5fa23d5d6a32f4e73a50b6442b5e7e2982982f74751dd82edc8b19cb707c`
- Canonical request digest: `sha256:0df072f6d3dd4723b2d63bcdcffa0bf56710d54aff3508ec7ced6db21fa37ca8`

## Claims

| Claim | Status | Reason |
| --- | --- | --- |
| PREPARE\_SEND\_OBSERVED | PROVEN | `PREPARE_SEND_CAPTURE_VALID` |
| PREPARE\_ACTIVITY\_PAYMENT\_HASH\_MATCH | PROVEN | `PAYMENT_HASH_MATCHED` |
| PREPARE\_ACTIVITY\_AMOUNT\_MATCH | PROVEN | `PAYMENT_AMOUNT_MATCHED` |
| PREIMAGE\_MATCHES\_PAYMENT\_HASH | UNKNOWN | `PAYMENT_PREIMAGE_NOT_OBSERVED` |
| WALLET\_TERMINAL\_SUCCESS | PROVEN | `WAVELENGTH_RECORDED_COMPLETE` |
| SETTLEMENT\_RAIL\_RECORDED | PROVEN | `WAVELENGTH_RECORDED_RAIL_IN_ARK` |
| HTTP\_ACCESS\_RESPONSE | UNKNOWN | `HTTP_RESPONSE_NOT_OBSERVED` |
| CAPTURE\_RECORDED\_JOB\_SUCCESS | UNKNOWN | `JOB_TERMINAL_STATE_NOT_OBSERVED` |
| PAYER\_IDENTITY | UNKNOWN | `PAYER_IDENTITY_NOT_ESTABLISHED` |
| OBLIGATION\_FULFILLED | UNKNOWN | `COMMERCIAL_OBLIGATION_NOT_EVALUATED` |

## Claim details

### PREPARE\_SEND\_OBSERVED

Status: **PROVEN** — `PREPARE_SEND_CAPTURE_VALID`.

Evidence fields: `prepareSend`.

Limitations:

- The capture records a prepared Wavelength intent; it does not show that Send was called.
- The recorder and Wavelength daemon identity are not independently authenticated by this profile.

### PREPARE\_ACTIVITY\_PAYMENT\_HASH\_MATCH

Status: **PROVEN** — `PAYMENT_HASH_MATCHED`.

Evidence fields: `prepareSend.paymentHash`, `terminalActivity.paymentHash`.

Limitations:

- This binds two recorder-supplied fields; it does not independently identify a network payment.

### PREPARE\_ACTIVITY\_AMOUNT\_MATCH

Status: **PROVEN** — `PAYMENT_AMOUNT_MATCHED`.

Evidence fields: `prepareSend.amountSat`, `terminalActivity.amountSat`.

Limitations:

- The terminal amount may be signed as an outflow; this profile compares its absolute value.

### PREIMAGE\_MATCHES\_PAYMENT\_HASH

Status: **UNKNOWN** — `PAYMENT_PREIMAGE_NOT_OBSERVED`.

Limitations:

- No preimage is present in the analyzed normalized capture, so this analyzer treats the hashlock predicate as unobserved.
- That absence does not establish that an upstream export contained no preimage; public reports never include raw preimages.

### WALLET\_TERMINAL\_SUCCESS

Status: **PROVEN** — `WAVELENGTH_RECORDED_COMPLETE`.

Evidence fields: `terminalActivity.status`.

Limitations:

- This is the local Wavelength wallet's durable status, not an independent network attestation.

### SETTLEMENT\_RAIL\_RECORDED

Status: **PROVEN** — `WAVELENGTH_RECORDED_RAIL_IN_ARK`.

Evidence fields: `terminalActivity.settlement`.

Limitations:

- The recorder reports IN\_ARK; this report does not independently replay or verify that rail.
- The rail declaration is intentionally separate from the preimage/hashlock predicate.

### HTTP\_ACCESS\_RESPONSE

Status: **UNKNOWN** — `HTTP_RESPONSE_NOT_OBSERVED`.

Limitations:

- Payment evidence alone does not show that a protected resource was returned.

### CAPTURE\_RECORDED\_JOB\_SUCCESS

Status: **UNKNOWN** — `JOB_TERMINAL_STATE_NOT_OBSERVED`.

Limitations:

- A synchronous payment or HTTP success does not establish a deferred job outcome.

### PAYER\_IDENTITY

Status: **UNKNOWN** — `PAYER_IDENTITY_NOT_ESTABLISHED`.

Limitations:

- A payment hash, preimage, and local wallet record do not identify the economic payer.

### OBLIGATION\_FULFILLED

Status: **UNKNOWN** — `COMMERCIAL_OBLIGATION_NOT_EVALUATED`.

Limitations:

- Payment and transport observations do not establish correctness, utility, or full commercial fulfilment.
- No economic action follows from this report.

## Disclosure boundary

The report contains derived results, commitments, and coarse metadata; it omits bearer credentials and raw payment secrets.

Omitted by policy: invoice, send\_intent\_id, preimage, L402 authorization, macaroon, captureId, interactionId, URL path, query, and fragment.

Disclaimer: `EVIDENCE_ANALYSIS_ONLY`.
