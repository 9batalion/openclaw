import { Type } from "@sinclair/typebox";
import { randomUUID } from "node:crypto";
import type { OpenClawConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { stringEnum, optionalStringEnum } from "../schema/typebox.js";
import {
  type AnyAgentTool,
  jsonResult,
  readStringParam,
  readNumberParam,
  readStringArrayParam,
} from "./common.js";

// Federation message types
type FederationMessageType = "request" | "response" | "delegation" | "broadcast" | "sync";
type Priority = "low" | "normal" | "high" | "urgent";

interface FederationMessage {
  messageId: string;
  fromAgent: string;
  fromServer: string;
  toAgent: string;
  type: FederationMessageType;
  content: string;
  context?: Record<string, unknown>;
  correlationId?: string;
  priority?: Priority;
  timestamp: number;
}

interface PeerAgent {
  id: string;
  name: string;
  url: string;
  token?: string;
  agentId: string;
  capabilities: string[];
  description?: string;
  enabled: boolean;
  timeoutMs?: number;
}

interface FederationConfig {
  enabled: boolean;
  serverId?: string;
  peers: PeerAgent[];
  defaultTimeoutMs: number;
  allowDynamicPeers: boolean;
  requireAuth: boolean;
}

const FEDERATION_ACTIONS = [
  "send",
  "delegate",
  "broadcast",
  "list_peers",
  "register_peer",
  "unregister_peer",
  "sync_context",
  "query_capabilities",
] as const;

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const MESSAGE_TYPES = ["request", "response", "delegation", "broadcast", "sync"] as const;

// Tool schema using TypeBox
const AgentFederationToolSchema = Type.Object({
  action: stringEnum(FEDERATION_ACTIONS, {
    description: "The federation action to perform",
  }),
  // Common parameters
  peerId: Type.Optional(Type.String({ description: "Target peer agent ID" })),
  message: Type.Optional(Type.String({ description: "Message content to send" })),
  context: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: "Additional context data",
    }),
  ),
  correlationId: Type.Optional(
    Type.String({ description: "Correlation ID for tracking conversations" }),
  ),
  priority: optionalStringEnum(PRIORITIES, {
    description: "Message priority level",
    default: "normal",
  }),
  // delegate-specific
  requiredCapabilities: Type.Optional(
    Type.Array(Type.String(), {
      description: "Required capabilities for task delegation",
    }),
  ),
  task: Type.Optional(Type.String({ description: "Task description for delegation" })),
  // register_peer-specific
  peerName: Type.Optional(Type.String({ description: "Human-readable peer name" })),
  peerUrl: Type.Optional(Type.String({ description: "WebSocket URL of the peer" })),
  peerToken: Type.Optional(Type.String({ description: "Authentication token for the peer" })),
  peerAgentId: Type.Optional(Type.String({ description: "Agent ID on the remote server" })),
  peerCapabilities: Type.Optional(
    Type.Array(Type.String(), { description: "Peer capabilities" }),
  ),
  peerDescription: Type.Optional(Type.String({ description: "Peer description" })),
  peerTimeoutMs: Type.Optional(
    Type.Number({ description: "Request timeout for this peer in milliseconds" }),
  ),
  // sync_context-specific
  syncData: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: "Context data to synchronize",
    }),
  ),
  // General timeout override
  timeoutMs: Type.Optional(
    Type.Number({ description: "Request timeout override in milliseconds" }),
  ),
});

export class AgentFederationClient {
  private config: FederationConfig;
  private dynamicPeers: Map<string, PeerAgent>;
  private serverId: string;

  constructor(config?: OpenClawConfig) {
    // Load federation config from main config
    const federationConfig = (config as any)?.federation;
    
    this.config = {
      enabled: federationConfig?.enabled ?? false,
      serverId: federationConfig?.serverId ?? `server-${randomUUID().slice(0, 8)}`,
      peers: federationConfig?.peers ?? [],
      defaultTimeoutMs: federationConfig?.defaultTimeoutMs ?? 30000,
      allowDynamicPeers: federationConfig?.allowDynamicPeers ?? true,
      requireAuth: federationConfig?.requireAuth ?? false,
    };

    this.dynamicPeers = new Map();
    this.serverId = this.config.serverId ?? `server-${randomUUID().slice(0, 8)}`;
  }

