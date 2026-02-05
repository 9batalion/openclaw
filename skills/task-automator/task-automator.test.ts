import { describe, it, expect, beforeEach } from "vitest";
import {
  defineTask,
  getTask,
  getAllTasks,
  deleteTask,
  executeTask,
  getTaskStatus,
  getTaskHistory,
  getTaskStatistics,
  enableTask,
  disableTask,
  scheduleTask,
  getScheduledTasks,
  createTrigger,
  getAllTriggers,
  fireEvent,
  createWorkflow,
  executeWorkflow,
  getWorkflowProgress,
  validateCronExpression,
  validateTrigger,
  validateWorkflow,
  cleanup,
} from "./task-automator.ts";
import type { Task, Trigger, Workflow } from "./types.ts";

describe("task-automator", () => {
  beforeEach(() => {
    cleanup();
  });

  describe("task definition", () => {
    it("should define a task", () => {
      const task = defineTask({
        id: "test-task",
        name: "Test Task",
        action: async () => ({ success: true }),
      });

      expect(task.id).toBe("test-task");
      expect(task.name).toBe("Test Task");
    });

    it("should retrieve a defined task", () => {
      defineTask({
        id: "test-task",
        name: "Test Task",
        action: async () => ({ success: true }),
      });

      const task = getTask("test-task");
      expect(task).toBeDefined();
      expect(task?.id).toBe("test-task");
    });

    it("should list all tasks", () => {
      defineTask({
        id: "task-1",
        name: "Task 1",
        action: async () => ({}),
      });
      defineTask({
        id: "task-2",
        name: "Task 2",
        action: async () => ({}),
      });

      const tasks = getAllTasks();
      expect(tasks.length).toBe(2);
    });

    it("should delete a task", async () => {
      defineTask({
        id: "delete-task",
        name: "Delete Task",
        action: async () => ({}),
      });

      const deleted = await deleteTask("delete-task");
      expect(deleted).toBe(true);

      const task = getTask("delete-task");
      expect(task).toBeUndefined();
    });
  });

  describe("task execution", () => {
    it("should execute a task", async () => {
      defineTask({
        id: "exec-task",
        name: "Exec Task",
        action: async () => ({ data: "success" }),
      });

      const result = await executeTask("exec-task");
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: "success" });
    });

    it("should handle task errors", async () => {
      defineTask({
        id: "error-task",
        name: "Error Task",
        action: async () => {
          throw new Error("Task failed");
        },
      });

      const result = await executeTask("error-task");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Task failed");
    });

    it("should track task status", async () => {
      defineTask({
        id: "status-task",
        name: "Status Task",
        action: async () => ({ done: true }),
      });

      await executeTask("status-task");

      const status = getTaskStatus("status-task");
      expect(status).toBeDefined();
      expect(status?.runCount).toBe(1);
      expect(status?.successCount).toBe(1);
    });

    it("should respect task conditions", async () => {
      defineTask({
        id: "conditional-task",
        name: "Conditional Task",
        action: async () => ({ executed: true }),
        condition: async () => false, // Always false
      });

      const result = await executeTask("conditional-task");
      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        skipped: true,
        reason: "Condition not met",
      });
    });
  });

  describe("task history", () => {
    it("should track execution history", async () => {
      defineTask({
        id: "history-task",
        name: "History Task",
        action: async () => ({ count: 1 }),
      });

      await executeTask("history-task");
      await executeTask("history-task");
      await executeTask("history-task");

      const history = getTaskHistory({ taskId: "history-task" });
      expect(history.executions.length).toBe(3);
      expect(history.totalExecutions).toBe(3);
    });

    it("should calculate task statistics", async () => {
      defineTask({
        id: "stats-task",
        name: "Stats Task",
        action: async () => ({ result: "ok" }),
      });

      await executeTask("stats-task");
      await executeTask("stats-task");

      const stats = getTaskStatistics("stats-task");
      expect(stats).toBeDefined();
      expect(stats?.totalExecutions).toBe(2);
      expect(stats?.successfulExecutions).toBe(2);
      expect(stats?.successRate).toBe(1);
    });
  });

  describe("task scheduling", () => {
    it("should schedule a task", async () => {
      const task = defineTask({
        id: "scheduled-task",
        name: "Scheduled Task",
        action: async () => ({ scheduled: true }),
        schedule: "5m",
      });

      await scheduleTask(task);

      const schedules = getScheduledTasks();
      expect(schedules.length).toBeGreaterThan(0);
      expect(schedules[0].taskId).toBe("scheduled-task");
    });

    it("should validate cron expressions", () => {
      expect(validateCronExpression("5m")).toBe(true);
      expect(validateCronExpression("0 0 * * *")).toBe(true);
      expect(validateCronExpression("invalid")).toBe(false);
    });
  });

  describe("triggers", () => {
    it("should create a trigger", async () => {
      defineTask({
        id: "triggered-task",
        name: "Triggered Task",
        action: async () => ({ triggered: true }),
      });

      const trigger: Trigger = {
        id: "test-trigger",
        type: "event",
        taskId: "triggered-task",
        condition: { event: "test.event" },
      };

      await createTrigger(trigger);

      const triggers = getAllTriggers();
      expect(triggers.length).toBe(1);
      expect(triggers[0].id).toBe("test-trigger");
    });

    it("should fire events and trigger tasks", async () => {
      defineTask({
        id: "event-task",
        name: "Event Task",
        action: async () => ({ fired: true }),
      });

      await createTrigger({
        id: "event-trigger",
        type: "event",
        taskId: "event-task",
        condition: { event: "my.event" },
      });

      const triggered = await fireEvent("my.event", { data: "test" });
      expect(triggered).toContain("event-task");
    });

    it("should validate trigger configuration", () => {
      const validTrigger: Trigger = {
        id: "valid-trigger",
        type: "event",
        taskId: "some-task",
        condition: { event: "test.event" },
      };

      const validation = validateTrigger(validTrigger);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe("workflows", () => {
    it("should create a workflow", async () => {
      const workflow: Workflow = {
        id: "test-workflow",
        name: "Test Workflow",
        steps: [
          { taskId: "task-1" },
          { taskId: "task-2" },
        ],
      };

      await createWorkflow(workflow);

      const workflows = workflow;
      expect(workflows.id).toBe("test-workflow");
    });

    it("should execute a workflow", async () => {
      defineTask({
        id: "workflow-task-1",
        name: "Task 1",
        action: async () => ({ step: 1 }),
      });

      defineTask({
        id: "workflow-task-2",
        name: "Task 2",
        action: async () => ({ step: 2 }),
      });

      const workflow: Workflow = {
        id: "exec-workflow",
        name: "Execution Workflow",
        steps: [
          { taskId: "workflow-task-1" },
          { taskId: "workflow-task-2" },
        ],
      };

      await createWorkflow(workflow);

      const execution = await executeWorkflow("exec-workflow");
      expect(execution.status).toBe("completed");
      expect(execution.completedSteps).toBe(2);
    });

    it("should track workflow progress", async () => {
      defineTask({
        id: "progress-task",
        name: "Progress Task",
        action: async () => ({}),
      });

      const workflow: Workflow = {
        id: "progress-workflow",
        name: "Progress Workflow",
        steps: [{ taskId: "progress-task" }],
      };

      await createWorkflow(workflow);

      const execution = await executeWorkflow("progress-workflow");
      const progress = getWorkflowProgress(execution.id);

      expect(progress).toBeDefined();
      expect(progress?.total).toBe(1);
      expect(progress?.completed).toBe(1);
    });

    it("should validate workflow configuration", () => {
      const validWorkflow: Workflow = {
        id: "valid-workflow",
        name: "Valid Workflow",
        steps: [{ taskId: "some-task" }],
      };

      const validation = validateWorkflow(validWorkflow);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe("task enable/disable", () => {
    it("should enable and disable tasks", async () => {
      defineTask({
        id: "toggle-task",
        name: "Toggle Task",
        action: async () => ({}),
        enabled: true,
      });

      await disableTask("toggle-task");
      let task = getTask("toggle-task");
      expect(task?.enabled).toBe(false);

      await enableTask("toggle-task");
      task = getTask("toggle-task");
      expect(task?.enabled).toBe(true);
    });
  });
});
