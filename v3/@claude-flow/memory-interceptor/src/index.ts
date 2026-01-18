/**
 * @claude-flow/memory-interceptor
 *
 * Intercept and redirect Claude Code memory operations to custom backends.
 *
 * @example MCP Registration
 * ```bash
 * claude mcp add memory-interceptor npx @claude-flow/memory-interceptor
 * ```
 *
 * @example Programmatic Usage
 * ```typescript
 * import { MemoryInterceptorServer, SQLiteBackend } from '@claude-flow/memory-interceptor';
 *
 * const backend = new SQLiteBackend({ dbPath: './my-memory.db' });
 * const server = new MemoryInterceptorServer({
 *   backend,
 *   hooks: {
 *     beforeStore: async (key, value) => {
 *       console.log('Storing:', key);
 *       return { key, value };
 *     },
 *   },
 * });
 *
 * await server.start();
 * ```
 *
 * @example Custom Backend
 * ```typescript
 * import { MemoryBackend } from '@claude-flow/memory-interceptor';
 *
 * class RedisBackend implements MemoryBackend {
 *   name = 'redis';
 *   // Implement interface...
 * }
 * ```
 */

export { MemoryInterceptorServer, startInterceptor, type InterceptorConfig } from './server.js';
export { SQLiteBackend, type SQLiteBackendOptions } from './backends/sqlite.js';
export type {
  MemoryBackend,
  MemoryEntry,
  SearchResult,
  MemoryStats,
  MemoryBackendConfig,
} from './backends/interface.js';
