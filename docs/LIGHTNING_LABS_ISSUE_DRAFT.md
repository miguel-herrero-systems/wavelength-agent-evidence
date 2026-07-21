# Draft upstream issue for Lightning Labs

## Suggested title

Feedback requested: signet-only, read-only evidence profile for Wavelength agent payments

## Suggested body

Hello Wavelength team,

I built a small, dependency-free evidence demo around the public Wavelength response shapes. Its purpose is to help an agent, service provider, or reviewer distinguish several claims that are easy to conflate:

- a send intent was prepared;
- Wavelength later recorded a terminal wallet result;
- a disclosed preimage matches the prepared payment hash;
- Wavelength recorded a particular settlement rail;
- a bound HTTP request received a successful response; and
- a separate, authoritative job source reported completion.

The demo consumes previously exported JSON offline and emits a redacted, commitment-bearing JSON/Markdown report. It never connects to a daemon, calls `PrepareSend` or `Send`, retries a payment, manages credentials, or moves funds. The public report omits the raw invoice, `send_intent_id`, preimage, L402 authorization, response body, capture/interaction IDs, and the resource URL path/query/fragment.

This first profile is deliberately narrow:

- Wavelength commit: `a1094c9f7787d8b91cecc1ee7ae9117e811478d3`
- network: signet only
- fixtures: synthetic values derived from the public documentation, not claims from a live Wavelength run
- economic decision: always `NOT_EVALUATED`
- unsupported or ambiguous states: fail closed or remain `UNKNOWN`

It is intended to complement send-capable work such as [lightninglabs/wavelength#1027](https://github.com/lightninglabs/wavelength/pull/1027), not duplicate it: this project has no payment execution surface. It also does not claim that a payment proves payer identity or commercial fulfilment.

Would the Wavelength team be open to reviewing this as a small interoperability/conformance experiment? The most valuable guidance would be:

1. Is `payment_hash` the intended stable correlator between `PrepareSendResponse` and the later terminal `WalletEntry`?
2. Which terminal field should be treated as the canonical recorded settlement rail across the wallet API and `wavecli`?
3. Are the current status/rail enum names suitable for a versioned external evidence profile, or should consumers preserve the original enum alongside a normalized value?
4. Is there a preferred read-only export or test fixture that avoids exposing the raw preimage and `send_intent_id`?
5. Would a signet conformance fixture or optional schema be useful upstream, and if so, where should that live?
6. What stable provider-side correlator, if any, should bind a deferred job result to the paid HTTP interaction?

The demo explicitly models these limits:

- `sha256(preimage) == payment_hash` establishes only the hashlock relation;
- BOLT11 does not establish that the selected settlement rail was Lightning;
- wallet success, HTTP success, and deferred-job success are independent claims;
- recorder and daemon identity are not independently authenticated; and
- payment evidence alone never authorizes an economic action.

If this direction is useful, I can share the repository plus a minimal three-scenario suite: completed payment, payment followed by job failure, and ambiguous post-dispatch state. I would also be happy to adapt the field mapping to an official fixture or maintainer-recommended read-only API.

Thank you — feedback on the contract and claim boundaries would be more useful than endorsement of the current format.

## Maintainer notes before posting

- Replace “I built” with the preferred project/team attribution.
- Add the public repository URL and exact reproduction command.
- Link `#1027` only if it remains relevant and open when the issue is posted.
- Verify that the pinned commit still matches the fixtures and implementation.
- Do not attach raw captures, normalized captures, invoices, preimages, `send_intent_id` values, macaroons, or authorization headers.
- Run the complete test/check workflow and include its exact output summary.
