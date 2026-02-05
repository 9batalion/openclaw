import type {
  ExecutionOptions,
  ExecutionResult,
  Task,
  TaskExecution,
  TaskHistory,
  TaskHistoryQuery,
  TaskStatistics,
  TaskStatusInfo,
  Trigger,
  Workflow,
  WorkflowExecution,
  WorkflowProgress,
} from "./types.ts";

import {
  scheduleTask,
  unscheduleTask,
  getScheduledTasks,
  getSchedule,
  enableSchedule,
  disableSchedule,
  validateCronExpression,
  parseCronExpression,
  getUpcomingExecutions,
  cleanupScheduler,
} from "./scheduler/task-scheduler.ts";

import {
  createTrigger,
  deleteTrigger,
  getTrigger,
  getAllTriggers,
  getTaskTriggers,
  enableTrigger,
  disableTrigger,
  fireEvent,
  handleWebhook,
  checkConditionalTriggers,
  getTriggerStatistics,
  listEvents,
  validateTrigger,
  clearAllTriggers,
} from "./triggers/trigger-manager.ts";

import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  getAllWorkflows,
  executeWorkflow,
  getWorkflowExecution,
  getWorkflowExecutions,
  getWorkflowProgress,
  cancelWorkflowExecution,
  validateWorkflow,
  getWorkflowStatistics,
  clearAllWorkflows,
} from "./workflows/workflow-engine.ts";

const VERSION = "1.0.0";

// In-memory task storage
const tasks = new Map<string, Task>();
const taskExecutions = new Map<string, TaskExecution[]>();

/**
 * Defines a new task
 */
export function defineTask(task: Task): Task {
  tasks.set(task.id, task);
  return task;
}

/**
 * Gets a task by ID
 */
export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId);
}

/**
 * Gets all defined tasks
 */
export function getAllTasks(): Task[] {
  return Array.from(tasks.values());
}

/**
 * Deletes a task
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  // Clean up associated schedules and triggers
  await unscheduleTask(taskId);

  const triggers = getTaskTriggers(taskId);
  for (const trigger of triggers) {
    await deleteTrigger(trigger.id);
  }

  return tasks.delete(taskId);
}

/**
 * Executes a task manually
 */
