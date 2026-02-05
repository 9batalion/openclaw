import { describe, it, expect } from "vitest";
import { FederationConfigSchema } from "./zod-schema.federation.js";

describe("Federation Config Schema", () => {
  it("should validate valid federation config", () => {
    const validConfig = {
      enabled: true,
      serverId: "server-001",
      peers: [
        {
          id: "peer-1",
          name: "Test Peer",
          url: "ws://localhost:18789",
          agentId: "agent-1",
          capabilities: ["test"],
          enabled: true,
        },
      ],
      defaultTimeoutMs: 30000,
      allowDynamicPeers: true,
      requireAuth: false,
    };

    const result = FederationConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("should accept minimal valid config", () => {
    const minimalConfig = {
      enabled: true,
      peers: [],
    };

    const result = FederationConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultTimeoutMs).toBe(30000);
      expect(result.data.allowDynamicPeers).toBe(true);
      expect(result.data.requireAuth).toBe(false);
    }
  });

  it("should accept undefined (optional)", () => {
    const result = FederationConfigSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("should validate peer with wss URL", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "secure-peer",
          name: "Secure Peer",
          url: "wss://secure-agent.example.com",
          agentId: "agent-secure",
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should reject peer with invalid URL protocol", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "bad-peer",
          name: "Bad Peer",
          url: "http://localhost:18789",
          agentId: "agent-bad",
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject peer without required fields", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "incomplete-peer",
          name: "Incomplete Peer",
          // missing url and agentId
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should accept peer with all optional fields", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "full-peer",
          name: "Full Peer",
          url: "ws://localhost:18789",
          token: "secret-token",
          agentId: "agent-full",
          capabilities: ["cap1", "cap2"],
          description: "A fully configured peer",
          enabled: true,
          timeoutMs: 45000,
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should reject negative timeout", () => {
    const config = {
      enabled: true,
      defaultTimeoutMs: -1000,
      peers: [],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject peer with negative timeout", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "peer-bad-timeout",
          name: "Bad Timeout Peer",
          url: "ws://localhost:18789",
          agentId: "agent-bad",
          timeoutMs: -5000,
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject empty peer ID", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "",
          name: "Empty ID Peer",
          url: "ws://localhost:18789",
          agentId: "agent-empty",
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should set default values for peer fields", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "default-peer",
          name: "Default Peer",
          url: "ws://localhost:18789",
          agentId: "agent-default",
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.peers[0].capabilities).toEqual([]);
      expect(result.data.peers[0].enabled).toBe(true);
    }
  });

  it("should accept multiple peers", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "peer-1",
          name: "Peer One",
          url: "ws://peer1.example.com",
          agentId: "agent-1",
          capabilities: ["research"],
        },
        {
          id: "peer-2",
          name: "Peer Two",
          url: "ws://peer2.example.com",
          agentId: "agent-2",
          capabilities: ["analysis"],
        },
        {
          id: "peer-3",
          name: "Peer Three",
          url: "wss://peer3.example.com",
          agentId: "agent-3",
          capabilities: ["coding"],
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.peers).toHaveLength(3);
    }
  });

  it("should reject extra unknown fields", () => {
    const config = {
      enabled: true,
      peers: [],
      unknownField: "should not be allowed",
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject peer with extra unknown fields", () => {
    const config = {
      enabled: true,
      peers: [
        {
          id: "peer-extra",
          name: "Extra Fields Peer",
          url: "ws://localhost:18789",
          agentId: "agent-extra",
          unknownField: "should not be allowed",
        },
      ],
    };

    const result = FederationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
