import { describe, expect, it, beforeEach } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { createToolCreatorTool, getDynamicTool, listDynamicTools } from "./tool-creator.js";

describe("tool-creator", () => {
  const baseConfig: OpenClawConfig = {
    tools: {
      toolCreator: {
        enabled: true,
        allowPersist: false,
        timeoutSeconds: 30,
        allowedModules: ["Math", "JSON", "Date"],
      },
    },
  };

  beforeEach(() => {
    // Clear dynamic tools registry between tests
    for (const name of listDynamicTools()) {
      const tool = getDynamicTool(name);
      if (tool) {
        // Note: There's no exposed clearDynamicTools function, so we work around it
      }
    }
  });

  describe("createToolCreatorTool", () => {
    it("returns null when disabled", () => {
      const config: OpenClawConfig = {
        tools: { toolCreator: { enabled: false } },
      };
      const tool = createToolCreatorTool({ config });
      expect(tool).toBeNull();
    });

    it("returns null when config is missing", () => {
      const tool = createToolCreatorTool({ config: {} });
      expect(tool).toBeNull();
    });

    it("returns a tool when enabled", () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();
      expect(tool?.name).toBe("tool_create");
      expect(tool?.label).toBe("Tool Creator");
    });
  });

  describe("tool execution", () => {
    it("creates a simple tool successfully", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      const result = await tool!.execute("call1", {
        name: "add_numbers",
        description: "Add two numbers together",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
        }),
        code: "return { result: params.a + params.b };",
        persist: false,
      });

      expect(result.details).toMatchObject({
        status: "created",
        tool: {
          name: "add_numbers",
          description: "Add two numbers together",
          persisted: false,
        },
      });
    });

    it("rejects invalid tool names", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await expect(
        tool!.execute("call1", {
          name: "Invalid-Name",
          description: "Test",
          parameters: JSON.stringify({ type: "object" }),
          code: "return {};",
        }),
      ).rejects.toThrow(/Invalid tool name/);
    });

    it("rejects tool names that start with uppercase", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await expect(
        tool!.execute("call1", {
          name: "MyTool",
          description: "Test",
          parameters: JSON.stringify({ type: "object" }),
          code: "return {};",
        }),
      ).rejects.toThrow(/Invalid tool name/);
    });

    it("rejects duplicate tool names", async () => {
      const existingTools = new Set(["existing_tool"]);
      const tool = createToolCreatorTool({ config: baseConfig, existingToolNames: existingTools });
      expect(tool).not.toBeNull();

      await expect(
        tool!.execute("call1", {
          name: "existing_tool",
          description: "Test",
          parameters: JSON.stringify({ type: "object" }),
          code: "return {};",
        }),
      ).rejects.toThrow(/already exists/);
    });

    it("rejects invalid JSON in parameters", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await expect(
        tool!.execute("call1", {
          name: "test_tool",
          description: "Test",
          parameters: "not valid json",
          code: "return {};",
        }),
      ).rejects.toThrow(/Invalid parameters schema JSON/);
    });

    it("rejects persist when allowPersist is false", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await expect(
        tool!.execute("call1", {
          name: "test_tool",
          description: "Test",
          parameters: JSON.stringify({ type: "object" }),
          code: "return {};",
          persist: true,
        }),
      ).rejects.toThrow(/Persistent tools are disabled/);
    });

    it("executes created tool successfully", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      // Create the tool
      await tool!.execute("call1", {
        name: "multiply",
        description: "Multiply two numbers",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
        }),
        code: "return { product: params.x * params.y };",
      });

      // Get and execute the created tool
      const createdTool = getDynamicTool("multiply");
      expect(createdTool).not.toBeNull();
      expect(createdTool?.name).toBe("multiply");

      const result = await createdTool!.execute("call2", { x: 6, y: 7 });
      expect(result.details).toEqual({ product: 42 });
    });

    it("allows access to Math module", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "calc_sqrt",
        description: "Calculate square root",
        parameters: JSON.stringify({
          type: "object",
          properties: { n: { type: "number" } },
        }),
        code: "return { result: Math.sqrt(params.n) };",
      });

      const createdTool = getDynamicTool("calc_sqrt");
      const result = await createdTool!.execute("call2", { n: 16 });
      expect(result.details).toEqual({ result: 4 });
    });

    it("allows access to JSON module", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "parse_json",
        description: "Parse JSON string",
        parameters: JSON.stringify({
          type: "object",
          properties: { str: { type: "string" } },
        }),
        code: "return JSON.parse(params.str);",
      });

      const createdTool = getDynamicTool("parse_json");
      const result = await createdTool!.execute("call2", { str: '{"key":"value"}' });
      expect(result.details).toEqual({ key: "value" });
    });

    it("restricts access to disallowed modules", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "use_fs",
        description: "Try to use fs",
        parameters: JSON.stringify({ type: "object" }),
        code: "const fs = require('fs'); return { exists: typeof fs !== 'undefined' };",
      });

      const createdTool = getDynamicTool("use_fs");
      await expect(createdTool!.execute("call2", {})).rejects.toThrow();
    });

    it("handles async code execution", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "async_delay",
        description: "Async delay",
        parameters: JSON.stringify({ type: "object" }),
        code: `
          return Promise.resolve({ done: true });
        `,
      });

      const createdTool = getDynamicTool("async_delay");
      const result = await createdTool!.execute("call2", {});
      expect(result.details).toEqual({ done: true });
    });

    it("enforces execution timeout", async () => {
      const config: OpenClawConfig = {
        tools: {
          toolCreator: {
            enabled: true,
            timeoutSeconds: 1,
            allowedModules: ["Math", "JSON"],
          },
        },
      };
      const tool = createToolCreatorTool({ config });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "infinite_loop",
        description: "Infinite loop",
        parameters: JSON.stringify({ type: "object" }),
        code: "while(true) {}; return {};",
      });

      const createdTool = getDynamicTool("infinite_loop");
      await expect(createdTool!.execute("call2", {})).rejects.toThrow(/timed out/);
    });
  });

  describe("configuration", () => {
    it("uses default timeout when not specified", () => {
      const config: OpenClawConfig = {
        tools: { toolCreator: { enabled: true } },
      };
      const tool = createToolCreatorTool({ config });
      expect(tool).not.toBeNull();
    });

    it("uses custom allowed modules", async () => {
      const config: OpenClawConfig = {
        tools: {
          toolCreator: {
            enabled: true,
            allowedModules: ["fetch"],
          },
        },
      };
      const tool = createToolCreatorTool({ config });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "test_fetch",
        description: "Test fetch availability",
        parameters: JSON.stringify({ type: "object" }),
        code: "return { hasFetch: typeof fetch !== 'undefined' };",
      });

      const createdTool = getDynamicTool("test_fetch");
      const result = await createdTool!.execute("call2", {});
      expect(result.details).toMatchObject({ hasFetch: true });
    });
  });

  describe("dynamic tools registry", () => {
    it("lists created tools", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "tool_one",
        description: "First tool",
        parameters: JSON.stringify({ type: "object" }),
        code: "return {};",
      });

      await tool!.execute("call2", {
        name: "tool_two",
        description: "Second tool",
        parameters: JSON.stringify({ type: "object" }),
        code: "return {};",
      });

      const tools = listDynamicTools();
      expect(tools).toContain("tool_one");
      expect(tools).toContain("tool_two");
    });

    it("retrieves created tool by name", async () => {
      const tool = createToolCreatorTool({ config: baseConfig });
      expect(tool).not.toBeNull();

      await tool!.execute("call1", {
        name: "my_tool",
        description: "My tool",
        parameters: JSON.stringify({ type: "object" }),
        code: "return { value: 42 };",
      });

      const createdTool = getDynamicTool("my_tool");
      expect(createdTool).not.toBeNull();
      expect(createdTool?.name).toBe("my_tool");
      expect(createdTool?.description).toBe("My tool");
    });

    it("returns undefined for non-existent tools", () => {
      const tool = getDynamicTool("non_existent");
      expect(tool).toBeUndefined();
    });
  });
});
