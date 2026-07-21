# Optional live signet capture runbook

This runbook turns already-exported Wavelength signet data into an offline evidence report. It does not tell the demo to make a payment: the repository does not call `PrepareSend` or `Send` and has no wallet or network integration.

The live step is optional. The bundled fixtures are synthetic and documentation-derived, so they demonstrate the analysis contract but do not prove compatibility with a running Wavelength node.

## Safety boundary

Proceed only when all of these conditions are true:

- the Wavelength source is exactly commit `a1094c9f7787d8b91cecc1ee7ae9117e811478d3`;
- the wallet and captured activity are on signet, never mainnet;
- any payment was already performed separately by an authorized operator using their own bounded test procedure;
- no retry or second payment is needed for this capture;
- raw files can remain outside the repository in an owner-only directory; and
- no seed, wallet password, macaroon, L402 authorization, private key, or production identifier will be provided to the demo.

Stop if the network, version, terminal activity, or payment hash is uncertain. Do not weaken validation to make a capture pass.

## 1. Verify the local demo first

From the repository root:

```sh
npm test
npm run demo
npm run check
```

These commands use only synthetic fixtures. Review their output before handling private data.

## 2. Create a private working directory

Use a directory outside the repository and restrict it to your account. For example:

```sh
umask 077
mkdir -p /private/tmp/wavelength-evidence-input
```

The paths below use `/private/tmp/wavelength-evidence-input` as an example. Raw files placed there are still sensitive and may survive until the operating system cleans the directory; use an approved secure location if that matters for your environment.

## 3. Export existing records without initiating a send

Save the previously observed `PrepareSendResponse` as `prepare.json` and the corresponding terminal wallet activity as `activity.json`. Do this with a read-only/manual export from the authorized environment. Do not place authentication metadata or the containing HTTP/gRPC envelope in either file.

The prepare record is expected to carry the documented values corresponding to:

```json
{
  "send_intent_id": "<private value>",
  "amount_sat": 21,
  "expected_fee_sat": 1,
  "fee_known": true,
  "expected_total_outflow_sat": 22,
  "total_outflow_known": true,
  "rail": "SEND_RAIL_LIGHTNING",
  "quote_status": "COMPLETE",
  "payment_hash": "<64 lowercase hex characters>",
  "expires_at_unix": 1784678400
}
```

The terminal record can use the compact `wavecli` shape or the supported wallet API wrapper. A compact example is:

```json
{
  "id": "<wallet activity id>",
  "status": "COMPLETE",
  "kind": "SEND",
  "amount_sat": -21,
  "fee_sat": 1,
  "settlement": "LIGHTNING",
  "payment_hash": "<the same 64-character hash>",
  "preimage": "<private 64-character value, only if already present>"
}
```

Do not manufacture a preimage. If the authorized export does not contain one, omit it; the analyzer should report the hashlock claim as `UNKNOWN`. A missing witness is safer than a guessed witness.

If you need an invoice commitment, save the invoice alone in a private file such as `invoice.txt`. Pass the file path to the CLI; never put the invoice directly in a command-line argument, where it may enter shell history or process listings.

## 4. Normalize locally

Choose the exact public resource URL and a non-secret local interaction identifier. Then run:

```sh
node src/cli.js normalize \
  --prepare /private/tmp/wavelength-evidence-input/prepare.json \
  --activity /private/tmp/wavelength-evidence-input/activity.json \
  --resource https://example.test/protected-resource \
  --interaction-id signet-demo-001 \
  --network signet \
  --version a1094c9f7787d8b91cecc1ee7ae9117e811478d3 \
  --interface wallet-api \
  --out /private/tmp/wavelength-evidence-input/capture.private.json
```

When `invoice.txt` is available, append:

```sh
--invoice-file /private/tmp/wavelength-evidence-input/invoice.txt
```

The CLI requires the operator to declare the network, source commit, and interface because those values are not present in the two exported records. Validation accepts only the pinned signet profile. Normalization replaces the raw `send_intent_id` and optional invoice with SHA-256 commitments. The normalized capture can still contain the preimage from terminal activity, so `capture.private.json` remains confidential and must not be committed or shared.

The normalizer performs no network call. If the command rejects the source version, network, enum, or shape, preserve the failure as a compatibility result and update the profile through review; do not edit the private capture until it merely passes.

## 5. Analyze and verify

Write the shareable candidates to a separate local directory:

```sh
mkdir -p /private/tmp/wavelength-evidence-output
node src/cli.js analyze \
  --capture /private/tmp/wavelength-evidence-input/capture.private.json \
  --out /private/tmp/wavelength-evidence-output/report.json \
  --markdown /private/tmp/wavelength-evidence-output/report.md
node src/cli.js verify \
  --capture /private/tmp/wavelength-evidence-input/capture.private.json \
  --report /private/tmp/wavelength-evidence-output/report.json
```

Verification shows that the report is the deterministic result of the supplied capture. It does not authenticate who produced the capture or prove that its observations came from the network.

## 6. Review before sharing

Read both report files and confirm:

- `input.network` is `signet`;
- `economicAction` is `NOT_EVALUATED`;
- ambiguous evidence remains `UNKNOWN` rather than being upgraded to `PROVEN`;
- the report contains no raw invoice, `send_intent_id`, preimage, authorization, macaroon, response body, or personal identifier; and
- the actual private values from the source files do not appear in either report.

The report includes an `omittedFields` list, so words such as `preimage` and `send_intent_id` are expected as labels. Check for the secret values themselves.

Share only the reviewed `report.json` and/or `report.md`. Keep `prepare.json`, `activity.json`, `invoice.txt`, and `capture.private.json` private. Follow your environment's approved retention and deletion policy when they are no longer needed.

## Interpreting a useful live result

A successful compatibility run can establish that this pinned parser understood an operator-supplied signet export and derived the documented local claims. It cannot by itself establish payer identity, daemon identity, independent rail settlement, resource correctness, deferred-job success, or fulfilment of a contract. Those boundaries are part of the result, not omissions to paper over.
