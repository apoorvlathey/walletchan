# Centralized RPC Broker and Automatic Failover PRD

> Status: proposed
>
> Created: 2026-07-30
>
> Product: WalletChan browser extension
>
> WalletChan baseline: `1c6f8b41627451e410c52583eec9448cf2cfe1d6`
>
> Related implementation references:
> [`IMPLEMENTATION.md`](./IMPLEMENTATION.md),
> [`SECURITY.md`](./SECURITY.md),
> [`SECURITY_ARCHITECTURE.md`](./SECURITY_ARCHITECTURE.md), and
> [`apps/extension/src/chrome/network/README.md`](../apps/extension/src/chrome/network/README.md)

## 1. Executive summary

WalletChan lets a user save multiple RPC endpoints for one EVM chain, but only
the manually selected endpoint participates in normal runtime traffic. RPC
selection is also spread across renderer hooks, background services, injected
provider forwarding, WalletConnect, signing preparation, simulation, gas,
portfolio, history, Safe, Privacy Pools, and other feature clients. A failure
observed by one caller therefore does not reliably prevent another caller or a
newly mounted screen from trying the same unhealthy endpoint.

WalletChan will introduce one background-owned RPC broker for every request
that relies on user-configured chain RPCs. Callers will identify the chain and
request policy, not choose an RPC URL. The broker will:

1. merge the user's configured primary RPC with the chain's saved fallbacks;
2. validate every candidate at final egress and attest exact chain IDs;
3. own endpoint health, cooldown, half-open recovery, concurrency, and
   selection state;
4. retry eligible requests transparently after explicit rate limits,
   retryable HTTP failures, timeouts, or network failures;
5. share health immediately across all components and screens;
6. persist a bounded, short-lived health snapshot across MV3 service-worker
   restarts;
7. preserve provider-origin, private-network, impersonator, method, size,
   redirect, and ambient-authority restrictions; and
8. keep transaction submission ambiguity policy separate from ordinary
   read-only failover.

If a transaction-review component receives an RPC `429`, the component will
not handle or display that intermediate failure. The broker will open the
endpoint's circuit, retry the exact request against the next eligible endpoint,
and resolve the original component request normally when a fallback succeeds.
Every later component for the same chain will skip the cooling endpoint.

The user-selected endpoint remains durable configuration. Automatic failover
changes only the broker's effective runtime endpoint and must not silently
rewrite `networksInfo`, reorder Settings, sync a transient choice, or emit a
chain-change event.

## 2. Product decisions

These are implementation requirements, not optional design directions.

| Decision | Requirement |
| --- | --- |
| Runtime authority | One service-worker-owned RPC broker is authoritative for configured-chain RPC health and selection. React state, individual Viem clients, content scripts, and feature modules are not authorities. |
| Caller contract | Normal callers provide `chainId`, method, params, audience, and operation class. They do not provide or receive an RPC URL. |
| Configured versus effective | `networksInfo[chain].rpcUrl` remains the user-selected configured primary. The broker owns a separate short-lived preferred effective endpoint. |
| Endpoint order | The configured primary is preferred first, followed by the normalized saved endpoint order. Health and request eligibility may temporarily alter the attempted order. |
| Failover style | Sequential failover with circuit breaking and a sticky effective endpoint. Do not round-robin healthy requests by default. |
| Transparent reads | Eligible read and preparation requests retry automatically. A caller sees no intermediate error if any eligible endpoint succeeds within the total deadline. |
| Runtime persistence | Persist only a bounded, expiring health snapshot and endpoint fingerprints. Do not persist RPC params, results, addresses, calldata, raw errors, or response bodies. |
| Service-worker restart | A restarted worker lazily hydrates valid unexpired health and avoids a known cooling endpoint. |
| Browser restart | A short unexpired health snapshot may be reused, but stale records are pruned. No endpoint remains penalized indefinitely. |
| Failure classification | Classify the bounded HTTP response before Viem wraps it. Valid JSON-RPC application errors do not make an endpoint unhealthy. |
| Total budget | One logical request has one total deadline and a bounded attempt count. Per-endpoint timeouts must not multiply into an unbounded wait. |
| Chain attestation | Every configured-primary or saved-fallback candidate is ineligible until `eth_chainId` matches the requested chain. Mismatched endpoints are quarantined, not used automatically. |
| URL security | URL parsing, public-HTTPS/private-network rules, redirect rejection, credential omission, referrer omission, request size, response size, and concurrency checks run at every attempt. |
| Provider policy | Injected-provider forwarding retains its exact read-only allowlist and connected-origin authorization. The page/content bridge sends a chain ID, never a runtime target URL. |
| WalletConnect policy | WalletConnect uses the same broker health but retains session-chain and method authorization. |
| Impersonator policy | `eth_sendTransaction` remains pinned to the exact selected endpoint whose `allowImpersonatedTransactions` flag is true. It does not inherit general fallback. |
| Raw broadcast | V1 does not generically retry raw transaction submission after timeouts, network errors, malformed responses, or arbitrary JSON-RPC errors. |
| Specialized endpoints | Fixed quorum RPCs, dapp-discovered RPCs, Settings probes, and explicitly pinned protocol endpoints remain outside the configured-chain pool unless separately migrated. |
| User visibility | Successful fallback is non-blocking. Settings may show “Fallback in use” and endpoint cooldown state, but feature screens do not show a transient RPC error that the broker recovered. |
| Telemetry | No behavioral telemetry is introduced. Diagnostics must not log full RPC URLs, API keys, addresses, calldata, signatures, or request payloads. |

## 3. User problem and desired outcome

### 3.1 Current problem

A single extension surface can mount many independent RPC consumers. A
transaction request may concurrently load:

- chain and account state;
- nonce;
- fee history and priority fees;
- gas estimate;
- transaction simulation;
- asset-change metadata;
- allowances and token metadata;
- ENS or address identity;
- Safe state or proposal execution state;
- EIP-7702 or ERC-7715 status; and
- receipt, replacement, or prior-transaction context.

Today, several of those consumers resolve `getStoredRpcUrl(chainId)` or read a
resolved chain's `rpcUrl`, construct a one-URL client, and cache that client.
The portfolio also derives its own mounted-screen health report. Consequences
include:

1. one component can observe `429` while another immediately retries the same
   endpoint;
2. navigating away can discard local health;
3. opening another popup, side panel, or full-page surface starts unaware of
   the failure;
4. a service-worker restart discards in-memory observations;
5. Viem and direct JSON-RPC clients may classify or retry errors differently;
6. concurrency against a limited endpoint is not coordinated globally; and
7. callers cannot distinguish the configured primary from the endpoint
   currently carrying runtime traffic.

### 3.2 Desired outcome

RPC health should behave as chain infrastructure, not component state:

- the first authoritative retryable failure updates shared health;
- already-dispatched eligible reads retry when their attempt fails;
- requests not yet dispatched skip the unhealthy endpoint;
- later screens inherit the same effective endpoint;
- service-worker restart restores recent cooldown state;
- a recovered configured primary is reintroduced cautiously;
- application-level RPC errors remain unchanged and visible to their caller;
- security policy can make a candidate eligible for one audience and
  ineligible for another; and
- signing and submission semantics remain correct for every wallet type.

## 4. Goals and non-goals

### 4.1 Goals

- Establish one audit-sized authority for configured RPC endpoint selection.
- Make read-only and transaction-preparation failover transparent.
- Share endpoint health across renderer surfaces, provider requests,
  WalletConnect, and background features.
