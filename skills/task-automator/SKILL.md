---
name: task-automator
description: Automated task execution system with scheduling, event-based triggers, and workflow chaining. Use when building automation pipelines, scheduled jobs, or event-driven workflows that minimize manual intervention.
metadata:
  {
    "openclaw":
      {
        "emoji": "⚙️",
        "requires": {},
      },
  }
---

# Task Automator

Comprehensive task automation system with cron-like scheduling, event triggers, and workflow orchestration.

## When to Use

Use this skill when you need to:

- Schedule recurring tasks (daily, weekly, custom intervals)
- Trigger tasks based on events or conditions
- Chain multiple tasks into workflows
- Automate repetitive operations
- Build event-driven systems
- Minimize manual intervention

## Quick Start

### Define a Task

```typescript
import { defineTask } from './task-automator';

const backupTask = defineTask({
  id: 'daily-backup',
  name: 'Daily Backup',
  action: async () => {
    // Backup logic here
    return { success: true };
  },
  schedule: '0 2 * * *', // Daily at 2 AM
});
```

### Schedule a Task

```typescript
import { scheduleTask } from './task-automator';

await scheduleTask(backupTask);
```

### Create a Trigger

```typescript
import { createTrigger } from './task-automator';

await createTrigger({
  id: 'file-upload-trigger',
  type: 'event',
  condition: { event: 'file.uploaded' },
  taskId: 'process-file',
});
```

### Build a Workflow

```typescript
import { createWorkflow } from './task-automator';

await createWorkflow({
  id: 'deploy-workflow',
  name: 'Deployment Workflow',
  steps: [
    { taskId: 'run-tests' },
    { taskId: 'build-app' },
    { taskId: 'deploy-to-prod', condition: 'previous.success' },
  ],
});
```

## Features

### Task Scheduling
- **Cron expressions**: Standard cron syntax for scheduling
- **Intervals**: Fixed intervals (every 5 minutes, hourly, daily)
- **One-time tasks**: Schedule for specific date/time
- **Timezone support**: Schedule in any timezone

### Event Triggers
- **System events**: React to system-level events
- **Custom events**: Define and trigger custom events
- **Webhooks**: HTTP-triggered tasks
- **Conditional triggers**: Execute only when conditions are met

### Workflow Engine
- **Sequential execution**: Run tasks one after another
- **Parallel execution**: Run multiple tasks simultaneously
- **Conditional steps**: Skip steps based on conditions
- **Error handling**: Retry logic and fallback actions

### Task Management
- **Status tracking**: Monitor task execution status
- **History logging**: Keep logs of all executions
- **Manual execution**: Run tasks on demand
- **Task cancellation**: Stop running tasks

## Task Definition

Tasks are defined with the following structure:

```typescript
{
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  action: () => Promise<any>;    // Function to execute
  schedule?: string;             // Cron expression
  timeout?: number;              // Max execution time (ms)
  retries?: number;              // Number of retry attempts
  enabled?: boolean;             // Whether task is active
  metadata?: Record<string, any>;
}
```

## Scheduling Syntax

