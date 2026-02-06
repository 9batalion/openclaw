import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("CronService race condition fix", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recurring cron job executes on schedule without race condition", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron.start();
    
    // Create a job that runs every minute
    const job = await cron.add({
      name: "recurring test",
      enabled: true,
      schedule: { kind: "cron", expr: "* * * * *" }, // Every minute
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "tick" },
    });

    expect(job.state.nextRunAtMs).toBeDefined();
    const firstRunAt = job.state.nextRunAtMs!;

    // Advance to first scheduled time
    vi.setSystemTime(new Date(firstRunAt));
    await vi.runOnlyPendingTimersAsync();

    // Job should have executed
    expect(enqueueSystemEvent).toHaveBeenCalledWith("tick", {
      agentId: undefined,
    });

    // Check that the job is still enabled and scheduled for the next run
    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((j) => j.id === job.id);
    expect(updated?.enabled).toBe(true);
    expect(updated?.state.lastRunAtMs).toBe(firstRunAt);
    expect(updated?.state.nextRunAtMs).toBeGreaterThan(firstRunAt);

    // Advance to second scheduled time
    const secondRunAt = updated!.state.nextRunAtMs!;
    vi.setSystemTime(new Date(secondRunAt));
    await vi.runOnlyPendingTimersAsync();

    // Job should have executed again
    expect(enqueueSystemEvent).toHaveBeenCalledTimes(2);

    const jobsAfterSecond = await cron.list({ includeDisabled: true });
    const updatedAgain = jobsAfterSecond.find((j) => j.id === job.id);
    expect(updatedAgain?.state.lastRunAtMs).toBe(secondRunAt);
    expect(updatedAgain?.state.nextRunAtMs).toBeGreaterThan(secondRunAt);

    cron.stop();
    await store.cleanup();
  });

  it("recurring every job executes on schedule without race condition", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron.start();
    
    // Create a job that runs every 5 seconds
    const job = await cron.add({
      name: "recurring every test",
      enabled: true,
      schedule: { kind: "every", everyMs: 5000 }, // Every 5 seconds
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "tick" },
    });

    expect(job.state.nextRunAtMs).toBeDefined();
    const firstRunAt = job.state.nextRunAtMs!;

    // Advance to first scheduled time
    vi.setSystemTime(new Date(firstRunAt));
    await vi.runOnlyPendingTimersAsync();

    // Job should have executed
    expect(enqueueSystemEvent).toHaveBeenCalledWith("tick", {
      agentId: undefined,
    });

    // Check that the job is still enabled and scheduled for the next run
    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((j) => j.id === job.id);
    expect(updated?.enabled).toBe(true);
    expect(updated?.state.lastRunAtMs).toBe(firstRunAt);
    expect(updated?.state.nextRunAtMs).toBe(firstRunAt + 5000);

    // Advance to second scheduled time
    const secondRunAt = updated!.state.nextRunAtMs!;
    vi.setSystemTime(new Date(secondRunAt));
    await vi.runOnlyPendingTimersAsync();

    // Job should have executed again
    expect(enqueueSystemEvent).toHaveBeenCalledTimes(2);

    const jobsAfterSecond = await cron.list({ includeDisabled: true });
    const updatedAgain = jobsAfterSecond.find((j) => j.id === job.id);
    expect(updatedAgain?.state.lastRunAtMs).toBe(secondRunAt);
    expect(updatedAgain?.state.nextRunAtMs).toBe(secondRunAt + 5000);

    cron.stop();
    await store.cleanup();
  });

  it("catches up missed jobs after restart within 6-hour window", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    // Create initial service and add a job
    const cron1 = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron1.start();
    const job = await cron1.add({
      name: "missed job test",
      enabled: true,
      schedule: { kind: "every", everyMs: 60_000 }, // Every minute
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "missed" },
    });

    // Run once to establish lastRunAtMs
    const firstRunAt = job.state.nextRunAtMs!;
    vi.setSystemTime(new Date(firstRunAt));
    await vi.runOnlyPendingTimersAsync();

    expect(enqueueSystemEvent).toHaveBeenCalledTimes(1);
    cron1.stop();

    // Simulate gateway restart 5 minutes later (within 6-hour window)
    vi.setSystemTime(new Date(firstRunAt + 5 * 60_000));
    enqueueSystemEvent.mockClear();

    const cron2 = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron2.start();

    // Should have caught up and run the missed job
    expect(enqueueSystemEvent).toHaveBeenCalledWith("missed", {
      agentId: undefined,
    });
    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        name: "missed job test",
      }),
      "cron: catch-up — running missed job",
    );

    cron2.stop();
    await store.cleanup();
  });

  it("does not catch up missed jobs outside 6-hour window", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    // Create initial service and add a job
    const cron1 = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron1.start();
    const job = await cron1.add({
      name: "old missed job test",
      enabled: true,
      schedule: { kind: "every", everyMs: 60_000 }, // Every minute
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "old missed" },
    });

    // Run once to establish lastRunAtMs
    const firstRunAt = job.state.nextRunAtMs!;
    vi.setSystemTime(new Date(firstRunAt));
    await vi.runOnlyPendingTimersAsync();

    expect(enqueueSystemEvent).toHaveBeenCalledTimes(1);
    cron1.stop();

    // Simulate gateway restart 7 hours later (outside 6-hour window)
    vi.setSystemTime(new Date(firstRunAt + 7 * 60 * 60_000));
    enqueueSystemEvent.mockClear();

    const cron2 = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron2.start();

    // Should NOT have caught up because it's too old
    expect(enqueueSystemEvent).not.toHaveBeenCalled();
    expect(noopLogger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
      }),
      expect.stringContaining("catch-up"),
    );

    cron2.stop();
    await store.cleanup();
  });
});
