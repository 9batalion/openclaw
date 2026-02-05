import { z } from "zod";

/**
 * Schema for a peer agent configuration
 */
const PeerAgentSchema = z
  .object({
    id: z.string().min(1, "Peer ID is required"),
    name: z.string().min(1, "Peer name is required"),
    url: z
      .string()
      .url("Must be a valid WebSocket URL")
      .regex(/^wss?:\/\//, "URL must start with ws:// or wss://"),
    token: z.string().optional(),
    agentId: z.string().min(1, "Agent ID is required"),
    capabilities: z.array(z.string()).default([]),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict();

/**
 * Schema for federation configuration
 */
export const FederationConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    serverId: z.string().optional(),
    peers: z.array(PeerAgentSchema).default([]),
    defaultTimeoutMs: z.number().int().positive().default(30000),
    allowDynamicPeers: z.boolean().default(true),
    requireAuth: z.boolean().default(false),
  })
  .strict()
  .optional();