### Cron Expressions

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
* * * * *
```

Examples:
- `0 0 * * *` - Daily at midnight
- `0 */2 * * *` - Every 2 hours
- `0 9 * * 1-5` - Weekdays at 9 AM
- `*/15 * * * *` - Every 15 minutes

### Interval Syntax

- `5m` - Every 5 minutes
- `1h` - Every hour
- `2d` - Every 2 days
- `1w` - Every week

## Trigger Types

### Time-based Triggers
```typescript
{
  type: 'schedule',
  schedule: '0 0 * * *'
}
```

### Event-based Triggers
```typescript
{
  type: 'event',
  condition: { event: 'user.signup' }
}
```

### Webhook Triggers
```typescript
{
  type: 'webhook',
  url: '/api/trigger/my-task',
  method: 'POST'
}
```

### Conditional Triggers
```typescript
{
  type: 'condition',
  condition: 'disk.usage > 80'
}
```

## Workflow Configuration

Workflows support complex orchestration:

```typescript
{
  id: 'complex-workflow',
  name: 'Complex Workflow',
  steps: [
    {
      taskId: 'fetch-data',
      parallel: false
    },
    {
      tasks: ['process-1', 'process-2', 'process-3'],
      parallel: true  // Run these in parallel
    },
    {
      taskId: 'aggregate-results',
      condition: 'all_previous_success',
      retryOnFailure: true,
      maxRetries: 3
    },
    {
      taskId: 'send-notification',
      runAlways: true  // Runs even if previous steps fail
    }
  ],
  onError: 'send-alert',
  onComplete: 'cleanup'
}
```

## Configuration

Configure via environment variables:

- `TASK_AUTOMATOR_MAX_CONCURRENT`: Max parallel tasks (default: 10)
- `TASK_AUTOMATOR_RETRY_DELAY`: Delay between retries in ms (default: 1000)
- `TASK_AUTOMATOR_LOG_LEVEL`: Logging verbosity (default: 'info')
- `TASK_AUTOMATOR_STORAGE_PATH`: Path for task persistence

## Advanced Usage

### Conditional Execution

```typescript
const task = defineTask({
  id: 'conditional-task',
  name: 'Conditional Task',
  action: async (context) => {
    // Task logic
  },
  condition: async (context) => {
    // Return true to execute, false to skip
    return context.isDaytime();
  }
});
```

### Task Dependencies

```typescript
const workflow = createWorkflow({
  id: 'dependent-workflow',
  steps: [
    { taskId: 'task-a' },
    { 
      taskId: 'task-b',
      dependsOn: ['task-a'],
      waitFor: 'completion'
    }
  ]
});
```

### Dynamic Tasks

```typescript
const dynamicTask = defineTask({
  id: 'dynamic-task',
  name: 'Dynamic Task',
  action: async (context) => {
    const tasks = await generateSubTasks(context);
    for (const task of tasks) {
      await executeTask(task);
    }
  }
});
```

## Error Handling

### Retry Configuration

```typescript
const task = defineTask({
  id: 'retry-task',
  action: async () => { /* ... */ },
  retries: 3,
  retryDelay: 5000,  // 5 seconds
  retryBackoff: 'exponential'  // or 'linear'
});
```

### Failure Hooks

```typescript
const task = defineTask({
  id: 'hooked-task',
  action: async () => { /* ... */ },
  onFailure: async (error) => {
    await logError(error);
    await notifyAdmin(error);
  },
  onSuccess: async (result) => {
    await logSuccess(result);
  }
});
```

## Monitoring

### Task Status

```typescript
import { getTaskStatus, getTaskHistory } from './task-automator';

const status = await getTaskStatus('my-task');
// Returns: { status: 'running' | 'completed' | 'failed', ... }

const history = await getTaskHistory('my-task', { limit: 10 });
// Returns: Array of past executions
```

### Workflow Progress

```typescript
import { getWorkflowProgress } from './task-automator';

const progress = await getWorkflowProgress('my-workflow');
// Returns: { completed: 2, total: 5, currentStep: 'task-3' }
```

## Output Format

Task execution results:

```typescript
{
  success: boolean;
  taskId: string;
  executionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  result: any;
  error?: string;
  retries: number;
}
```

## Performance

- **Efficient scheduling**: Minimal overhead for scheduled tasks
- **Resource management**: Configurable concurrency limits
- **Memory efficient**: Stream large data when possible
- **Graceful shutdown**: Properly cleanup on termination

## Security

- **Input validation**: Validate all task inputs
- **Execution isolation**: Tasks run in isolated contexts
- **Permission checks**: Verify permissions before execution
- **Audit logging**: Log all task executions

## Integration Examples

### With Notifications

```typescript
const notifyTask = defineTask({
  id: 'send-notification',
  action: async (context) => {
    await sendEmail({
      to: context.recipient,
      subject: 'Task completed',
      body: context.message
    });
  }
});
```

### With File Processing

```typescript
const processFilesWorkflow = createWorkflow({
  id: 'file-processor',
  steps: [
    { taskId: 'scan-directory' },
    { taskId: 'validate-files' },
    { taskId: 'process-batch', parallel: true },
    { taskId: 'generate-report' }
  ]
});
```

### With API Integrations

```typescript
const apiTask = defineTask({
  id: 'sync-data',
  schedule: '0 */6 * * *',  // Every 6 hours
  action: async () => {
    const data = await fetchFromAPI();
    await syncToDatabase(data);
    return { synced: data.length };
  }
});
```

## Dependencies

Built with standard TypeScript/Node.js features. Optional integrations:

- Job queue libraries (for distributed execution)
- Database for persistent task storage
- Monitoring tools for observability
