import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { runInNewContext, type Context } from "node:vm";
import type { OpenClawConfig } from "../../config/config.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const ToolCreatorSchema = Type.Object({
  name: Type.String({
    description: "Tool name in snake_case format (e.g., 'my_custom_tool')",
    pattern: "^[a-z][a-z0-9_]*$",
  }),
  description: Type.String({
    description: "Clear description of what the tool does",
  }),
  parameters: Type.String({
    description: "JSON string defining the TypeBox parameter schema",
  }),
  code: Type.String({
    description:
      "JavaScript/TypeScript code implementing the tool's execute function. Has access to 'params' object and must return a result object.",
  }),
  persist: Type.Optional(
    Type.Boolean({
      description: "If true, saves the tool as a plugin for future sessions",
      default: false,
    }),
  ),
});

type ToolCreatorConfig = NonNullable<OpenClawConfig["tools"]>["toolCreator"];

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_ALLOWED_MODULES = ["Math", "JSON", "Date"];

// Registry to store dynamically created tools for the current session
const dynamicToolsRegistry = new Map<string, AnyAgentTool>();

function resolveToolCreatorConfig(cfg?: OpenClawConfig): ToolCreatorConfig {
  const toolCreator = cfg?.tools?.toolCreator;
  if (!toolCreator || typeof toolCreator !== "object") {
    return undefined;
  }
  return toolCreator as ToolCreatorConfig;
}

function resolveEnabled(config?: ToolCreatorConfig): boolean {
  if (typeof config?.enabled === "boolean") {
    return config.enabled;
  }
  return false; // Disabled by default for security
}

function resolveAllowPersist(config?: ToolCreatorConfig): boolean {
  if (typeof config?.allowPersist === "boolean") {
    return config.allowPersist;
  }
  return false; // Disabled by default
}

function resolveTimeoutSeconds(config?: ToolCreatorConfig): number {
  const value = config?.timeoutSeconds;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_TIMEOUT_SECONDS;
}

function resolveAllowedModules(config?: ToolCreatorConfig): string[] {
  const modules = config?.allowedModules;
  if (Array.isArray(modules)) {
    return modules.filter((m) => typeof m === "string" && m.length > 0);
  }
  return DEFAULT_ALLOWED_MODULES;
}

function validateToolName(name: string, existingTools: Set<string>): void {
  if (!TOOL_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid tool name: '${name}'. Must be snake_case and start with a lowercase letter.`,
    );
  }
  if (existingTools.has(name)) {
    throw new Error(`Tool '${name}' already exists. Choose a different name.`);
  }
}

function validateParametersSchema(parametersJson: string): Record<string, unknown> {
  let schema: unknown;
  try {
    schema = JSON.parse(parametersJson);
  } catch (error) {
    throw new Error(
      `Invalid parameters schema JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!schema || typeof schema !== "object") {
    throw new Error("Parameters schema must be a valid JSON object");
  }

  return schema as Record<string, unknown>;
}

function createSandboxContext(allowedModules: string[]): Context {
  const context: Context = {
    // Provide safe globals
    console: {
      log: (...args: unknown[]) => console.log("[tool]", ...args),
      error: (...args: unknown[]) => console.error("[tool]", ...args),
      warn: (...args: unknown[]) => console.warn("[tool]", ...args),
    },
    // Provide explicitly allowed modules
    Math: allowedModules.includes("Math") ? Math : undefined,
    JSON: allowedModules.includes("JSON") ? JSON : undefined,
    Date: allowedModules.includes("Date") ? Date : undefined,
    // Add crypto if allowed
    crypto: allowedModules.includes("crypto")
      ? {
          randomUUID: () => {
            if (typeof globalThis.crypto?.randomUUID === "function") {
              return globalThis.crypto.randomUUID();
            }
            throw new Error("crypto.randomUUID not available");
          },
        }
      : undefined,
    // Provide fetch if allowed (wrapped for security)
    fetch: allowedModules.includes("fetch")
      ? (url: string, options?: RequestInit) => {
          // Basic validation
          try {
            const parsed = new URL(url);
            if (!["http:", "https:"].includes(parsed.protocol)) {
              throw new Error("Only http and https protocols are allowed");
            }
          } catch {
            throw new Error("Invalid URL");
          }
          return fetch(url, options);
        }
      : undefined,
  };

  // Remove undefined entries
  return Object.fromEntries(Object.entries(context).filter(([, v]) => v !== undefined));
}