  private getAllPeers(): PeerAgent[] {
    const staticPeers = this.config.peers.filter((p) => p.enabled);
    const dynamicPeersList = Array.from(this.dynamicPeers.values()).filter((p) => p.enabled);
    return [...staticPeers, ...dynamicPeersList];
  }

  private findPeerById(peerId: string): PeerAgent | undefined {
    return (
      this.config.peers.find((p) => p.id === peerId) || this.dynamicPeers.get(peerId)
    );
  }

  private findPeersByCapabilities(capabilities: string[]): PeerAgent[] {
    const allPeers = this.getAllPeers();
    return allPeers.filter((peer) =>
      capabilities.every((cap) => peer.capabilities.includes(cap)),
    );
  }

  private createMessage(
    toAgent: string,
    type: FederationMessageType,
    content: string,
    options: {
      context?: Record<string, unknown>;
      correlationId?: string;
      priority?: Priority;
    } = {},
  ): FederationMessage {
    return {
      messageId: randomUUID(),
      fromAgent: "openclaw-agent",
      fromServer: this.serverId,
      toAgent,
      type,
      content,
      context: options.context,
      correlationId: options.correlationId,
      priority: options.priority ?? "normal",
      timestamp: Date.now(),
    };
  }

  private async sendToPeer(
    peer: PeerAgent,
    message: FederationMessage,
    timeoutMs?: number,
  ): Promise<any> {
    if (!this.config.enabled) {
      throw new Error("Federation is not enabled");
    }

    const timeout = timeoutMs ?? peer.timeoutMs ?? this.config.defaultTimeoutMs;

    try {
      // Use the gateway WebSocket protocol to communicate
      const result = await callGateway({
        url: peer.url,
        token: peer.token,
        method: "federation.relay",
        params: {
          targetAgent: peer.agentId,
          message,
        },
        timeoutMs: timeout,
        expectFinal: true,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to send message to peer ${peer.id}: ${errorMessage}`);
    }
  }

  async send(
    peerId: string,
    message: string,
    options: {
      context?: Record<string, unknown>;
      correlationId?: string;
      priority?: Priority;
      timeoutMs?: number;
    } = {},
  ): Promise<any> {
    const peer = this.findPeerById(peerId);
    if (!peer) {
      throw new Error(`Peer not found: ${peerId}`);
    }

    if (!peer.enabled) {
      throw new Error(`Peer is disabled: ${peerId}`);
    }

    const federationMessage = this.createMessage(peer.agentId, "request", message, {
      context: options.context,
      correlationId: options.correlationId,
      priority: options.priority,
    });

    return await this.sendToPeer(peer, federationMessage, options.timeoutMs);
  }

  async delegate(
    requiredCapabilities: string[],
    task: string,
    options: {
      context?: Record<string, unknown>;
      correlationId?: string;
      priority?: Priority;
      timeoutMs?: number;
    } = {},
  ): Promise<any> {
    const matchingPeers = this.findPeersByCapabilities(requiredCapabilities);

    if (matchingPeers.length === 0) {
      throw new Error(
        `No peer found with required capabilities: ${requiredCapabilities.join(", ")}`,
      );
    }

    // Select the first matching peer (could be enhanced with load balancing)
    const selectedPeer = matchingPeers[0];

    const federationMessage = this.createMessage(selectedPeer.agentId, "delegation", task, {
      context: {
        ...options.context,
        requiredCapabilities,
      },
      correlationId: options.correlationId,
      priority: options.priority,
    });

    return await this.sendToPeer(selectedPeer, federationMessage, options.timeoutMs);
  }

  async broadcast(
    message: string,
    options: {
      context?: Record<string, unknown>;
      correlationId?: string;
      priority?: Priority;
      timeoutMs?: number;
    } = {},
  ): Promise<any[]> {
    const peers = this.getAllPeers();

    if (peers.length === 0) {
      throw new Error("No peers available for broadcast");
    }

    const results = await Promise.allSettled(
      peers.map(async (peer) => {
        const federationMessage = this.createMessage(peer.agentId, "broadcast", message, {
          context: options.context,
          correlationId: options.correlationId,
          priority: options.priority,
        });
        return await this.sendToPeer(peer, federationMessage, options.timeoutMs);
      }),
    );

    return results.map((result, index) => ({
      peerId: peers[index].id,
      status: result.status,
      value: result.status === "fulfilled" ? result.value : undefined,
      error: result.status === "rejected" ? result.reason : undefined,
    }));
  }

  async listPeers(): Promise<any> {
    const allPeers = this.getAllPeers();
    return {
      serverId: this.serverId,
      totalPeers: allPeers.length,
      peers: allPeers.map((peer) => ({
        id: peer.id,
        name: peer.name,
        url: peer.url,
        agentId: peer.agentId,
        capabilities: peer.capabilities,
        description: peer.description,
        enabled: peer.enabled,
        source: this.dynamicPeers.has(peer.id) ? "dynamic" : "static",
      })),
    };
  }

  async registerPeer(peerData: {
    id: string;
    name: string;
    url: string;
    token?: string;
    agentId: string;
    capabilities: string[];
    description?: string;
    timeoutMs?: number;
  }): Promise<any> {
    if (!this.config.allowDynamicPeers) {
      throw new Error("Dynamic peer registration is not allowed");
    }

    if (this.findPeerById(peerData.id)) {
      throw new Error(`Peer with ID ${peerData.id} already exists`);
    }

    const newPeer: PeerAgent = {
      ...peerData,
      enabled: true,
    };

    this.dynamicPeers.set(peerData.id, newPeer);

    return {
      status: "registered",
      peer: {
        id: newPeer.id,
        name: newPeer.name,
        url: newPeer.url,
        agentId: newPeer.agentId,
        capabilities: newPeer.capabilities,
      },
    };
  }

  async unregisterPeer(peerId: string): Promise<any> {
    if (!this.config.allowDynamicPeers) {
      throw new Error("Dynamic peer management is not allowed");
    }

    // Only allow removal of dynamic peers
    if (!this.dynamicPeers.has(peerId)) {
      throw new Error(
        `Peer ${peerId} is not a dynamic peer or does not exist. Static peers must be removed from config.`,
      );
    }

    this.dynamicPeers.delete(peerId);

    return {
      status: "unregistered",
      peerId,
    };
  }

  async syncContext(
    peerId: string,
    syncData: Record<string, unknown>,
    options: {
      correlationId?: string;
      priority?: Priority;
      timeoutMs?: number;
    } = {},
  ): Promise<any> {
    const peer = this.findPeerById(peerId);
    if (!peer) {
      throw new Error(`Peer not found: ${peerId}`);
    }

    if (!peer.enabled) {
      throw new Error(`Peer is disabled: ${peerId}`);
    }

    const federationMessage = this.createMessage(
      peer.agentId,
      "sync",
      "Context synchronization",
      {
        context: syncData,
        correlationId: options.correlationId,
        priority: options.priority,
      },
    );

    return await this.sendToPeer(peer, federationMessage, options.timeoutMs);
  }

  async queryCapabilities(peerId: string, timeoutMs?: number): Promise<any> {
    const peer = this.findPeerById(peerId);
    if (!peer) {
      throw new Error(`Peer not found: ${peerId}`);
    }

    if (!peer.enabled) {
      throw new Error(`Peer is disabled: ${peerId}`);
    }

    // Return cached capabilities from config
    // In a real implementation, this could query the remote agent
    return {
      peerId: peer.id,
      peerName: peer.name,
      capabilities: peer.capabilities,
      description: peer.description,
    };
  }
}

export function createAgentFederationTool(options?: {
  config?: OpenClawConfig;
}): AnyAgentTool {
  const client = new AgentFederationClient(options?.config);

  return {
    label: "Agent Federation",
    name: "agent_federation",
    description:
      "Communicate with other OpenClaw agents running on different servers. Supports sending messages, delegating tasks based on capabilities, broadcasting to all peers, managing peer connections, and synchronizing context for collaborative problem solving.",
    parameters: AgentFederationToolSchema,
    execute: async (_toolCallId, args, signal) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      // Check for cancellation
      if (signal?.aborted) {
        throw new Error("Operation cancelled");
      }

      switch (action) {
        case "send": {
          const peerId = readStringParam(params, "peerId", { required: true });
          const message = readStringParam(params, "message", { required: true });
          const context = params.context as Record<string, unknown> | undefined;
          const correlationId = readStringParam(params, "correlationId");
          const priority = readStringParam(params, "priority") as Priority | undefined;
          const timeoutMs = readNumberParam(params, "timeoutMs");

          const result = await client.send(peerId, message, {
            context,
            correlationId,
            priority,
            timeoutMs,
          });

          return jsonResult({
            action: "send",
            peerId,
            status: "sent",
            result,
          });
        }

        case "delegate": {
          const requiredCapabilities = readStringArrayParam(params, "requiredCapabilities");
          if (!requiredCapabilities || requiredCapabilities.length === 0) {
            throw new Error("requiredCapabilities is required for delegation");
          }
          const task = readStringParam(params, "task", { required: true });
          const context = params.context as Record<string, unknown> | undefined;
          const correlationId = readStringParam(params, "correlationId");
          const priority = readStringParam(params, "priority") as Priority | undefined;
          const timeoutMs = readNumberParam(params, "timeoutMs");

          const result = await client.delegate(requiredCapabilities, task, {
            context,
            correlationId,
            priority,
            timeoutMs,
          });

          return jsonResult({
            action: "delegate",
            requiredCapabilities,
            task,
            status: "delegated",
            result,
          });
        }

        case "broadcast": {
          const message = readStringParam(params, "message", { required: true });
          const context = params.context as Record<string, unknown> | undefined;
          const correlationId = readStringParam(params, "correlationId");
          const priority = readStringParam(params, "priority") as Priority | undefined;
          const timeoutMs = readNumberParam(params, "timeoutMs");

          const results = await client.broadcast(message, {
            context,
            correlationId,
            priority,
            timeoutMs,
          });

          return jsonResult({
            action: "broadcast",
            status: "completed",
            results,
          });
        }

        case "list_peers": {
          const result = await client.listPeers();
          return jsonResult(result);
        }

        case "register_peer": {
          const peerId = readStringParam(params, "peerId", { required: true });
          const peerName = readStringParam(params, "peerName", { required: true });
          const peerUrl = readStringParam(params, "peerUrl", { required: true });
          const peerToken = readStringParam(params, "peerToken");
          const peerAgentId = readStringParam(params, "peerAgentId", { required: true });
          const peerCapabilities = readStringArrayParam(params, "peerCapabilities") ?? [];
          const peerDescription = readStringParam(params, "peerDescription");
          const peerTimeoutMs = readNumberParam(params, "peerTimeoutMs");

          const result = await client.registerPeer({
            id: peerId,
            name: peerName,
            url: peerUrl,
            token: peerToken,
            agentId: peerAgentId,
            capabilities: peerCapabilities,
            description: peerDescription,
            timeoutMs: peerTimeoutMs,
          });

          return jsonResult(result);
        }

        case "unregister_peer": {
          const peerId = readStringParam(params, "peerId", { required: true });
          const result = await client.unregisterPeer(peerId);
          return jsonResult(result);
        }

        case "sync_context": {
          const peerId = readStringParam(params, "peerId", { required: true });
          const syncData = params.syncData as Record<string, unknown> | undefined;
          if (!syncData) {
            throw new Error("syncData is required for context synchronization");
          }
          const correlationId = readStringParam(params, "correlationId");
          const priority = readStringParam(params, "priority") as Priority | undefined;
          const timeoutMs = readNumberParam(params, "timeoutMs");

          const result = await client.syncContext(peerId, syncData, {
            correlationId,
            priority,
            timeoutMs,
          });

          return jsonResult({
            action: "sync_context",
            peerId,
            status: "synchronized",
            result,
          });
        }

        case "query_capabilities": {
          const peerId = readStringParam(params, "peerId", { required: true });
          const timeoutMs = readNumberParam(params, "timeoutMs");
          const result = await client.queryCapabilities(peerId, timeoutMs);
          return jsonResult(result);
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
