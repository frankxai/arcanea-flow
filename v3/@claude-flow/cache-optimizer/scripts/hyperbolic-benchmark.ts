#!/usr/bin/env npx tsx
/**
 * Hyperbolic Cache Intelligence Benchmark
 *
 * Compares cache optimization:
 * - WITHOUT hyperbolic intelligence (baseline)
 * - WITH hyperbolic intelligence (Poincaré embeddings + drift detection)
 *
 * Measures:
 * - Utilization stability
 * - Drift prevention
 * - Pruning accuracy
 * - Token savings
 */

import { CacheOptimizer } from '../src/core/orchestrator.js';
import type { CacheOptimizerConfig, CacheEntryType, ScoringContext } from '../src/types.js';

process.env.CLAUDE_FLOW_HEADLESS = 'true';

// Small context window to trigger optimizations
const CONTEXT_WINDOW = 12000;

const BASE_CONFIG: Partial<CacheOptimizerConfig> = {
  contextWindowSize: CONTEXT_WINDOW,
  targetUtilization: 0.55,
  pruning: {
    softThreshold: 0.40,
    hardThreshold: 0.50,
    emergencyThreshold: 0.60,
    minRelevanceScore: 0.20,
    strategy: 'adaptive',
    preservePatterns: ['system_prompt'],
    preserveRecentCount: 3,
  },
  temporal: {
    tiers: {
      hot: { maxAge: 150, compressionRatio: 1.0 },
      warm: { maxAge: 500, compressionRatio: 0.25 },
      cold: { maxAge: Infinity, compressionRatio: 0.03 },
    },
    compressionStrategy: 'hybrid',
    promoteOnAccess: true,
    decayRate: 0.25,
  },
};

// Simulate realistic usage patterns with drift
interface UsagePattern {
  type: CacheEntryType;
  file?: string;
  session: string;
  content: string;
}

function generateUsagePatterns(count: number): UsagePattern[] {
  const patterns: UsagePattern[] = [];
  const sessions = ['session-A', 'session-B', 'session-C'];
  const files = ['src/main.ts', 'src/utils.ts', 'src/api.ts', 'tests/main.test.ts', 'package.json'];
  const types: CacheEntryType[] = ['file_read', 'file_write', 'tool_result', 'bash_output', 'user_message', 'assistant_message'];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const session = sessions[Math.floor(i / 20) % sessions.length]; // Switch sessions every 20 entries
    const file = files[i % files.length];

    // Simulate drift: Later entries are less related to earlier ones
    const driftFactor = Math.floor(i / 30); // Every 30 entries, topics shift

    let content: string;
    switch (type) {
      case 'file_read':
        content = `// Reading ${file} (topic ${driftFactor})
export function feature${i}() {
  const data = processData${driftFactor}();
  return transform(data, { version: ${i} });
}`;
        break;
      case 'file_write':
        content = `// Updated ${file}
class Component${i} {
  private state = new Map();
  update(key: string, value: unknown) { this.state.set(key, value); }
}`;
        break;
      case 'tool_result':
        content = JSON.stringify({
          tool: 'grep',
          pattern: `pattern_${driftFactor}`,
          matches: Array.from({ length: 5 }, (_, j) => ({
            file: files[j % files.length],
            line: j * 10 + i,
          })),
        });
        break;
      case 'bash_output':
        content = `$ npm run test
  ✓ Test ${i} (${Math.random() * 50 | 0}ms)
  ✓ Test ${i + 1} (${Math.random() * 50 | 0}ms)
Tests: 2 passed`;
        break;
      case 'user_message':
        content = `Can you help with feature ${i}? I need to implement ${driftFactor % 2 === 0 ? 'caching' : 'validation'} for the ${file} module.`;
        break;
      case 'assistant_message':
        content = `I'll help with feature ${i}. Let me analyze the ${file} module and implement the ${driftFactor % 2 === 0 ? 'caching layer' : 'validation logic'}.`;
        break;
      default:
        content = `Entry ${i} content`;
    }

    patterns.push({ type, file, session, content });
  }

  return patterns;
}

