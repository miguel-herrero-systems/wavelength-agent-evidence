# Provenance note for the 2026-08-01 live Signet report

This note accompanies report `wer-44ed84ac93ad0b0a10e35d6c`. The report was derived from one bounded 1,000-sat Signet execution observed through the pinned Wavelength wallet API. The local recorder reported one complete `IN_ARK` send. That observation does not authenticate the operator, daemon, or settlement rail independently.

## V0.1 subject and result semantics

The report's `subject` block is operator-declared metadata, not a Wavelength observation. Its origin is `OPERATOR_DECLARED` and it establishes no claim: `establishes: []`. No HTTP request or paid-resource delivery occurred. `https://operator-declared.invalid/` uses the reserved `.invalid` namespace to make the non-resolving placeholder visible in the value itself. Its request and resource commitments prove only deterministic derivation from those declared inputs.

`input.sourceVersion` and `input.network` are also operator-declared provenance. They were supplied to the normalizer because the exported records do not contain them; the public report neither derives nor independently authenticates the daemon version or network.

In the v0.1 vocabulary, `PROVEN` means that a local predicate was satisfied over an `IMPORTED_UNATTESTED` capture. In particular, `WALLET_TERMINAL_SUCCESS` and `SETTLEMENT_RAIL_RECORDED` are conclusions about what the recorder supplied, not independent verification of network events, honesty, completeness, payer identity, or fulfilment.

This boundary has to be carried in adjacent prose because the immutable v0.1 report schema cannot express claim origin, verification mode, verifier/recorder relationship, or negative scope. That is itself a demonstrated limitation of v0.1, not an assurance property of this note. The [v0.2 result-contract proposal](../docs/RESULT_CONTRACT_V0.2_PROPOSAL.md) is intended to make those dimensions part of the result instead of leaving them beside it.

## Public capture and privacy review

The exact normalized capture used to derive this report is published as [`live-signet-2026-08-01.capture.json`](./live-signet-2026-08-01.capture.json). The source export did contain a non-empty value at `swap.preimage`; that path was outside the allowlist, was recorded by path in the private manifest, and was discarded. The published capture contains no preimage, BOLT11 invoice, raw `send_intent_id`, wallet or node credential, session identifier, outpoint, transaction identifier, or unknown raw-field value. Its invoice and send-intent references are commitments.

Accordingly, `PAYMENT_PREIMAGE_NOT_OBSERVED` means that the analyzer did not receive a preimage in the normalized capture. It does not mean that the operator or the raw export lacked one. The raw export contained the witness; the disclosure policy excluded it, so the analyzer treated the hashlock predicate as unobserved. V0.1 has no structured field for this upstream disclosure; the report now states only the analyzer's input boundary, while this adjacent provenance note records the instance-specific operator-side fact.

That exclusion has a real assurance cost. `PREIMAGE_MATCHES_PAYMENT_HASH` is the profile's strongest payment-specific cryptographic predicate: it can establish a SHA-256 relation over supplied bytes rather than merely compare recorder-supplied fields or repeat a recorder assertion. Because the published capture omits the witness, deterministic public recomputation of this artifact cannot return `PROVEN` for that predicate. This publication deliberately chooses open reproducibility without disclosing the preimage; it is not a free assurance improvement. Evaluating the hashlock relation would require a separate confidential analysis of the withheld witness.

The final privacy gate compared 22 non-empty secret or identifying values from the raw prepare, activity, and invoice inputs against both the normalized capture and the complete candidate repository tree, and found zero disclosures. The manifest used `ALLOWLIST_PROJECTION`, retained no unknown values, recorded all 38 discarded paths without truncation, and remains private because it describes implementation-specific source fields. The generic v0.1 limitation inside the capture says captures can contain a preimage and should be private by default; this reviewed instance is the explicit exception.

Anyone can now recompute the public report without a bilateral data transfer:

```sh
node src/cli.js verify \
  --capture examples/live-signet-2026-08-01.capture.json \
  --report examples/live-signet-2026-08-01.report.json
```

Successful recomputation demonstrates deterministic agreement over the published capture. It does not authenticate the recorder or daemon, prove the capture complete or honest, or independently establish network settlement.

## Analyzer traceability

The private capture was normalized and the report was generated with repository commit [`09f7c4f1f5398187e29241cf7563e70cda50e1f7`](https://github.com/miguel-herrero-systems/wavelength-agent-evidence/commit/09f7c4f1f5398187e29241cf7563e70cda50e1f7).

That SHA identifies the exact normalizer, analyzer, schemas, and tests used. The published normalized capture makes the report publicly reproducible with that analyzer. It does not authenticate the underlying source or establish its completeness: the raw export, invoice, and normalization manifest remain private and are not committed.

## Compatibility result

The live response differed from the synthetic fixtures: `InspectActivityResponse` carried the recorded settlement rail in the sibling field `swap.settlement_type`, not in a nested `entry.trace` object. Commit `09f7c4f1f5398187e29241cf7563e70cda50e1f7` adds explicit support and a synthetic regression test for that observed shape. The parser consumes only the allowlisted settlement field; the private manifest records the other discarded paths without their values.
