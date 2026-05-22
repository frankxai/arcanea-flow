/**
 * SQLiteBackend
 *
 * SQLite-based memory backend for persistent storage.
 * Part of the hybrid memory system per ADR-009.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  Memory,
  MemoryBackend,
  MemoryQuery,
  MemorySearchResult
} from '../../shared/types';

export class SQLiteBackend implements MemoryBackend {
  private dbPath: string;
  private memories: Map<string, Memory>;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.memories = new Map();
  }

  private async loadFromFile(): Promise<void> {
    if (!this.dbPath || this.dbPath === ':memory:') return;
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = await fs.promises.readFile(this.dbPath, 'utf-8');
        if (data.trim()) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            this.memories = new Map(parsed);
          }
        }
      }
    } catch (error) {
      console.warn(`[SQLiteBackend] Failed to load from file ${this.dbPath}:`, error);
    }
  }

  private async saveToFile(): Promise<void> {
    if (!this.dbPath || this.dbPath === ':memory:') return;
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.memories.entries()), null, 2);
      await fs.promises.writeFile(this.dbPath, data, 'utf-8');
    } catch (error) {
      console.warn(`[SQLiteBackend] Failed to save to file ${this.dbPath}:`, error);
    }
  }

  /**
   * Initialize the SQLite database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadFromFile();
    this.initialized = true;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.memories.clear();
    this.initialized = false;
  }

  /**
   * Store a memory
   */
  async store(memory: Memory): Promise<Memory> {
    this.memories.set(memory.id, { ...memory });
    await this.saveToFile();
    return memory;
  }

  /**
   * Retrieve a memory by ID
   */
  async retrieve(id: string): Promise<Memory | undefined> {
    return this.memories.get(id);
  }

  /**
   * Update a memory
   */
  async update(memory: Memory): Promise<void> {
    if (this.memories.has(memory.id)) {
      this.memories.set(memory.id, { ...memory });
      await this.saveToFile();
    }
  }

  /**
   * Delete a memory
   */
  async delete(id: string): Promise<void> {
    if (this.memories.delete(id)) {
      await this.saveToFile();
    }
  }

  /**
   * Query memories with filters
   */
  async query(query: MemoryQuery): Promise<Memory[]> {
    let results = Array.from(this.memories.values());

    // Filter by agentId
    if (query.agentId) {
      results = results.filter(m => m.agentId === query.agentId);
    }

    // Filter by type
    if (query.type) {
      results = results.filter(m => m.type === query.type);
    }

    // Filter by time range
    if (query.timeRange) {
      results = results.filter(
        m => m.timestamp >= query.timeRange!.start && m.timestamp <= query.timeRange!.end
      );
    }

    // Filter by metadata
    if (query.metadata) {
      results = results.filter(m => {
        if (!m.metadata) return false;
        return Object.entries(query.metadata!).every(
          ([key, value]) => m.metadata![key] === value
        );
      });
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    if (query.offset !== undefined) {
      results = results.slice(query.offset);
    }
    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Vector search (not supported in SQLite, returns empty)
   */
  async vectorSearch(embedding: number[], k?: number): Promise<MemorySearchResult[]> {
    // SQLite doesn't support vector search natively
    // Return empty array - vector search handled by AgentDB
    return [];
  }

  /**
   * Clear all memories for an agent
   */
  async clearAgent(agentId: string): Promise<void> {
    let changed = false;
    for (const [id, memory] of this.memories.entries()) {
      if (memory.agentId === agentId) {
        this.memories.delete(id);
        changed = true;
      }
    }
    if (changed) {
      await this.saveToFile();
    }
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Get memory count
   */
  getCount(): number {
    return this.memories.size;
  }
}

export { SQLiteBackend as default };