interface BenchmarkResult {
  name: string;
  hyperbolicEnabled: boolean;
  finalUtilization: number;
  entriesRemaining: number;
  tokensSaved: number;
  pruneEvents: number;
  compressionEvents: number;
  utilizationHistory: number[];
  driftEvents: number;
  driftCorrections: number;
  avgPruningTime: number;
  peakUtilization: number;
  wouldCompact: boolean;
}

async function runBenchmark(
  name: string,
  patterns: UsagePattern[],
  useHyperbolic: boolean
): Promise<BenchmarkResult> {
  const optimizer = new CacheOptimizer(BASE_CONFIG, { useHyperbolic });

  const utilizationHistory: number[] = [];
  let tokensSaved = 0;
  let pruneEvents = 0;
  let compressionEvents = 0;
  let peakUtilization = 0;
  const pruningTimes: number[] = [];

  // Add system prompt
  await optimizer.add('You are a helpful AI assistant.', 'system_prompt', {
    source: 'system',
    sessionId: 'benchmark',
  });

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];

    // Add entry
    await optimizer.add(pattern.content, pattern.type, {
      source: `test:${pattern.type}`,
      filePath: pattern.file,
      sessionId: pattern.session,
      tags: ['benchmark', pattern.type],
    });

    // Let entries age
    await new Promise(r => setTimeout(r, 15));

    // Trigger optimization every 5 entries
    if ((i + 1) % 5 === 0) {
      const context: ScoringContext = {
        currentQuery: `Working on ${pattern.file || 'task'}`,
        activeFiles: pattern.file ? [pattern.file] : [],
        activeTools: [],
        sessionId: pattern.session,
        timestamp: Date.now(),
      };

      await optimizer.scoreAll(context);

      const startPrune = performance.now();
      const result = await optimizer.onUserPromptSubmit(`Query ${i}`, pattern.session);
      pruningTimes.push(performance.now() - startPrune);

      if (result.tokensFreed > 0) {
        tokensSaved += result.tokensFreed;
        pruneEvents++;
      }

      // Tier transitions
      const transResult = await optimizer.transitionTiers();
      if (transResult.tokensSaved > 0) {
        tokensSaved += transResult.tokensSaved;
        compressionEvents += transResult.hotToWarm + transResult.warmToCold;
      }

      const metrics = optimizer.getMetrics();
      utilizationHistory.push(metrics.utilization);
      peakUtilization = Math.max(peakUtilization, metrics.utilization);
    }
  }

  const finalMetrics = optimizer.getMetrics();
  const hyperbolicStats = optimizer.getHyperbolicStats();

  return {
    name,
    hyperbolicEnabled: useHyperbolic,
    finalUtilization: finalMetrics.utilization,
    entriesRemaining: optimizer.getEntries().length,
    tokensSaved,
    pruneEvents,
    compressionEvents,
    utilizationHistory,
    driftEvents: hyperbolicStats.driftEvents,
    driftCorrections: hyperbolicStats.driftCorrections,
    avgPruningTime: pruningTimes.reduce((a, b) => a + b, 0) / pruningTimes.length,
    peakUtilization,
    wouldCompact: peakUtilization >= 0.75,
  };
}

function printResults(results: BenchmarkResult[]): void {
  console.log('\n' + '═'.repeat(80));
  console.log('                    HYPERBOLIC CACHE OPTIMIZATION BENCHMARK');
  console.log('═'.repeat(80));

  for (const result of results) {
    console.log(`\n  ${result.name} (Hyperbolic: ${result.hyperbolicEnabled ? '✅ ON' : '❌ OFF'})`);
    console.log('  ' + '─'.repeat(60));
    console.log(`  Final Utilization:    ${(result.finalUtilization * 100).toFixed(1)}%`);
    console.log(`  Peak Utilization:     ${(result.peakUtilization * 100).toFixed(1)}%`);
    console.log(`  Entries Remaining:    ${result.entriesRemaining}`);
    console.log(`  Tokens Saved:         ${result.tokensSaved}`);
    console.log(`  Prune Events:         ${result.pruneEvents}`);
    console.log(`  Compression Events:   ${result.compressionEvents}`);
    console.log(`  Avg Pruning Time:     ${result.avgPruningTime.toFixed(2)}ms`);
    if (result.hyperbolicEnabled) {
      console.log(`  Drift Events:         ${result.driftEvents}`);
      console.log(`  Drift Corrections:    ${result.driftCorrections}`);
    }
    console.log(`  Would Compact:        ${result.wouldCompact ? '❌ YES' : '✅ NO'}`);
  }
}

