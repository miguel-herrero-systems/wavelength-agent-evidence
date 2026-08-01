# Wavelength Evidence Result Contract v0.2

- Status: **minimal draft proposal; not implemented**
- Date: **2026-08-01**
- Applies to: a possible future revision of the Wavelength Agent Evidence result contract
- Does not modify: `wavelength-evidence.capture/0.1`, `wavelength-evidence.report/0.1`, the v0.1.0 release, or its generated artifacts

## 1. Purpose and current boundary

Version 0.1 keeps payment, HTTP, and deferred-job claims separate, but it leaves an important assurance boundary partly in prose. The typed result does not separately state:

1. where the evidence came from;
2. whether the recorder identity is established;
3. what verification operation was performed;
4. whether the verifier is independent of the recorder; and
5. exactly what the verification does and does not establish.

These are orthogonal dimensions. They must not be collapsed into an ordinal ladder such as `OBSERVED < ATTESTED < VERIFIABLE`. Recomputing a hash relation over recorder-supplied bytes and receiving a counterparty attestation answer different questions. Neither is inherently a higher version of the other.

The published v0.1 report pairs were generated and recomputed by the same project and operator. The bundled verifier reruns the same `analyzeCapture` implementation, compares the observed and expected reports as canonical JSON, and checks that the raw preimage is absent from the public report. `verify-demo` additionally checks the Markdown rendering and the same preimage boundary.

That is deterministic same-project recomputation. It is not independent-party verification.

| Dimension | Current fact |
| --- | --- |
| Evidence origin | Synthetic documentation-derived fixtures supplied by the project |
| Recorder identity | Not authenticated by the profile |
| Verification mode | Deterministic recomputation with the bundled implementation |
| Recorder–verifier relationship | Same project and operator |
| Verification scope | Report equality over supplied capture bytes; raw preimage absence; no independent establishment of the underlying events |

The relationship above is known from the documented release procedure. It is not cryptographically established by the v0.1 report itself.

Version 0.2 remains an offline, signet-scoped evidence profile. This proposal does not add live Wavelength integration, identity infrastructure, signatures, public anchoring, payment execution, or an independent verifier implementation.

## 2. Minimal artifact model

The analysis report and the verification statement should be separate artifacts.

### 2.1 Analysis report

The analysis report states what a specific analyzer derived from a supplied capture. It should contain only the additional contract elements needed to interpret and reproduce that result:

- immutable analyzer identity: implementation, implementation version, source revision or digest, and profile version;
- capture-level mode and recorder identity status;
- one result per claim; and
- evidence origin, operation, positive scope, and curated negative scope for each claim.

The analyzer identity is required. A version label without an immutable source revision or digest is not enough to reproduce “deterministic recomputation with the same implementation.”

The analysis report must not claim that a later verifier has run.

### 2.2 Verification statement

A verification statement is produced after a verifier checks a particular report against a particular private capture. It should bind:

- the report digest;
- the capture digest;
- immutable verifier implementation identity;
- verification mode;
- verifier identity status;
- the relationship between verifier and recorder; and
- positive and curated negative verification scope.

Keeping this statement separate allows multiple parties to check the same report without rewriting it or treating the report producer's own assertion as third-party verification.

No unsigned local statement proves who ran the verifier. If verifier identity is not authenticated, it remains unresolved.

## 3. Semantic vocabulary of the five dimensions

The following five labels and serialization paths are the vocabulary of this dated draft. They are fixed here so that implementations and later discussion can cite the same dimensions without turning them into an assurance ladder:

| Semantic dimension | Draft serialization path |
| --- | --- |
| Evidence origin | `claims[].evidenceOrigins` |
| Recorder identity status | `provenance.recorderIdentityStatus` |
| Verification mode | `verification.verificationMode` |
| Recorder–verifier relationship | `verification.recorderVerifierRelationship` |
| Verification scope | `claims[].verificationScope` and `verification.verificationScope` |

These names are normative within this proposal, but they are not implemented by v0.1. A later draft may supersede them only through an explicitly dated revision; it must not silently reuse this proposal while assigning them different meanings.

### 3.1 Evidence origin

Evidence origin answers: **what supplied the bytes used by this claim?**

It should be expressed per claim because one private capture can contain distinct surfaces: a Wavelength prepare record, terminal wallet activity, a recorder-supplied HTTP observation, and a recorder-supplied provider/job observation. A capture-level mode can distinguish synthetic fixtures from imported captures, but it cannot replace per-claim origin.

