# Agent Federation

OpenClaw's Agent Federation feature enables agents to communicate and collaborate with other agents running on different servers. This allows for distributed AI systems where agents can delegate tasks, share context, and work together on complex problems.

## Overview

Agent Federation provides:

- **Inter-agent messaging** - Send messages to specific remote agents
- **Capability-based delegation** - Route tasks to agents with specific skills
- **Broadcasting** - Send messages to all connected peers
- **Dynamic peer management** - Add/remove peers at runtime
- **Context synchronization** - Share state between collaborative agents
- **Capability discovery** - Query what remote agents can do

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your OpenClaw Instance                    │
│  ┌────────────┐         ┌──────────────────────────────┐   │
│  │   Agent    │────────▶│  Federation Client (Tool)    │   │
│  └────────────┘         └──────────────────────────────┘   │
│                                    │                          │
│                                    │ callGateway (WebSocket) │
└────────────────────────────────────┼──────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
         ┌──────────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
         │  Peer Agent 1   │  │ Peer Agent │  │ Peer Agent │
         │ (Research)      │  │ (Analysis) │  │ (Data)     │
         │ ws://host1:port │  │ ws://host2 │  │ ws://host3 │
         └─────────────────┘  └────────────┘  └────────────┘
```

## Configuration

Add the `federation` section to your OpenClaw configuration file:

### Basic Configuration

```yaml
federation:
  enabled: true
  serverId: "my-server-001"
  defaultTimeoutMs: 30000
  allowDynamicPeers: true
  requireAuth: false
  peers: []
```

### Full Configuration with Peers

```yaml
federation:
  enabled: true
  serverId: "main-agent-server"
  defaultTimeoutMs: 30000
  allowDynamicPeers: true
  requireAuth: false
  peers:
    - id: "research-agent"
      name: "Research Specialist"
      url: "ws://192.168.1.100:18789"
      token: "secret-token-123"
      agentId: "agent-research-01"
      capabilities:
        - "web-search"
        - "summarization"
        - "fact-checking"
      description: "Specialized in research and information gathering"
      enabled: true
      timeoutMs: 45000

    - id: "data-agent"
      name: "Data Analysis Agent"
      url: "ws://192.168.1.101:18789"
      token: "secret-token-456"
      agentId: "agent-data-01"
      capabilities:
        - "data-analysis"
        - "visualization"
        - "statistics"
      description: "Specialized in data processing and analysis"
      enabled: true
      timeoutMs: 60000

    - id: "code-agent"
      name: "Code Assistant"
      url: "wss://code-agent.example.com"
      token: "secret-token-789"
      agentId: "agent-code-01"
      capabilities:
        - "code-generation"
        - "debugging"
        - "refactoring"
      description: "Specialized in software development tasks"
      enabled: true
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable federation |
| `serverId` | string | auto-generated | Unique identifier for this server |
| `peers` | array | `[]` | List of peer agent configurations |
| `defaultTimeoutMs` | number | `30000` | Default timeout for federation requests (30s) |
| `allowDynamicPeers` | boolean | `true` | Allow runtime registration of new peers |
| `requireAuth` | boolean | `false` | Require authentication tokens for all peers |

### Peer Configuration

