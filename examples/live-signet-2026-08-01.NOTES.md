# Provenance note for the 2026-08-01 live Signet report

This note accompanies report `wer-44ed84ac93ad0b0a10e35d6c`. The report was derived from one bounded 1,000-sat Signet execution observed through the pinned Wavelength wallet API. The local recorder reported one complete `IN_ARK` send. That observation does not authenticate the operator, daemon, or settlement rail independently.

## V0.1 subject and result semantics

The report's `subject` block is operator-declared metadata, not a Wavelength observation. Its origin is `OPERATOR_DECLARED` and it establishes no claim: `establishes: []`. No HTTP request or paid-resource delivery occurred. `https://operator-declared.invalid/` uses the reserved `.invalid` namespace to make the non-resolving placeholder visible in the value itself. Its request and resource commitments prove only deterministic derivation from those declared inputs.

In the v0.1 vocabulary, `PROVEN` means that a local predicate was satisfied over an `IMPORTED_UNATTESTED` capture. In particular, `WALLET_TERMINAL_SUCCESS` and `SETTLEMENT_RAIL_RECORDED` are conclusions about what the recorder supplied, not independent verification of network events, honesty, completeness, payer identity, or fulfilment.

This boundary has to be carried in adjacent prose because the immutable v0.1 report schema cannot express claim origin, verification mode, verifier/recorder relationship, or negative scope. That is itself a demonstrated limitation of v0.1, not an assurance property of this note. The [v0.2 result-contract proposal](../docs/RESULT_CONTRACT_V0.2_PROPOSAL.md) is intended to make those dimensions part of the result instead of leaving them beside it.

## Analyzer traceability

The private capture was normalized and the report was generated with repository commit [`09f7c4f1f5398187e29241cf7563e70cda50e1f7`](https://github.com/miguel-herrero-systems/wavelength-agent-evidence/commit/09f7c4f1f5398187e29241cf7563e70cda50e1f7).

That SHA identifies the exact normalizer, analyzer, schemas, and tests used. It does not make the report publicly reproducible: the raw export, invoice, normalized capture, and normalization manifest remain private and are not committed.

## Compatibility result

The live response differed from the synthetic fixtures: `InspectActivityResponse` carried the recorded settlement rail in the sibling field `swap.settlement_type`, not in a nested `entry.trace` object. Commit `09f7c4f1f5398187e29241cf7563e70cda50e1f7` adds explicit support and a synthetic regression test for that observed shape. The parser consumes only the allowlisted settlement field; the private manifest records the other discarded paths without their values.
