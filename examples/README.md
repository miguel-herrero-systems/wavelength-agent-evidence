# Curated examples

`paid-then-job-failed` is the smallest useful demonstration of the project's claim boundary:

- Wavelength wallet completion is recorded;
- the HTTP request is recorded as accepted;
- the bound deferred job is recorded as failed; and
- commercial fulfilment remains `UNKNOWN`.

That capture and report are entirely synthetic and derived from public field documentation. They are not evidence of a live Wavelength payment.

`live-signet-2026-08-01` is the reviewed public report from one bounded live compatibility run. Read its provenance note before the report. The operator-supplied raw export, invoice, normalized capture, and field manifest are intentionally absent. The declared `operator-declared.invalid` subject is a non-resolving placeholder because this run tested wallet compatibility, not delivery of a paid resource. The report is `IMPORTED_UNATTESTED`: it describes what the pinned local recorder reported and does not authenticate the operator, daemon, or rail independently.

Files:

- `paid-then-job-failed.report.json`: machine-readable report validated by the report schema.
- `paid-then-job-failed.report.md`: deterministic human-readable rendering of the same report.
- `live-signet-2026-08-01.NOTES.md`: analyzer SHA, operator-declared subject boundary, v0.1 result semantics, and compatibility finding.
- `live-signet-2026-08-01.report.json`: reviewed machine-readable report from the live Signet compatibility run.
- `live-signet-2026-08-01.report.md`: reviewed human-readable rendering of that report.

`npm run check` verifies that the synthetic pair still matches `fixtures/paid-then-job-failed.json` and the current analyzer. The live report is schema-validated, but cannot be regenerated in CI because its confidential source capture is not committed.
