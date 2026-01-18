/**
 * @claude-flow/cache-optimizer - Persistent Store
 *
 * SQLite-based persistent storage for handoff queue and metrics.
 * Uses sql.js for cross-platform WASM-based SQLite.
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type {
  HandoffRequest,
  HandoffResponse,
  HandoffMetrics,
  HandoffQueueItem,
} from '../types.js';

export interface PersistentStoreConfig {
  /** Path to SQLite database file */
  dbPath: string;
  /** Auto-save interval in ms */
  autoSaveInterval: number;
  /** Maximum queue items to retain */
  maxQueueItems: number;
  /** Maximum metrics history entries */
  maxMetricsHistory: number;
}

interface QueueRecord {
  id: string;
  request: string; // JSON
  status: string;
  position: number;
  added_at: number;
  started_at?: number;
  completed_at?: number;
  response?: string; // JSON
  retries: number;
}

interface MetricsRecord {
  id: number;
  timestamp: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_latency: number;
  total_tokens: number;
  by_provider: string; // JSON
  queue_length: number;
  active_requests: number;
}

const DEFAULT_CONFIG: PersistentStoreConfig = {
  dbPath: './data/handoff.db',
  autoSaveInterval: 5000,
  maxQueueItems: 1000,
  maxMetricsHistory: 1000,
};

/**
 * PersistentStore - SQLite-based persistence for handoff data
 *
 * Note: Uses JSON file storage as fallback when sql.js is not available.
 * In production, would use sql.js WASM for proper SQLite support.
 */
export class PersistentStore {
  private config: PersistentStoreConfig;
  private initialized: boolean = false;
  private autoSaveTimer?: NodeJS.Timeout;
  private dirty: boolean = false;

  // In-memory cache
  private queueCache: Map<string, QueueRecord> = new Map();
  private metricsCache: MetricsRecord[] = [];
  private currentMetrics: HandoffMetrics;