- Survive popup unmounts, route changes, side-panel changes, and MV3
  service-worker restarts.
- Preserve the user's explicit configured-primary preference.
- Avoid thundering-herd retries and half-open probes.
- Bound total request latency, attempt count, response bytes, and concurrency.
- Fail closed on mismatched fallback chain IDs.
- Keep private-network and connected-origin policy exact per attempted
  endpoint.
- Keep raw broadcast ambiguity behavior explicit and separately testable.
- Provide enough trusted status for Settings and home diagnostics without
  exposing sensitive request data.
- Make architectural bypasses detectable with static tests.

### 4.2 Non-goals for V1

- Distributing every request evenly across healthy endpoints.
- Discovering RPCs that the user did not save or WalletChan did not package.
- Automatically adding public RPC providers.
- Synchronizing fallback health or saved endpoint lists across browser
  profiles.
- Guaranteeing all RPC providers return identical `latest` state.
- Retrying contract reverts, invalid params, unsupported methods, nonce
  errors, or other application-level failures.
- General failover for `eth_sendTransaction`,
  `eth_sendRawTransactionSync`, stateful filters, debug/admin methods, or
  subscription methods.
- Hiding the final error after every eligible endpoint is exhausted.
- Treating a private endpoint as safe for a remote dapp because another
  endpoint on the chain was allowed.
- Moving the RPC authority into the Ledger/offscreen document.
- Replacing fixed-provider product APIs such as Bankr, bridge, price, Safe
  Transaction Service, or relayer transports.

## 5. Terminology and invariants

### 5.1 Terms

| Term | Meaning |
| --- | --- |
| Configured primary | User-selected `rpcUrl` in normalized `networksInfo`. |
| Saved fallback | One of up to ten normalized saved endpoint objects in local `networkRpcUrls`, excluding the configured primary when deduplicated. |
| Candidate | A configured primary or saved fallback considered by the broker. |
| Attested candidate | A candidate whose bounded `eth_chainId` result matches the requested chain under the current configuration fingerprint. |
| Eligible candidate | An attested candidate that also satisfies audience, origin, method, capability, and endpoint-flag policy for this request. |
| Preferred effective endpoint | The broker's default healthy candidate for a chain. A request may skip it when its audience, origin, operation, or method makes that candidate ineligible. |
| Circuit | Runtime health state for one normalized endpoint under one chain. |
| Logical request | One caller request, including all broker attempts. |
| Attempt | One bounded JSON-RPC request to one endpoint. |
| Application error | A valid JSON-RPC error caused by request semantics rather than endpoint availability. |
| Retryable transport failure | An explicitly classified rate limit, unambiguous service failure, timeout, network failure, or malformed transport response eligible for failover. |

There is one shared health authority and one default preferred endpoint per
chain, but security and capability filtering remains request-specific. For
example, trusted wallet UI may use a configured private endpoint that a remote
provider origin cannot use. The provider request still benefits from the
private endpoint's known health state, but it selects the first healthy public
candidate eligible for that origin. “Single source of truth” therefore means
one endpoint catalog, health record, circuit policy, and selector—not one URL
forced onto requests with different authority.

### 5.2 Invariants

1. `chainId`, not URL, is the normal runtime lookup key.
2. The configured primary remains first preference whenever it is healthy and
   eligible.
3. No feature component selects, persists, promotes, or cools an endpoint.
4. No content script or webpage supplies a trusted fallback list.
5. Every endpoint is parsed and authorized again at final egress.
6. Saved fallback history is untrusted persisted input and is decoded under
   existing count, URL, and field bounds.
7. No candidate serves a chain until its chain ID is attested under the current
   configuration fingerprint.
8. Endpoint health never grants method, origin, account, signing, or submission
   authority.
9. One endpoint's impersonator opt-in never applies to another endpoint.
10. One chain's health never automatically applies to another chain, even if
    URLs share a provider or API key.
11. A local capacity rejection, caller cancellation, or security-policy
    rejection does not count against remote endpoint health.
12. A valid application error is returned without trying another endpoint in
    V1.
13. Retrying a read never changes the reviewed transaction or signing account.
14. No automatic retry may cause transaction re-preparation at a different
    nonce after signed bytes exist.
15. Health persistence is best effort. Persistence failure does not turn a
    successful RPC response into an error.

## 6. Primary user stories

### 6.1 Transaction review

As a user reviewing a transaction, if the configured RPC rate-limits a gas,
simulation, nonce, metadata, or balance request, WalletChan should retry a
saved fallback and finish rendering without asking me to switch RPCs manually.

### 6.2 Cross-component awareness

As a user, after one component detects an unhealthy endpoint, other components
on the current screen should avoid it as soon as the broker records the
failure.

### 6.3 Cross-screen awareness

As a user, after WalletChan has switched to a healthy fallback, navigating to
Swap, Send, Activity, Settings, or another confirmation screen should not
immediately retry the cooling endpoint.

### 6.4 Cross-surface awareness

As a user, a side panel, popup, and full extension page should share the same
recent endpoint health rather than develop independent selections.

### 6.5 Service-worker restart

As a user, if MV3 suspends and restarts the background worker during an RPC
cooldown, the next request should restore the unexpired state and continue
using the healthy fallback.

### 6.6 Recovery

As a user, after the configured primary recovers, WalletChan should return to
my selected endpoint without repeatedly flapping between providers.

### 6.7 Exhaustion

As a user, if every eligible endpoint fails, WalletChan should show one bounded
actionable error and direct me to Network Settings rather than expose a stream
of provider-specific failures.

## 7. End-to-end transparent failover flow

### 7.1 Single component

```text
Transaction component
       │ chainId + method + params
       ▼
RPC broker
       │ chooses configured primary A
       ▼
RPC A ── HTTP 429
       │
       ├─ broker classifies rate limit
       ├─ atomically opens A's circuit in memory
       ├─ schedules best-effort persisted snapshot
       ├─ chooses and attests eligible fallback B
       ▼
RPC B ── success
       │
       ├─ broker marks B successful/effective
       ▼
Original component promise resolves with B's result
```

The component remains in its normal loading state during the retry. It does
not receive A's `429`, mount an error state, or initiate a URL switch.

### 7.2 Many components on one page

When simulation, gas, nonce, balance, allowance, and metadata requests run
concurrently:

1. requests already sent to A may finish successfully or fail independently;
2. the first classified retryable failure opens or cools A synchronously in
   broker memory before persistence;
3. every request consulting selection afterward skips A;
4. already-dispatched eligible reads that receive a retryable failure retry on
   B;
5. B's first chain-attestation probe is single-flight;
6. requests waiting for selection share the attestation result;
7. an attestation mismatch quarantines B and advances to C; and
8. successful results return independently to their original callers.

The broker must not cancel a request that already succeeded merely because
another concurrent request marked the endpoint unhealthy. Health is
prospective; a valid completed result remains valid.

### 7.3 Later screen

After route navigation, the new component constructs a chain-based broker
transport. It does not load an RPC URL into component state. The broker sees
A's open circuit and uses B first. No React context propagation is required for
correctness.

### 7.4 Service-worker restart

On first request after restart:

1. load current normalized endpoint configuration;
2. compute its fingerprint;
3. lazily decode the bounded runtime health record;
4. discard expired, malformed, unknown, removed, or fingerprint-mismatched
   entries;
5. hydrate the chain's in-memory pool;
6. select B if A's cooldown remains active; and
7. continue within the caller's original total request deadline.

