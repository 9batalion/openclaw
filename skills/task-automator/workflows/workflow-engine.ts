import type {
  StepResult,
  Workflow,
  WorkflowExecution,
  WorkflowProgress,
  WorkflowStatus,
} from "../types.ts";

// In-memory workflow storage
const workflows = new Map<string, Workflow>();
const executions = new Map<string, WorkflowExecution>();

/**
 * Creates a new workflow
 */
export async function createWorkflow(workflow: Workflow): Promise<void> {
  workflows.set(workflow.id, workflow);
}

/**
 * Deletes a workflow
 */
export async function deleteWorkflow(workflowId: string): Promise<boolean> {
  return workflows.delete(workflowId);
}

/**
 * Gets a workflow by ID
 */
export function getWorkflow(workflowId: string): Workflow | undefined {
  return workflows.get(workflowId);
}

/**
 * Gets all workflows
 */
export function getAllWorkflows(): Workflow[] {
  return Array.from(workflows.values());
}

/**
 * Executes a workflow
 */
export async function executeWorkflow(
  workflowId: string,
  input?: unknown,
): Promise<WorkflowExecution> {
  const workflow = workflows.get(workflowId);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  if (workflow.enabled === false) {
    throw new Error(`Workflow is disabled: ${workflowId}`);
  }

  const execution: WorkflowExecution = {
    id: `exec-${workflowId}-${Date.now()}`,
    workflowId,
    status: "running",
    startTime: new Date().toISOString(),
    currentStep: 0,
    completedSteps: 0,
    totalSteps: workflow.steps.length,
    stepResults: [],
  };

  executions.set(execution.id, execution);

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      execution.currentStep = i;
      const step = workflow.steps[i];

      // Check dependencies
      if (step.dependsOn && !areDependenciesMet(step.dependsOn, execution)) {
        throw new Error(`Dependencies not met for step ${i}`);
      }

      // Execute step
      const stepResult = await executeStep(step, execution, input);
      execution.stepResults.push(stepResult);

      // Check if step failed
      if (stepResult.status === "failed" && !step.runAlways) {
        if (step.retryOnFailure && (step.maxRetries || 0) > 0) {
          // Retry logic would go here
        } else {
          execution.status = "failed";
          execution.error = stepResult.error;
          break;
        }
      }

      execution.completedSteps++;
    }

    if (execution.status !== "failed") {
      execution.status = "completed";
    }
  } catch (error) {
    execution.status = "failed";
    execution.error =
      error instanceof Error ? error.message : "Unknown error";

    // Execute error handler if defined
    if (workflow.onError) {
      await executeErrorHandler(workflow.onError, execution);
    }
  } finally {
    execution.endTime = new Date().toISOString();

    // Execute completion handler if defined
    if (workflow.onComplete) {
      await executeCompletionHandler(workflow.onComplete, execution);
    }
  }

  return execution;
}

/**
 * Executes a single workflow step
 */
async function executeStep(
  step: any,
  execution: WorkflowExecution,
  input?: unknown,
): Promise<StepResult> {
  const startTime = new Date().toISOString();
  const stepIndex = execution.currentStep;

  try {
    if (step.parallel && step.tasks) {
      // Execute multiple tasks in parallel
      return await executeParallelTasks(step.tasks, stepIndex, startTime);
    }

    // Execute single task
    const taskId = step.taskId || "unknown";

    // Check condition if specified
    if (step.condition) {
      const conditionMet = evaluateStepCondition(
        step.condition,
        execution.stepResults,
      );
      if (!conditionMet) {
        return {
          stepIndex,
          taskId,
          status: "completed",
          result: { skipped: true, reason: "Condition not met" },
          startTime,
          endTime: new Date().toISOString(),
        };
      }
    }

    // Simulate task execution (in real implementation, would call task executor)
    const result = { success: true, data: "Task completed" };

    return {
      stepIndex,
      taskId,
      status: "completed",
      result,
      startTime,
      endTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      stepIndex,
      taskId: step.taskId || "unknown",
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      startTime,
      endTime: new Date().toISOString(),
    };
  }
}

/**
 * Executes multiple tasks in parallel
 */
async function executeParallelTasks(
  taskIds: string[],
  stepIndex: number,
  startTime: string,
): Promise<StepResult> {
  try {
    // Simulate parallel execution
    const results = await Promise.all(
      taskIds.map(async (taskId) => {
        return { taskId, success: true };
      }),
    );

    return {
      stepIndex,
      taskId: `parallel-${stepIndex}`,
      status: "completed",
      result: { tasks: results },
      startTime,
      endTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      stepIndex,
      taskId: `parallel-${stepIndex}`,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      startTime,
      endTime: new Date().toISOString(),
    };
  }
}

