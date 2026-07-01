---
title: "Event Notification vs. Direct Sync Push: Who Should Depend on Whom?"
description: "When a shared upstream service needs to tell a downstream consumer that something happened, it can publish a thin event with a callback, or call the downstream directly. A dimension-by-dimension comparison of the two, and the one question that usually decides it: who ends up depending on whom."
pubDatetime: 2026-07-01T00:20:00Z
lang: en
tags:
  - event-driven-architecture
  - messaging
  - system-design
  - software-architecture
  - outbox-pattern
---

## TL;DR

- The decision bundles two nested questions: **async-decoupled-pull vs. sync-coupled-push** (temporal coupling, failure isolation, latency, backpressure), and — more decisive for a shared service — **who depends on whom**.
- A direct sync push forces a generic, shared upstream service to hard-code knowledge of one specific downstream (its auth, schema, uptime, quirks). That grows into O(N) point-to-point integrations and a distributed monolith as consumers multiply.
- A thin event + callback keeps the upstream service ignorant of its consumers, buys free backpressure/buffering/dead-lettering, and lets the callback re-read the freshest state at consume time — at the cost of an extra round trip and an eventual-consistency window.
- Whichever you pick, if the upstream service publishes events at all, wrap the write in a **Transactional Outbox** — otherwise a crash between "persist" and "notify" silently drops the message with nothing to replay.
- A **fat event** (event-carried state transfer) is the underrated third option: the same decoupling as the event approach, no callback round-trip, at the cost of putting sensitive data on the bus.

---

## 1. The setup

> A generalized architecture study. The concrete trigger was a fintech-lender setup where an
> upstream **Facade** service (abstracts all bank-data complexity for the whole platform —
> statements, balances, credit signals) must tell a downstream **CRM** that a customer
> connected a new bank. "Salesforce" appears as the concrete CRM example because its real
> platform limits change the analysis. The pattern generalizes to any _generic upstream →
> specific downstream_ notification.

- **Facade**: a generic, shared, upstream service. Its whole purpose is to abstract bank-data complexity for _every_ system on the platform. Many consumers depend on it.
- **CRM** (Salesforce in the concrete case): one of several downstream consumers. On "bank connected" it must update the customer record.
- Platform is event-driven; messaging is NServiceBus over Azure Service Bus.
- Bank data is sensitive (financial PII).

**Approach 1 — Event notification + callback (thin event / claim-check):**

```
Bank connects → Facade persists → Facade publishes "BankConnected{customerId, connectionId}" (thin)
   → bus → CRM subscriber consumes → CRM calls Facade GET /connections/{id}
      → Facade returns full detail → CRM upserts record
```

On the wire: **IDs only** on the bus; sensitive payload travels over one authenticated callback, read **fresh at consume time**.

**Approach 2 — Direct synchronous API push (command):**

```
Bank connects → Facade persists → Facade calls CRM POST /bankinfo {full payload}
   → CRM writes record → returns 200/4xx/5xx
```

On the wire: **full payload**, a point-in-time snapshot, pushed straight into the CRM. The Facade holds CRM credentials + schema and must handle the CRM being slow or down.

---

## 2. Pros & cons by dimension

Legend: **A1** = event+callback, **A2** = direct push, **↔** = depends.

### Coupling & dependency direction → **Tilts A1 (strongly)**

|      | A1                                                                                                                                                        | A2                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pros | Facade publishes a fact, knows nothing about consumers; CRM depends on Facade (healthy: specific→generic). Temporal decoupling. New consumers self-serve. | One fewer indirection; call path reads top-to-bottom.                                                                                                       |
| Cons | CRM must know event schema _and_ callback API (two contracts); needs CRM→Facade connectivity.                                                             | **Generic facade must know the specific CRM** (endpoint, auth, schema, quirks). Grows to O(N) integrations / distributed monolith. Tight temporal coupling. |

### Delivery guarantees & reliability → **Tilts A1**

|      | A1                                                                                                                                  | A2                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pros | Durable, at-least-once delivery + NServiceBus recoverability (immediate + delayed retries → error/DLQ). CRM can be down at publish. | Immediate in-band success/failure signal.                                                                                                                                           |
| Cons | Duplicates possible (needs idempotent upsert); more infra in the path.                                                              | You hand-roll retries/backoff/dead-lettering/durability. Fire-and-forget failure = lost; inline retry couples Facade latency to CRM; background retry = reinventing the bus, worse. |

### Consistency, freshness, ordering, idempotency → **Tilts A1**

|      | A1                                                                                                                                                                            | A2                                                                                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pros | Callback reads **latest** state at consume time → self-healing against missed/stale/reordered events (event = "come look"). Idempotency natural via upsert on `connectionId`. | Strong immediate read-your-write in CRM on happy path; no callback staleness window.                                                                                            |
| Cons | Eventual consistency window (sub-second–seconds). Bus ordering not guaranteed across partitions without sessions/partition keys.                                              | Snapshot can overwrite newer state if retried/late (lost update). Reordered connect/disconnect can land out of order with no re-pull safety net. Duplicates need explicit keys. |