export async function executeTask(
  taskId: string,
  options: ExecutionOptions = {},
): Promise<ExecutionResult> {
  const task = tasks.get(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  if (task.enabled === false) {
    throw new Error(`Task is disabled: ${taskId}`);
  }

  const executionId = `exec-${taskId}-${Date.now()}`;
  const startTime = new Date();

  try {
    // Check condition if defined
    if (task.condition) {
      const context = { taskId, executionId, input: options.input };
      const shouldExecute = await task.condition(context);
      if (!shouldExecute) {
        return {
          executionId,
          success: true,
          result: { skipped: true, reason: "Condition not met" },
          duration: 0,
        };
      }
    }

    // Execute task action
    const context = { taskId, executionId, input: options.input };
    const result = await task.action(context);

    // Record successful execution
    const execution: TaskExecution = {
      success: true,
      taskId,
      executionId,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime.getTime(),
      result,
      retries: 0,
    };

    recordExecution(taskId, execution);

    // Call success hook
    if (task.onSuccess) {
      await task.onSuccess(result);
    }

    return {
      executionId,
      success: true,
      result,
      duration: execution.duration,
    };
  } catch (error) {
    // Record failed execution
    const execution: TaskExecution = {
      success: false,
      taskId,
      executionId,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime.getTime(),
      result: null,
      error: error instanceof Error ? error.message : "Unknown error",
      retries: 0,
    };

    recordExecution(taskId, execution);

    // Call failure hook
    if (task.onFailure) {
      await task.onFailure(error);
    }

    return {
      executionId,
      success: false,
      error: execution.error,
      duration: execution.duration,
    };
  }
}

/**
 * Records a task execution
 */
function recordExecution(taskId: string, execution: TaskExecution): void {
  if (!taskExecutions.has(taskId)) {
    taskExecutions.set(taskId, []);
  }
  taskExecutions.get(taskId)?.push(execution);
}

/**
 * Gets task status
 */
export function getTaskStatus(taskId: string): TaskStatusInfo | undefined {
  const task = tasks.get(taskId);
  if (!task) {
    return undefined;
  }

  const executions = taskExecutions.get(taskId) || [];
  const lastExecution = executions[executions.length - 1];

  const successCount = executions.filter((e) => e.success).length;
  const failureCount = executions.filter((e) => !e.success).length;

  const schedule = getSchedule(taskId);
  const nextExecution = schedule?.nextRun;

  return {
    status: lastExecution?.success ? "completed" : "failed",
    lastExecution,
    nextExecution,
    runCount: executions.length,
    successCount,
    failureCount,
  };
}

/**
 * Gets task execution history
 */
export function getTaskHistory(
  query: TaskHistoryQuery,
): TaskHistory {
  const executions = taskExecutions.get(query.taskId) || [];

  // Apply filters
  let filtered = executions;

  if (query.status) {
    filtered = filtered.filter((e) =>
      query.status === "completed" ? e.success : !e.success
    );
  }

  if (query.startDate) {
    filtered = filtered.filter((e) => e.startTime >= query.startDate!);
  }

  if (query.endDate) {
    filtered = filtered.filter((e) => e.startTime <= query.endDate!);
  }

  // Apply pagination
  const offset = query.offset || 0;
  const limit = query.limit || filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  // Calculate statistics
  const totalExecutions = filtered.length;
  const successCount = filtered.filter((e) => e.success).length;
  const successRate = totalExecutions > 0 ? successCount / totalExecutions : 0;

  const totalDuration = filtered.reduce((sum, e) => sum + e.duration, 0);
  const averageDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;

  return {
    taskId: query.taskId,
    executions: paginated,
    totalExecutions,
    successRate,
    averageDuration,
  };
}

/**
 * Gets task statistics
 */
export function getTaskStatistics(taskId: string): TaskStatistics | undefined {
  const executions = taskExecutions.get(taskId) || [];
  if (executions.length === 0) {
    return undefined;
  }

  const successful = executions.filter((e) => e.success).length;
  const failed = executions.length - successful;

  const durations = executions.map((e) => e.duration);
  const avgDuration =
    durations.reduce((sum, d) => sum + d, 0) / durations.length;

  return {
    taskId,
    totalExecutions: executions.length,
    successfulExecutions: successful,
    failedExecutions: failed,
    successRate: successful / executions.length,
    averageDuration: avgDuration,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    lastExecution: executions[executions.length - 1].startTime,
  };
}

/**
 * Enables a task
 */
export async function enableTask(taskId: string): Promise<void> {
  const task = tasks.get(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  task.enabled = true;
}

/**
 * Disables a task
 */
export async function disableTask(taskId: string): Promise<void> {
  const task = tasks.get(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  task.enabled = false;
}

/**
 * Cleans up all automator resources
 */
export function cleanup(): void {
  tasks.clear();
  taskExecutions.clear();
  cleanupScheduler();
  clearAllTriggers();
  clearAllWorkflows();
}

// Re-export key functions
export {
  // Scheduler
  scheduleTask,
  unscheduleTask,
  getScheduledTasks,
  enableSchedule,
  disableSchedule,
  validateCronExpression,
  parseCronExpression,
  getUpcomingExecutions,
  // Triggers
  createTrigger,
  deleteTrigger,
  getTrigger,
  getAllTriggers,
  getTaskTriggers,
  enableTrigger,
  disableTrigger,
  fireEvent,
  handleWebhook,
  checkConditionalTriggers,
  getTriggerStatistics,
  listEvents,
  validateTrigger,
  // Workflows
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  getAllWorkflows,
  executeWorkflow,
  getWorkflowExecution,
  getWorkflowExecutions,
  getWorkflowProgress,
  cancelWorkflowExecution,
  validateWorkflow,
  getWorkflowStatistics,
};

export * from "./types.ts";
