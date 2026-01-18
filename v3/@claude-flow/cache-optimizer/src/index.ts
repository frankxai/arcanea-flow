/**
 * @claude-flow/cache-optimizer
 * Intelligent Cache Optimization System (ICOS)
 *
 * Zero-compaction context management with RuVector temporal compression,
 * attention-based relevance scoring, and self-learning capabilities.
 *
 * Based on ADR-030: Claude Code Content Management Architecture
 *
 * @example
 * ```typescript
 * import { createCacheOptimizer } from '@claude-flow/cache-optimizer';
 *
 * const optimizer = createCacheOptimizer({
 *   targetUtilization: 0.75,
 *   pruning: { strategy: 'adaptive' }
 * });
 *
 * await optimizer.initialize();
 *
 * // Add entries
 * await optimizer.add(content, 'file_read', { filePath: '/path/to/file.ts' });
 *
 * // Handle hooks
 * const result = await optimizer.onUserPromptSubmit(prompt);
 * console.log(`Compaction prevented: ${result.compactionPrevented}`);
 * ```
 */

// =============================================================================
// Types - All type definitions
// =============================================================================
export * from './types.js';

// =============================================================================
// Core - Main CacheOptimizer and TokenCounter
// =============================================================================
export {
  CacheOptimizer,
  createCacheOptimizer,
} from './core/orchestrator.js';

export {
  TokenCounter,
  createTokenCounter,
} from './core/token-counter.js';

// =============================================================================
// Temporal - RuVector temporal compression
// =============================================================================
export {
  TemporalCompressor,
  createTemporalCompressor,
} from './temporal/compression.js';

// =============================================================================
// Intelligence - Attention-based scoring
// =============================================================================
export {
  FlashAttention,
  createFlashAttention,
} from './intelligence/attention/flash-attention.js';

// =============================================================================
// Hooks - Claude Code hook integration
// =============================================================================
export {
  handleUserPromptSubmit,
  handlePreToolUse,
  handlePostToolUse,
  handlePreCompact,
  handleMessageComplete,
  createHookConfig,
  getGlobalOptimizer,
  resetGlobalOptimizer,
  // Handoff hooks
  handleHandoffRequest,
  handleHandoffPoll,
  handleHandoffCancel,
  getHandoffMetrics,
  handleHandoffHealthCheck,
  createHandoffWorkflow,
  getGlobalHandoffManager,
  resetGlobalHandoffManager,
} from './hooks/handlers.js';

// =============================================================================
// Handoff - Background process model invocation
// =============================================================================
export {
  HandoffManager,
  handoff,
  BackgroundHandler,
  createHandoffChain,
  DEFAULT_HANDOFF_CONFIG,
} from './handoff/index.js';

// =============================================================================
// Benchmarks - Performance measurement
// =============================================================================
export {
  BenchmarkSuite,
  LatencyTracker,
  createBenchmarkSuite,
} from './benchmarks/metrics.js';

export type {
  BenchmarkReport,
  TargetMetric,
} from './benchmarks/metrics.js';

// =============================================================================
// Init - Project initialization and configuration profiles
// =============================================================================
export {
  init,
  reset,
  validate,
  status,
  isInitialized,
  getCurrentConfig,
  getProfileOptions,
  getProfile,
  listProfiles,
  detectRecommendedProfile,
  mergeWithProfile,
  PROFILES,
  SettingsManager,
  createSettingsManager,
  type InitOptions,
  type InitResult,
  type ProfileId,
  type Profile,
  type ProfileCacheConfig,
  type ProfileHandoffConfig,
  type HookConfiguration,
  type HookEntry,
  type ClaudeSettings,
  type SettingsManagerConfig,
} from './init/index.js';