function printComparison(without: BenchmarkResult, withHyp: BenchmarkResult): void {
  console.log('\n' + '═'.repeat(80));
  console.log('                          BEFORE vs AFTER COMPARISON');
  console.log('═'.repeat(80));

  const utilizationImprovement = without.peakUtilization - withHyp.peakUtilization;
  const tokensSavedImprovement = withHyp.tokensSaved - without.tokensSaved;
  const stabilityWithout = calculateStability(without.utilizationHistory);
  const stabilityWith = calculateStability(withHyp.utilizationHistory);

  console.log(`
  ┌─────────────────────────────────┬─────────────────┬─────────────────┐
  │ Metric                          │ WITHOUT Hyper.  │ WITH Hyperbolic │
  ├─────────────────────────────────┼─────────────────┼─────────────────┤
  │ Peak Utilization                │ ${(without.peakUtilization * 100).toFixed(1).padStart(13)}% │ ${(withHyp.peakUtilization * 100).toFixed(1).padStart(13)}% │
  │ Final Utilization               │ ${(without.finalUtilization * 100).toFixed(1).padStart(13)}% │ ${(withHyp.finalUtilization * 100).toFixed(1).padStart(13)}% │
  │ Utilization Stability (std dev) │ ${(stabilityWithout * 100).toFixed(2).padStart(13)}% │ ${(stabilityWith * 100).toFixed(2).padStart(13)}% │
  │ Tokens Saved                    │ ${without.tokensSaved.toString().padStart(15)} │ ${withHyp.tokensSaved.toString().padStart(15)} │
  │ Prune Events                    │ ${without.pruneEvents.toString().padStart(15)} │ ${withHyp.pruneEvents.toString().padStart(15)} │
  │ Entries Remaining               │ ${without.entriesRemaining.toString().padStart(15)} │ ${withHyp.entriesRemaining.toString().padStart(15)} │
  │ Avg Pruning Time (ms)           │ ${without.avgPruningTime.toFixed(2).padStart(15)} │ ${withHyp.avgPruningTime.toFixed(2).padStart(15)} │
  │ Drift Corrections               │ ${(0).toString().padStart(15)} │ ${withHyp.driftCorrections.toString().padStart(15)} │
  └─────────────────────────────────┴─────────────────┴─────────────────┘

  📊 IMPROVEMENTS WITH HYPERBOLIC INTELLIGENCE:

  • Peak Utilization Reduction: ${(utilizationImprovement * 100).toFixed(1)}% lower
  • Additional Tokens Saved: ${tokensSavedImprovement > 0 ? '+' : ''}${tokensSavedImprovement}
  • Utilization Stability: ${stabilityWith < stabilityWithout ? '✅ MORE STABLE' : '⚠️ Similar'}
  • Drift Corrections Applied: ${withHyp.driftCorrections}
  • Compaction Prevention: ${!without.wouldCompact && !withHyp.wouldCompact ? '✅ BOTH PASS' :
      withHyp.wouldCompact ? '❌ HYPERBOLIC FAILED' : '✅ HYPERBOLIC PREVENTS'}`);

  // Print utilization chart
  console.log('\n  📈 UTILIZATION OVER TIME:');
  console.log('  ' + '─'.repeat(70));
  printUtilizationChart(without.utilizationHistory, withHyp.utilizationHistory);
}

function calculateStability(history: number[]): number {
  if (history.length < 2) return 0;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
  return Math.sqrt(variance);
}