### Latency & timeliness → **↔ (A2 faster happy-path; A1 fine for "seconds")**

|      | A1                                                                 | A2                                                                                                  |
| ---- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Pros | Facade's connect txn returns immediately (just publish).           | Single hop = lowest end-to-end latency; best when a human waits _now_.                              |
| Cons | Bus hop + consume + callback round-trip (still typically seconds). | Adds CRM latency to Facade's critical path if inline; CRM tail latency becomes Facade tail latency. |

### Scalability, load, backpressure & fan-out → **Tilts A1 (strongly at scale)**

|      | A1                                                                                                          | A2                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pros | **Publish once, N consumers.** Queue buffers bursts; consumers drain at their own rate (free backpressure). | Trivial at tiny volume with one consumer.                                                                                                                                                                |
| Cons | Burst can stampede the callback endpoint (thundering herd) — mitigate with caching/ETags/concurrency caps.  | No buffer — spikes hit the CRM directly, burning **Salesforce daily API request quota** + the ~25 concurrent long-running-request cap; 429s must be handled. Fan-out to M consumers = M calls per event. |

### Failure modes, blast radius & isolation → **Tilts A1 (strongly)**

|      | A1                                                                                                                                           | A2                                                                                                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pros | Failures isolated behind the bus; poison message → DLQ without touching the Facade; one broken consumer doesn't affect others (bulkheading). | Failures visible synchronously and immediately.                                                                                                                                                         |
| Cons | DLQ triage is its own skill.                                                                                                                 | **CRM outage/slowness directly degrades the Facade** (thread/connection exhaustion, cascading failure into a core shared service). "One bad downstream takes down the facade" — canonical anti-pattern. |

### Security & data sensitivity (financial PII) → **Tilts A1 (thin) / ↔ vs fat-event**

|      | A1 (thin)                                                                                                                                          | A2                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Pros | **Data minimization**: only IDs on the broker; payload over one authenticated, least-privilege callback, fetched fresh. Smaller leak blast-radius. | Direct TLS channel; data never sits on a broker.                                                                                              |
| Cons | Bank data traverses the CRM→Facade callback; CRM needs read creds.                                                                                 | **Full payload in flight + at rest in CRM**; broader exposure, more compliance surface. (A _fat-event_ hybrid would also put PII on the bus.) |

### Operational complexity, infra, cost & observability → **Tilts A2**

|      | A1                                                                                                                                        | A2                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Pros | If you already run NServiceBus/Azure Service Bus, marginal cost is low; DLQ/retry tooling exists.                                         | Simplest possible: "just an HTTP call." No broker to run/pay/monitor. Single call stack = trivial tracing.          |
| Cons | More moving parts (topic/subscription, endpoint config, DLQ monitoring, callback API). Tracing across an async hop needs correlation IDs. | You must **build** the observability/retry/idempotency the bus gives free — and that home-grown layer is what rots. |

### Evolvability, versioning, contract ownership & extensibility → **Tilts A1 (strongly)**

|      | A1                                                                                                                                                              | A2                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pros | Facade owns **one** event + **one** fetch API for everyone. New consumer = new subscription, **zero facade change**. Additive event versioning is well-trodden. | One contract for the single case.                                                                                                   |
| Cons | Two contracts to version; consumers invisible to producer (need schema registry / contract tests).                                                              | **Per-consumer integration code in the facade** → O(N) maintenance, integration spaghetti, facade redeploys for downstream changes. |

### Dimensions the two-way framing misses

- **Testability / local dev → ↔.** A2 = a stub HTTP server. A1 needs a bus emulator/in-memory transport + contract tests for event _and_ callback.
- **Auditability / replay / event-log value → A1.** A published event stream is a reusable audit trail you can replay to backfill a _new_ consumer or rebuild the CRM after data loss. A2 leaves no such log.
- **Org boundaries (Conway) → A1.** A1 lets each team own its side behind a contract; A2 forces cross-team coordination inside the facade's codebase.
- **Compliance / right-to-erasure → ↔, leans A1-thin.** PII on a broker (fat event) complicates GDPR/erasure/retention; thin event keeps PII off the bus.
- **Domain symmetry (disconnect/reconnect/multi-bank) → A1.** More verbs = more events on the same channel; pull-latest reflects current truth. A2 needs a matching endpoint + ordering care per verb.

---

## 3. Failure-scenario walkthroughs

| Scenario                            | A1 (event+callback)                                                                              | A2 (direct push)                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **CRM down**                        | Event waits durably; CRM drains on recovery. Facade unaffected.                                  | Call fails. Inline → Facade flow degrades; background → must own a retry store or notification is **lost**.                             |
| **Facade down**                     | Nothing published (correct); with **outbox**, pending event publishes on recovery.               | Connect didn't happen → nothing to push (symmetric).                                                                                    |
| **Burst/spike**                     | Queue buffers; consumers drain at pace. Risk: callback thundering herd → cache/concurrency caps. | No buffer; CRM hammered, burns **daily API quota**, hits concurrency cap, 429s to back off on.                                          |
| **Poison message**                  | Retried then parked in **DLQ**; rest of stream flows.                                            | No DLQ — block forever, drop, or build bespoke quarantine.                                                                              |
| **Duplicate** (at-least-once)       | Idempotent upsert on `connectionId` → no-op.                                                     | Needs idempotency key or risks double-write/overwrite.                                                                                  |
| **Out-of-order connect/disconnect** | Callback re-reads **current** truth → converges.                                                 | Snapshot ordering can land stale; needs version/timestamp guards.                                                                       |
| **CRM hits governor limit**         | Indirect: only CRM's outbound callout + write consume limits; bus throttles naturally.           | Direct: every connect consumes inbound API quota; sustained volume can **exhaust the org's daily budget** and block other integrations. |