Hydration must be single-flight per chain.

## 8. Architecture

### 8.1 Target dependency shape

```text
network configuration repositories
            │
            ▼
endpoint catalog + chain attestation
            │
            ▼
pure failure classifier + circuit policy
            │
            ▼
bounded runtime health repository
            │
            ▼
RPC broker / scheduler
      ┌─────┼────────────┐
      ▼     ▼            ▼
background  trusted UI   provider / WalletConnect adapters
clients     Viem bridge  with existing audience policy
```

Policy-free feature modules may depend on a broker request interface or
broker-backed Viem transport. They must not depend on the health repository or
endpoint catalog directly.

### 8.2 Proposed network runtime domain

```text
apps/extension/src/chrome/network/runtime/
├── README.md                 # Audit map and dependency contract
├── types.ts                  # Released internal request/status contracts
├── endpointCatalog.ts        # Active-first config, IDs, fingerprints
├── endpointAttestation.ts    # Bounded single-flight eth_chainId checks
├── failureClassifier.ts      # Pure typed retry/application classification
├── circuitPolicy.ts          # Pure state transitions and candidate ranking
├── healthRecord.ts           # Bounded persisted-record codec
├── healthRepository.ts       # Sole rpcRuntimeHealthV1 storage owner
├── scheduler.ts              # Concurrency, leases, half-open single flight
├── broker.ts                 # Logical request orchestration
├── viemTransport.ts          # Broker-backed Viem transport
└── status.ts                 # Trusted non-sensitive status projection
```

The wallet-UI message adapter belongs under `chrome/background/`, for example
`rpcBrokerRouter.ts`. Provider and WalletConnect adapters remain in their
existing audience domains.

### 8.3 Broker public contract

The exact types may evolve, but the semantic contract is:

```ts
type RpcAudience =
  | { kind: "internal" }
  | { kind: "walletUi" }
  | { kind: "provider"; origin: string }
  | { kind: "walletConnect"; topic: string };

type RpcOperationClass =
  | "read"
  | "transactionPreparation"
  | "rawBroadcast"
  | "impersonatedSubmission"
  | "endpointProbe";

type BrokerRpcRequest = {
  chainId: number;
  method: string;
  params: unknown[];
  audience: RpcAudience;
  operation: RpcOperationClass;
  timeoutMs?: number;
};

type BrokerRpcResult = {
  result: unknown;
  // Internal-only status metadata; feature callers normally receive result.
  endpointChanged: boolean;
};
```

Normal feature callers must not receive the endpoint URL. A narrow trusted
Settings status API may resolve endpoint IDs to user-saved labels.

### 8.4 Viem transport

The broker-backed transport must:

- implement the Viem `Transport` request contract;
- send already-formatted JSON-RPC methods and params to the broker;
- avoid constructing an HTTP transport per endpoint in the caller;
- set Viem retry count to zero because the broker owns retries;
- preserve bounded errors and JSON-RPC error codes;
- avoid URL-keyed caller caches; and
- permit a client to remain cached by `chainId` while the broker changes its
  effective endpoint.

Viem's generic fallback transport is not the health authority because its
default behavior can retry broad error classes, ranks independently per client,
does not persist shared circuit state, and cannot by itself preserve
WalletChan's audience and broadcast ambiguity policies.

### 8.5 Renderer transport

Trusted wallet UI code that needs Viem-compatible RPC access will use a runtime
message transport:

```text
renderer Viem client
    → walletUiRpcRequest { chainId, method, params, requestId }
    → exhaustive Wallet UI audience gate
    → broker
    → bounded result/error response
```

Requirements:

- classify the new route in `WALLET_UI_MESSAGE_TYPES`;
- validate `chainId`, method, params, request ID, and serialized request size;
- allow only the internal read/preparation method set needed by migrated UI;
- keep submission, signing, debug, admin, and stateful-filter methods out;
- cap message-channel lifetime with the broker's total deadline;
- never accept `rpcUrl`, fallback URLs, health state, or retry policy from the
  renderer; and
- treat response-channel failure as caller transport failure, not endpoint
  health failure.

Feature-specific existing background routes remain preferable when they
already provide a narrower domain API.

## 9. Endpoint catalog and configuration behavior

### 9.1 Static sources

The catalog composes:

1. normalized built-in/custom chain data from `networksInfo`;
2. the configured primary `rpcUrl`;
3. normalized saved endpoint objects from `networkRpcUrls`;
4. endpoint names; and
5. exact per-endpoint developer flags.

The configured primary is deduplicated and placed first. At most the existing
ten saved endpoints participate.

### 9.2 Configuration fingerprint

Each chain pool receives a deterministic fingerprint over:

- schema version;
- chain ID;
- ordered normalized endpoint URLs;
- endpoint flags that affect request eligibility; and
- configured-primary identity.

The fingerprint is used only to reject stale runtime health. It is not an
authorization proof.

### 9.3 Configuration changes

The broker listens for relevant storage changes:

- `networksInfo` in sync storage;
- `networkRpcUrls` in local storage; and
- reset deletion of either record.

On a changed chain pool:

1. increment or replace the in-memory generation;
2. invalidate cached attestation for changed/removed endpoints;
3. discard health for endpoints no longer present;
4. preserve compatible health for unchanged endpoint IDs when safe;
5. make a newly selected and successfully probed primary immediately
   preferred;
6. prevent new attempts against a removed endpoint; and
7. let an already-dispatched attempt finish without treating configuration
   invalidation as remote endpoint failure.

### 9.4 Manual Settings selection

Selecting an endpoint in Settings remains an explicit configuration action.
The existing probe runs directly against the selected URL under Settings
authority. On a successful matching probe and commit, the broker clears that
endpoint's cooldown and makes it preferred.

If the user force-saves an unreachable or mismatched endpoint:

- the configured primary remains visible as selected;
- final egress validation still applies;
- the endpoint remains ineligible until exact runtime chain attestation;
- no mismatched configured primary or saved fallback is automatically used;
- status explains that the configured endpoint is unavailable or mismatched;
  and
- healthy attested fallbacks may carry eligible reads without silently
  changing Settings.

## 10. Endpoint chain attestation

The current security architecture treats saved RPC history as Settings-only
until a user promotes an endpoint. This PRD intentionally changes that rule.
A saved endpoint may become a runtime fallback without becoming the configured
primary, but only after broker-owned chain attestation and request eligibility
checks. The configured primary uses the same runtime chain boundary.

### 10.1 Attestation requirements

- Call `eth_chainId` through the same bounded egress primitive.
- Apply the request audience's private-network policy before the probe.
- Require a positive safe-integer result exactly equal to the requested chain.
- Cache success by chain ID, endpoint ID, and configuration fingerprint.
- Bound the response to the existing probe ceiling.
- Single-flight concurrent attestation for the same candidate.
- Do not treat mismatch as a temporary health failure; quarantine the candidate
  until configuration changes or the user explicitly retests it.
- Treat rate limit, timeout, or network failure during attestation as a
  retryable candidate failure, then try another candidate within the logical
  request budget.

### 10.2 Configured primary

The configured primary receives the same exact runtime chain attestation as a
fallback. Settings may let a user force-save an unreachable or mismatched URL
so it can be corrected later, but “force save” is not runtime authority to use
the wrong chain. Until a matching probe succeeds:

- the endpoint remains visibly configured;
- the broker classifies it as unattested or mismatched;
- eligible attested fallbacks may carry reads;
- no request is sent through a known mismatch; and
- selecting or editing the endpoint does not clear quarantine without a new
  matching attestation.

