# Cron Scheduler Race Condition - Visual Explanation

## The Problem (BEFORE)

```
Timeline: Job scheduled for 10:00:00, Timer fires at 10:00:01

┌─────────────────────────────────────────────────────────────┐
│ onTimer() called at 10:00:01                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. ensureLoaded(state)                                      │
│    └─> Returns cached store (doesn't reload from disk)     │
│    └─> Calls recomputeNextRuns() automatically             │
│        └─> Job.nextRunAtMs: 10:00:00 → 10:01:00 ❌         │
│                                                             │
│ 2. runDueJobs(state)                                        │
│    └─> now = 10:00:01                                      │
│    └─> Check: 10:00:01 >= 10:01:00? NO ❌                  │
│    └─> Job skipped!                                        │
│                                                             │
│ 3. persist(state)                                           │
│    └─> Saves nextRunAtMs = 10:01:00 to disk                │
│                                                             │
│ 4. armTimer(state)                                          │
│    └─> Sets timer for 10:01:00                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Next cycle: Timer fires at 10:01:01, same problem repeats!
Result: Job NEVER executes 💥
```

## The Solution (AFTER)

```
Timeline: Job scheduled for 10:00:00, Timer fires at 10:00:01

┌─────────────────────────────────────────────────────────────┐
│ onTimer() called at 10:00:01                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. ensureLoaded(state, {                                    │
│      forceReload: true,     // Force reload from disk       │
│      skipRecompute: true    // Don't advance times yet      │
│    })                                                       │
│    └─> Clears cache and reloads from disk                  │
│    └─> Job.nextRunAtMs: 10:00:00 (original value) ✅        │
│                                                             │
│ 2. runDueJobs(state)                                        │
│    └─> now = 10:00:01                                      │
│    └─> Check: 10:00:01 >= 10:00:00? YES ✅                 │
│    └─> Job EXECUTES! 🎉                                    │
│                                                             │
│ 3. recomputeNextRuns(state)                                 │
│    └─> NOW advance: Job.nextRunAtMs: 10:00:00 → 10:01:00   │
│                                                             │
│ 4. persist(state)                                           │
│    └─> Saves nextRunAtMs = 10:01:00 to disk                │
│                                                             │
│ 5. armTimer(state)                                          │
│    └─> Sets timer for 10:01:00                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Next cycle: Timer fires at 10:01:01, job executes again!
Result: Jobs execute reliably ✅
```

## Key Insight

The critical change is the ORDER of operations:

**BEFORE (broken):**
1. Load → Auto-recompute (advances times)
2. Check if due (always false because times already advanced)
3. Execute (never happens)

**AFTER (fixed):**
1. Load without recompute (preserves original times)
2. Check if due (uses original times)
3. Execute (happens when due)
4. THEN recompute (advances times for next cycle)

## Additional Safeguards

### Watchdog Timer (Self-Healing)

```
Every 60 seconds:
┌────────────────────────────────┐
│ onWatchdog()                   │
├────────────────────────────────┤
│ 1. Check nextWakeAtMs          │
│ 2. If in the past:             │
│    └─> Log warning             │
│    └─> Force armTimer()        │
│ 3. armWatchdogTimer() again    │
└────────────────────────────────┘
```

### Catch-Up Logic (Missed Jobs)

```
On gateway start():
┌────────────────────────────────────────┐
│ For each job:                          │
├────────────────────────────────────────┤
│ 1. Is nextRunAtMs < now?               │
│ 2. Is within 6-hour window?            │
│ 3. Has lastRunAtMs? (ran before)       │
│ 4. If YES to all:                      │
│    └─> Log "catch-up"                  │
│    └─> Execute job immediately         │
└────────────────────────────────────────┘
```

## Files Changed

```
src/cron/service/
├── state.ts        (+2 lines)  → Added watchdogTimer field
├── store.ts        (+17 lines) → Added forceReload/skipRecompute
├── timer.ts        (+55 lines) → Fixed onTimer order, added watchdog
├── ops.ts          (+27 lines) → Added catch-up logic
└── tests/
    └── race-condition-fix.test.ts  (+286 lines) → New test suite
```

## Backward Compatibility

✅ All existing code continues to work:
- `ensureLoaded()` without parameters → same as before
- `ensureLoaded(state)` → same as before
- Only `onTimer` uses new parameters

No breaking changes! 🎉