---

## 4. The dependency-direction insight (the one to internalize)

A facade exists to be the **single place that abstracts complexity for everyone**. A2 makes that generic, shared, upstream service hold a hard-coded dependency on **one specific downstream** — its URL, auth, schema, uptime, rate limits. One integration today; three consumers = three sets of outbound code, three credentials, three failure modes, three reasons to redeploy the facade when a _downstream_ changes. That is how a clean facade decays into a distributed monolith.

A1 inverts the arrow: the facade states a fact once; each consumer owns its dependency _on the facade_ and its own reaction. The generic service stays generic. Hence: for a facade with a growing consumer set, **event-notification is the default and direct push is the exception you justify**.

---

## 5. Third / hybrid options

| Option                                       | What                                                          | When                                                                                              | Trade-off                                                                        |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Event-carried state transfer (fat event)** | Event carries full info; **no callback**.                     | Want A1 decoupling but not the callback / downstream→facade connectivity; sensitivity acceptable. | PII on the bus; larger messages; snapshot can be stale; tighter schema coupling. |
| **Transactional Outbox**                     | Write event in same DB txn as the connect; relay publishes.   | Whenever the facade publishes events.                                                             | Small infra (outbox table + dispatcher); ~mandatory to avoid dual-write loss.    |
| **iPaaS / middleware**                       | Event → integration layer → CRM via Bulk/Composite API.       | Keep CRM API quirks/batching/quota out of the facade.                                             | Another platform to own/pay; added hop.                                          |
| **Salesforce Platform Events**               | Publish a platform event into the CRM; it reacts internally.  | CRM team prefers native pub/sub; offload retry to the platform.                                   | CRM-specific; daily event-delivery allocations.                                  |
| **Event + cached/conditional callback**      | Thin event; callback uses caching/ETags + concurrency limits. | A1 at high burst volume.                                                                          | Extra caching logic.                                                             |
| **Event + periodic reconciliation**          | A1 as primary + scheduled drift sweep.                        | High-assurance financial correctness.                                                             | Extra batch job.                                                                 |

---

## 6. Strongest case for each (steelman)

**For A2 (direct push):** exactly one consumer now and foreseeable, low volume (a bus is over-engineering for 1:1); a human expects the record updated **instantly**; you want **synchronous confirmation** in-band; minimal infra/cognitive load.

**For A1 (event+callback):** ≥2 consumers (or expected); need failure isolation + guaranteed delivery + buffering for free; keeping the facade generic is a goal; want freshest data / self-healing; you already run the bus.

---

## 7. Decision framework (no single verdict)

**Lean A1 when most hold:** >1 downstream now or within ~12–24mo · facade must stay consumer-agnostic · isolation + guaranteed delivery > instant confirmation · "updated within seconds" is fine · want PII kept off the bus.

**Lean A2 when most hold:** exactly one consumer, low/steady volume · human-in-the-loop needs near-synchronous update · synchronous confirmation materially simplifies error handling · you don't want to own messaging for this flow · downstream→facade callouts are hard.

**Lean hybrid when:** want A1 decoupling but callback is awkward → **fat event** (mind PII) · the facade publishes events at all → add **Outbox** regardless · downstream API quotas/batching are a headache → **iPaaS**.

---

## 8. Key open questions that flip the decision

1. **Consumer count** now and in 12–24mo? (biggest lever)
2. **Latency SLA** — <1s (human waiting) or seconds–minutes fine?
3. **Volume / burst** vs the CRM's daily API budget + concurrency cap?
4. **Data-on-bus policy** — is PII allowed on the broker? (thin vs fat event)
5. **Contract & on-call ownership** — who owns it, who's paged?
6. **Existing events** — does the facade already publish domain events? (if yes, A1 ~free)
7. **Transactional integrity** — is the connect write transactional with the notify? (→ outbox)
8. **Downstream→facade connectivity** — can the CRM reliably call back within its callout limits? (if not → favor fat event / push)

---

> **One-line takeaways**
>
> - It's _async-decoupled-pull vs sync-coupled-push_ **and** _who-knows-whom_ — the second usually decides it for a facade.
> - Direct push from a generic facade to a specific downstream is the smell to watch: O(N) integrations, cascading failure, distributed monolith.
> - Thin-event + callback = freshest data + PII off the bus + self-healing; the cost is a second round-trip and async debugging.
> - Whatever you pick, if the facade emits events, use a **Transactional Outbox**; the dual-write will bite otherwise.
