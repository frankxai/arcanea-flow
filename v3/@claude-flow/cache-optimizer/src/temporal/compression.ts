/**
 * @claude-flow/cache-optimizer - Temporal Compression
 * RuVector-style temporal compression with Hot/Warm/Cold tiers
 */

import type {
  CacheEntry,
  TemporalTier,
  TemporalConfig,
  CompressedEntry,
  TierTransitionResult,
  CompressionStrategy,
} from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Temporal Compressor - Manages Hot/Warm/Cold tier transitions
 * Based on RuVector temporal compression strategy
 */
export class TemporalCompressor {
  private config: TemporalConfig;

  constructor(config: Partial<TemporalConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG.temporal,
      ...config,
      tiers: {
        ...DEFAULT_CONFIG.temporal.tiers,
        ...config.tiers,
      },
    };
  }

  /**
   * Determine the appropriate tier for an entry based on age
   */
  determineTier(entry: CacheEntry): TemporalTier {
    const now = Date.now();
    const age = now - entry.timestamp;

    // Check access-based promotion
    if (this.config.promoteOnAccess) {
      const timeSinceAccess = now - entry.lastAccessedAt;
      // If accessed recently, consider it hot
      if (timeSinceAccess < this.config.tiers.hot.maxAge) {
        return 'hot';
      }
    }

    // Determine tier based on age
    if (age < this.config.tiers.hot.maxAge) {
      return 'hot';
    } else if (age < this.config.tiers.warm.maxAge) {
      return 'warm';
    } else {
      return 'cold';
    }
  }

  /**
   * Check if an entry needs tier transition
   */
  needsTransition(entry: CacheEntry): boolean {
    const targetTier = this.determineTier(entry);
    return targetTier !== entry.tier;
  }

  /**
   * Compress an entry based on target tier
   */
  async compressEntry(
    entry: CacheEntry,
    targetTier: TemporalTier
  ): Promise<CompressedEntry | undefined> {
    // Hot tier doesn't need compression
    if (targetTier === 'hot') {
      return undefined;
    }

    const tierConfig = this.config.tiers[targetTier === 'archived' ? 'cold' : targetTier];
    const compressionRatio = tierConfig.compressionRatio;

    // If ratio is 1.0 (no compression), skip
    if (compressionRatio >= 1.0) {
      return undefined;
    }

    const originalTokens = entry.tokens;
    const targetTokens = Math.ceil(originalTokens * compressionRatio);

    // Apply compression based on strategy
    const compressed = await this.applyCompression(
      entry,
      targetTokens,
      this.config.compressionStrategy
    );

    return {
      method: this.config.compressionStrategy === 'embedding' ? 'embedding' : 'summary',
      summary: compressed.summary,
      compressedTokens: compressed.tokens,
      ratio: compressed.tokens / originalTokens,
      originalTokens,
      compressedAt: Date.now(),
    };
  }

  /**
   * Apply compression using the specified strategy
   */
  private async applyCompression(
    entry: CacheEntry,
    targetTokens: number,
    strategy: CompressionStrategy
  ): Promise<{ summary?: string; tokens: number }> {
    switch (strategy) {
      case 'summary':
        return this.applySummaryCompression(entry, targetTokens);
      case 'embedding':
        return this.applyEmbeddingCompression(entry);
      case 'hybrid':
        return this.applyHybridCompression(entry, targetTokens);
      default:
        return this.applySummaryCompression(entry, targetTokens);
    }
  }

  /**
   * Summary-based compression - extract key information
   */
  private async applySummaryCompression(
    entry: CacheEntry,
    targetTokens: number
  ): Promise<{ summary: string; tokens: number }> {
    const content = entry.content;

    // Simple extractive summarization based on content type
    let summary: string;

    switch (entry.type) {
      case 'file_read':
      case 'file_write':
        summary = this.summarizeCode(content, targetTokens);
        break;
      case 'tool_result':
      case 'bash_output':
        summary = this.summarizeToolOutput(content, targetTokens);
        break;
      case 'user_message':
      case 'assistant_message':
        summary = this.summarizeConversation(content, targetTokens);
        break;
      default:
        summary = this.extractKeyContent(content, targetTokens);
    }

    // Estimate tokens in summary (approximately 4 chars per token)
    const estimatedTokens = Math.ceil(summary.length / 4);

    return {
      summary,
      tokens: Math.min(targetTokens, estimatedTokens),
    };
  }

  /**
   * Embedding-based compression - store only vector representation
   */
  private async applyEmbeddingCompression(
    entry: CacheEntry
  ): Promise<{ tokens: number }> {
    // For embedding compression, we store only the reference
    // Actual content is retrievable via vector search
    // Token count is minimal (just metadata)
    return {
      tokens: 10, // Minimal token footprint for embedding reference
    };
  }

  /**
   * Hybrid compression - summary + embedding
   */
  private async applyHybridCompression(
    entry: CacheEntry,
    targetTokens: number
  ): Promise<{ summary: string; tokens: number }> {
    // Use 70% of target for summary, rest for embedding reference
    const summaryTargetTokens = Math.ceil(targetTokens * 0.7);
    const summaryResult = await this.applySummaryCompression(entry, summaryTargetTokens);

    return {
      summary: `[EMBEDDING:${entry.id}] ${summaryResult.summary}`,
      tokens: summaryResult.tokens + 5, // Add tokens for embedding reference
    };
  }

  /**
   * Summarize code content
   */
  private summarizeCode(content: string, targetTokens: number): string {
    const targetChars = targetTokens * 3.5; // Code is ~3.5 chars per token

    // Extract function signatures, class definitions, imports
    const lines = content.split('\n');
    const importantLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep function/class signatures, imports, exports
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('export ') ||
        trimmed.startsWith('function ') ||
        trimmed.startsWith('async function ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('type ') ||
        trimmed.match(/^(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/) || // Arrow functions
        trimmed.match(/^\w+\s*\([^)]*\)\s*[:{]/) // Method signatures
      ) {
        importantLines.push(trimmed);
      }
    }

    let result = importantLines.join('\n');
    if (result.length > targetChars) {
      result = result.substring(0, targetChars) + '...';
    }

    return `[CODE SUMMARY] ${result || content.substring(0, targetChars) + '...'}`;
  }

  /**
   * Summarize tool/bash output
   */
  private summarizeToolOutput(content: string, targetTokens: number): string {
    const targetChars = targetTokens * 3; // JSON/structured is ~3 chars per token

    // Try to extract key results
    if (content.startsWith('{') || content.startsWith('[')) {
      try {
        const parsed = JSON.parse(content);
        // Extract key fields
        const summary = this.extractJsonSummary(parsed, targetChars);
        return `[TOOL OUTPUT] ${summary}`;
      } catch {
        // Not valid JSON, fall through
      }
    }

    // For text output, extract first and last parts
    if (content.length > targetChars) {
      const half = Math.floor(targetChars / 2);
      return `[TOOL OUTPUT] ${content.substring(0, half)}...${content.substring(content.length - half)}`;
    }

    return `[TOOL OUTPUT] ${content}`;
  }

  /**
   * Summarize conversation content
   */
  private summarizeConversation(content: string, targetTokens: number): string {
    const targetChars = targetTokens * 4; // English is ~4 chars per token

    if (content.length <= targetChars) {
      return content;
    }

    // Extract key sentences (those with important keywords)
    const sentences = content.split(/[.!?]+/);
    const keywords = ['must', 'should', 'important', 'error', 'fix', 'implement', 'create', 'update', 'delete'];

    const importantSentences = sentences.filter(s =>
      keywords.some(kw => s.toLowerCase().includes(kw))
    );

    let result = importantSentences.join('. ');
    if (result.length > targetChars) {
      result = result.substring(0, targetChars) + '...';
    } else if (result.length < targetChars / 2) {
      // Not enough important sentences, add beginning and end
      result = content.substring(0, targetChars / 2) + '...' + result;
    }

    return `[CONV SUMMARY] ${result}`;
  }

  /**
   * Generic key content extraction
   */
  private extractKeyContent(content: string, targetTokens: number): string {
    const targetChars = targetTokens * 4;

    if (content.length <= targetChars) {
      return content;
    }

    return content.substring(0, targetChars) + '...';
  }

  /**
   * Extract summary from JSON object
   */
  private extractJsonSummary(obj: unknown, maxChars: number): string {
    if (typeof obj !== 'object' || obj === null) {
      return String(obj).substring(0, maxChars);
    }

    const keys = Object.keys(obj as Record<string, unknown>);
    const summary: string[] = [];
    let currentLength = 0;

    for (const key of keys) {
      const value = (obj as Record<string, unknown>)[key];
      const entry = `${key}: ${typeof value === 'object' ? '[object]' : String(value).substring(0, 50)}`;

      if (currentLength + entry.length > maxChars) break;

      summary.push(entry);
      currentLength += entry.length + 2;
    }

    return summary.join(', ');
  }

  /**
   * Process all entries and perform tier transitions
   */
  async processTransitions(entries: CacheEntry[]): Promise<TierTransitionResult> {
    const startTime = Date.now();
    const result: TierTransitionResult = {
      hotToWarm: 0,
      warmToCold: 0,
      coldToArchived: 0,
      promoted: 0,
      tokensSaved: 0,
      durationMs: 0,
    };

    for (const entry of entries) {
      const targetTier = this.determineTier(entry);

      if (targetTier === entry.tier) continue;

      const oldTokens = entry.compressed?.compressedTokens ?? entry.tokens;

      // Compress if needed
      if (this.shouldCompress(entry.tier, targetTier)) {
        const compressed = await this.compressEntry(entry, targetTier);
        if (compressed) {
          entry.compressed = compressed;
          result.tokensSaved += oldTokens - compressed.compressedTokens;
        }
      }

      // Track transition
      if (entry.tier === 'hot' && targetTier === 'warm') {
        result.hotToWarm++;
      } else if (entry.tier === 'warm' && targetTier === 'cold') {
        result.warmToCold++;
      } else if (entry.tier === 'cold' && targetTier === 'archived') {
        result.coldToArchived++;
      } else if (this.isPromotion(entry.tier, targetTier)) {
        result.promoted++;
      }

      entry.tier = targetTier;
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Check if transition requires compression
   */
  private shouldCompress(currentTier: TemporalTier, targetTier: TemporalTier): boolean {
    const tierOrder: TemporalTier[] = ['hot', 'warm', 'cold', 'archived'];
    return tierOrder.indexOf(targetTier) > tierOrder.indexOf(currentTier);
  }

  /**
   * Check if transition is a promotion (toward hot)
   */
  private isPromotion(currentTier: TemporalTier, targetTier: TemporalTier): boolean {
    const tierOrder: TemporalTier[] = ['hot', 'warm', 'cold', 'archived'];
    return tierOrder.indexOf(targetTier) < tierOrder.indexOf(currentTier);
  }

  /**
   * Calculate decay factor for relevance scores
   */
  calculateDecay(tier: TemporalTier): number {
    const tierDecay: Record<TemporalTier, number> = {
      hot: 0,
      warm: this.config.decayRate,
      cold: this.config.decayRate * 2,
      archived: this.config.decayRate * 3,
    };
    return tierDecay[tier];
  }
}

export function createTemporalCompressor(config?: Partial<TemporalConfig>): TemporalCompressor {
  return new TemporalCompressor(config);
}