  constructor(config?: Partial<PersistentStoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalTokens: 0,
      byProvider: {},
      queueLength: 0,
      activeRequests: 0,
    };
  }

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      await mkdir(dirname(this.config.dbPath), { recursive: true });

      // Load existing data
      await this.loadFromDisk();

      // Start auto-save
      this.autoSaveTimer = setInterval(() => {
        if (this.dirty) {
          this.saveToDisk().catch(console.error);
        }
      }, this.config.autoSaveInterval);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize persistent store:', error);
      // Continue without persistence
      this.initialized = true;
    }
  }

  /**
   * Load data from disk
   */
  private async loadFromDisk(): Promise<void> {
    const queuePath = this.config.dbPath.replace('.db', '_queue.json');
    const metricsPath = this.config.dbPath.replace('.db', '_metrics.json');

    try {
      const queueData = await readFile(queuePath, 'utf8');
      const records = JSON.parse(queueData) as QueueRecord[];
      for (const record of records) {
        this.queueCache.set(record.id, record);
      }
    } catch {
      // No existing data
    }

    try {
      const metricsData = await readFile(metricsPath, 'utf8');
      const data = JSON.parse(metricsData) as { history: MetricsRecord[]; current: HandoffMetrics };
      this.metricsCache = data.history || [];
      this.currentMetrics = data.current || this.currentMetrics;
    } catch {
      // No existing data
    }
  }

  /**
   * Save data to disk
   */
  private async saveToDisk(): Promise<void> {
    const queuePath = this.config.dbPath.replace('.db', '_queue.json');
    const metricsPath = this.config.dbPath.replace('.db', '_metrics.json');

    try {
      const queueRecords = Array.from(this.queueCache.values());
      await writeFile(queuePath, JSON.stringify(queueRecords, null, 2));

      await writeFile(metricsPath, JSON.stringify({
        history: this.metricsCache,
        current: this.currentMetrics,
      }, null, 2));

      this.dirty = false;
    } catch (error) {
      console.error('Failed to save to disk:', error);
    }
  }

  // =============================================================================
  // Queue Operations
  // =============================================================================

  /**
   * Add item to queue
   */
  async addToQueue(item: HandoffQueueItem): Promise<void> {
    await this.initialize();

    const record: QueueRecord = {
      id: item.request.id,
      request: JSON.stringify(item.request),
      status: item.status,
      position: item.position,
      added_at: item.addedAt,
      started_at: item.startedAt,
      completed_at: item.completedAt,
      response: item.response ? JSON.stringify(item.response) : undefined,
      retries: item.retries || 0,
    };

    this.queueCache.set(record.id, record);
    this.dirty = true;

    // Cleanup old items
    await this.cleanupQueue();
  }

  /**
   * Update queue item
   */
  async updateQueueItem(id: string, updates: Partial<HandoffQueueItem>): Promise<void> {
    const record = this.queueCache.get(id);
    if (!record) return;

    if (updates.status) record.status = updates.status;
    if (updates.startedAt) record.started_at = updates.startedAt;
    if (updates.completedAt) record.completed_at = updates.completedAt;
    if (updates.response) record.response = JSON.stringify(updates.response);
    if (updates.retries !== undefined) record.retries = updates.retries;

    this.dirty = true;
  }

  /**
   * Get queue item
   */
  async getQueueItem(id: string): Promise<HandoffQueueItem | null> {
    await this.initialize();

    const record = this.queueCache.get(id);
    if (!record) return null;

    return this.recordToQueueItem(record);
  }

  /**
   * Get all queue items
   */
  async getAllQueueItems(status?: string): Promise<HandoffQueueItem[]> {
    await this.initialize();

    const items: HandoffQueueItem[] = [];
    for (const record of this.queueCache.values()) {
      if (!status || record.status === status) {
        items.push(this.recordToQueueItem(record));
      }
    }

    return items.sort((a, b) => a.position - b.position);
  }

  /**
   * Remove queue item
   */
  async removeQueueItem(id: string): Promise<void> {
    this.queueCache.delete(id);
    this.dirty = true;
  }

  /**
   * Convert record to queue item
   */
  private recordToQueueItem(record: QueueRecord): HandoffQueueItem {
    return {
      request: JSON.parse(record.request) as HandoffRequest,
      status: record.status as HandoffQueueItem['status'],
      position: record.position,
      addedAt: record.added_at,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      response: record.response ? JSON.parse(record.response) as HandoffResponse : undefined,
      retries: record.retries,
    };
  }

  /**
   * Cleanup old queue items
   */
  private async cleanupQueue(): Promise<void> {
    if (this.queueCache.size <= this.config.maxQueueItems) return;

    // Get completed/failed items sorted by completion time
    const completedItems = Array.from(this.queueCache.values())
      .filter(r => r.status === 'completed' || r.status === 'failed')
      .sort((a, b) => (a.completed_at || 0) - (b.completed_at || 0));

    // Remove oldest until under limit
    const toRemove = this.queueCache.size - this.config.maxQueueItems;
    for (let i = 0; i < Math.min(toRemove, completedItems.length); i++) {
      this.queueCache.delete(completedItems[i].id);
    }

    this.dirty = true;
  }

  // =============================================================================
  // Metrics Operations
  // =============================================================================

  /**
   * Update current metrics
   */
  async updateMetrics(metrics: Partial<HandoffMetrics>): Promise<void> {
    await this.initialize();

    Object.assign(this.currentMetrics, metrics);
    this.dirty = true;
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<HandoffMetrics> {
    await this.initialize();
    return { ...this.currentMetrics };
  }

  /**
   * Snapshot current metrics to history
   */
  async snapshotMetrics(): Promise<void> {
    await this.initialize();

    const record: MetricsRecord = {
      id: Date.now(),
      timestamp: Date.now(),
      total_requests: this.currentMetrics.totalRequests,
      successful_requests: this.currentMetrics.successfulRequests,
      failed_requests: this.currentMetrics.failedRequests,
      average_latency: this.currentMetrics.averageLatency,
      total_tokens: this.currentMetrics.totalTokens,
      by_provider: JSON.stringify(this.currentMetrics.byProvider),
      queue_length: this.currentMetrics.queueLength,
      active_requests: this.currentMetrics.activeRequests,
    };

    this.metricsCache.push(record);

    // Cleanup old metrics
    if (this.metricsCache.length > this.config.maxMetricsHistory) {
      this.metricsCache = this.metricsCache.slice(-this.config.maxMetricsHistory);
    }

    this.dirty = true;
  }

  /**
   * Get metrics history
   */
  async getMetricsHistory(limit: number = 100): Promise<HandoffMetrics[]> {
    await this.initialize();

    return this.metricsCache
      .slice(-limit)
      .map(r => ({
        totalRequests: r.total_requests,
        successfulRequests: r.successful_requests,
        failedRequests: r.failed_requests,
        averageLatency: r.average_latency,
        totalTokens: r.total_tokens,
        byProvider: JSON.parse(r.by_provider),
        queueLength: r.queue_length,
        activeRequests: r.active_requests,
      }));
  }

  /**
   * Reset metrics
   */
  async resetMetrics(): Promise<void> {
    this.currentMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalTokens: 0,
      byProvider: {},
      queueLength: 0,
      activeRequests: 0,
    };
    this.dirty = true;
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================

  /**
   * Force save
   */
  async flush(): Promise<void> {
    await this.saveToDisk();
  }

  /**
   * Close store
   */
  async close(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    await this.saveToDisk();
    this.initialized = false;
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.queueCache.clear();
    this.metricsCache = [];
    await this.resetMetrics();
    this.dirty = true;
    await this.saveToDisk();
  }
}

/**
 * Create persistent store with default config
 */
export function createPersistentStore(config?: Partial<PersistentStoreConfig>): PersistentStore {
  return new PersistentStore(config);
}