Each peer in the `peers` array has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the peer |
| `name` | string | Yes | Human-readable name |
| `url` | string | Yes | WebSocket URL (ws:// or wss://) |
| `token` | string | No | Authentication token |
| `agentId` | string | Yes | Agent ID on the remote server |
| `capabilities` | array | No | List of capability strings |
| `description` | string | No | What the agent specializes in |
| `enabled` | boolean | No | Enable/disable this peer (default: true) |
| `timeoutMs` | number | No | Request timeout override |

## Tool Actions

The `agent_federation` tool provides the following actions:

### 1. send

Send a message to a specific peer agent.

**Parameters:**
- `action`: "send"
- `peerId`: ID of the target peer
- `message`: Message content
- `context` (optional): Additional context data
- `correlationId` (optional): For tracking conversations
- `priority` (optional): "low", "normal", "high", or "urgent"
- `timeoutMs` (optional): Override default timeout

**Example:**
```json
{
  "action": "send",
  "peerId": "research-agent",
  "message": "Please research the latest developments in quantum computing",
  "priority": "high",
  "correlationId": "research-task-001"
}
```

### 2. delegate

Delegate a task to an agent with specific capabilities. The system automatically selects a peer that matches the required capabilities.

**Parameters:**
- `action`: "delegate"
- `requiredCapabilities`: Array of required capability strings
- `task`: Task description
- `context` (optional): Additional context
- `correlationId` (optional): For tracking
- `priority` (optional): Priority level
- `timeoutMs` (optional): Timeout override

**Example:**
```json
{
  "action": "delegate",
  "requiredCapabilities": ["web-search", "summarization"],
  "task": "Find and summarize recent papers on AI safety",
  "priority": "normal"
}
```

### 3. broadcast

Send a message to all connected peer agents.

**Parameters:**
- `action`: "broadcast"
- `message`: Message to broadcast
- `context` (optional): Additional context
- `correlationId` (optional): For tracking
- `priority` (optional): Priority level
- `timeoutMs` (optional): Timeout override

**Example:**
```json
{
  "action": "broadcast",
  "message": "System maintenance scheduled in 1 hour",
  "priority": "urgent"
}
```

### 4. list_peers

List all registered peer agents and their capabilities.

**Parameters:**
- `action`: "list_peers"

**Example:**
```json
{
  "action": "list_peers"
}
```

**Response:**
```json
{
  "serverId": "main-agent-server",
  "totalPeers": 3,
  "peers": [
    {
      "id": "research-agent",
      "name": "Research Specialist",
      "url": "ws://192.168.1.100:18789",
      "agentId": "agent-research-01",
      "capabilities": ["web-search", "summarization", "fact-checking"],
      "description": "Specialized in research and information gathering",
      "enabled": true,
      "source": "static"
    }
  ]
}
```

### 5. register_peer

Dynamically register a new peer agent at runtime (requires `allowDynamicPeers: true`).

**Parameters:**
- `action`: "register_peer"
- `peerId`: Unique ID for the new peer
- `peerName`: Human-readable name
- `peerUrl`: WebSocket URL
- `peerAgentId`: Agent ID on remote server
- `peerToken` (optional): Authentication token
- `peerCapabilities` (optional): Array of capabilities
- `peerDescription` (optional): Description
- `peerTimeoutMs` (optional): Timeout override

**Example:**
```json
{
  "action": "register_peer",
  "peerId": "temp-agent-01",
  "peerName": "Temporary Analysis Agent",
  "peerUrl": "ws://192.168.1.200:18789",
  "peerAgentId": "agent-temp-01",
  "peerCapabilities": ["analysis", "reporting"],
  "peerDescription": "Temporary agent for special project"
}
```

### 6. unregister_peer

Remove a dynamically registered peer (only works for dynamic peers).

**Parameters:**
- `action`: "unregister_peer"
- `peerId`: ID of the peer to remove

**Example:**
```json
{
  "action": "unregister_peer",
  "peerId": "temp-agent-01"
}
```

### 7. sync_context

Synchronize context data with a peer for collaborative sessions.

**Parameters:**
- `action`: "sync_context"
- `peerId`: Target peer ID
- `syncData`: Context data to synchronize
- `correlationId` (optional): For tracking
- `priority` (optional): Priority level
- `timeoutMs` (optional): Timeout override

**Example:**
```json
{
  "action": "sync_context",
  "peerId": "data-agent",
  "syncData": {
    "projectId": "proj-123",
    "currentPhase": "analysis",
    "dataFiles": ["data1.csv", "data2.json"]
  }
}
```

### 8. query_capabilities

Query the capabilities of a specific peer agent.

**Parameters:**
- `action`: "query_capabilities"
- `peerId`: Target peer ID
- `timeoutMs` (optional): Timeout override

**Example:**
```json
{
  "action": "query_capabilities",
  "peerId": "research-agent"
}
```

**Response:**
```json
{
  "peerId": "research-agent",
  "peerName": "Research Specialist",
  "capabilities": ["web-search", "summarization", "fact-checking"],
  "description": "Specialized in research and information gathering"
}
```

## Message Priority Levels

| Priority | Description | Use Case |
|----------|-------------|----------|
| `low` | Background tasks | Non-urgent updates, logs |
| `normal` | Standard requests | Regular task delegation |
| `high` | Important tasks | Time-sensitive work |
| `urgent` | Critical messages | System alerts, emergencies |

## Security Considerations

### Authentication

1. **Token-based auth**: Use the `token` field in peer configuration for authentication
2. **Set `requireAuth: true`**: Force all peers to have authentication tokens
3. **Secure tokens**: Store tokens in environment variables or secure vaults
4. **Rotate tokens**: Regularly update authentication tokens

### Network Security

1. **Use TLS/SSL**: Prefer `wss://` over `ws://` for encrypted connections
2. **Firewall rules**: Restrict WebSocket access to trusted networks
3. **Private networks**: Use VPNs or private networks for peer communication
4. **Validate certificates**: Configure certificate validation for wss:// connections

### Access Control

1. **Capability filtering**: Only grant specific capabilities to trusted peers
2. **Disable unused peers**: Set `enabled: false` for peers not in use
3. **Dynamic peer control**: Set `allowDynamicPeers: false` to prevent runtime registration
4. **Monitor federation**: Log and audit all federation activities

### Best Practices

- **Limit peer count**: Only connect to necessary peers
- **Set timeouts**: Use appropriate timeouts to prevent hanging requests
- **Error handling**: Implement proper error handling for network failures
- **Rate limiting**: Consider implementing rate limits for federation requests
- **Input validation**: Validate all data received from remote peers

## Use Cases

### 1. Distributed Research

Split research tasks across specialized agents:

```yaml
# Main agent delegates to research specialists
federation:
  peers:
    - id: "research-web"
      capabilities: ["web-search", "scraping"]
    - id: "research-papers"
      capabilities: ["academic-search", "pdf-analysis"]
    - id: "research-social"
      capabilities: ["social-media", "sentiment-analysis"]
```

### 2. Multi-Stage Processing

Chain agents for complex workflows:

```
User Query → Main Agent → Data Agent → Analysis Agent → Visualization Agent → Response
```

### 3. Load Balancing

Distribute work across multiple identical agents:

```yaml
federation:
  peers:
    - id: "worker-1"
      capabilities: ["task-processing"]
    - id: "worker-2"
      capabilities: ["task-processing"]
    - id: "worker-3"
      capabilities: ["task-processing"]
```

### 4. Specialized Domains

Connect domain-specific expert agents:

- Medical agent for healthcare queries
- Legal agent for legal questions
- Financial agent for financial analysis
- Code agent for programming tasks

### 5. Geographic Distribution

Deploy agents in different regions for localized tasks:

```yaml
federation:
  peers:
    - id: "agent-us"
      capabilities: ["us-data", "local-search"]
    - id: "agent-eu"
      capabilities: ["eu-data", "local-search"]
    - id: "agent-asia"
      capabilities: ["asia-data", "local-search"]
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to peer agent

**Solutions**:
- Verify the peer URL is correct and accessible
- Check firewall rules and network connectivity
- Ensure the peer gateway is running
- Verify authentication tokens if `requireAuth` is enabled

### Timeout Errors

**Problem**: Federation requests timing out

**Solutions**:
- Increase `timeoutMs` for slow peers
- Check network latency
- Ensure peer agents are responsive
- Monitor peer agent resource usage

### Capability Matching

**Problem**: No peer found for delegation

**Solutions**:
- Verify capability strings match exactly (case-sensitive)
- Check that required peers are `enabled: true`
- Use `list_peers` to verify available capabilities
- Add missing capabilities to peer configurations

### Dynamic Peer Issues

**Problem**: Cannot register/unregister peers

**Solutions**:
- Ensure `allowDynamicPeers: true` in configuration
- Only unregister dynamic peers (not static config peers)
- Check for ID conflicts with existing peers

## Examples

### Example 1: Simple Research Task

```typescript
// Delegate research to a specialized agent
const result = await agent_federation({
  action: "delegate",
  requiredCapabilities: ["web-search", "summarization"],
  task: "Research the impact of AI on healthcare",
  priority: "high"
});
```

### Example 2: Collaborative Analysis

```typescript
// Sync context with data agent
await agent_federation({
  action: "sync_context",
  peerId: "data-agent",
  syncData: {
    projectId: "healthcare-ai-2024",
    dataSource: "medical-records.csv",
    analysisType: "predictive"
  }
});

// Send analysis request
const analysis = await agent_federation({
  action: "send",
  peerId: "data-agent",
  message: "Perform predictive analysis on synced data",
  correlationId: "healthcare-ai-2024"
});
```

### Example 3: System Broadcast

```typescript
// Notify all peers about system event
const results = await agent_federation({
  action: "broadcast",
  message: "New model version deployed: v2.5.0",
  priority: "normal"
});

// Check results
results.forEach(result => {
  console.log(`Peer ${result.peerId}: ${result.status}`);
});
```

### Example 4: Dynamic Peer Management

```typescript
// Register a temporary peer for a specific task
await agent_federation({
  action: "register_peer",
  peerId: "temp-translator",
  peerName: "Translation Agent",
  peerUrl: "ws://translator-service:18789",
  peerAgentId: "translator-01",
  peerCapabilities: ["translation", "language-detection"]
});

// Use the peer
const translation = await agent_federation({
  action: "send",
  peerId: "temp-translator",
  message: "Translate this text to Spanish: Hello, world!"
});

// Clean up when done
await agent_federation({
  action: "unregister_peer",
  peerId: "temp-translator"
});
```

## Federation Message Protocol

### Message Structure

```typescript
interface FederationMessage {
  messageId: string;           // Unique message ID (UUID)
  fromAgent: string;           // Sending agent ID
  fromServer: string;          // Sending server ID
  toAgent: string;             // Target agent ID
  type: "request" | "response" | "delegation" | "broadcast" | "sync";
  content: string;             // Message content
  context?: Record<string, unknown>;  // Additional context
  correlationId?: string;      // Conversation tracking
  priority?: "low" | "normal" | "high" | "urgent";
  timestamp: number;           // Unix timestamp
}
```

### Gateway Protocol

Federation uses the Gateway WebSocket protocol with the `federation.relay` method:

```typescript
{
  method: "federation.relay",
  params: {
    targetAgent: "agent-id",
    message: FederationMessage
  }
}
```

## Performance Considerations

- **Connection pooling**: Reuse WebSocket connections when possible
- **Timeouts**: Set appropriate timeouts based on task complexity
- **Batch operations**: Group multiple messages when appropriate
- **Async operations**: Federation requests are async; handle concurrency properly
- **Error handling**: Always handle network failures gracefully
- **Monitoring**: Track federation metrics (latency, success rate, errors)

## Future Enhancements

Potential future features:

- Automatic peer discovery via mDNS/DNS-SD
- Load balancing strategies (round-robin, least-loaded)
- Circuit breaker patterns for failing peers
- Peer health monitoring and auto-failover
- Distributed task queuing
- Message encryption at the application layer
- Peer capability versioning
- Federation mesh networking

## Related Documentation

- [Gateway Configuration](/gateway/configuration)
- [Agent Tools](/agents/tools)
- [Security Best Practices](/security)
- [WebSocket Protocol](/protocols/websocket)