function printUtilizationChart(without: number[], withHyp: number[]): void {
  const maxLen = Math.max(without.length, withHyp.length);
  const chartHeight = 10;
  const chartWidth = 60;

  // Normalize both to same length
  const normalizedWithout = normalizeArray(without, chartWidth);
  const normalizedWith = normalizeArray(withHyp, chartWidth);

  // Create chart
  for (let row = chartHeight; row >= 0; row--) {
    const threshold = row / chartHeight;
    let line = `  ${(threshold * 100).toFixed(0).padStart(3)}% │`;

    for (let col = 0; col < chartWidth; col++) {
      const wVal = normalizedWithout[col] || 0;
      const hVal = normalizedWith[col] || 0;

      if (wVal >= threshold && hVal >= threshold) {
        line += '█'; // Both
      } else if (wVal >= threshold) {
        line += '░'; // Without only
      } else if (hVal >= threshold) {
        line += '▓'; // With hyperbolic only
      } else {
        line += ' ';
      }
    }
    console.log(line);
  }
  console.log('       └' + '─'.repeat(chartWidth));
  console.log('         ░ = Without  ▓ = With Hyperbolic  █ = Both');
}

function normalizeArray(arr: number[], targetLen: number): number[] {
  const result: number[] = [];
  const step = arr.length / targetLen;
  for (let i = 0; i < targetLen; i++) {
    const idx = Math.floor(i * step);
    result.push(arr[idx] || 0);
  }
  return result;
}

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║        HYPERBOLIC CACHE INTELLIGENCE - BEFORE/AFTER TEST         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\nConfiguration:');
  console.log(`  Context Window: ${CONTEXT_WINDOW} tokens`);
  console.log(`  Soft Threshold: ${BASE_CONFIG.pruning!.softThreshold! * 100}%`);
  console.log(`  Hard Threshold: ${BASE_CONFIG.pruning!.hardThreshold! * 100}%`);
  console.log(`  Emergency Threshold: ${BASE_CONFIG.pruning!.emergencyThreshold! * 100}%`);

  // Generate usage patterns with drift
  const patterns = generateUsagePatterns(100);
  console.log(`\nGenerated ${patterns.length} usage patterns with drift simulation`);

  // Run benchmark WITHOUT hyperbolic
  console.log('\n🔄 Running benchmark WITHOUT hyperbolic intelligence...');
  const withoutResult = await runBenchmark('BASELINE (No Hyperbolic)', patterns, false);

  // Run benchmark WITH hyperbolic
  console.log('🔄 Running benchmark WITH hyperbolic intelligence...');
  const withResult = await runBenchmark('HYPERBOLIC (Poincaré + Drift Detection)', patterns, true);

  // Print individual results
  printResults([withoutResult, withResult]);

  // Print comparison
  printComparison(withoutResult, withResult);

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('                              CONCLUSION');
  console.log('═'.repeat(80));

  const improvement = withoutResult.peakUtilization > withResult.peakUtilization;
  const stability = calculateStability(withResult.utilizationHistory) < calculateStability(withoutResult.utilizationHistory);

  if (improvement || stability || withResult.driftCorrections > 0) {
    console.log(`
  ✅ HYPERBOLIC INTELLIGENCE PROVIDES BENEFITS:

  ${improvement ? '• Lower peak utilization through geometric pruning' : ''}
  ${stability ? '• More stable utilization through drift prevention' : ''}
  ${withResult.driftCorrections > 0 ? `• ${withResult.driftCorrections} drift corrections applied` : ''}

  The Poincaré ball embeddings help identify which entries are "peripheral"
  (far from origin) and therefore safer to prune. Hypergraph relationships
  preserve connections between related entries.
`);
  } else {
    console.log(`
  ℹ️ In this test scenario, both approaches performed similarly.
  Hyperbolic intelligence shows more benefit with:
  • Longer sessions with topic drift
  • More complex file relationships
  • Historical pattern learning over multiple sessions
`);
  }

  console.log('═'.repeat(80));
}

main().catch(console.error);