## 11. Failure classification

Failure classification must be pure, typed, exhaustively tested, and shared by
direct JSON-RPC and Viem adapters.

### 11.1 Classification table

| Observation | Request retry? | Endpoint health effect | Caller result |
| --- | --- | --- | --- |
| HTTP `429` | Yes for eligible operation | Open immediately; use bounded `Retry-After` or default cooldown | Hidden if fallback succeeds |
| Valid JSON-RPC rate-limit error | Yes only when code/message pair matches reviewed provider patterns | Open immediately | Hidden if fallback succeeds |
| HTTP `502`, `503`, `504` without a valid application result/error | Yes | Open short cooldown immediately | Hidden if fallback succeeds |
| HTTP `500` with malformed/empty transport body | Yes for reads/preparation | Degrade/open under threshold policy | Hidden if fallback succeeds |
| HTTP `500` carrying a valid JSON-RPC application error | No | None | Return application error |
| Timeout enforced by bounded transport | Yes for reads/preparation | Open short cooldown; repeated timeout increases cooldown | Hidden if fallback succeeds |
| DNS/TLS/offline/network fetch failure | Yes for reads/preparation | Open short cooldown | Hidden if fallback succeeds |
| Malformed JSON or missing JSON-RPC result/error | Yes for reads/preparation | Degrade/open | Hidden if fallback succeeds |
| JSON-RPC execution revert | No | None | Return unchanged bounded error |
| Invalid params/request | No | None | Return unchanged bounded error |
| Method not found/unsupported | No in V1 | None; possible future method capability | Return unchanged error |
| Nonce too low/replacement underpriced/insufficient funds | No | None | Return unchanged error |
| Caller cancellation | No | None | Return cancellation |
| Local concurrency/capacity rejection | No automatic alternate attempt | None | Return bounded local error |
| URL/SSRF/private-origin policy rejection | No | None; candidate is ineligible | Try another eligible candidate only if policy permits selection before egress |
| Request too large | No | None | Return bounded local error |
| Response too large | No in V1 | None | Return bounded local error |
| User or wallet rejection | No | None | Return unchanged rejection |
| Ambiguous raw-broadcast transport failure | No generic failover | None | Preserve local-hash ambiguity flow |

### 11.2 Structured transport errors

The bounded HTTP layer currently has access to status, headers, and text before
callers or Viem consume them. Broker attempts must preserve structured,
non-sensitive fields:

```ts
type RpcAttemptFailure = {
  kind:
    | "rateLimit"
    | "server"
    | "timeout"
    | "network"
    | "invalidResponse"
    | "application"
    | "policy"
    | "localCapacity"
    | "cancelled";
  httpStatus?: number;
  rpcCode?: number;
  retryAfterMs?: number;
  message: string; // bounded
};
```

Do not reduce HTTP status to a string and later recover it with regex. Raw
headers, response bodies, and nested provider metadata do not enter health
storage.

### 11.3 JSON-RPC rate limits

JSON-RPC server codes are not globally unique. A numeric code alone must not
trigger failover. Supported provider patterns require:

- an explicitly reviewed code;
- a bounded normalized message pattern;
- tests for positive and negative examples; and
- no collision with range-limit, execution, or application errors used by
  WalletChan features.

## 12. Circuit breaker and endpoint selection

### 12.1 Circuit states

```text
healthy
  │ retryable failure
  ▼
open / cooling
  │ cooldown expires
  ▼
half-open ── success ──> healthy
  │
  └─ retryable failure ──> open with bounded backoff
```

A lightweight `degraded` counter may exist inside the healthy record, but
candidate selection must expose only clear effective states.

### 12.2 Initial cooldown policy

Exact values should be frozen by tests before implementation. Proposed V1
defaults:

| Failure | Initial cooldown | Backoff |
| --- | ---: | --- |
| HTTP/recognized RPC rate limit | `Retry-After`, otherwise 60 seconds | Double to maximum 5 minutes |
| `502`/`503`/`504` | 30 seconds | Double to maximum 2 minutes |
| Timeout | 15 seconds | Double to maximum 2 minutes |
| Network failure | 30 seconds | Double to maximum 2 minutes |
| Malformed response | 30 seconds | Double to maximum 2 minutes |
| Unstructured `500` | 15 seconds | Open longer after repeated observation |

All decoded timestamps and cooldowns are clamped. Clock anomalies must not
create a permanent circuit.

### 12.3 Sticky effective endpoint

After B successfully replaces A:

- B remains preferred while A is open;
- B remains sticky during A's half-open probe;
- only one safe request probes A after cooldown;
- other requests continue on B during that probe;
- one successful A probe closes its circuit, but A becomes effective only
  under a short recovery hysteresis policy; and
- repeated A failure extends its cooldown without disrupting successful B
  traffic.

The broker should prefer the user's configured primary after stable recovery.
It should not permanently optimize for the fastest provider.

### 12.4 Candidate ranking

For each logical request:

1. discard malformed, removed, expired, quarantined, or policy-ineligible
   candidates;
2. prefer a healthy sticky effective endpoint;
3. otherwise prefer the healthy configured primary;
4. then use healthy attested fallbacks in saved order;
5. reserve at most one eligible half-open candidate for a probe;
6. avoid open candidates until cooldown expires;
7. if every circuit is open, probe only the candidate whose retry time is
   earliest and only when policy allows; and
8. stop at the attempt or total-deadline limit.

### 12.5 All candidates exhausted

The broker records bounded internal attempt summaries and returns one
`RpcPoolExhaustedError` containing:

- chain ID;
- high-level failure category;
- whether fallbacks existed;
- whether every candidate was cooling, ineligible, mismatched, or failed; and
- a bounded user-safe message.

It must not return endpoint URLs, API-key-bearing paths, raw response bodies,
or a concatenation of remote error messages.

## 13. Deadlines, attempts, concurrency, and cancellation

### 13.1 One total deadline

Each logical request owns one deadline. Proposed defaults:

- ordinary read: 15 seconds;
- interactive transaction review/preparation: up to 20 seconds where current
  UX already permits it;
- endpoint probe: 8 seconds;
- hard maximum accepted from any caller: 30 seconds.

Each attempt receives at most the remaining logical budget. A request must not
run ten full endpoint timeouts.

### 13.2 Attempt limit

- Default maximum: three endpoint attempts.
- Immediate `429` may advance without delay.
- Attestation consumes time but does not increase the RPC-method attempt count;
  it remains bounded by candidate count and total deadline.
- Retrying the same endpoint inside Viem is disabled.

### 13.3 Concurrency

The broker becomes the owner of configured-RPC concurrency:

- preserve or tighten the existing global concurrent-request ceiling;
- optionally cap per-chain and per-endpoint in-flight attempts;
- consult circuit state immediately before dispatch;
- ensure a queued attempt switches away from an endpoint opened while it was
  waiting;
- single-flight endpoint hydration, chain attestation, and half-open probes;
- do not count fixed service APIs against configured-RPC endpoint health; and
- prevent a burst of fallback attempts from bypassing the global cap.

Requests already on the wire cannot always be recalled after another request
opens the circuit. They may finish, and eligible failures may retry.

### 13.4 Cancellation

V1 trusted UI messages may complete in the background after a renderer
unmounts, provided:

- the logical deadline remains bounded;
- no signing or irreversible operation is involved;
- abandoned results are not persisted as feature state; and
- valid success/failure observations may still update endpoint health.