The minimum origin values for the current claim set are:

- `RECORDER_SUPPLIED_PREPARE_RECORD`;
- `RECORDER_SUPPLIED_TERMINAL_ACTIVITY`;
- `RECORDER_SUPPLIED_HTTP_OBSERVATION`;
- `RECORDER_SUPPLIED_JOB_OBSERVATION`; and
- `NO_SUPPORTING_EVIDENCE`.

The field is an array because a comparison claim may depend on more than one recorder-supplied surface. None of these values authenticates its source.

### 3.2 Recorder identity status

Recorder identity answers: **what, if anything, binds the recorder label to an actor?**

In v0.1, `source.recorder` is a caller-supplied string in the private capture. The public report does not publish it, and the profile does not authenticate it. The conservative status is unresolved.

`UNRESOLVED` is the only recorder-identity value defined by this draft. A favorable identity value requires a separately specified authenticated binding and is deliberately not named here.

A future signature would establish control of a key over signed bytes only. It would not, by itself, establish the legal, institutional, or operational identity of the recorder.

### 3.3 Verification mode

Verification mode answers: **what computation was performed?**

The current mode is deterministic recomputation with the bundled implementation. It validates and analyzes the supplied capture with the same analyzer used for generation, compares canonical JSON representations, and checks the raw-preimage boundary. The mode must not be named or rendered as independent verification.

The mode value defined by this draft is `DETERMINISTIC_RECOMPUTATION`.

### 3.4 Recorder–verifier relationship

This dimension answers: **is the verifier a party distinct from the recorder, and how is that known?**

The contract is intentionally asymmetric:

- a self-declaration of `SAME_*` may be retained because it limits assurance rather than increasing it; but
- `DISTINCT_PARTY`, `INDEPENDENT`, or an equivalent favorable relationship must never be emitted from self-declaration alone. Without authenticated identity and role bindings that establish separation, the relationship remains unresolved.

A separate process, machine, account, or key does not by itself establish a separate party.

The relationship values defined by this draft are `SAME_OPERATOR`, `DISTINCT_PARTY`, and `UNRESOLVED`. Their allowed bases are `SELF_DECLARED_ASSURANCE_LIMIT`, `AUTHENTICATED_IDENTITY_AND_ROLE_BINDING`, and `NONE`. `SAME_OPERATOR` may use the self-declared limiting basis. `DISTINCT_PARTY` requires the authenticated binding basis. Every unsupported or incomplete combination resolves to `UNRESOLVED` with `NONE`.

### 3.5 Positive scope and curated anti-inferences

Positive scope answers: **what does this operation establish over the supplied inputs?** Only properties explicitly listed in `establishes` are positively established.

`doesNotEstablish` is not intended to enumerate the infinite complement of `establishes`. It is a curated anti-inference set: a versioned, profile-defined list of the specific overreadings most likely to be made from this result.

Its semantics are normative self-limitation:

- the emitter states that it considered those named interpretations and expressly rejects them for this result;
- the renderer, adapters, and later descriptions must not use the result to support a listed anti-inference;
- a profile defines the minimum anti-inference set required for each operation and outcome;
- an emitter may add further anti-inferences but may not remove profile-required ones; and
- supporting a previously rejected interpretation requires new evidence and a new versioned result, not reinterpretation of the old one.

The two sets therefore have different functions. `establishes` defines the complete positive meaning available to a consumer. `doesNotEstablish` binds the emitter against a curated set of foreseeable future inflations. Omission from both sets never implies support.

Negative scope is part of the result's meaning, not a disclaimer attached after it.

### 3.6 Result status vocabulary

Claim status is not a sixth assurance dimension. It states the outcome of the named operation within the declared scope. This draft defines three values:

- `PREDICATE_SATISFIED`;
- `PREDICATE_NOT_SATISFIED`; and
- `PREDICATE_UNDETERMINED`.

None of them means proven, true in the world, authentic, independently verified, complete, or authorized for economic action.

## 4. Draft contract shape

The field names and enum values below are normative for this dated draft proposal. They are citable as proposed vocabulary, not as implemented constants or v0.1 capabilities.

### 4.1 Analysis report fragment

