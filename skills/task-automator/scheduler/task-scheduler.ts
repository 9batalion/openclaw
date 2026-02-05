import type {
  ScheduleEntry,
  SchedulerOptions,
  Task,
  TaskExecution,
} from "../types.ts";

// In-memory schedule storage
const schedules = new Map<string, ScheduleEntry>();
const activeIntervals = new Map<string, NodeJS.Timeout>();

let schedulerOptions: SchedulerOptions = {
  timezone: "UTC",
  maxConcurrent: 10,
  gracePeriod: 60000, // 1 minute
};

/**
 * Configures the scheduler
 */
export function configureScheduler(options: SchedulerOptions): void {
  schedulerOptions = { ...schedulerOptions, ...options };
}

/**
 * Schedules a task for execution
 */
export async function scheduleTask(task: Task): Promise<void> {
  if (!task.schedule) {
    throw new Error("Task must have a schedule");
  }

  const nextRun = calculateNextRun(task.schedule);

  const entry: ScheduleEntry = {
    id: `schedule-${task.id}`,
    taskId: task.id,
    schedule: task.schedule,
    nextRun,
    enabled: task.enabled !== false,
  };

  schedules.set(entry.id, entry);

  if (entry.enabled) {
    startSchedule(entry);
  }
}

/**
 * Unschedules a task
 */
export async function unscheduleTask(taskId: string): Promise<boolean> {
  const scheduleId = `schedule-${taskId}`;
  const entry = schedules.get(scheduleId);

  if (!entry) {
    return false;
  }

  stopSchedule(scheduleId);
  return schedules.delete(scheduleId);
}

/**
 * Gets all scheduled tasks
 */
export function getScheduledTasks(): ScheduleEntry[] {
  return Array.from(schedules.values());
}

/**
 * Gets a specific schedule entry
 */
export function getSchedule(taskId: string): ScheduleEntry | undefined {
  const scheduleId = `schedule-${taskId}`;
  return schedules.get(scheduleId);
}

/**
 * Enables a schedule
 */
export async function enableSchedule(taskId: string): Promise<void> {
  const scheduleId = `schedule-${taskId}`;
  const entry = schedules.get(scheduleId);

  if (!entry) {
    throw new Error(`Schedule not found for task: ${taskId}`);
  }

  entry.enabled = true;
  startSchedule(entry);
}

/**
 * Disables a schedule
 */
export async function disableSchedule(taskId: string): Promise<void> {
  const scheduleId = `schedule-${taskId}`;
  const entry = schedules.get(scheduleId);

  if (!entry) {
    throw new Error(`Schedule not found for task: ${taskId}`);
  }

  entry.enabled = false;
  stopSchedule(scheduleId);
}

/**
 * Starts a schedule
 */
function startSchedule(entry: ScheduleEntry): void {
  if (activeIntervals.has(entry.id)) {
    return; // Already running
  }

  const delay = calculateDelay(entry.nextRun);

  const timeout = setTimeout(() => {
    executeScheduledTask(entry);
  }, delay);

  activeIntervals.set(entry.id, timeout);
}

/**
 * Stops a schedule
 */
function stopSchedule(scheduleId: string): void {
  const timeout = activeIntervals.get(scheduleId);
  if (timeout) {
    clearTimeout(timeout);
    activeIntervals.delete(scheduleId);
  }
}

/**
 * Executes a scheduled task
 */
async function executeScheduledTask(entry: ScheduleEntry): Promise<void> {
  // Update last run
  entry.lastRun = new Date().toISOString();

  // Calculate next run
  entry.nextRun = calculateNextRun(entry.schedule);

  // Schedule next execution
  if (entry.enabled) {
    startSchedule(entry);
  }

  // Trigger task execution (this would integrate with task executor)
  // For now, this is a placeholder
  console.log(`Executing scheduled task: ${entry.taskId}`);
}

/**
 * Calculates the next run time from a cron expression
 */
function calculateNextRun(schedule: string): string {
  // Parse cron expression and calculate next run
  // This is a simplified implementation

  if (isIntervalSchedule(schedule)) {
    return calculateIntervalNextRun(schedule);
  }

  // For cron expressions, calculate next occurrence
  const now = new Date();
  const next = new Date(now.getTime() + 60000); // Simplified: add 1 minute

  return next.toISOString();
}

/**
 * Checks if schedule is an interval (e.g., "5m", "1h")
 */
function isIntervalSchedule(schedule: string): boolean {
  return /^\d+[smhd]$/.test(schedule);
}

/**
 * Calculates next run for interval schedules
 */
function calculateIntervalNextRun(schedule: string): string {
  const match = schedule.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid interval schedule: ${schedule}`);
  }

  const amount = Number.parseInt(match[1]);
  const unit = match[2];

  const now = new Date();
  let next = new Date(now);

  switch (unit) {
    case "s":
      next = new Date(now.getTime() + amount * 1000);
      break;
    case "m":
      next = new Date(now.getTime() + amount * 60 * 1000);
      break;
    case "h":
      next = new Date(now.getTime() + amount * 60 * 60 * 1000);
      break;
    case "d":
      next = new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
      break;
  }

  return next.toISOString();
}

/**
 * Calculates delay in milliseconds until next run
 */
function calculateDelay(nextRun: string): number {
  const now = Date.now();
  const target = new Date(nextRun).getTime();
  return Math.max(0, target - now);
}

/**
 * Validates a cron expression
 */
export function validateCronExpression(expression: string): boolean {
  // Simplified validation
  if (isIntervalSchedule(expression)) {
    return true;
  }

  // Cron format: minute hour day month dayOfWeek
  const parts = expression.split(" ");
  return parts.length === 5;
}

/**
 * Parses a cron expression into human-readable format
 */
export function parseCronExpression(expression: string): string {
  if (isIntervalSchedule(expression)) {
    const match = expression.match(/^(\d+)([smhd])$/);
    if (!match) {
      return "Invalid interval";
    }

    const amount = match[1];
    const unit =
      match[2] === "s"
        ? "second(s)"
        : match[2] === "m"
          ? "minute(s)"
          : match[2] === "h"
            ? "hour(s)"
            : "day(s)";

    return `Every ${amount} ${unit}`;
  }

  // Simplified cron parsing
  const parts = expression.split(" ");
  if (parts.length !== 5) {
    return "Invalid cron expression";
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  if (minute === "*" && hour === "*" && day === "*" && month === "*" && dayOfWeek === "*") {
    return "Every minute";
  }

  if (minute === "0" && hour === "0" && day === "*" && month === "*" && dayOfWeek === "*") {
    return "Daily at midnight";
  }

  return "Custom schedule";
}

/**
 * Gets upcoming scheduled executions
 */
export function getUpcomingExecutions(
  limit = 10,
): Array<{ taskId: string; nextRun: string }> {
  const entries = Array.from(schedules.values())
    .filter((e) => e.enabled)
    .sort((a, b) => a.nextRun.localeCompare(b.nextRun))
    .slice(0, limit);

  return entries.map((e) => ({
    taskId: e.taskId,
    nextRun: e.nextRun,
  }));
}

/**
 * Cleans up all schedules (for shutdown)
 */
export function cleanupScheduler(): void {
  for (const scheduleId of activeIntervals.keys()) {
    stopSchedule(scheduleId);
  }
  schedules.clear();
}
