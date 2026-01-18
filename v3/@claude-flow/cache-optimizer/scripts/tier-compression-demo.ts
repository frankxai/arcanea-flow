#!/usr/bin/env npx tsx
/**
 * Tier Compression Demo
 * Shows how entries move through hot → warm → cold tiers with compression
 */

import { CacheOptimizer } from '../src/core/orchestrator.js';
import type { CacheOptimizerConfig, CacheEntryType } from '../src/types.js';

process.env.CLAUDE_FLOW_HEADLESS = 'true';

const CONFIG: Partial<CacheOptimizerConfig> = {
  contextWindowSize: 50000,
  targetUtilization: 0.70,
  pruning: {
    softThreshold: 0.50,
    hardThreshold: 0.60,
    emergencyThreshold: 0.70,
    minRelevanceScore: 0.20,
    strategy: 'adaptive',
    preservePatterns: ['system_prompt'],
    preserveRecentCount: 2,
  },
  temporal: {
    tiers: {
      // Very short ages for demo
      hot: { maxAge: 100, compressionRatio: 1.0 },     // 100ms
      warm: { maxAge: 300, compressionRatio: 0.25 },   // 300ms
      cold: { maxAge: Infinity, compressionRatio: 0.03 },
    },
    compressionStrategy: 'hybrid',
    promoteOnAccess: true,
    decayRate: 0.3,
  },
};

function generateContent(index: number): string {
  return `/**
 * Component ${index}
 * This is a large code block that will be compressed as it ages
 */
export function component${index}() {
  const data = fetchData('endpoint${index}');
  const processed = transform(data, {
    option1: true,
    option2: false,
    threshold: ${index * 10}
  });
  return { result: processed, timestamp: Date.now() };
}`;
}

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║              TIER COMPRESSION DEMONSTRATION                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const optimizer = new CacheOptimizer(CONFIG);

  console.log('Configuration:');
  console.log('  Hot tier:  < 100ms old, 100% size (no compression)');
  console.log('  Warm tier: 100-300ms old, 25% size (75% compression)');
  console.log('  Cold tier: > 300ms old, 3% size (97% compression)');
  console.log();

  // Add entries
  console.log('Phase 1: Adding 10 entries...\n');
  const entryTypes: CacheEntryType[] = ['file_read', 'tool_result', 'bash_output'];

  for (let i = 0; i < 10; i++) {
    await optimizer.add(generateContent(i), entryTypes[i % 3], {
      source: `demo:${i}`,
      sessionId: 'tier-demo',
    });
  }

  const printTierStatus = () => {
    const entries = optimizer.getEntries();
    const metrics = optimizer.getMetrics();
    const tierCounts = { hot: 0, warm: 0, cold: 0, archived: 0 };
    const tierTokens = { hot: 0, warm: 0, cold: 0, archived: 0 };

    entries.forEach(e => {
      tierCounts[e.tier]++;
      tierTokens[e.tier] += e.compressed?.compressedTokens ?? e.tokens;
    });

    console.log('  ┌─────────┬─────────┬────────────┬─────────────────────────────────┐');
    console.log('  │ Tier    │ Entries │ Tokens     │ Bar                             │');
    console.log('  ├─────────┼─────────┼────────────┼─────────────────────────────────┤');

    const maxTokens = Math.max(...Object.values(tierTokens), 1);
    for (const tier of ['hot', 'warm', 'cold'] as const) {
      const barLen = Math.round((tierTokens[tier] / maxTokens) * 30);
      const bar = '█'.repeat(barLen) + '░'.repeat(30 - barLen);
      console.log(`  │ ${tier.toUpperCase().padEnd(7)} │ ${tierCounts[tier].toString().padStart(7)} │ ${tierTokens[tier].toString().padStart(10)} │ ${bar} │`);
    }
    console.log('  └─────────┴─────────┴────────────┴─────────────────────────────────┘');
    console.log(`  Total: ${entries.length} entries, ${metrics.currentTokens} tokens, ${(metrics.utilization * 100).toFixed(1)}% utilization`);
  };

  console.log('Initial state (all entries are HOT):');
  printTierStatus();

  // Wait for entries to age to warm
  console.log('\n⏳ Waiting 150ms for entries to age...\n');
  await new Promise(r => setTimeout(r, 150));

  console.log('Phase 2: Triggering tier transitions...');
  let result = await optimizer.transitionTiers();
  console.log(`  Transitions: Hot→Warm: ${result.hotToWarm}, Warm→Cold: ${result.warmToCold}`);
  console.log(`  Tokens saved: ${result.tokensSaved}\n`);

  console.log('After first transition (some should be WARM):');
  printTierStatus();

  // Wait more for cold
  console.log('\n⏳ Waiting 250ms more for entries to age further...\n');
  await new Promise(r => setTimeout(r, 250));

  console.log('Phase 3: Triggering more tier transitions...');
  result = await optimizer.transitionTiers();
  console.log(`  Transitions: Hot→Warm: ${result.hotToWarm}, Warm→Cold: ${result.warmToCold}`);
  console.log(`  Tokens saved: ${result.tokensSaved}\n`);

  console.log('After second transition (some should be COLD):');
  printTierStatus();

  // Access one entry to promote it
  console.log('\n📖 Accessing entry 0 to promote it back to HOT...\n');
  optimizer.access('demo:0');

  // Trigger transitions again
  result = await optimizer.transitionTiers();

  console.log('After access (entry 0 promoted back to HOT):');
  printTierStatus();

  // Show compression savings
  console.log('\n' + '═'.repeat(70));
  console.log('COMPRESSION SAVINGS SUMMARY');
  console.log('═'.repeat(70));

  const entries = optimizer.getEntries();
  let originalTokens = 0;
  let compressedTokens = 0;

  for (const entry of entries) {
    originalTokens += entry.tokens;
    compressedTokens += entry.compressed?.compressedTokens ?? entry.tokens;
  }

  const savings = originalTokens - compressedTokens;
  const savingsPercent = ((savings / originalTokens) * 100).toFixed(1);

  console.log(`
  Original tokens:   ${originalTokens}
  Compressed tokens: ${compressedTokens}
  Savings:           ${savings} tokens (${savingsPercent}%)

  Without compression, these ${entries.length} entries would use ${originalTokens} tokens.
  With tier compression, they only use ${compressedTokens} tokens.

  ✅ This is how tier compression helps prevent compaction!
`);
}

main().catch(console.error);
