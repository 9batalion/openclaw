import type { Trigger, TriggerEvent, TriggerType } from "../types.ts";

// In-memory trigger storage
const triggers = new Map<string, Trigger>();
const eventListeners = new Map<string, Set<string>>();

/**
 * Creates a new trigger
 */
export async function createTrigger(trigger: Trigger): Promise<void> {
  triggers.set(trigger.id, trigger);

  // Register event listeners for event-based triggers
  if (trigger.type === "event" && trigger.condition.event) {
    const event = trigger.condition.event;
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)?.add(trigger.id);
  }
}

/**
 * Deletes a trigger
 */
export async function deleteTrigger(triggerId: string): Promise<boolean> {
  const trigger = triggers.get(triggerId);
  if (!trigger) {
    return false;
  }

  // Remove from event listeners
  if (trigger.type === "event" && trigger.condition.event) {
    const event = trigger.condition.event;
    eventListeners.get(event)?.delete(triggerId);
  }

  return triggers.delete(triggerId);
}

/**
 * Gets a trigger by ID
 */
export function getTrigger(triggerId: string): Trigger | undefined {
  return triggers.get(triggerId);
}

/**
 * Gets all triggers
 */
export function getAllTriggers(): Trigger[] {
  return Array.from(triggers.values());
}

/**
 * Gets triggers for a specific task
 */
export function getTaskTriggers(taskId: string): Trigger[] {
  return Array.from(triggers.values()).filter((t) => t.taskId === taskId);
}

/**
 * Enables a trigger
 */
export async function enableTrigger(triggerId: string): Promise<void> {
  const trigger = triggers.get(triggerId);
  if (!trigger) {
    throw new Error(`Trigger not found: ${triggerId}`);
  }
  trigger.enabled = true;
}

/**
 * Disables a trigger
 */
export async function disableTrigger(triggerId: string): Promise<void> {
  const trigger = triggers.get(triggerId);
  if (!trigger) {
    throw new Error(`Trigger not found: ${triggerId}`);
  }
  trigger.enabled = false;
}

/**
 * Fires an event and triggers associated tasks
 */
export async function fireEvent(
  event: string,
  data?: unknown,
): Promise<string[]> {
  const triggerIds = eventListeners.get(event);
  if (!triggerIds || triggerIds.size === 0) {
    return [];
  }

  const triggeredTasks: string[] = [];

  for (const triggerId of triggerIds) {
    const trigger = triggers.get(triggerId);
    if (!trigger || trigger.enabled === false) {
      continue;
    }

    // Check if condition matches
    if (await evaluateCondition(trigger, data)) {
      triggeredTasks.push(trigger.taskId);

      // Create trigger event
      const triggerEvent: TriggerEvent = {
        id: `event-${Date.now()}-${triggerId}`,
        triggerId,
        timestamp: new Date().toISOString(),
        data,
      };

      // Execute task (this would integrate with task executor)
      console.log(`Trigger ${triggerId} activated for task ${trigger.taskId}`);
    }
  }

  return triggeredTasks;
}

/**
 * Evaluates a trigger condition
 */
async function evaluateCondition(
  trigger: Trigger,
  data?: unknown,
): Promise<boolean> {
  switch (trigger.type) {
    case "event":
      // For event triggers, just check if event matches
      return true;

    case "condition":
      // Evaluate conditional expression
      return evaluateExpression(trigger.condition.expression || "", data);

    case "webhook":
      // Webhook triggers are evaluated externally
      return true;

    case "schedule":
      // Schedule triggers are handled by the scheduler
      return true;

    default:
      return false;
  }
}

/**
 * Evaluates a conditional expression
 */
function evaluateExpression(expression: string, data?: unknown): boolean {
  // Simplified expression evaluation
  // In a real implementation, this would use a safe expression evaluator

  if (!expression) {
    return true;
  }

  // Example: "disk.usage > 80"
  // For now, return true as a placeholder
  return true;
}

/**
 * Registers a webhook trigger
 */
export async function registerWebhook(
  triggerId: string,
  url: string,
  method = "POST",
): Promise<void> {
  const trigger = triggers.get(triggerId);
  if (!trigger) {
    throw new Error(`Trigger not found: ${triggerId}`);
  }

  trigger.condition.url = url;
  trigger.condition.method = method;
}

/**
 * Handles incoming webhook request
 */
export async function handleWebhook(
  url: string,
  method: string,
  data: unknown,
): Promise<string[]> {
  const triggeredTasks: string[] = [];

  for (const trigger of triggers.values()) {
    if (
      trigger.type === "webhook" &&
      trigger.condition.url === url &&
      trigger.condition.method === method &&
      trigger.enabled !== false
    ) {
      triggeredTasks.push(trigger.taskId);
      console.log(`Webhook trigger ${trigger.id} activated`);
    }
  }

  return triggeredTasks;
}

/**
 * Checks conditional triggers
 */
export async function checkConditionalTriggers(): Promise<string[]> {
  const triggeredTasks: string[] = [];

  for (const trigger of triggers.values()) {
    if (
      trigger.type === "condition" &&
      trigger.enabled !== false
    ) {
      const shouldTrigger = await evaluateCondition(trigger);
      if (shouldTrigger) {
        triggeredTasks.push(trigger.taskId);
      }
    }
  }

  return triggeredTasks;
}

/**
 * Gets trigger statistics
 */
export function getTriggerStatistics(): {
  total: number;
  byType: Record<TriggerType, number>;
  enabled: number;
  disabled: number;
} {
  const allTriggers = Array.from(triggers.values());

  const byType: Record<TriggerType, number> = {
    schedule: 0,
    event: 0,
    webhook: 0,
    condition: 0,
  };

  let enabled = 0;
  let disabled = 0;

  for (const trigger of allTriggers) {
    byType[trigger.type]++;
    if (trigger.enabled !== false) {
      enabled++;
    } else {
      disabled++;
    }
  }

  return {
    total: allTriggers.length,
    byType,
    enabled,
    disabled,
  };
}

/**
 * Lists all registered events
 */
export function listEvents(): string[] {
  return Array.from(eventListeners.keys());
}

/**
 * Gets trigger count for an event
 */
export function getEventTriggerCount(event: string): number {
  return eventListeners.get(event)?.size || 0;
}

/**
 * Clears all triggers (for cleanup)
 */
export function clearAllTriggers(): void {
  triggers.clear();
  eventListeners.clear();
}

/**
 * Validates a trigger configuration
 */
export function validateTrigger(trigger: Trigger): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!trigger.id) {
    errors.push("Trigger ID is required");
  }

  if (!trigger.taskId) {
    errors.push("Task ID is required");
  }

  if (!trigger.type) {
    errors.push("Trigger type is required");
  }

  if (trigger.type === "event" && !trigger.condition.event) {
    errors.push("Event name is required for event triggers");
  }

  if (trigger.type === "webhook" && !trigger.condition.url) {
    errors.push("URL is required for webhook triggers");
  }

  if (trigger.type === "condition" && !trigger.condition.expression) {
    errors.push("Expression is required for condition triggers");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