A later runtime-port cancellation protocol may abort caller-owned reads.
Caller cancellation never penalizes an endpoint.

## 14. Runtime health storage

### 14.1 Storage key

Proposed key: `rpcRuntimeHealthV1` in `chrome.storage.local`.

Rationale:

- renderer navigation and popup closure do not affect it;
- MV3 worker restarts can hydrate it;
- it is not coupled to authentication session teardown, which currently
  clears the entire native session storage area;
- it can be bounded and TTL-pruned;
- it contains no request or secret material; and
- wallet reset can remove it through the exact reset manifest.

This is a proposed released storage key and therefore requires updates to
`STORAGE.md`, `SECURITY.md`, `SECURITY_ARCHITECTURE.md`,
`IMPLEMENTATION.md`, the reset manifest, and frozen codec tests before merge.

### 14.2 Record shape

Illustrative shape:

```ts
type RpcRuntimeHealthV1 = {
  version: 1;
  updatedAt: number;
  chains: Record<
    string,
    {
      configFingerprint: string;
      preferredEndpointId?: string;
      expiresAt: number;
      endpoints: Record<
        string,
        {
          state: "open" | "halfOpen";
          failureKind:
            | "rateLimit"
            | "server"
            | "timeout"
            | "network"
            | "invalidResponse";
          consecutiveFailures: number;
          cooldownUntil: number;
        }
      >;
    }
  >;
};
```

Healthy endpoints need not be persisted. IDs are hashes/fingerprints of the
normalized URL under the chain configuration; the record does not duplicate
the URL.

### 14.3 Bounds and lifecycle

- Maximum chains: no greater than the existing network-history chain bound.
- Maximum endpoints per chain: existing endpoint maximum.
- Maximum consecutive-failure count: small clamped integer.
- Maximum cooldown: 5 minutes.
- Maximum record lifetime: proposed 15 minutes after last transition.
- Decode malformed records as empty.
- Persist only state transitions, effective changes, and recovery—not every
  request success.
- Serialize writes and make them best effort.
- Prune expired records during hydration and maintenance.
- Reset removes the complete key.
- Network deletion removes that chain's state.
- Endpoint removal makes its health unreachable immediately.

## 15. Audience and security policy

### 15.1 Internal background and trusted UI

Internal background and trusted wallet UI reads may use configured private
endpoints when the existing trusted Settings/configuration policy admits them.
They still receive:

- scheme and credential validation;
- public-HTTPS requirements for public hosts;
- redirect rejection;
- no cookies or HTTP credentials;
- no referrer;
- request/response byte ceilings;
- total deadlines; and
- method/operation restrictions.

### 15.2 Injected provider

The provider route remains a separate, narrow adapter:

1. validate the external envelope;
2. authorize the exact connected top-level sender and origin;
3. resolve/attest the requested chain under provider state;
4. accept only the existing safe read-only method allowlist;
5. ask the broker for candidates eligible for that exact origin;
6. deliver the result through the existing durable result channel; and
7. return bounded EIP-1193-compatible errors.

The content bridge should stop sending `rpcUrl`. It sends the attested chain ID
or enough chain context for the background to derive it. The background never
trusts a page-selected URL.

A public endpoint may be eligible for a remote dapp. A loopback/private
fallback is not eligible merely because another endpoint on that chain was
allowed. Existing loopback/same-LAN-host rules and exact developer opt-in apply
to each attempted endpoint.

### 15.3 WalletConnect

WalletConnect already identifies a chain in its namespace request. The adapter
must:

- verify the session supports the requested chain;
- retain the safe read-only forwarding allowlist;
- never let a relay peer provide candidates;
- apply private-network policy at each candidate;
- use broker health shared with extension reads; and
- preserve protocol error/result semantics.

### 15.4 Impersonator accounts

The saved endpoint field `allowImpersonatedTransactions` is an exact
endpoint-specific capability.

- Read-only calls may use the normal candidate policy where audience rules
  permit.
- `eth_sendTransaction` must use only the selected endpoint with an exact true
  flag.
- A fallback endpoint with no flag cannot inherit authorization.
- A flagged fallback does not become submission-authorized merely because the
  selected endpoint failed; the user must explicitly select it.
- The broker must not convert an impersonator submission into raw-signing or
  normal transaction fallback.

### 15.5 Secret and privacy considerations

Automatic fallback can expose a public address, calldata, queried contracts,
or read patterns to more than one user-saved provider. Settings must explain:

> When an RPC is unavailable or rate-limited, WalletChan may retry read
> requests using another saved endpoint for this network.

The broker must never:

- send private keys, seed phrases, passwords, passkey material, Ledger device
  data, Bankr credentials, Privacy Pools recovery material, proofs, or notes to
  an RPC;
- include RPC payloads or results in health storage;
- log full URLs that may contain API keys;
- log raw calldata as failover diagnostics; or
- add telemetry about endpoint usage.

## 16. Operation classes and retry policy

### 16.1 Read

Examples:

- `eth_chainId`;
- `eth_blockNumber`;
- `eth_getBalance`;
- `eth_getCode`;
- `eth_getStorageAt`;
- `eth_getTransactionCount`;
- `eth_getTransactionByHash`;
- `eth_getTransactionReceipt`;
- `eth_getBlockByNumber`;
- `eth_getLogs`;
- `eth_call`;
- `eth_estimateGas`;
- `eth_createAccessList`;
- `eth_feeHistory`;
- `eth_gasPrice`; and
- `eth_maxPriorityFeePerGas`.

Eligible retryable transport failures fail over transparently.

### 16.2 Transaction preparation

Preparation includes nonce, fee, gas, simulation, allowance, delegate,
capability, and contract-state reads before signing. It may use transparent
read failover, but:

- request/account/chain pinning remains outside the broker;
- a fallback cannot change reviewed transaction fields;
- final authorization remains at the signing/effect boundary;
- nonce and latest-state observations may come from a newer or older head;
- transaction coordinators should use a short endpoint lease where a
  multi-read sequence requires consistency; and
- signed bytes are never recreated solely because the effective RPC changed.

### 16.3 Raw signed broadcast

V1 preserves current behavior:

- the local transaction is prepared and signed once;
- the deterministic local hash is computed;
- ambiguous broadcast failure returns `broadcastUncertain`;
- receipt reconciliation tracks the local hash; and
- no generic broker failover retries the broadcast.

A future separately reviewed extension may retry identical signed bytes on an
explicit, unambiguous rate-limit rejection. It must define:

- which HTTP/JSON-RPC responses prove non-acceptance;
- whether the alternate endpoint supports the method;
- local-hash/returned-hash equality;
- duplicate-known-transaction handling;
- Safe and hardware wallet parity; and
- ambiguity behavior when the retry also fails.

### 16.4 Endpoint-pinned methods

The following remain pinned or outside V1 broker failover:

- impersonator `eth_sendTransaction`;
- `eth_sendRawTransactionSync`;
- stateful filters and subscriptions;
- debug/admin methods;
- Settings chain-ID probes for a newly entered URL;
- fixed reconciliation quorum endpoints;
- dapp-discovered page RPCs;
- protocol transports that require a particular provider; and
- any method whose correctness depends on endpoint-local state.

## 17. Consistency across components

### 17.1 Effective endpoint lease

For ordinary independent reads, global endpoint health is sufficient. For a
transaction-review operation that performs several related reads, a
coordinator may request a short broker lease:

```ts
type RpcEndpointLease = {
  chainId: number;
  generation: number;
  endpointId: string;
  expiresAt: number;
};
```

