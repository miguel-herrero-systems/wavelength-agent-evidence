# Security policy

## Scope and operating model

This repository is an offline, read-only evidence demo. It parses operator-supplied JSON and derives narrowly scoped claims from it. It does not connect to a Wavelength daemon, call `PrepareSend` or `Send`, manage a wallet, move funds, or evaluate an economic obligation.

Version 0.1 is restricted to Wavelength commit `a1094c9f7787d8b91cecc1ee7ae9117e811478d3` on signet. Mainnet captures and other Wavelength revisions are outside the supported profile. Treat a validator rejection as a safety boundary, not as a reason to weaken validation.

## Data classification

Use these handling rules even when the transaction is on signet:

| Artifact | Classification | Handling |
| --- | --- | --- |
| Raw Wavelength/API/CLI export | Secret | Keep outside Git; it can contain a raw invoice, `send_intent_id`, preimage, macaroon, or authorization header. |
| Normalized capture | Confidential by default | Keep outside Git unless that exact instance passes an allowlist-based publication review confirming that it contains no preimage, raw invoice, raw send intent, credential, or discarded unknown value. Document every public exception. |
| Normalization field manifest | Confidential | Keep outside Git; it records discarded unknown JSON Pointer paths, never their values, and may reveal private implementation field names. |
| Derived JSON/Markdown report | Review before sharing | Designed to contain commitments and conclusions instead of bearer data, but inspect every report before publication. |
| Synthetic fixture | Public test data | Must contain only deliberately generated, non-spendable values. |

Never supply a seed phrase, wallet password, macaroon, L402 authorization, production invoice, private key, or mainnet capture to this project. Do not paste any of those values into an issue, pull request, chat, test fixture, terminal recording, or CI log.

The public report intentionally names omitted field classes such as `preimage`; the presence of that label is expected. The raw value must not be present.

## Trust boundaries and claim limits

- Input JSON is untrusted. Use the provided CLI, which applies bounded reads and explicit allowlist projection. Unknown raw fields are discarded and recorded by path in the private normalization manifest; they cannot flow into the normalized capture or public report.
- Network, source commit, and interface are operator-declared normalization inputs. Requiring the pinned values prevents accidental broadening, but it does not independently prove their truth.
- A matching SHA-256 preimage proves only a hashlock relation. It does not prove payer identity, the settlement rail, delivery quality, or commercial fulfilment.
- A Wavelength `COMPLETE` status is a recorder-supplied local wallet observation, not an independent network attestation.
- A BOLT11 invoice is not proof of Lightning settlement. The rail is recorded and evaluated separately because Wavelength can select another supported rail.
- HTTP success is not deferred-job success. Job state is a separate claim and is only conclusive when the capture marks its source authoritative.
- Commitments provide tamper evidence only when the verifier already has the referenced bytes. They do not authenticate the recorder or the Wavelength daemon.
- The analyzer always emits `economicAction: "NOT_EVALUATED"`. Nothing in a report authorizes payment, refund, release, settlement, or another economic action.

## Safe local use

Run the demo with an unprivileged account in a clean checkout. Keep raw inputs in a private directory outside the repository with owner-only permissions. Do not add networking, shell execution, automatic retry, or any send-capable Wavelength operation to the evidence path.

Before sharing a report:

1. Run the test and verification commands documented in the README.
2. Confirm that the input network is `signet` and the source version is the pinned commit.
3. Review the private normalization manifest and account for every discarded unknown field path without copying its value into a public artifact.
4. Confirm that the report contains only fields defined by the versioned report schema.
5. Search the report for the actual secret values from the private inputs, not merely their field names.
6. Share only the derived report by default. Publish a normalized capture only after a separate instance-specific review confirms that no secret or identifying value from the raw inputs survived; never publish the raw export or normalization manifest.

Generated reports and private capture locations are ignored by Git as a second line of defense. `.gitignore` is not a security control: always inspect the staged diff before committing.

## Dependency and network posture

The current implementation uses Node.js built-ins and has no runtime package dependencies. Ajv and `ajv-formats` are pinned development-only dependencies used to validate the published JSON Schemas and artifacts; install them reproducibly with `npm ci`. The offline analysis path should remain deterministic and network-free. Any future dependency or network-capable change should receive an explicit security review and must not silently broaden the signet-only, no-send scope.

## Reporting a vulnerability

Do not include a raw export, unreviewed normalized capture, or secret in a public report. If this repository enables GitHub private vulnerability reporting, use that channel. Otherwise, email [contact@hrevn.com](mailto:contact@hrevn.com) with a minimal reproducer made from synthetic data. Include the affected commit, Node.js version, expected result, actual result, and whether any secret may have been exposed.

If a secret was exposed, treat it as compromised and rotate or revoke it through the system that issued it. This demo cannot revoke Wavelength, Lightning, L402, or wallet credentials.
