# Curated example

`paid-then-job-failed` is the smallest useful demonstration of the project's claim boundary:

- Wavelength wallet completion is recorded;
- the HTTP request is recorded as accepted;
- the bound deferred job is recorded as failed; and
- commercial fulfilment remains `UNKNOWN`.

The capture and report are entirely synthetic and derived from public field documentation. They are not evidence of a live Wavelength payment.

Files:

- `paid-then-job-failed.report.json`: machine-readable report validated by the report schema.
- `paid-then-job-failed.report.md`: deterministic human-readable rendering of the same report.

`npm run check` verifies that both files still match `fixtures/paid-then-job-failed.json` and the current analyzer.