The lease is opaque to feature code and contains no URL. Requests under the
lease prefer the same endpoint while it remains healthy and eligible. A
retryable failure can break the lease and move the operation to a fallback.

### 17.2 Block consistency

Failover does not make separate `latest` reads atomic. Where exact consistency
matters:

- resolve a block number/hash first;
- pass that block reference into subsequent supported calls;
- keep existing operation-specific snapshot rules; or
- rerun the complete pure preparation/simulation sequence after a failover
  before signing.

The broker does not invent cross-call snapshot semantics.

### 17.3 Cached clients

Feature clients may cache a broker-backed Viem client by chain ID and operation
class. They must not cache:

- resolved RPC URL;
- effective endpoint ID as authority;
- local circuit state;
- fallback order; or
- endpoint attestation.

## 18. Wallet-type behavior

RPC centralization must be tested against all four signing wallet types, plus
view-only and Safe flows.

### 18.1 Private-key accounts

- Review/preparation reads use broker failover.
- Agent or master password authority is unchanged.
- Private-key resolution and final authorization remain unchanged.
- Raw broadcast preserves sign-once and ambiguity semantics.

### 18.2 Seed-phrase accounts

- Same preparation/failover behavior as private-key accounts.
- Mnemonic capability, derivation binding, and account integrity remain
  unchanged.
- Raw broadcast preserves sign-once and ambiguity semantics.

### 18.3 Ledger accounts

- Public preparation reads use broker failover before device signing.
- The offscreen document does not become the RPC health authority.
- Device interaction, derivation binding, signature recovery, and hardware
  errors remain independent from RPC health.
- Broadcast after device signing preserves deterministic hash and ambiguity
  policy.
- Automated no-device coverage and real-device QA are required.

### 18.4 Bankr accounts

- Configured-chain reads, simulation, display, and status paths may use the
  broker.
- Bankr credential and remote submission transport are not RPC candidates.
- An RPC fallback cannot authorize a Bankr credential generation or account
  change.
- Bankr API retry/ambiguity policy remains separate.

### 18.5 Impersonator accounts

- Read-only review data may fail over under audience policy.
- Submission remains exact-selected-endpoint-only and opt-in-only.
- No failure may enter a direct signing path.

### 18.6 Safe accounts

- Safe discovery/onchain state, simulation, gas, and receipt reads may use
  broker failover where they rely on configured RPCs.
- Proposal service calls remain separate fixed service transport.
- Approval/execution is tested independently through each eligible linked
  owner type.
- Serialized Safe execution broadcast retains sign-once and ambiguity
  handling.

## 19. Status and user experience

### 19.1 Feature screens

When failover succeeds:

- retain the normal loading state until the response arrives;
- do not show the intermediate endpoint error;
- do not ask the user to switch RPC manually;
- do not remount the page;
- do not emit chain/account change;
- do not clear form or transaction-review state; and
- do not restart unrelated successful queries.

If the added delay crosses an existing loading threshold, normal skeleton or
loading copy may continue. Do not show a red error merely because fallback is
in progress.

### 19.2 Final failure

When every eligible endpoint is exhausted, feature code receives one bounded
error category. Suggested user copy:

> All saved RPC endpoints for this network are currently unavailable. Try
> again or review Network Settings.

Features that can safely retain stale/API-derived data may continue doing so,
but must not misrepresent unverified state as current.

### 19.3 Settings

Settings may display trusted broker status:

- Configured;
- In use;
- Fallback in use;
- Temporarily unavailable;
- Checking;
- Chain mismatch; or
- Unreachable.

Requirements:

- use saved endpoint names/host presentation without exposing URL secrets;
- show remaining cooldown only approximately;
- provide an explicit “Try now” action that performs one bounded half-open
  probe;
- distinguish selection from runtime use;
- never let renderer status mutate the broker directly; and
- explain automatic read retry privacy.

### 19.4 Home alert

The current mounted-renderer portfolio RPC issue reducer should stop being an
independent health authority. Home may subscribe to or query a bounded broker
status projection.

- Do not show a chain-level outage if a healthy fallback is serving requests.
- A subtle non-blocking fallback indicator is optional.
- Show the existing actionable RPC issue only when the chain pool is exhausted
  or required candidates are ineligible/mismatched.
- Dismissal is display state only and never changes circuit health.

## 20. Provider and WalletConnect compatibility

### 20.1 Provider result flow

The existing durable `rpcResult:{id}` flow remains compatible. The adapter
changes target resolution:

```text
page method
  → isolated content validation
  → rpcRequest { requestId, chainId, method, params }
  → connected-origin authorization
  → broker provider-read request
  → durable bounded result
  → content/inpage correlated response
```

Provider results must not reveal whether a fallback was used.

### 20.2 Provider errors

- Application JSON-RPC errors preserve their code/message mapping.
- Pool exhaustion maps to a bounded provider-compatible request failure.
- Unsupported methods remain `-32601`/existing policy behavior.
- Chain unavailable/unknown remains distinct from endpoint outage.
- No provider error includes saved endpoint inventory.

### 20.3 WalletConnect

WalletConnect read requests use the same endpoint pool but preserve:

- topic/session authorization;
- requested CAIP chain validation;
- supported method checks;
- relay response deadlines; and
- exact result/error response correlation.

A fallback health event from WalletConnect benefits wallet UI/provider reads,
and vice versa, because all refer to the same chain pool.

## 21. Specialized flow audit

Implementation must classify every current configured-RPC call site as one of:

1. broker-managed configured-chain read;
2. broker-managed transaction preparation;
3. explicitly pinned raw broadcast;
4. exact impersonator endpoint operation;
5. Settings endpoint probe;
6. fixed quorum/reconciliation transport;
7. dapp-discovered page transport;
8. fixed product/protocol service; or
9. obsolete duplicate path to remove.

At minimum, audit:

- portfolio and progressive balances;
- gas and fee estimation;
- single/batch simulations;
- token balance, metadata, allowance, and Permit2 reads;
- transaction replacement and history enrichment;
- receipt reconciliation and polling;
- swap and bridge preparation;
- Safe discovery, state, execution, and receipts;
- delegation/EIP-7702/ERC-7715 state;
- Privacy Pools deployment/event/deposit/withdrawal reads;
- force-inclusion L1/L2 configured RPC selection;
- ENS/GNS/decentralized browsing;
- provider and WalletConnect forwarding;
- Ledger preparation and broadcast;
- local signing clients;
- impersonator execution; and
- recovery/quorum paths.

An explicit exception registry or architecture test allowlist must document why
each remaining direct URL client cannot use the broker.

## 22. Architecture enforcement

Tests should make these regressions fail:

- renderer feature code importing configured egress transport directly;
- feature code calling `getStoredRpcUrl` to create a client;
- content bridge sending an RPC URL to background;
- provider/WalletConnect bypassing broker health;
- new URL-keyed configured-chain client caches;
- Viem retry count above zero on broker transports;
- saved fallback use without chain attestation;
- raw broadcast using the normal read retry policy;
- impersonator submission using a non-selected endpoint;
- health storage outside its repository;
- unbounded health records or cooldowns; and
- new network runtime modules exceeding audit size budgets.

Allowed direct paths must be narrow and named, not justified with a generic
“special case” comment.

## 23. Implementation plan

### Phase 0: freeze contracts and inventory

- Freeze product decisions, error classes, cooldowns, deadline, and attempt
  limits.
