# Wavelength evidence report

Report `wer-a4d8d1afe50f3bfeed3c594b` analyzes one captured interaction. It does **not** authorize, retry, refund, or otherwise trigger an economic action.

> Synthetic documentation-derived fixture: this is a reproducible example, not evidence of a live payment.

## Result

| Proven | Not proven | Unknown | Economic action |
| ---: | ---: | ---: | --- |
| 7 | 1 | 2 | NOT\_EVALUATED |

## Context

- Captured at: `2026-07-21T12:05:00Z`
- Capture ID commitment: `sha256:e9d7306ceb1b7b3f430807f98d4750af4339a500c428358403d7ea7911ab9c67`
- Private capture digest: `sha256:a4d8d1afe50f3bfeed3c594bfd325964d278bf2fbdf441d95a82655573676a25`
- Wavelength: `a1094c9f7787d8b91cecc1ee7ae9117e811478d3`, `signet`, `wallet-api`
- Interaction ID commitment: `sha256:62f8f47406ca8734d11b501d349242e51ca75fd3415352993f75bc48e6b476f6`
- Resource origin: https://demo.example
- Private resource commitment: `sha256:bd46b8ea1987a8007d98053815c2b5b7e480f1ce4d308d9a1d330e72537245db`
- Canonical request digest: `sha256:f9ab2bab281e7b1f10439a2fa5c7b22b484402eb9838864881ed454fefd27712`

## Claims

| Claim | Status | Reason |
| --- | --- | --- |
| PREPARE\_SEND\_OBSERVED | PROVEN | `PREPARE_SEND_CAPTURE_VALID` |
| PREPARE\_ACTIVITY\_PAYMENT\_HASH\_MATCH | PROVEN | `PAYMENT_HASH_MATCHED` |
| PREPARE\_ACTIVITY\_AMOUNT\_MATCH | PROVEN | `PAYMENT_AMOUNT_MATCHED` |
| PREIMAGE\_MATCHES\_PAYMENT\_HASH | PROVEN | `SHA256_PREIMAGE_MATCHED_PAYMENT_HASH` |
| WALLET\_TERMINAL\_SUCCESS | PROVEN | `WAVELENGTH_RECORDED_COMPLETE` |
| SETTLEMENT\_RAIL\_RECORDED | PROVEN | `WAVELENGTH_RECORDED_RAIL_IN_ARK` |
| HTTP\_ACCESS\_RESPONSE | PROVEN | `BOUND_HTTP_SUCCESS_OBSERVED` |
| CAPTURE\_RECORDED\_JOB\_SUCCESS | NOT PROVEN | `AUTHORITATIVE_SOURCE_REPORTED_FAILURE` |
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

Status: **PROVEN** — `SHA256_PREIMAGE_MATCHED_PAYMENT_HASH`.

Evidence fields: `prepareSend.paymentHash`, `terminalActivity.preimage`.

Limitations:

- The hashlock relation is established, but it does not identify who paid.
- It does not by itself prove whether settlement used Lightning, Ark, credit, or another recorded rail.

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

Status: **PROVEN** — `BOUND_HTTP_SUCCESS_OBSERVED`.

Evidence fields: `httpObservation`.

Limitations:

- A successful HTTP response does not establish semantic correctness or later job completion.
- The response ordering is a recorder-supplied assertion, not an independently authenticated timestamp.
- The profile commits response bytes by digest and does not disclose them.

### CAPTURE\_RECORDED\_JOB\_SUCCESS

Status: **NOT PROVEN** — `AUTHORITATIVE_SOURCE_REPORTED_FAILURE`.

Evidence fields: `jobObservation`.

Limitations:

- Authority is a capture input; this profile does not establish the source's institutional identity.
- The source is declared as controlled by PROVIDER.

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