/**
 * Evaluates a step condition
 */
function evaluateStepCondition(
  condition: string,
  stepResults: StepResult[],
): boolean {
  // Simplified condition evaluation
  switch (condition) {
    case "previous.success":
      return stepResults.length === 0 ||
        stepResults[stepResults.length - 1].status === "completed";

    case "all_previous_success":
      return stepResults.every((r) => r.status === "completed");

    default:
      return true;
  }
}

/**
 * Checks if dependencies are met
 */
function areDependenciesMet(
  dependencies: string[],
  execution: WorkflowExecution,
): boolean {
  for (const dep of dependencies) {
    const depResult = execution.stepResults.find((r) => r.taskId === dep);
    if (!depResult || depResult.status !== "completed") {
      return false;
    }
  }
  return true;
}

/**
 * Executes error handler
 */
async function executeErrorHandler(
  handlerTaskId: string,
  execution: WorkflowExecution,
): Promise<void> {
  console.log(`Executing error handler: ${handlerTaskId}`);
}

/**
 * Executes completion handler
 */
async function executeCompletionHandler(
  handlerTaskId: string,
  execution: WorkflowExecution,
): Promise<void> {
  console.log(`Executing completion handler: ${handlerTaskId}`);
}

/**
 * Gets workflow execution status
 */
export function getWorkflowExecution(
  executionId: string,
): WorkflowExecution | undefined {
  return executions.get(executionId);
}

/**
 * Gets all executions for a workflow
 */
export function getWorkflowExecutions(workflowId: string): WorkflowExecution[] {
  return Array.from(executions.values()).filter(
    (e) => e.workflowId === workflowId,
  );
}

/**
 * Gets workflow progress
 */
export function getWorkflowProgress(
  executionId: string,
): WorkflowProgress | undefined {
  const execution = executions.get(executionId);
  if (!execution) {
    return undefined;
  }

  const percentage =
    execution.totalSteps > 0
      ? Math.round((execution.completedSteps / execution.totalSteps) * 100)
      : 0;

  return {
    completed: execution.completedSteps,
    total: execution.totalSteps,
    currentStep: `Step ${execution.currentStep + 1}`,
    percentage,
  };
}

/**
 * Cancels a running workflow execution
 */
export async function cancelWorkflowExecution(
  executionId: string,
): Promise<boolean> {
  const execution = executions.get(executionId);
  if (!execution || execution.status !== "running") {
    return false;
  }

  execution.status = "cancelled";
  execution.endTime = new Date().toISOString();
  return true;
}

/**
 * Validates a workflow configuration
 */
export function validateWorkflow(workflow: Workflow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!workflow.id) {
    errors.push("Workflow ID is required");
  }

  if (!workflow.name) {
    errors.push("Workflow name is required");
  }

  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push("Workflow must have at least one step");
  }

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    if (!step.taskId && !step.tasks) {
      errors.push(`Step ${i} must have either taskId or tasks`);
    }

    if (step.taskId && step.tasks) {
      errors.push(`Step ${i} cannot have both taskId and tasks`);
    }

    if (step.parallel && !step.tasks) {
      errors.push(`Step ${i} marked as parallel must have tasks array`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gets workflow statistics
 */
export function getWorkflowStatistics(workflowId: string): {
  totalExecutions: number;
  successful: number;
  failed: number;
  cancelled: number;
  successRate: number;
} {
  const workflowExecutions = getWorkflowExecutions(workflowId);

  const stats = {
    totalExecutions: workflowExecutions.length,
    successful: 0,
    failed: 0,
    cancelled: 0,
    successRate: 0,
  };

  for (const exec of workflowExecutions) {
    switch (exec.status) {
      case "completed":
        stats.successful++;
        break;
      case "failed":
        stats.failed++;
        break;
      case "cancelled":
        stats.cancelled++;
        break;
    }
  }

  stats.successRate =
    stats.totalExecutions > 0
      ? (stats.successful / stats.totalExecutions) * 100
      : 0;

  return stats;
}

/**
 * Clears all workflows and executions (for cleanup)
 */
export function clearAllWorkflows(): void {
  workflows.clear();
  executions.clear();
}
