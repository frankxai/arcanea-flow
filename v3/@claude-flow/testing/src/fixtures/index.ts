/**
 * V3 Claude-Flow Test Fixtures Index
 *
 * Central export for all test fixtures
 */

// Agent fixtures (comprehensive)
export * from './agent-fixtures.js';

// Memory fixtures (AgentDB, HNSW, ReasoningBank)
export * from './memory-fixtures.js';

// Swarm fixtures (topologies, coordination, consensus)
export * from './swarm-fixtures.js';

// MCP fixtures (tools, resources, prompts)
export * from './mcp-fixtures.js';

// Legacy exports for backward compatibility
export * from './agents.js';
export * from './tasks.js';
export * from './memory-entries.js';
export * from './configurations.js';
