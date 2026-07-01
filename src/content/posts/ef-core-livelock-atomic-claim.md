---
title: "The EF Core Livelock That Looks Like a Hang: Stale ChangeTracker State and the Atomic-Claim Fix"
description: "A scheduled worker claiming payment rows under optimistic concurrency started livelocking at 2+ instances — not crashing, just never finishing. This traces the two-layer root cause and compares the minimal ChangeTracker.Clear() patch against removing the race entirely with an atomic UPDATE."
pubDatetime: 2026-07-01T00:15:00Z
lang: en
tags:
  - ef-core
  - dotnet
  - concurrency
  - distributed-systems
  - sql-server
multiLangKey: "ef-core-livelock"
---

## TL;DR

1. **Root cause has two layers.** Surface layer: a failed `SaveChangesAsync()` (rowversion conflict) leaves the entity `Modified` in the `DbContext`'s change-tracker — EF does **not** reset entity state on a thrown exception. Structural layer: the worker reuses **one scoped `DbContext` across an unbounded drain loop**, so that one poisoned entity re-flushes and fails on _every subsequent_ `SaveChanges` in the same context — including calls unrelated to the original row. If the failure also gates the loop's exit condition, the loop **never terminates**: a livelock, not a crash, which is why a service restart "fixes" it (a fresh `DbContext` has no poisoned state).
2. **The minimal fix is `_context.ChangeTracker.Clear()` in the failure catch block(s).** Combined with `AsNoTracking()` on the read side, this is a small, low-risk patch. It treats the symptom (stale tracked state) correctly, but does not remove the underlying race.
3. **Common review misconception:** _"You added `AsNoTracking()` on the read, isn't `Clear()` redundant?"_ — No. They protect two _different_ queries. `AsNoTracking()` stops the **read** from seeding a tracked entity. But the entity that actually poisons the context is the one the **write/claim method** loads and mutates internally — that query is still tracking, because tracking is required to detect the concurrency conflict in the first place. Removing `Clear()` and keeping only `AsNoTracking()` brings the livelock straight back.
4. **The structurally better fix removes the race entirely: claim the row with one atomic conditional `UPDATE`** instead of `SELECT` (track) → mutate → `SaveChanges`. No entity is ever loaded or tracked for the write; the DB tells you win/loss via **rows-affected**, not an exception. No exception ⇒ nothing to leave stale ⇒ the livelock is architecturally impossible, not just patched over.
5. **SQL Server has no `FOR UPDATE`/`SKIP LOCKED` syntax** (that's Postgres). The equivalent is table hints: `WITH (UPDLOCK, READPAST, ROWLOCK)`. On EF Core 7+, the ORM-level equivalent of a bare atomic claim is `ExecuteUpdateAsync()` — no tracking, no `SaveChanges`, returns an `int` row count. On EF Core 6 and earlier, you write the conditional `UPDATE` as raw SQL.

---

> **The concrete trigger:** a scheduled payment-batch worker (drains a queue of "due" payments and locks each one before handing it off for processing) started livelocking in production whenever it scaled to 2+ instances. The pattern generalizes to any EF Core worker that (a) reuses one long-lived `DbContext` across a drain loop, and (b) claims work items with a read-then-conditionally-update pattern under optimistic concurrency (a rowversion/timestamp column).

## 1. The setup

A worker ticks on a schedule. Each tick opens one DI scope → one `DbContext`, then drains a queue in a `do…while` loop until nothing is left to claim:

```
tick → open ONE DbContext scope
  do {
    row = Pick()          // find one queued, unclaimed item
    if (row == null) { isLast = true; break }
    lockKey = Claim(row)  // mark it claimed, so other instances skip it
    if (lockKey == null) continue   // someone else claimed it first — try again
    Process(row)
  } while (!isLast)
```

`Claim()` uses **optimistic concurrency**: the row has a `rowversion`/`timestamp` column, and the claim is a normal EF `Update()` + `SaveChanges()` — the generated SQL includes `WHERE Id = @id AND Timestamp = @originalTimestamp`. If two instances race for the same row, whichever saves second gets **0 rows affected**, which EF surfaces as `DbUpdateConcurrencyException`.

## 2. The failure chain

1. Instance B's `Claim()` internally runs a **tracking** query (`_context.Rows.Where(...).ToListAsync()`), mutates the entity, calls `SaveChangesAsync()`.
2. Instance A wins the race first; the row's timestamp bumps in the DB.
3. Instance B's `SaveChanges` issues `UPDATE ... WHERE Id=@id AND Timestamp=@stale` → **0 rows** → `DbUpdateConcurrencyException` thrown.
4. **The catch block returns `null` without clearing the tracker.** The entity stays in the context as `Modified`, holding the _stale_ timestamp.
5. The loop continues (`Pick()` finds a different unclaimed row). `Claim()` runs again — but now `SaveChangesAsync()` re-flushes **both** the new row _and_ the stale poisoned entity from step 4, in one transaction. The poisoned entity's `UPDATE` still fails its `WHERE` clause → the **entire transaction rolls back**, including the otherwise-valid new claim.
6. Because the claim never commits, the DB-side "claimed" marker stays unset, so `Pick()` keeps re-returning the same unclaimed rows forever. The exit condition (`Pick()` returns nothing) is never reached ⇒ the loop, and the `DbContext` holding it, never end.

The killer step is **5→6**: one failed claim doesn't just fail once — it silently sabotages _every later claim_ in the same context, which in turn guarantees the loop can never drain to empty.

## 3. Fix 1 (minimal): clear the tracker

Add `_context.ChangeTracker.Clear()` to every catch block that can leave a rolled-back `SaveChanges` behind, and mark the read-side pick query `AsNoTracking()` for defense in depth:

```csharp
public Task<Row?> Pick(...) =>
    _context.Rows.AsNoTracking()          // read-only; nothing here should ever be tracked
        .Where(r => r.Status == "Queued" && (r.LockKey == null || r.LockExpiry < DateTime.UtcNow))
        .FirstOrDefaultAsync();

public async Task<string?> Claim(int id, int ttlMinutes)
{
    var row = await _context.Rows.FirstOrDefaultAsync(r => r.Id == id);   // tracking — required to detect conflict
    var key = Guid.NewGuid().ToString();
    row.LockKey = key;
    row.LockExpiry = DateTime.UtcNow.AddMinutes(ttlMinutes);
    try
    {
        await _context.SaveChangesAsync();
        return key;
    }
    catch (DbUpdateConcurrencyException)
    {
        _context.ChangeTracker.Clear();   // <-- the actual fix: evict the stale entity
        return null;
    }
}
```

**Why the two are not redundant** — this is the exact point that trips up code review. Trace which query produces which tracked entity:

| Change                  | Which query                    | What it protects                                      |
| ----------------------- | ------------------------------ | ----------------------------------------------------- |
| `AsNoTracking()`        | the **read/pick**              | stops the _read_ from ever seeding a tracked entity   |
| `ChangeTracker.Clear()` | catch block in **claim/write** | evicts the entity the **claim method itself** tracked |

`Claim()`'s internal load (`_context.Rows.FirstOrDefaultAsync(...)`) is a plain tracking query — it _has to be_, because EF can only detect the rowversion mismatch on an entity it is tracking. So the poisoned entity always originates from the write path, never the read path. Remove `Clear()` and keep only `AsNoTracking()` on the pick, and the livelock **returns unchanged** — the pick was never the source of the leak.

This fix is correct and low-risk, but it's reactive: it depends on every catch block remembering to call `Clear()`. A new catch path added later without it reintroduces the bug.

## 4. Fix 2 (structural): atomic conditional UPDATE

The deeper issue is a **read-then-conditionally-write** pattern racing across two network round-trips. Collapse it into **one atomic statement**: check the "still available" condition and write the claim in the same `UPDATE`. The database guarantees atomicity; there is no window for another instance to interleave.

```sql
UPDATE TOP(1) Rows
SET    LockKey = @key, LockExpiry = @ttl
OUTPUT inserted.Id, inserted.RelatedId
WHERE  Status = 'Queued'
   AND (LockKey IS NULL OR LockExpiry < SYSUTCDATETIME())
```

Read the result: `rows affected == 1` → you won the claim, use the `OUTPUT` row. `rows affected == 0` → someone else already claimed it (or nothing is left); no exception, just try again. **No entity is loaded, no rowversion is compared, nothing is ever tracked for the write** — so there is nothing that can survive a failed attempt and poison later calls. The livelock class of bug is removed, not mitigated.

This is a bigger diff than Fix 1 (touches the SQL/repository shape, not just a catch block), but it is the textbook pattern for **claiming work items under concurrent consumers** — the same idea SQL queueing patterns and message brokers use internally.

## 5. SQL Server vs Postgres row-locking syntax

It's tempting to reach for `SELECT ... FOR UPDATE` (Postgres) — but that's a different mechanism than the atomic claim above, and SQL Server spells it differently:

| Postgres      | SQL Server                | Meaning                                                          |
| ------------- | ------------------------- | ---------------------------------------------------------------- |
| `FOR UPDATE`  | `WITH (UPDLOCK, ROWLOCK)` | lock the selected row for update, block other claimants          |
| `SKIP LOCKED` | `WITH (READPAST)`         | don't wait on a locked row — skip it and take the next candidate |

```sql
-- SQL Server queue-pick pattern equivalent to `FOR UPDATE SKIP LOCKED`
BEGIN TRAN;
SELECT TOP(1) *
FROM Rows WITH (UPDLOCK, READPAST, ROWLOCK)
WHERE Status = 'Queued' AND (LockKey IS NULL OR LockExpiry < SYSUTCDATETIME())
ORDER BY Id;
-- ... process ...
UPDATE Rows SET ... WHERE Id = @id;
COMMIT;
```

**But this mechanism doesn't fit the payment-worker scenario**, and that's worth understanding, not just the syntax mapping. `FOR UPDATE`/`UPDLOCK` only holds the row lock **for the duration of one DB transaction**. In this worker, after claiming a row the work is handed off to asynchronous downstream processing (a message bus, an external call) that can outlive a single transaction by a wide margin — sometimes minutes, across process boundaries. You cannot hold a DB transaction open that long.

That's why the system uses an **application-level lease** instead: a `LockKey` + `LockExpiry` column pair stored directly in the row. It's a soft lock that self-expires via TTL if the claiming instance dies mid-flight — the correct design for long-running/distributed work, and _not_ the bug. The bug was **how the lease gets written** (racy read-then-write). The atomic `UPDATE` (Fix 2) keeps the lease design exactly as-is; it only makes the _write_ atomic. If you also want to remove the race in the read/pick step itself, fold pick + claim into one statement: `UPDATE TOP(1) ... OUTPUT inserted.* WHERE ...` — pick and claim in a single round-trip, no separate `SELECT` at all.

## 6. EF Core 7+: `ExecuteUpdateAsync`

EF Core 6 (a common LTS pin) has no ORM-level equivalent of the atomic claim — Fix 2 must be raw SQL. EF Core 7 introduced bulk `ExecuteUpdateAsync`/`ExecuteDeleteAsync`, which is the typed, LINQ-expressed version of exactly the same idea:

```csharp
// EF 7+ — replaces load + mutate + SaveChanges + catch(DbUpdateConcurrencyException) entirely
var claimed = await _context.Rows
    .Where(r => r.Id == id && (r.LockKey == null || r.LockExpiry < DateTime.UtcNow))
    .ExecuteUpdateAsync(s => s
        .SetProperty(r => r.LockKey, key)
        .SetProperty(r => r.LockExpiry, ttl));

return claimed == 1 ? key : null;
```

Key properties:

- Translates to a single `UPDATE ... WHERE ...` sent directly to the database.
- **No entity is loaded, no change-tracker involvement, no `SaveChangesAsync()` call.**
- Returns the row count as an `int` — win/loss is a plain comparison, never an exception.
- Because nothing is tracked, there is structurally nothing that can leak into a later call in the same `DbContext`. `ChangeTracker.Clear()` becomes unnecessary, not just unneeded-today.

Caveats: it doesn't return the updated row's other columns (no `OUTPUT`-equivalent) — if you need the claimed row's data back, either re-`SELECT` after a successful claim (safe now, since you own the row) or drop to raw SQL with `OUTPUT`. It also bypasses any entities currently tracked for that row in the same context — by design, since this pattern deliberately avoids tracking for the write path. There's no `TOP(n)` — for "claim one of many" queue semantics, raw SQL with `UPDATE TOP(1) ... OUTPUT` is still the tool.

## 7. Comparing the options

| Approach                                            | Removes the race?                     | Needs `Clear()`?             | Win/loss signal              | Diff size                    |
| --------------------------------------------------- | ------------------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| Current (SELECT+track, catch exception)             | ❌                                    | ✅ must remember every catch | thrown exception             | —                            |
| + `ChangeTracker.Clear()` (Fix 1)                   | ❌ (still races)                      | — (this _is_ the fix)        | thrown exception             | small                        |
| + fresh `DbContext`/scope per loop iteration        | partially (contains the blast radius) | ❌                           | thrown exception             | medium                       |
| Atomic raw-SQL `UPDATE` (Fix 2, EF6-compatible)     | ✅                                    | ❌                           | rows-affected count          | medium                       |
| EF7+ `ExecuteUpdateAsync`                           | ✅                                    | ❌                           | rows-affected count          | medium, typed                |
| SQL Server `UPDLOCK, READPAST` pick+claim in one tx | ✅                                    | ❌                           | rows-affected / empty result | medium, needs short-lived tx |

Ranking, "safer patch" → "fixes the class of bug": **Fix 1 alone < Fix 1 + loop-iteration cap (safety net) < fresh scope per iteration < atomic UPDATE (raw SQL or `ExecuteUpdateAsync`)**. For a production hotfix under time pressure, Fix 1 is defensible — it _does_ work. For a durable fix that removes the bug class so it can't resurface via a new code path, the atomic claim is the correct target.

## 8. One-line takeaways

> A thrown exception mid-`SaveChanges` doesn't roll back the _change-tracker_ — only the DB transaction. If you reuse a `DbContext` across a loop, that stale tracked state is a time bomb for every later `SaveChanges` in the same scope.

> "We added `AsNoTracking()` on the read" does not make `ChangeTracker.Clear()` on the write's catch block redundant — trace which query the poisoned entity actually came from.

> When two consumers race to claim the same row, prefer "let the DB tell you win/loss via an atomic conditional `UPDATE`" over "detect the loss via a caught exception after a tracking read." The former structurally cannot leave residue; the latter always can.
