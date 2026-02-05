import { describe, it, expect, beforeEach } from "vitest";
import { createAgentFederationTool, AgentFederationClient } from "./agent-federation-tool.js";
import type { OpenClawConfig } from "../../config/config.js";

describe("Agent Federation Tool", () => {
  let tool: ReturnType<typeof createAgentFederationTool>;
  let mockConfig: Partial<OpenClawConfig>;

  beforeEach(() => {
    mockConfig = {
      federation: {
        enabled: true,
        serverId: "test-server",
        peers: [
          {
            id: "test-peer",
            name: "Test Peer",
            url: "ws://localhost:18789",
            agentId: "agent-test",
            capabilities: ["test-capability"],
            enabled: true,
          },
        ],
        defaultTimeoutMs: 30000,
        allowDynamicPeers: true,
        requireAuth: false,
      },
    } as any;

    tool = createAgentFederationTool({ config: mockConfig as OpenClawConfig });
  });

  it("should create tool with correct metadata", () => {
    expect(tool.name).toBe("agent_federation");
    expect(tool.label).toBe("Agent Federation");
    expect(tool.description).toContain("Communicate with other OpenClaw agents");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeInstanceOf(Function);
  });

  it("should list peers", async () => {
    const result = await tool.execute("test-call-id", { action: "list_peers" }, undefined);
    expect(result.type).toBe("json");
    const payload = JSON.parse(result.payload);
    expect(payload.serverId).toBe("test-server");
    expect(payload.totalPeers).toBe(1);
    expect(payload.peers).toHaveLength(1);
    expect(payload.peers[0].id).toBe("test-peer");
  });

  it("should query capabilities", async () => {
    const result = await tool.execute(
      "test-call-id",
      { action: "query_capabilities", peerId: "test-peer" },
      undefined,
    );
    expect(result.type).toBe("json");
    const payload = JSON.parse(result.payload);
    expect(payload.peerId).toBe("test-peer");
    expect(payload.capabilities).toContain("test-capability");
  });

  it("should throw error for missing peer", async () => {
    await expect(
      tool.execute(
        "test-call-id",
        { action: "query_capabilities", peerId: "non-existent" },
        undefined,
      ),
    ).rejects.toThrow("Peer not found");
  });

  it("should register dynamic peer", async () => {
    const result = await tool.execute(
      "test-call-id",
      {
        action: "register_peer",
        peerId: "dynamic-peer",
        peerName: "Dynamic Test Peer",
        peerUrl: "ws://localhost:18790",
        peerAgentId: "agent-dynamic",
        peerCapabilities: ["dynamic-capability"],
      },
      undefined,
    );
    expect(result.type).toBe("json");
    const payload = JSON.parse(result.payload);
    expect(payload.status).toBe("registered");
    expect(payload.peer.id).toBe("dynamic-peer");
  });

  it("should unregister dynamic peer", async () => {
    // First register
    await tool.execute(
      "test-call-id",
      {
        action: "register_peer",
        peerId: "temp-peer",
        peerName: "Temp Peer",
        peerUrl: "ws://localhost:18791",
        peerAgentId: "agent-temp",
      },
      undefined,
    );

    // Then unregister
    const result = await tool.execute(
      "test-call-id",
      { action: "unregister_peer", peerId: "temp-peer" },
      undefined,
    );
    expect(result.type).toBe("json");
    const payload = JSON.parse(result.payload);
    expect(payload.status).toBe("unregistered");
    expect(payload.peerId).toBe("temp-peer");
  });

  it("should not allow unregistering static peers", async () => {
    await expect(
      tool.execute("test-call-id", { action: "unregister_peer", peerId: "test-peer" }, undefined),
    ).rejects.toThrow("not a dynamic peer");
  });

  it("should throw error when federation is disabled", async () => {
    const disabledConfig = {
      federation: {
        enabled: false,
        peers: [],
      },
    } as any;
    const disabledTool = createAgentFederationTool({ config: disabledConfig });

    await expect(
      disabledTool.execute(
        "test-call-id",
        { action: "send", peerId: "test-peer", message: "test" },
        undefined,
      ),
    ).rejects.toThrow("Federation is not enabled");
  });

  it("should throw error for unknown action", async () => {
    await expect(
      tool.execute("test-call-id", { action: "unknown_action" }, undefined),
    ).rejects.toThrow("Unknown action");
  });
});

describe("AgentFederationClient", () => {
  it("should initialize with default config when no config provided", () => {
    const client = new AgentFederationClient();
    expect(client).toBeDefined();
  });

  it("should initialize with provided config", () => {
    const config = {
      federation: {
        enabled: true,
        serverId: "custom-server",
        peers: [],
        defaultTimeoutMs: 45000,
        allowDynamicPeers: false,
        requireAuth: true,
      },
    } as any;
    const client = new AgentFederationClient(config);
    expect(client).toBeDefined();
  });
});
