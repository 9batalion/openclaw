// Type definitions for task-automator skill

export interface Task {
  id: string;
  name: string;
  action: TaskAction;
  schedule?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryBackoff?: "linear" | "exponential";
  enabled?: boolean;
  condition?: TaskCondition;
  onSuccess?: TaskHook;
  onFailure?: TaskHook;
  metadata?: Record<string, unknown>;
}

export type TaskAction = (context: TaskContext) => Promise<unknown>;
export type TaskCondition = (context: TaskContext) => Promise<boolean>;
export type TaskHook = (data: unknown) => Promise<void>;

export interface TaskContext {
  taskId: string;
  executionId: string;
  input?: unknown;
  previousResults?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface TaskExecution {
  success: boolean;
  taskId: string;
  executionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  result: unknown;
  error?: string;
  retries: number;
}

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskStatusInfo {
  status: TaskStatus;
  lastExecution?: TaskExecution;
  nextExecution?: string;
  runCount: number;
  successCount: number;
  failureCount: number;
}

// Trigger Types
export interface Trigger {
  id: string;
  type: TriggerType;
  taskId: string;
  condition: TriggerCondition;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export type TriggerType = "schedule" | "event" | "webhook" | "condition";

export interface TriggerCondition {
  schedule?: string;
  event?: string;
  url?: string;
  method?: string;
  expression?: string;
  [key: string]: unknown;
}

export interface TriggerEvent {
  id: string;
  triggerId: string;
  timestamp: string;
  data?: unknown;
}

// Workflow Types
export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  onError?: string;
  onComplete?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  taskId?: string;
  tasks?: string[];
  parallel?: boolean;
  condition?: string;
  dependsOn?: string[];
  waitFor?: "completion" | "start";
  retryOnFailure?: boolean;
  maxRetries?: number;
  runAlways?: boolean;
  timeout?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  startTime: string;
  endTime?: string;
  currentStep: number;
  completedSteps: number;
  totalSteps: number;
  stepResults: StepResult[];
  error?: string;
}

export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface StepResult {
  stepIndex: number;
  taskId: string;
  status: TaskStatus;
  result?: unknown;
  error?: string;
  startTime: string;
  endTime?: string;
}

export interface WorkflowProgress {
  completed: number;
  total: number;
  currentStep: string;
  percentage: number;
  estimatedCompletion?: string;
}

// Scheduler Types
export interface ScheduleEntry {
  id: string;
  taskId: string;
  schedule: string;
  nextRun: string;
  lastRun?: string;
  enabled: boolean;
}

export interface SchedulerOptions {
  timezone?: string;
  maxConcurrent?: number;
  gracePeriod?: number;
}

// Execution Types
export interface ExecutionOptions {
  input?: unknown;
  priority?: number;
  delayBy?: number;
  timeout?: number;
}

export interface ExecutionResult {
  executionId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

// History Types
export interface TaskHistory {
  taskId: string;
  executions: TaskExecution[];
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
}

export interface TaskHistoryQuery {
  taskId: string;
  limit?: number;
  offset?: number;
  status?: TaskStatus;
  startDate?: string;
  endDate?: string;
}

// Configuration Types
export interface AutomatorConfig {
  maxConcurrent: number;
  retryDelay: number;
  logLevel: "debug" | "info" | "warn" | "error";
  storagePath: string;
  timezone: string;
}

// Event Types
export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  executionId?: string;
  timestamp: string;
  data?: unknown;
}

export type TaskEventType =
  | "task.scheduled"
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.cancelled"
  | "task.retry";

export interface EventListener {
  id: string;
  event: TaskEventType;
  handler: (event: TaskEvent) => Promise<void>;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Statistics Types
export interface TaskStatistics {
  taskId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecution: string;
}

export interface SystemStatistics {
  totalTasks: number;
  activeTasks: number;
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  successRate: number;
  uptime: number;
}

// Error Types
export interface TaskError {
  taskId: string;
  executionId: string;
  error: string;
  stack?: string;
  timestamp: string;
  retryable: boolean;
}

// Batch Types
export interface BatchOperation {
  tasks: string[];
  operation: "start" | "stop" | "enable" | "disable";
}

export interface BatchResult {
  successful: string[];
  failed: string[];
  errors: Record<string, string>;
}

// Priority Types
export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface PrioritizedTask extends Task {
  priority: TaskPriority;
}

// Notification Types
export interface TaskNotification {
  taskId: string;
  event: TaskEventType;
  message: string;
  timestamp: string;
  severity: "info" | "warning" | "error";
}
