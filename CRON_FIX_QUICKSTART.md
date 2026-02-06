# Quick Start Guide - Cron Scheduler Fix

## What Was Fixed

The cron scheduler had a critical race condition that prevented recurring jobs from executing. This has now been fixed.

## What Changed

### For Users

- **Recurring jobs now work**: Jobs with `schedule.kind: "cron"` or `schedule.kind: "every"` will now execute on schedule
- **Missed jobs catch up**: If the gateway was down during a scheduled time, jobs missed within the last 6 hours will run on restart
- **Self-healing**: A watchdog timer monitors the scheduler and fixes it if it gets stuck

### For Developers

The fix is fully backward-compatible. All existing code continues to work without changes.

**Key API Changes:**
```typescript
// The ensureLoaded function now accepts optional parameters
await ensureLoaded(state, {
  forceReload: true,    // Force reload from disk (default: false)
  skipRecompute: true   // Skip automatic recomputation (default: false)
});

// Without parameters, behavior is unchanged
await ensureLoaded(state); // Works exactly as before
```

**State Changes:**
```typescript
// CronServiceState now includes a watchdog timer
type CronServiceState = {
  // ... existing fields
  watchdogTimer: NodeJS.Timeout | null; // New field
};
```

## Testing

To test the fix, run:
```bash
pnpm test src/cron/service.race-condition-fix.test.ts
```

Or run all cron tests:
```bash
pnpm test src/cron
```

## Verifying the Fix

### Before the Fix
- Recurring cron/every jobs would never execute
- Jobs would advance their `nextRunAtMs` but never run
- No catch-up for missed jobs after restart

### After the Fix
- Recurring jobs execute on schedule
- Jobs run at their scheduled times reliably
- Missed jobs catch up on restart (within 6-hour window)
- Watchdog self-heals if timer gets stuck

## Monitoring

Look for these log messages to verify the fix is working:

**Normal operation:**
```
cron: started (with catchUpJobs count)
cron: running due jobs (debug level)
```

**Catch-up on restart:**
```
cron: catch-up — running missed job
```

**Watchdog self-healing:**
```
cron: watchdog self-heal — main timer missed its wake time
```

## Rolling Back

If you need to roll back this change, all modifications are in these files:
- `src/cron/service/state.ts`
- `src/cron/service/store.ts`
- `src/cron/service/timer.ts`
- `src/cron/service/ops.ts`

The changes are minimal and surgical, making rollback straightforward if needed.

## Questions?

See the detailed documentation:
- `CRON_FIX_SUMMARY.md` - Technical details and root cause analysis
- `CRON_FIX_VISUAL.md` - Visual timeline diagrams

## Related Issues

This fix resolves:
- #10573 - Recurring cron jobs not executing
- #10574 - Every jobs skip execution
- #10584 - Jobs advance but never run
- #10598 - Scheduler stuck after restart
- #10610 - Missed jobs not caught up
- #10564 - Timer race condition
- #10596 - Cron jobs never fire

## Next Steps

1. Review and merge this PR
2. Test in a staging environment
3. Monitor logs for catch-up and watchdog messages
4. Deploy to production
5. Verify recurring jobs are executing

## Performance Impact

Minimal:
- Watchdog timer runs every 60 seconds (unref'd, won't keep process alive)
- Catch-up logic only runs on startup
- Force reload on timer tick adds negligible overhead
- No impact on job execution performance

## Security Impact

None - this is a bug fix with no security implications.
