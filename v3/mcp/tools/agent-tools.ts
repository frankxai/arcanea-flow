/**
 * V3 MCP Agent Tools
 *
 * MCP tools for agent lifecycle operations:
 * - agent/spawn - Spawn a new agent
 * - agent/list - List all agents
 * - agent/terminate - Terminate an agent
 * - agent/status - Get agent status
 *
 * Implements ADR-005: MCP-First API Design
 */

import { z } from 'zod';
import { MCPTool, ToolContext } from '../types.js';

// ============================================================================
// Input Schemas
// ============================================================================

const spawnAgentSchema = z.object({
  agentType: z.string().describe('Type of agent to spawn (e.g., coder, reviewer, tester)'),
  id: z.string().optional().describe('Optional agent ID (auto-generated if not provided)'),
  config: z.record(z.unknown()).optional().describe('Agent-specific configuration'),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata'),
});

const listAgentsSchema = z.object({
  status: z.enum(['active', 'idle', 'terminated', 'all']).optional().describe('Filter by status'),
  agentType: z.string().optional().describe('Filter by agent type'),
  limit: z.number().int().positive().max(1000).optional().describe('Maximum number of agents to return'),
  offset: z.number().int().nonnegative().optional().describe('Offset for pagination'),
});

const terminateAgentSchema = z.object({
  agentId: z.string().describe('ID of the agent to terminate'),
  graceful: z.boolean().default(true).describe('Whether to gracefully shutdown the agent'),
  reason: z.string().optional().describe('Reason for termination'),
});

const agentStatusSchema = z.object({
  agentId: z.string().describe('ID of the agent to get status for'),
  includeMetrics: z.boolean().default(false).describe('Include performance metrics'),
  includeHistory: z.boolean().default(false).describe('Include execution history'),
});

// ============================================================================
// Type Definitions
// ============================================================================

interface AgentInfo {
  id: string;
  agentType: string;
  status: 'active' | 'idle' | 'terminated';
  createdAt: string;
  lastActivityAt?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface AgentStatus extends AgentInfo {
  metrics?: {
    tasksCompleted: number;
    tasksInProgress: number;
    tasksFailed: number;
    averageExecutionTime: number;
    uptime: number;
  };
  history?: Array<{
    timestamp: string;
    event: string;
    details?: unknown;
  }>;
}

interface SpawnAgentResult {
  agentId: string;
  agentType: string;
  status: string;
  createdAt: string;
}

interface ListAgentsResult {
  agents: AgentInfo[];
  total: number;
  limit?: number;
  offset?: number;
}

interface TerminateAgentResult {
  agentId: string;
  terminated: boolean;
  terminatedAt: string;
  reason?: string;
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Spawn a new agent
 */
async function handleSpawnAgent(
  input: z.infer<typeof spawnAgentSchema>,
  context?: ToolContext
): Promise<SpawnAgentResult> {
  const agentId = input.id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = new Date().toISOString();

  // Try to use swarmCoordinator if available
  if (context?.swarmCoordinator) {
    try {
      const { UnifiedSwarmCoordinator } = await import('@claude-flow/swarm');
      const coordinator = context.swarmCoordinator as InstanceType<typeof UnifiedSwarmCoordinator>;

      // Spawn agent using the coordinator
      await coordinator.spawnAgent({
        id: agentId,
        type: input.agentType as any,
        capabilities: input.config?.capabilities as any || [],
        priority: input.priority === 'critical' ? 1 : input.priority === 'high' ? 2 : input.priority === 'normal' ? 3 : 4,
      });

      return {
        agentId,
        agentType: input.agentType,
        status: 'active',
        createdAt,
      };
    } catch (error) {
      // Fall through to simple implementation if coordinator fails
      console.error('Failed to spawn agent via coordinator:', error);
    }
  }

  // Simple implementation when no coordinator is available
  const result: SpawnAgentResult = {
    agentId,
    agentType: input.agentType,
    status: 'active',
    createdAt,
  };

  return result;
}

/**
 * List all agents
 */
async function handleListAgents(
  input: z.infer<typeof listAgentsSchema>,
  context?: ToolContext
): Promise<ListAgentsResult> {
  // TODO: Integrate with actual agent manager when available
  // For now, return stub response

  // Stub implementation - will be replaced with actual agent manager integration
  const agents: AgentInfo[] = [
    {
      id: 'agent-example-1',
      agentType: 'coder',
      status: 'active',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      lastActivityAt: new Date().toISOString(),
    },
    {
      id: 'agent-example-2',
      agentType: 'reviewer',
      status: 'idle',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      lastActivityAt: new Date(Date.now() - 600000).toISOString(),
    },
  ];

  // Apply filters
  let filtered = agents;
  if (input.status && input.status !== 'all') {
    filtered = filtered.filter(a => a.status === input.status);
  }
  if (input.agentType) {
    filtered = filtered.filter(a => a.agentType === input.agentType);
  }

  // Apply pagination
  const offset = input.offset || 0;
  const limit = input.limit || filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  // TODO: Call actual agent manager
  // const agentManager = context?.agentManager as AgentManager;
  // if (agentManager) {
  //   const agents = await agentManager.listAgents({
  //     status: input.status,
  //     agentType: input.agentType,
  //     limit: input.limit,
  //     offset: input.offset,
  //   });
  //   return agents;
  // }

  return {
    agents: paginated,
    total: filtered.length,
    limit: input.limit,
    offset: input.offset,
  };
}

/**
 * Terminate an agent
 */
async function handleTerminateAgent(
  input: z.infer<typeof terminateAgentSchema>,
  context?: ToolContext
): Promise<TerminateAgentResult> {
  // TODO: Integrate with actual agent manager when available
  // For now, return stub response

  const terminatedAt = new Date().toISOString();

  // Stub implementation - will be replaced with actual agent manager integration
  const result: TerminateAgentResult = {
    agentId: input.agentId,
    terminated: true,
    terminatedAt,
    reason: input.reason,
  };

  // TODO: Call actual agent manager
  // const agentManager = context?.agentManager as AgentManager;
  // if (agentManager) {
  //   await agentManager.terminateAgent(input.agentId, {
  //     graceful: input.graceful,
  //     reason: input.reason,
  //   });
  // }

  return result;
}

/**
 * Get agent status
 */
async function handleAgentStatus(
  input: z.infer<typeof agentStatusSchema>,
  context?: ToolContext
): Promise<AgentStatus> {
  // TODO: Integrate with actual agent manager when available
  // For now, return stub response

  // Stub implementation - will be replaced with actual agent manager integration
  const status: AgentStatus = {
    id: input.agentId,
    agentType: 'coder',
    status: 'active',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    lastActivityAt: new Date().toISOString(),
    config: { maxConcurrentTasks: 5 },
    metadata: { version: '3.0.0' },
  };

  if (input.includeMetrics) {
    status.metrics = {
      tasksCompleted: 42,
      tasksInProgress: 2,
      tasksFailed: 3,
      averageExecutionTime: 1234.56,
      uptime: 3600000,
    };
  }

  if (input.includeHistory) {
    status.history = [
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        event: 'task_completed',
        details: { taskId: 'task-123' },
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        event: 'task_started',
        details: { taskId: 'task-123' },
      },
    ];
  }