function executeToolCode(
  code: string,
  params: Record<string, unknown>,
  timeoutSeconds: number,
  allowedModules: string[],
): unknown {
  const context = createSandboxContext(allowedModules);

  // Wrap the code in an async function to support async operations
  const wrappedCode = `
    (async function execute(params) {
      ${code}
    })(params)
  `;

  try {
    const result = runInNewContext(
      wrappedCode,
      { ...context, params },
      {
        timeout: timeoutSeconds * 1000,
        displayErrors: true,
      },
    );

    // Handle promises
    if (result && typeof result === "object" && "then" in result) {
      return result;
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw new Error(`Tool execution timed out after ${timeoutSeconds} seconds`);
    }
    throw new Error(
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getDynamicTool(name: string): AnyAgentTool | undefined {
  return dynamicToolsRegistry.get(name);
}

export function listDynamicTools(): string[] {
  return Array.from(dynamicToolsRegistry.keys());
}

export function createToolCreatorTool(options?: {
  config?: OpenClawConfig;
  existingToolNames?: Set<string>;
}): AnyAgentTool | null {
  const config = resolveToolCreatorConfig(options?.config);
  if (!resolveEnabled(config)) {
    return null;
  }

  const allowPersist = resolveAllowPersist(config);
  const timeoutSeconds = resolveTimeoutSeconds(config);
  const allowedModules = resolveAllowedModules(config);
  const existingTools = options?.existingToolNames ?? new Set<string>();

  return {
    label: "Tool Creator",
    name: "tool_create",
    description:
      "Create custom tools dynamically at runtime. Define new tools with name, description, parameters schema, and implementation code. Tools are available for the current session.",
    parameters: ToolCreatorSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      // Parse parameters
      const name = readStringParam(params, "name", { required: true });
      const description = readStringParam(params, "description", { required: true });
      const parametersJson = readStringParam(params, "parameters", { required: true });
      const code = readStringParam(params, "code", { required: true });
      const persist = typeof params.persist === "boolean" ? params.persist : false;

      // Validate persist option
      if (persist && !allowPersist) {
        throw new Error(
          "Persistent tools are disabled. Set tools.toolCreator.allowPersist=true in config to enable.",
        );
      }

      // Validate tool name
      const allToolNames = new Set([...existingTools, ...dynamicToolsRegistry.keys()]);
      validateToolName(name, allToolNames);

      // Validate parameters schema
      const parametersSchema = validateParametersSchema(parametersJson);

      // Create the tool
      const tool: AnyAgentTool = {
        label: `Dynamic: ${name}`,
        name,
        description,
        // biome-ignore lint/suspicious/noExplicitAny: Runtime-validated dynamic schema
        parameters: parametersSchema as any,
        execute: async (toolCallId, toolArgs) => {
          try {
            const result = await executeToolCode(
              code,
              toolArgs as Record<string, unknown>,
              timeoutSeconds,
              allowedModules,
            );
            return jsonResult(result);
          } catch (error) {
            throw new Error(
              `Dynamic tool '${name}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
      };

      // Register the tool in the dynamic registry
      dynamicToolsRegistry.set(name, tool);

      const response = {
        status: "created",
        tool: {
          name,
          description,
          persisted: false, // Persistence not yet implemented
        },
        message: `Tool '${name}' created and available for this session`,
        warning: persist
          ? "Persistent tools are not yet implemented. Tool is session-only."
          : undefined,
      };

      return jsonResult(response);
    },
  };
}
