/**
 * Memory Infrastructure Layer - Public Exports
 *
 * Exports all infrastructure implementations including repositories,
 * adapters, and external service integrations.
 *
 * @module v3/memory/infrastructure
 */

// Repositories
export {
  HybridMemoryRepository,
  type HybridRepositoryConfig,
} from './repositories/hybrid-memory-repository.js';

// Re-export existing adapters
export { AgentDBAdapter, type AgentDBConfig } from '../agentdb-adapter.js';
export { HNSWIndex, type HNSWConfig } from '../hnsw-index.js';
export { CacheManager, type CacheConfig } from '../cache-manager.js';
export { MigrationManager } from '../migration.js';