```json
{
  "specVersion": "wavelength-evidence.report/0.2-draft",
  "analyzer": {
    "implementation": "wavelength-evidence-demo",
    "implementationVersion": "<version>",
    "sourceRevision": "<immutable-revision>",
    "profileVersion": "wavelength-signet/0.2-draft"
  },
  "provenance": {
    "captureMode": "SYNTHETIC_DOCUMENTATION_FIXTURE",
    "recorderIdentityStatus": "UNRESOLVED"
  },
  "claims": [
    {
      "type": "PREIMAGE_MATCHES_PAYMENT_HASH",
      "status": "PREDICATE_SATISFIED",
      "evidenceOrigins": [
        "RECORDER_SUPPLIED_TERMINAL_ACTIVITY"
      ],
      "operation": "SHA256_PREIMAGE_RELATION",
      "verificationScope": {
        "establishes": [
          "SUPPLIED_PREIMAGE_HASHES_TO_SUPPLIED_PAYMENT_HASH"
        ],
        "doesNotEstablish": [
          "CAPTURE_ORIGIN",
          "RECORDER_IDENTITY",
          "PAYER_IDENTITY",
          "PAYMENT_OCCURRENCE",
          "SETTLEMENT_RAIL",
          "RECORD_HONESTY",
          "RECORD_COMPLETENESS"
        ]
      }
    }
  ]
}
```

`PREDICATE_SATISFIED` says only that the named operation satisfied its typed predicate. It carries no standalone vocabulary of proof, truth, authenticity, or independence. The accompanying scope supplies the permitted meaning.

### 4.2 Verification statement fragment

```json
{
  "specVersion": "wavelength-evidence.verification/0.2-draft",
  "subject": {
    "reportDigest": "sha256:<digest>",
    "captureDigest": "sha256:<digest>"
  },
  "verification": {
    "verificationMode": "DETERMINISTIC_RECOMPUTATION",
    "implementation": "wavelength-evidence-demo",
    "implementationVersion": "<version>",
    "sourceRevision": "<immutable-revision>",
    "verifierIdentityStatus": "UNRESOLVED",
    "recorderVerifierRelationship": {
      "value": "SAME_OPERATOR",
      "basis": "SELF_DECLARED_ASSURANCE_LIMIT"
    },
    "verificationScope": {
      "establishes": [
        "REPORT_MATCHES_DETERMINISTIC_ANALYSIS_OF_SUPPLIED_CAPTURE",
        "RAW_PREIMAGE_ABSENT_FROM_PUBLIC_REPORT"
      ],
      "doesNotEstablish": [
        "CAPTURE_ORIGIN",
        "RECORDER_IDENTITY",
        "DAEMON_IDENTITY",
        "VERIFIER_INDEPENDENCE",
        "UNDERLYING_EVENT_OCCURRENCE",
        "RECORD_HONESTY",
        "RECORD_COMPLETENESS"
      ]
    }
  }
}
```

The current release can truthfully declare `SAME_OPERATOR` because doing so limits the assurance claimed for the documented release procedure. The same mechanism must not accept a self-declared `DISTINCT_PARTY` or `INDEPENDENT` value.

## 5. Scope catalogue for the current claims

The table below is the semantic core of the proposal. The operation names in backticks are the draft machine vocabulary for the current claim set. The profile-required anti-inference codes remain a separate versioned catalogue because their value is precisely in being curated per operation and outcome.

