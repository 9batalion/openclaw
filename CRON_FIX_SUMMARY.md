# Cron Scheduler Race Condition Fix - Summary

## Problem Statement

The cron scheduler had critical bugs causing recurring jobs (`schedule.kind: "cron"` and `schedule.kind: "every"`) to **never execute**, and one-shot missed jobs to be silently skipped after gateway restarts.

### Root Causes Identified

1. **Race condition in `onTimer`**: The timer callback would call `recomputeNextRuns()` BEFORE `runDueJobs()`, which meant the `nextRunAtMs` was already pushed to the future when checking if jobs were due, causing all checks to fail.

2. **No force-reload support**: The `ensureLoaded()` function had no way to force-reload from disk, so `onTimer` would always use stale in-memory state.

3. **No catch-up logic**: When the gateway was down during a scheduled time, on restart the missed run was silently dropped.

4. **Stale `nextWakeAtMs`**: After restart, the timer could get stuck if `nextWakeAtMs` was in the past.

## Solution Implemented

### 1. Fixed `ensureLoaded` in `src/cron/service/store.ts`

Added optional parameters:
- `forceReload: boolean` - Clears cached store and reloads from disk
- `skipRecompute: boolean` - Skips automatic call to `recomputeNextRuns()` after loading

This allows callers to control when recomputation happens.

### 2. Fixed `onTimer` execution order in `src/cron/service/timer.ts`

Changed the timer callback to follow the correct sequence:

```typescript
// OLD (broken) order:
await ensureLoaded(state);           // Uses cache, doesn't reload
await runDueJobs(state);             // Never finds due jobs
await persist(state);
armTimer(state);

// NEW (fixed) order:
await ensureLoaded(state, { forceReload: true, skipRecompute: true });
                                     // Force reload, skip recompute
await runDueJobs(state);             // Check against original persisted values
recomputeNextRuns(state);            // NOW advance to next cycle
await persist(state);
armTimer(state);
```

### 3. Added catch-up logic in `start()` in `src/cron/service/ops.ts`

After loading the store on startup:
- Checks for jobs where `nextRunAtMs` is in the past
- Only catches up if the job has `lastRunAtMs` (has run before) and is within 6-hour window
- Runs missed jobs immediately with warning log
- Logs the count of caught-up jobs in startup message

### 4. Added watchdog timer in `src/cron/service/timer.ts`

Self-healing mechanism:
- Runs every 60 seconds independently of the main timer
- Checks if `nextWakeAtMs` is in the past
- If stuck, forces a re-arm of the main timer
- Logs warnings when self-healing occurs

### 5. Updated state structure in `src/cron/service/state.ts`

Added `watchdogTimer: NodeJS.Timeout | null` field to track the watchdog timer.

## Files Modified

1. `src/cron/service/state.ts` - Added watchdogTimer field
2. `src/cron/service/store.ts` - Added forceReload and skipRecompute options
3. `src/cron/service/timer.ts` - Fixed onTimer, added watchdog, improved logging
4. `src/cron/service/ops.ts` - Added catch-up logic in start()
5. `src/cron/service.race-condition-fix.test.ts` - New comprehensive test suite

## Tests Added

Created `src/cron/service.race-condition-fix.test.ts` with:
- Test for recurring cron jobs executing on schedule
- Test for recurring every jobs executing on schedule  
- Test for catch-up of missed jobs within 6-hour window
- Test that old missed jobs outside window are skipped

## Backward Compatibility

All changes are backward-compatible:
- The `ensureLoaded()` options are optional (defaults maintain old behavior)
- All existing calls to `ensureLoaded()` continue to work unchanged
- Only `onTimer()` uses the new parameters
- Watchdog timer is transparent to existing code
- Catch-up logic only runs on startup and doesn't affect normal operation

## Expected Behavior After Fix

1. **Recurring jobs will execute on schedule**: Jobs with `cron` or `every` schedules will now run at their scheduled times
2. **Missed jobs will catch up**: If the gateway was down, jobs missed within the last 6 hours will run on startup
3. **Self-healing**: If the timer gets stuck due to edge cases, the watchdog will detect and fix it
4. **Better observability**: Debug logs show when jobs are due, when catch-up runs, and when watchdog heals

## Testing Strategy

Since dependencies are not installed in the current environment, the tests cannot be run yet. However, the test suite is comprehensive and follows existing patterns:
- Uses vitest with fake timers
- Creates temporary store paths for isolation
- Tests both successful execution and edge cases
- Validates state changes after each action

The tests can be run with:
```bash
pnpm test src/cron/service.race-condition-fix.test.ts
```

## Related Issues

This fix addresses the following community issues:
- #10573, #10574, #10584, #10598, #10610, #10564, #10596
