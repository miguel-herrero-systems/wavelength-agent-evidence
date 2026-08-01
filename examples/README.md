# Curated examples

`paid-then-job-failed` is the smallest useful demonstration of the project's claim boundary:

- Wavelength wallet completion is recorded;
- the HTTP request is recorded as accepted;
- the bound deferred job is recorded as failed; and
- commercial fulfilment remains `UNKNOWN`.

That capture and report are entirely synthetic and derived from public field documentation. They are not evidence of a live Wavelength payment.

`live-signet-2026-08-01` is the reviewed public capture and report from one bounded live compatibility run. Read its provenance note before using either artifact. The raw export, invoice, and field manifest remain private; the normalized capture was separately reviewed and contains commitments instead of the raw invoice and send intent, and no payment preimage. The raw export did contain a preimage, but the allowlist disclosure policy excluded it; `PAYMENT_PREIMAGE_NOT_OBSERVED` therefore describes the analyzer's input boundary, not the operator's knowledge. The declared `operator-declared.invalid` subject is a non-resolving placeholder because this run tested wallet compatibility, not delivery of a paid resource. The capture is `IMPORTED_UNATTESTED`: it describes what the pinned local recorder reported and does not authenticate the operator, daemon, or rail independently.

Files:

- `paid-then-job-failed.report.json`: machine-readable report validated by the report schema.
- `paid-then-job-failed.report.md`: deterministic human-readable rendering of the same report.
- `live-signet-2026-08-01.capture.json`: reviewed normalized input that deterministically reproduces the live report.
- `live-signet-2026-08-01.NOTES.md`: analyzer SHA, operator-declared subject boundary, v0.1 result semantics, and compatibility finding.
- `live-signet-2026-08-01.report.json`: reviewed machine-readable report from the live Signet compatibility run.
- `live-signet-2026-08-01.report.md`: reviewed human-readable rendering of that report.

`npm run check` verifies that both curated report pairs match their captures and the current analyzer. Publishing the live normalized capture makes recomputation open; it does not make its recorder or source independently authenticated.