| Claim | Operation code and operation over supplied input | What the result may establish | Curated anti-inferences |
| --- | --- | --- | --- |
| `PREPARE_SEND_OBSERVED` | `PROFILE_RECORD_VALIDATION` — validate the normalized `prepareSend` object under the supported profile | The supplied capture contains a structurally valid prepared-intent record | `PrepareSend` ran live; `Send` ran; recorder or daemon identity; remote quote validity; payment occurrence |
| `PREPARE_ACTIVITY_PAYMENT_HASH_MATCH` | `PAYMENT_HASH_FIELD_EQUALITY` — compare the supplied prepare and terminal payment-hash fields | Equality or inequality of those two supplied fields | Network payment occurrence; origin or truth of either field; payer identity; settlement |
| `PREPARE_ACTIVITY_AMOUNT_MATCH` | `NORMALIZED_AMOUNT_FIELD_EQUALITY` — compare the prepared amount with the absolute terminal amount | Equality or inequality under the profile's signed-outflow normalization | Actual value transferred; fees beyond the compared fields; payment occurrence; commercial amount owed |
| `PREIMAGE_MATCHES_PAYMENT_HASH` | `SHA256_PREIMAGE_RELATION` — compute SHA-256 over the supplied preimage and compare it with the bound supplied payment hash | The cryptographic hash relation over those bytes | Who supplied the preimage; payer identity; live payment; timing; settlement rail; capture origin; honesty or completeness |
| `WALLET_TERMINAL_SUCCESS` | `DECLARED_WALLET_STATUS_INTERPRETATION` — interpret the supplied terminal status after hash and amount binding | What the recorder-supplied Wavelength activity says about terminal state | Independent network settlement; daemon authenticity; external finality; correctness of the recorder's statement |
| `SETTLEMENT_RAIL_RECORDED` | `DECLARED_SETTLEMENT_RAIL_INTERPRETATION` — read the supplied settlement enum after hash and amount binding to the prepared intent | Which rail the recorder-supplied activity declares | Independent replay or verification of the rail; inference from BOLT11; network settlement; recorder honesty |
| `HTTP_ACCESS_RESPONSE` | `BOUND_HTTP_STATUS_CLASSIFICATION` — bind the supplied HTTP observation to the canonical request digest, read the supplied ordering flag, and classify the status code | The recorder-supplied observation reports a bound 2xx or non-2xx response under the declared ordering | Authenticated time ordering; server identity; response-body semantics; correctness, utility, job completion, or payment causation |
| `CAPTURE_RECORDED_JOB_SUCCESS` | `BOUND_DECLARED_JOB_STATUS_INTERPRETATION` — bind the supplied job observation to the request digest and interpret its declared status and authority flag | What a capture-designated source reports about the bound job | Source institutional identity or actual authority; truthful reporting; output quality; correctness; full contractual fulfilment |
| `PAYER_IDENTITY` | `NOT_PERFORMED` — no identity operation is implemented | Only that the profile did not establish payer identity | Any payer identity, ownership, authorization, or legal attribution |
| `OBLIGATION_FULFILLED` | `NOT_PERFORMED` — no full-obligation evaluation is implemented | Only that commercial fulfilment remains unevaluated | Correctness, utility, acceptance, contractual performance, payment authorization, release conditions, or economic instruction |

## 6. Independence and interpretation rules

1. Deterministic recomputation does not establish evidence origin.
2. A second invocation of the same verifier does not establish an independent party.
3. A separate process, machine, account, or key does not by itself establish organizational independence.
4. A self-declared same-party relationship may be retained as an assurance limit; it does not authenticate either identity.
5. A distinct-party or independent relationship requires authenticated identity and role bindings that establish separation. Otherwise it must remain unresolved.
6. A valid signature proves control of the signing key over the signed bytes; it does not establish honesty, competence, completeness, authority, or institutional identity.
7. Only properties listed in `establishes` are positively established.
8. `doesNotEstablish` is a curated, non-exhaustive set of binding anti-inferences; every profile-required entry must be preserved by emitters, renderers, and adapters.
9. No successful result may be converted into a payment, retry, refund, release, or settlement instruction.

## 7. Compatibility and publication boundary

- v0.1 artifacts remain byte-for-byte unchanged.
- v0.2 uses new `specVersion` identifiers and schemas.
- A v0.1 report must not be silently reinterpreted as independently verified.
- A conservative v0.1-to-v0.2 adapter may mark evidence as recorder-supplied and identities as unresolved.
- A generic adapter must leave the recorder–verifier relationship unresolved because v0.1 does not encode it.
- Release-specific metadata may document that the published v0.1 fixtures were generated and recomputed by the same project and operator.
- Migration must not upgrade `UNKNOWN`, infer identity, or add an external-event claim.

The first public proposal should stop at the minimal contract described here: immutable analyzer identity, origin and scope per claim, a separate verification statement, and the independence rules. A generalized negative-scope taxonomy and a large implementation gate should wait until a party other than the author is consuming the profile.

## 8. Decisions required before a schema

The reduced proposal leaves three decisions open:

1. the exact minimum anti-inference code set required for each current operation and outcome;
2. whether authenticated recorder–verifier relationships belong in this profile or a separate identity profile; and
3. whether public reports should expose a privacy-preserving recorder commitment while identity remains unresolved.

None of this work is conditioned on further external feedback. Feedback may improve the proposal, but it is not required to continue it.
