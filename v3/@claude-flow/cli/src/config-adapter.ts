/**
 * Configuration Adapter
 * Converts between SystemConfig and V3Config types
 */

import type { SystemConfig } from '@claude-flow/shared/core/config';
import type { V3Config } from './types.js';

/**
 * Convert SystemConfig to V3Config (CLI-specific format)
 */
export function systemConfigToV3Config(systemConfig: SystemConfig): V3Config {
  return {
    version: '3.0.0',
    projectRoot: systemConfig.orchestrator?.session?.dataDir || process.cwd(),

    // Agent configuration
    agents: {
      defaultType: 'coder',
      autoSpawn: systemConfig.orchestrator?.lifecycle?.autoStart ?? false,
      maxConcurrent: systemConfig.orchestrator?.lifecycle?.maxConcurrentAgents ?? 15,
      timeout: 300000, // 5 minutes default
      providers: [],
    },

    // Swarm configuration
    swarm: {
      topology: systemConfig.swarm?.topology || 'hierarchical-mesh',
      maxAgents: systemConfig.swarm?.maxAgents ?? 15,
      autoScale: systemConfig.swarm?.autoScale?.enabled ?? false,
      coordinationStrategy: systemConfig.swarm?.coordination?.consensusRequired ? 'consensus' : 'leader',
      healthCheckInterval: systemConfig.swarm?.coordination?.timeoutMs ?? 10000,
    },

    // Memory configuration
    memory: {
      backend: systemConfig.memory?.type || 'hybrid',
      persistPath: systemConfig.memory?.path || './data/memory',
      cacheSize: systemConfig.memory?.maxSize ?? 1000000,
      enableHNSW: systemConfig.memory?.agentdb?.indexType === 'hnsw',
      vectorDimension: systemConfig.memory?.agentdb?.dimensions ?? 1536,
    },

    // MCP configuration
    mcp: {
      serverHost: systemConfig.mcp?.transport?.host || 'localhost',
      serverPort: systemConfig.mcp?.transport?.port ?? 3000,
      autoStart: systemConfig.mcp?.enabled ?? false,
      transportType: systemConfig.mcp?.transport?.type || 'stdio',
      tools: systemConfig.mcp?.enabledTools || [],
    },

    // CLI preferences
    cli: {
      colorOutput: systemConfig.logging?.pretty ?? true,
      interactive: true,
      verbosity: systemConfig.logging?.level || 'normal',
      outputFormat: 'text',
      progressStyle: 'spinner',
    },

    // Hooks configuration
    hooks: {
      enabled: systemConfig.hooks?.enabled ?? false,
      autoExecute: systemConfig.hooks?.autoExecute ?? false,
      hooks: (systemConfig.hooks?.definitions || []).map(hook => ({
        name: hook.name,
        event: hook.event,
        handler: hook.handler,
        priority: hook.priority ?? 50,
        enabled: hook.enabled ?? true,
      })),
    },
  };
}

/**
 * Convert V3Config to SystemConfig
 */
export function v3ConfigToSystemConfig(v3Config: V3Config): Partial<SystemConfig> {
  return {
    orchestrator: {
      lifecycle: {
        autoStart: v3Config.agents.autoSpawn,
        maxConcurrentAgents: v3Config.agents.maxConcurrent,
        shutdownTimeoutMs: v3Config.agents.timeout,
        cleanupOrphanedAgents: true,
      },
      session: {
        dataDir: v3Config.projectRoot,
        persistState: true,
        stateFile: 'session.json',
      },
      monitoring: {
        enabled: true,
        metricsIntervalMs: 5000,
        healthCheckIntervalMs: v3Config.swarm.healthCheckInterval,
      },
    },

    swarm: {
      topology: v3Config.swarm.topology,
      maxAgents: v3Config.swarm.maxAgents,
      autoScale: {
        enabled: v3Config.swarm.autoScale,
        minAgents: 1,
        maxAgents: v3Config.swarm.maxAgents,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
      },
      coordination: {
        consensusRequired: v3Config.swarm.coordinationStrategy === 'consensus',
        timeoutMs: v3Config.swarm.healthCheckInterval,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 500,
        },
      },
      communication: {
        protocol: 'events',
        batchSize: 10,
        flushIntervalMs: 100,
      },
    },

    memory: {
      type: v3Config.memory.backend,
      path: v3Config.memory.persistPath,
      maxSize: v3Config.memory.cacheSize,
      agentdb: {
        dimensions: v3Config.memory.vectorDimension,
        indexType: v3Config.memory.enableHNSW ? 'hnsw' : 'flat',
        efConstruction: 200,
        m: 16,
        quantization: 'none',
      },
    },

    mcp: {
      enabled: v3Config.mcp.autoStart,
      transport: {
        type: v3Config.mcp.transportType,
        host: v3Config.mcp.serverHost,
        port: v3Config.mcp.serverPort,
      },
      enabledTools: v3Config.mcp.tools,
      security: {
        requireAuth: false,
        allowedOrigins: ['*'],
        rateLimiting: {
          enabled: true,
          maxRequestsPerMinute: 100,
        },
      },
    },

    logging: {
      level: v3Config.cli.verbosity,
      pretty: v3Config.cli.colorOutput,
      destination: 'console',
      format: 'text',
    },

    hooks: {
      enabled: v3Config.hooks.enabled,
      autoExecute: v3Config.hooks.autoExecute,
      definitions: v3Config.hooks.hooks.map(hook => ({
        name: hook.name,
        event: hook.event,
        handler: hook.handler,
        priority: hook.priority,
        enabled: hook.enabled,
      })),
    },
  };
}