- Produce the complete current RPC call-site classification.
- Identify every fixed/pinned exception.
- Add architecture test fixtures before migration.
- Update network-domain README target dependency direction.

Exit criteria:

- every configured-RPC call site has an owner and migration classification;
- transaction submission paths are separated from read paths; and
- no unresolved audience or private-network behavior remains.

### Phase 1: pure policy and runtime record

- Add failure-classifier types and pure tests.
- Add circuit state transition policy and property/table tests.
- Add endpoint IDs/configuration fingerprints.
- Add bounded `rpcRuntimeHealthV1` codec/repository.
- Add reset, prune, and configuration invalidation behavior.

Exit criteria:

- malformed state decodes empty;
- every transition is deterministic under injected time;
- raw URLs/payloads cannot enter the record; and
- cooldown and record bounds are frozen.

### Phase 2: broker and bounded attempt transport

- Add structured bounded attempt errors.
- Implement endpoint catalog and single-flight attestation.
- Implement selection, attempts, deadlines, concurrency, and persistence.
- Add broker-backed Viem transport.
- Keep direct compatibility helpers temporarily delegating to one-endpoint
  behavior where migration is incomplete.

Exit criteria:

- unit/integration tests prove A `429` → B success;
- later requests skip A;
- worker restart hydrates A's cooldown;
- all-failed requests respect total deadline; and
- application errors do not fail over.

### Phase 3: background read migration

- Migrate portfolio, gas, simulation, history, token, Safe, delegation, swap,
  bridge preparation, and other configured-chain background reads.
- Replace URL-keyed client caches with broker-transport clients keyed by chain
  and operation class.
- Keep fixed/quorum and endpoint-pinned clients explicit.

Exit criteria:

- background configured reads no longer choose URLs;
- current behavior tests remain green; and
- no signing/submission authority moves into the broker.

### Phase 4: renderer migration

- Prefer existing domain messages where available.
- Add the trusted wallet-UI broker route for remaining generic reads.
- Replace direct renderer Viem/fetch clients.
- Replace screen-local health authority with broker status.

Exit criteria:

- a transaction-request integration test mounts multiple consumers, causes one
  `429`, and observes transparent shared fallback;
- route navigation uses B without retrying A; and
- wallet UI cannot submit a URL or disallowed method.

### Phase 5: provider and WalletConnect migration

- Replace content-provided URL with chain context.
- Route provider reads through broker under exact origin policy.
- Route WalletConnect reads through broker under topic/chain policy.
- Preserve durable result delivery and method allowlists.

Exit criteria:

- provider A `429` benefits subsequent wallet UI/WC requests;
- private backup SSRF tests remain fail-closed;
- disallowed methods never reach any candidate; and
- page/relay peers cannot enumerate or select endpoints.

### Phase 6: transaction and specialized flow review

- Confirm local PK, seed, Ledger, Safe, and Bankr preparation uses the broker.
- Keep raw submission pinned under current ambiguity policy.
- Keep impersonator endpoint authority exact.
- Classify force inclusion, Privacy Pools, fixed reconciliation, and
  method-capability paths.
- Add operation leases where multi-read consistency requires them.

Exit criteria:

- all wallet-type matrices pass;
- no duplicate signing or transaction preparation occurs during failover; and
- no ambiguous submission is retried generically.

### Phase 7: UX, documentation, and rollout

- Add Settings status/privacy copy.
- Change home outage logic to pool exhaustion.
- Update implementation, storage, security, and architecture docs.
- Add diagnostics guarded against sensitive data.
- Roll out behind an internal feature flag if needed.

Exit criteria:

- no UI error appears when fallback succeeds;
- pool exhaustion remains actionable;
- documents match released storage/message behavior; and
- all release gates pass.

## 24. Required test plan

### 24.1 Pure failure classification

Test at least:

- HTTP 429 with valid, invalid, missing, negative, huge, date, and seconds
  `Retry-After`;
- reviewed JSON-RPC rate-limit patterns;
- same numeric code with a non-rate-limit message;
- 502/503/504 empty and malformed bodies;
- HTTP 500 with valid execution revert;
- timeout versus caller abort;
- DNS/network error;
- malformed JSON;
- missing result/error;
- oversized response;
- local concurrency rejection;
- policy rejection; and
- bounded error messages.

### 24.2 Circuit policy

- healthy → open → half-open → healthy;
- repeated failure bounded exponential cooldown;
- timestamp/counter clamping;
- configured-primary recovery hysteresis;
- no permanent open state after clock rollback/advance;
- all-open earliest candidate behavior;
- healthy fallback stickiness;
- application errors leave state unchanged; and
- success from an already-dispatched request remains usable.

### 24.3 Endpoint catalog and storage

- configured primary is first and deduplicated;
- ten-endpoint bound;
- malformed saved records ignored;
- configuration fingerprint changes on URL/order/flag/primary change;
- stale health discarded;
- removed chain/endpoint pruned;
- reset removes runtime health;
- storage write failure is best effort;
- record contains no URL, params, payload, result, address, or raw error; and
- browser/service-worker lifecycle TTL behavior.

### 24.4 Attestation

- exact matching chain accepted;
- decimal/hex chain result parsing bounded;
- mismatch quarantined;
- malformed chain result rejected;
- private target rejected for remote origin;
- trusted internal local target admitted under policy;
- concurrent probes single-flight;
- probe 429 advances to another candidate;
- fingerprint change invalidates prior success; and
- force-saved mismatch never becomes automatic fallback.

### 24.5 Broker behavior

- A 429 → B success → caller success;
- A 503 → B success;
- A timeout → B success within total deadline;
- A application revert → no B request;
- A/B fail → C success;
- maximum attempts enforced;
- total deadline enforced;
- subsequent request skips open A;
- half-open A receives only one probe;
- concurrent calls already on A each retry safely;
- queued calls switch before dispatch;
- B validation single-flight;
- service-worker recreation hydrates effective B;
- persistence failure does not fail request;
- all candidates exhausted returns one bounded error; and
- no Viem nested retry duplicates attempts.

### 24.6 Multi-component UI integration

Build a transaction-review fixture with concurrent:

- nonce;
- gas;
- fee;
- simulation;
- balance;
- token metadata; and
- allowance reads.

Required assertions:

1. one component's A response is `429`;
2. broker opens A before retry;
3. failed eligible requests retry on B;
4. components receive successful data without transient error UI;
5. later requests go directly to B;
6. navigation/remount does not try A;
7. all-fallback failure shows one final actionable state; and
8. already successful A data is not discarded solely because A later opens.

### 24.7 Provider and WalletConnect

- exact connected sender required;
- content/relay cannot send URL/fallbacks;
- safe read method succeeds through B after A 429;
- signing/submission/debug/filter methods remain rejected;
- remote page cannot pivot to loopback/private fallback;
- LAN exact-host policy preserved;
- WalletConnect session-chain mismatch rejected;
- provider/WC results do not reveal endpoint inventory; and
- result channels remain bounded and correlated.

### 24.8 Transaction and wallet types

For private-key, seed-phrase, Ledger, and Bankr accounts:

- transaction-review reads fail over;
- agent-password signing authority is unchanged;
- reviewed account/from/chain remains pinned;
- fallback cannot release a signature;
- final authority checks still run;
- no request is signed twice due to failover; and
- private-key reveal remains master-only.

Additional:

- Ledger automated no-device test and physical-device QA;
- Bankr submission does not enter configured RPC transport;
- impersonator reads may fail over but submission may not;
- Safe owner paths tested independently for every eligible owner type;
- raw broadcast timeout remains ambiguous without generic retry;
- deterministic local transaction hash remains unchanged; and
- receipt reconciliation can use eligible read failover without resubmission.

### 24.9 Security regression

- redirect-to-private blocked on every candidate;
- URL userinfo rejected;
- public plaintext HTTP rejected;
- request and response ceilings preserved across attempts;
- total concurrency cannot be multiplied by candidates;
- health record decoder resists oversized/malformed storage;
- no endpoint flags bleed across candidates;
- no origin authority bleeds across requests;
- wallet reset invalidates in-flight generation and stored health;
- network deletion prevents new egress;
- message audience list remains exhaustive; and
- source architecture tests prevent configured-RPC bypass.

## 25. Manual QA matrix

| Scenario | Expected |
| --- | --- |
| Primary returns 429; fallback healthy | Current component completes; later screen starts on fallback; no error toast |
| Primary returns 503; fallback healthy | Same transparent behavior |
| Primary times out; fallback healthy | Request completes within total deadline; primary cools |
| Primary returns contract revert | Revert shown; fallback not contacted |
| Primary and fallback fail | One pool-exhausted error with Settings action |
| Primary cooldown expires and recovers | One half-open probe; stable return to configured primary |
| Popup closes/reopens during cooldown | Reopened popup skips primary |
| Side panel navigates between screens | New screen skips primary |
| Service worker restarts during cooldown | Hydrated worker skips primary |
| User selects another endpoint in Settings | Successful probe makes it configured/effective |
| Saved fallback reports wrong chain | Never used; Settings shows mismatch |
| Remote dapp with private fallback | Private pivot remains blocked |
| Impersonator selected endpoint fails | No automatic submission through another endpoint |
| PK/seed transaction review | Reads fail over; signing remains one-shot |
| Ledger transaction review/sign | Reads fail over before device; device signs once; physical QA passes |
| Bankr transaction review | Reads may fail over; Bankr submission remains Bankr-only |
| Safe linked-owner execution | Reads fail over; owner authorization and serialized broadcast unchanged |

## 26. Performance requirements

- A healthy primary adds no extra network round trip after cached
  configuration hydration.
- Persisted health must be loaded lazily and single-flight.
- Successful reads do not write storage.
- Immediate rate limits advance without artificial delay.
- Candidate attestation occurs once per configuration fingerprint, not once per
  component.
- Endpoint status rendering does not poll aggressively.
- Broker transport avoids rebuilding clients after effective endpoint changes.
- Global and per-endpoint concurrency prevent fallback amplification.
- Total deadline and attempt limit bound worst-case user-visible latency.
- Health record remains small enough for local storage and sync-free.

## 27. Documentation and compatibility updates required at implementation

Implementation is not complete until the following stay synchronized:

- `_docs/IMPLEMENTATION.md`: broker request flows, renderer/provider/WC
  routing, transaction behavior, and lifecycle.
- `_docs/SECURITY.md`: runtime fallback policy, storage key, SSRF/origin
  boundary, impersonator exception, and pre-commit checklist.
- `_docs/SECURITY_ARCHITECTURE.md`: saved endpoints becoming attested runtime
  candidates, runtime domain dependency direction, and router boundary.
- `_docs/STORAGE.md`: `rpcRuntimeHealthV1` exact schema, bounds, TTL, reset,
  and migration behavior.
- `apps/extension/src/chrome/network/README.md`: audit map and direct-egress
  exception registry.
- Network and relevant feature README/test maps.
- Reset manifest and reset tests.
- Message access-policy and router completeness tests.

No compatibility facade may become a second health authority.

## 28. Rollout plan

### 28.1 Internal read-only rollout

Enable broker selection for internal background reads first. Record only local
diagnostic counters/log categories without telemetry or sensitive fields.
Compare feature behavior under deterministic mocked failures.

### 28.2 Renderer rollout

Migrate direct renderer clients and transaction-review multi-component
fixtures. Confirm transparent UI behavior and route persistence.

### 28.3 Provider and WalletConnect rollout

Move external read forwarding only after origin/private-network regression
coverage is complete.

### 28.4 Specialized and signing rollout

Migrate preparation reads for every wallet type. Keep raw broadcast and
impersonator submission policies pinned.

### 28.5 Release gates

- All network/security tests pass.
- `pnpm test:extension-ui` passes.
- `pnpm lint` passes for touched code.
- `pnpm build:extension` succeeds and refreshes the unpacked build.
- Ledger real-device QA passes when transaction paths are affected.
- Manual failover matrix passes on at least two built-in chains and one custom
  chain.
- No unresolved direct configured-RPC bypass remains outside the documented
  exception registry.

## 29. Acceptance criteria

The product behavior is accepted when:

1. a `429` observed by one component causes the same logical request to retry
   another eligible saved RPC automatically;
2. the component shows no error when the retry succeeds;
3. other components and later screens skip the cooling endpoint;
4. popup, side panel, full-page UI, provider, WalletConnect, and background
   reads share one chain health authority;
5. a service-worker restart restores unexpired cooldown/effective state;
6. the configured primary remains unchanged in Settings during failover;
7. recovered primary selection is stable and non-flapping;
8. application JSON-RPC errors never trigger broad endpoint switching;
9. total deadline, attempts, bytes, and concurrency remain bounded;
10. neither a configured primary nor saved fallback can serve the wrong chain;
11. private-network/origin restrictions apply independently to every attempt;
12. impersonator submission remains exact-endpoint opt-in only;
13. raw broadcast ambiguity behavior remains unchanged;
14. all four signing wallet types pass preparation/signing regression tests;
15. Safe linked-owner paths are tested independently;
16. pool exhaustion produces one actionable error;
17. health storage contains no request or secret data; and
18. architecture tests prevent future components from bypassing the broker.

## 30. Definition of done

- The runtime domain, broker, transport adapters, and storage repository are
  audit-sized and documented.
- Every configured-chain RPC call site is broker-managed or explicitly
  excepted.
- Every new message type is audience-classified and envelope-tested.
- Every new storage key is documented, bounded, reset-aware, and codec-tested.
- Read/preparation failover is transparent across component and screen
  boundaries.
- Provider and WalletConnect retain exact authorization and method policy.
- Transaction submission ambiguity and impersonator policy are unchanged
  unless a separate reviewed requirement explicitly changes them.
- Private-key, seed-phrase, Ledger, Bankr, impersonator, and Safe matrices pass.
- Required documentation, tests, lint, and extension build pass.
- No sensitive endpoint/request diagnostics or telemetry are introduced.

## 31. Open implementation decisions

These must be resolved and frozen before coding the relevant phase:

1. Exact initial cooldown, backoff, total-deadline, and attempt-limit values.
2. Whether unstructured HTTP `500` opens after one or two observations.
3. The initial reviewed JSON-RPC rate-limit code/message patterns.
4. Whether V1 needs an opaque endpoint lease or can defer it until a concrete
   consistency-sensitive flow requires it.
5. Whether wallet-UI cancellation needs a runtime port in V1.
6. Whether successful configured-primary recovery requires one or two
   half-open observations before becoming effective.
7. Which current fixed/pinned RPC paths are deliberately excluded.
8. Whether any endpoint method-capability cache is justified after V1.
9. Whether explicit HTTP `429` raw-broadcast retry should remain a future
   proposal or be specified before launch.

None of these open decisions changes the central product requirement: one
background-owned health authority must make retry and endpoint selection
consistent across WalletChan.