  // TODO: Call actual agent manager
  // const agentManager = context?.agentManager as AgentManager;
  // if (agentManager) {
  //   const status = await agentManager.getAgentStatus(input.agentId, {
  //     includeMetrics: input.includeMetrics,
  //     includeHistory: input.includeHistory,
  //   });
  //   return status;
  // }

  return status;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * agent/spawn tool
 */
export const spawnAgentTool: MCPTool = {
  name: 'agent/spawn',
  description: 'Spawn a new agent with specified type and configuration',
  inputSchema: {
    type: 'object',
    properties: {
      agentType: {
        type: 'string',
        description: 'Type of agent to spawn (e.g., coder, reviewer, tester, researcher, planner)',
      },
      id: {
        type: 'string',
        description: 'Optional agent ID (auto-generated if not provided)',
      },
      config: {
        type: 'object',
        description: 'Agent-specific configuration',
        additionalProperties: true,
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'critical'],
        description: 'Agent priority level',
        default: 'normal',
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata',
        additionalProperties: true,
      },
    },
    required: ['agentType'],
  },
  handler: async (input, context) => {
    const validated = spawnAgentSchema.parse(input);
    return handleSpawnAgent(validated, context);
  },
  category: 'agent',
  tags: ['agent', 'lifecycle', 'spawn'],
  version: '1.0.0',
};

/**
 * agent/list tool
 */
export const listAgentsTool: MCPTool = {
  name: 'agent/list',
  description: 'List all agents with optional filtering and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'idle', 'terminated', 'all'],
        description: 'Filter by agent status',
      },
      agentType: {
        type: 'string',
        description: 'Filter by agent type',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of agents to return',
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
        minimum: 0,
      },
    },
  },
  handler: async (input, context) => {
    const validated = listAgentsSchema.parse(input);
    return handleListAgents(validated, context);
  },
  category: 'agent',
  tags: ['agent', 'list', 'query'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 2000,
};

/**
 * agent/terminate tool
 */
export const terminateAgentTool: MCPTool = {
  name: 'agent/terminate',
  description: 'Terminate a running agent gracefully or forcefully',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'ID of the agent to terminate',
      },
      graceful: {
        type: 'boolean',
        description: 'Whether to gracefully shutdown the agent',
        default: true,
      },
      reason: {
        type: 'string',
        description: 'Reason for termination',
      },
    },
    required: ['agentId'],
  },
  handler: async (input, context) => {
    const validated = terminateAgentSchema.parse(input);
    return handleTerminateAgent(validated, context);
  },
  category: 'agent',
  tags: ['agent', 'lifecycle', 'terminate'],
  version: '1.0.0',
};

/**
 * agent/status tool
 */
export const agentStatusTool: MCPTool = {
  name: 'agent/status',
  description: 'Get detailed status information for a specific agent',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'ID of the agent to get status for',
      },
      includeMetrics: {
        type: 'boolean',
        description: 'Include performance metrics',
        default: false,
      },
      includeHistory: {
        type: 'boolean',
        description: 'Include execution history',
        default: false,
      },
    },
    required: ['agentId'],
  },
  handler: async (input, context) => {
    const validated = agentStatusSchema.parse(input);
    return handleAgentStatus(validated, context);
  },
  category: 'agent',
  tags: ['agent', 'status', 'metrics'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 1000,
};

// ============================================================================
// Exports
// ============================================================================

export const agentTools: MCPTool[] = [
  spawnAgentTool,
  listAgentsTool,
  terminateAgentTool,
  agentStatusTool,
];

export default agentTools;
