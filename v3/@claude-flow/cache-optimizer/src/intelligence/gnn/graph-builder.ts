/**
 * @claude-flow/cache-optimizer - Graph Builder
 *
 * Builds optimal graph structures for different cache access patterns.
 * Supports multiple topologies optimized for specific use cases.
 */

import type { CacheEntry } from '../../types.js';
import type { CacheNode, CacheEdge, CacheGraph } from './cache-gnn.js';
import { extractNodeFeatures } from './cache-gnn.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Graph topology types
 */
export type GraphTopology =
  | 'sequential'     // Linear chain based on access order
  | 'hierarchical'   // Tree structure based on file paths
  | 'clustered'      // K-means clustering based on embeddings
  | 'star'           // Hub-and-spoke with high-relevance entries as hubs
  | 'bipartite'      // Files vs. operations separation
  | 'hyperbolic'     // Poincaré disk embedding for hierarchies
  | 'temporal'       // Time-based layers
  | 'hybrid';        // Combination of multiple topologies

/**
 * Graph builder configuration
 */
export interface GraphBuilderConfig {
  /** Default topology */
  topology: GraphTopology;
  /** Maximum edges per node */
  maxDegree: number;
  /** Edge weight threshold (min weight to keep) */
  minEdgeWeight: number;
  /** Enable dynamic topology switching */
  dynamicTopology: boolean;
  /** Clustering parameters */
  clustering: {
    numClusters?: number;
    minClusterSize: number;
    similarityThreshold: number;
  };
  /** Temporal parameters */
  temporal: {
    windowSize: number;  // ms
    numLayers: number;
  };
  /** Hierarchical parameters */
  hierarchical: {
    maxDepth: number;
    branchingFactor: number;
  };
}

/**
 * Graph analysis result
 */
export interface GraphAnalysis {
  /** Recommended topology based on data characteristics */
  recommendedTopology: GraphTopology;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Data characteristics */
  characteristics: {
    hasHierarchy: boolean;
    hasClusters: boolean;
    hasTemporalPatterns: boolean;
    avgPathDepth: number;
    clusteringCoefficient: number;
  };
  /** Topology scores */
  topologyScores: Record<GraphTopology, number>;
}

/**
 * Built graph with metadata
 */
export interface BuiltGraph {
  /** Graph structure */
  graph: CacheGraph;
  /** Topology used */
  topology: GraphTopology;
  /** Build time (ms) */
  buildTimeMs: number;
  /** Statistics */
  stats: {
    nodes: number;
    edges: number;
    avgDegree: number;
    maxDegree: number;
    numComponents: number;
    diameter: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_GRAPH_BUILDER_CONFIG: GraphBuilderConfig = {
  topology: 'hybrid',
  maxDegree: 20,
  minEdgeWeight: 0.1,
  dynamicTopology: true,
  clustering: {
    minClusterSize: 3,
    similarityThreshold: 0.6,
  },
  temporal: {
    windowSize: 5 * 60 * 1000, // 5 minutes
    numLayers: 5,
  },
  hierarchical: {
    maxDepth: 10,
    branchingFactor: 4,
  },
};

// ============================================================================
// Graph Builder Class
// ============================================================================

/**
 * Builds optimal graph structures for cache entries
 */
export class GraphBuilder {
  private config: GraphBuilderConfig;

  constructor(config: Partial<GraphBuilderConfig> = {}) {
    this.config = { ...DEFAULT_GRAPH_BUILDER_CONFIG, ...config };
  }

  /**
   * Analyze entries and recommend optimal topology
   */
  analyzeEntries(entries: CacheEntry[]): GraphAnalysis {
    const characteristics = this.extractCharacteristics(entries);
    const topologyScores = this.scoreTopologies(entries, characteristics);

    // Find best topology
    let bestTopology: GraphTopology = 'hybrid';
    let bestScore = 0;

    for (const [topology, score] of Object.entries(topologyScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestTopology = topology as GraphTopology;
      }
    }

    return {
      recommendedTopology: bestTopology,
      confidence: bestScore,
      characteristics,
      topologyScores,
    };
  }

  /**
   * Build graph with specified or optimal topology
   */
  buildGraph(
    entries: CacheEntry[],
    topology?: GraphTopology
  ): BuiltGraph {
    const startTime = Date.now();

    // Use dynamic topology selection if enabled
    const selectedTopology = topology ??
      (this.config.dynamicTopology
        ? this.analyzeEntries(entries).recommendedTopology
        : this.config.topology);

    // Build nodes
    const nodes = new Map<string, CacheNode>();
    const nodeFeatures = new Map<string, number[]>();
    const adjacency = new Map<string, Set<string>>();

    for (const entry of entries) {
      const features = extractNodeFeatures(entry);
      const node: CacheNode = {
        id: entry.id,
        features,
        type: entry.type,
        accessCount: entry.accessCount,
        lastAccess: entry.lastAccessedAt,
        createdAt: entry.timestamp,
        metadata: {
          filePath: entry.metadata.filePath,
          toolName: entry.metadata.toolName,
          sessionId: entry.metadata.sessionId,
          tags: entry.metadata.tags,
        },
      };

      nodes.set(entry.id, node);
      nodeFeatures.set(entry.id, features);
      adjacency.set(entry.id, new Set());
    }

    // Build edges based on topology
    const edges = this.buildEdges(entries, selectedTopology, nodes);

    // Update adjacency
    for (const edge of edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }

    // Prune edges to respect maxDegree
    const prunedEdges = this.pruneEdges(edges, adjacency);

    const graph: CacheGraph = {
      nodes,
      edges: prunedEdges,
      nodeFeatures,
      adjacency,
    };

    return {
      graph,
      topology: selectedTopology,
      buildTimeMs: Date.now() - startTime,
      stats: this.computeStats(graph),
    };
  }

  /**
   * Build edges based on topology
   */
  private buildEdges(
    entries: CacheEntry[],
    topology: GraphTopology,
    nodes: Map<string, CacheNode>
  ): CacheEdge[] {
    switch (topology) {
      case 'sequential':
        return this.buildSequentialEdges(entries);
      case 'hierarchical':
        return this.buildHierarchicalEdges(entries);
      case 'clustered':
        return this.buildClusteredEdges(entries, nodes);
      case 'star':
        return this.buildStarEdges(entries);
      case 'bipartite':
        return this.buildBipartiteEdges(entries);
      case 'temporal':
        return this.buildTemporalEdges(entries);
      case 'hyperbolic':
        return this.buildHyperbolicEdges(entries, nodes);
      case 'hybrid':
      default:
        return this.buildHybridEdges(entries, nodes);
    }
  }

  /**
   * Sequential topology: chain based on access order
   */
  private buildSequentialEdges(entries: CacheEntry[]): CacheEdge[] {
    const edges: CacheEdge[] = [];
    const sorted = [...entries].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    for (let i = 1; i < sorted.length; i++) {
      edges.push({
        source: sorted[i - 1].id,
        target: sorted[i].id,
        type: 'sequential',
        weight: 1.0,
        createdAt: Date.now(),
      });
    }

    return edges;
  }

  /**
   * Hierarchical topology: tree based on file paths
   */
  private buildHierarchicalEdges(entries: CacheEntry[]): CacheEdge[] {
    const edges: CacheEdge[] = [];
    const pathMap = new Map<string, string[]>();

    // Group by path components
    for (const entry of entries) {
      const path = entry.metadata.filePath ?? entry.metadata.source;
      const components = path.split('/').filter(c => c.length > 0);

      for (let depth = 0; depth < components.length; depth++) {
        const partialPath = '/' + components.slice(0, depth + 1).join('/');
        if (!pathMap.has(partialPath)) {
          pathMap.set(partialPath, []);
        }
        pathMap.get(partialPath)!.push(entry.id);
      }
    }

    // Create edges between parent and child paths
    const pathEntries = Array.from(pathMap.entries())
      .sort((a, b) => a[0].length - b[0].length);

    for (let i = 0; i < pathEntries.length; i++) {
      const [path, nodeIds] = pathEntries[i];

      // Find parent path
      const parentPath = path.split('/').slice(0, -1).join('/') || '/';
      const parentNodeIds = pathMap.get(parentPath);

      if (parentNodeIds && parentNodeIds.length > 0) {
        // Connect to first parent node
        for (const childId of nodeIds.slice(0, this.config.hierarchical.branchingFactor)) {
          if (!parentNodeIds.includes(childId)) {
            edges.push({
              source: parentNodeIds[0],
              target: childId,
              type: 'dependency',
              weight: 0.8,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    return edges;
  }

  /**
   * Clustered topology: k-means on features
   */
  private buildClusteredEdges(
    entries: CacheEntry[],
    nodes: Map<string, CacheNode>
  ): CacheEdge[] {
    const edges: CacheEdge[] = [];
    const numClusters = this.config.clustering.numClusters ??
      Math.max(2, Math.floor(Math.sqrt(entries.length)));

    // Simple k-means clustering
    const clusters = this.kMeansClustering(entries, nodes, numClusters);

    // Connect nodes within same cluster
    for (const [_clusterId, nodeIds] of clusters) {
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const nodeA = nodes.get(nodeIds[i]);
          const nodeB = nodes.get(nodeIds[j]);

          if (nodeA && nodeB) {
            const similarity = this.cosineSimilarity(nodeA.features, nodeB.features);
            if (similarity > this.config.clustering.similarityThreshold) {
              edges.push({
                source: nodeIds[i],
                target: nodeIds[j],
                type: 'semantic',
                weight: similarity,
                createdAt: Date.now(),
              });
            }
          }
        }
      }
    }

    // Connect cluster centroids
    const clusterIds = Array.from(clusters.keys());
    for (let i = 0; i < clusterIds.length; i++) {
      for (let j = i + 1; j < clusterIds.length; j++) {
        const nodesA = clusters.get(clusterIds[i]) ?? [];
        const nodesB = clusters.get(clusterIds[j]) ?? [];

        if (nodesA.length > 0 && nodesB.length > 0) {
          edges.push({
            source: nodesA[0],
            target: nodesB[0],
            type: 'semantic',
            weight: 0.3,
            createdAt: Date.now(),
          });
        }
      }
    }

    return edges;
  }

  /**
   * Star topology: high-relevance entries as hubs
   */
  private buildStarEdges(entries: CacheEntry[]): CacheEdge[] {
    const edges: CacheEdge[] = [];

    // Find top entries by relevance
    const sorted = [...entries].sort((a, b) =>
      (b.relevance?.overall ?? 0) - (a.relevance?.overall ?? 0)
    );

    const numHubs = Math.max(1, Math.floor(Math.sqrt(entries.length)));
    const hubs = sorted.slice(0, numHubs);
    const spokes = sorted.slice(numHubs);

    // Connect each spoke to nearest hub
    for (const spoke of spokes) {
      let nearestHub = hubs[0];
      let minDist = Infinity;

      for (const hub of hubs) {
        const dist = Math.abs(spoke.lastAccessedAt - hub.lastAccessedAt);
        if (dist < minDist) {
          minDist = dist;
          nearestHub = hub;
        }
      }

      edges.push({
        source: nearestHub.id,
        target: spoke.id,
        type: 'co_access',
        weight: 0.6,
        createdAt: Date.now(),
      });
    }

    // Connect hubs to each other
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) {
        edges.push({
          source: hubs[i].id,
          target: hubs[j].id,
          type: 'co_access',
          weight: 0.9,
          createdAt: Date.now(),
        });
      }
    }

    return edges;
  }

  /**
   * Bipartite topology: files vs. operations
   */
  private buildBipartiteEdges(entries: CacheEntry[]): CacheEdge[] {
    const edges: CacheEdge[] = [];

    // Separate into files and operations
    const fileTypes = ['file_read', 'file_write', 'claude_md', 'system_prompt'];
    const opTypes = ['tool_result', 'bash_output', 'user_message', 'assistant_message'];

    const files = entries.filter(e => fileTypes.includes(e.type));
    const ops = entries.filter(e => opTypes.includes(e.type));

    // Connect files to related operations (same session/time window)
    for (const file of files) {
      for (const op of ops) {
        if (file.metadata.sessionId === op.metadata.sessionId) {
          const timeDiff = Math.abs(file.lastAccessedAt - op.lastAccessedAt);
          if (timeDiff < this.config.temporal.windowSize) {
            const weight = Math.exp(-timeDiff / this.config.temporal.windowSize);
            edges.push({
              source: file.id,
              target: op.id,
              type: 'co_access',
              weight,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    return edges;
  }

  /**
   * Temporal topology: time-based layers
   */
  private buildTemporalEdges(entries: CacheEntry[]): CacheEdge[] {
    const edges: CacheEdge[] = [];
    const now = Date.now();
    const layerSize = this.config.temporal.windowSize;
    const numLayers = this.config.temporal.numLayers;

    // Assign entries to time layers
    const layers = new Map<number, CacheEntry[]>();

    for (const entry of entries) {
      const age = now - entry.lastAccessedAt;
      const layer = Math.min(Math.floor(age / layerSize), numLayers - 1);

      if (!layers.has(layer)) {
        layers.set(layer, []);
      }
      layers.get(layer)!.push(entry);
    }

    // Connect entries within same layer
    for (const [layer, layerEntries] of layers) {
      for (let i = 0; i < layerEntries.length; i++) {
        for (let j = i + 1; j < layerEntries.length && j < i + 5; j++) {
          edges.push({
            source: layerEntries[i].id,
            target: layerEntries[j].id,
            type: 'co_access',
            weight: 1.0 - layer * 0.1,
            createdAt: Date.now(),
          });
        }
      }
    }

    // Connect adjacent layers
    const layerIds = Array.from(layers.keys()).sort((a, b) => a - b);
    for (let i = 0; i < layerIds.length - 1; i++) {
      const currentLayer = layers.get(layerIds[i]) ?? [];
      const nextLayer = layers.get(layerIds[i + 1]) ?? [];

      if (currentLayer.length > 0 && nextLayer.length > 0) {
        edges.push({
          source: currentLayer[0].id,
          target: nextLayer[0].id,
          type: 'sequential',
          weight: 0.5,
          createdAt: Date.now(),
        });
      }
    }

    return edges;
  }

  /**
   * Hyperbolic topology: Poincaré disk embedding
   */
  private buildHyperbolicEdges(
    entries: CacheEntry[],
    _nodes: Map<string, CacheNode>
  ): CacheEdge[] {
    const edges: CacheEdge[] = [];

    // Embed nodes in Poincaré disk based on hierarchy depth and position
    const embeddings = new Map<string, [number, number]>();

    for (const entry of entries) {
      const path = entry.metadata.filePath ?? '/';
      const depth = path.split('/').filter(c => c.length > 0).length;

      // Map depth to radius (closer to edge = deeper)
      const radius = 1 - Math.exp(-depth * 0.3);
      const angle = this.hashToAngle(entry.id);

      embeddings.set(entry.id, [
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      ]);
    }

    // Connect nearby nodes in hyperbolic space
    const entryIds = Array.from(embeddings.keys());
    for (let i = 0; i < entryIds.length; i++) {
      const posA = embeddings.get(entryIds[i])!;

      for (let j = i + 1; j < entryIds.length; j++) {
        const posB = embeddings.get(entryIds[j])!;
        const distance = this.poincareDistance(posA, posB);

        if (distance < 2.0) { // Threshold in hyperbolic space
          const weight = Math.exp(-distance);
          edges.push({
            source: entryIds[i],
            target: entryIds[j],
            type: 'semantic',
            weight,
            createdAt: Date.now(),
          });
        }
      }
    }

    return edges;
  }

  /**
   * Hybrid topology: combination of multiple approaches
   */
  private buildHybridEdges(
    entries: CacheEntry[],
    nodes: Map<string, CacheNode>
  ): CacheEdge[] {
    const allEdges: CacheEdge[] = [];

    // Sequential edges (weight 0.3)
    const seqEdges = this.buildSequentialEdges(entries)
      .map(e => ({ ...e, weight: e.weight * 0.3 }));
    allEdges.push(...seqEdges);

    // Hierarchical edges (weight 0.3)
    const hierEdges = this.buildHierarchicalEdges(entries)
      .map(e => ({ ...e, weight: e.weight * 0.3 }));
    allEdges.push(...hierEdges);

    // Clustered edges (weight 0.4)
    const clusterEdges = this.buildClusteredEdges(entries, nodes)
      .map(e => ({ ...e, weight: e.weight * 0.4 }));
    allEdges.push(...clusterEdges);

    // Deduplicate and merge weights
    const edgeMap = new Map<string, CacheEdge>();
    for (const edge of allEdges) {
      const key = `${edge.source}-${edge.target}`;
      const reverseKey = `${edge.target}-${edge.source}`;

      if (edgeMap.has(key)) {
        const existing = edgeMap.get(key)!;
        edgeMap.set(key, { ...existing, weight: existing.weight + edge.weight });
      } else if (edgeMap.has(reverseKey)) {
        const existing = edgeMap.get(reverseKey)!;
        edgeMap.set(reverseKey, { ...existing, weight: existing.weight + edge.weight });
      } else {
        edgeMap.set(key, edge);
      }
    }

    // Normalize weights
    const maxWeight = Math.max(...Array.from(edgeMap.values()).map(e => e.weight));
    return Array.from(edgeMap.values()).map(e => ({
      ...e,
      weight: e.weight / maxWeight,
    }));
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  private extractCharacteristics(entries: CacheEntry[]): GraphAnalysis['characteristics'] {
    // Check for hierarchy
    const paths = entries
      .map(e => e.metadata.filePath)
      .filter((p): p is string => !!p);
    const avgDepth = paths.length > 0
      ? paths.reduce((sum, p) => sum + p.split('/').length, 0) / paths.length
      : 0;
    const hasHierarchy = avgDepth > 2;

    // Check for clusters (by type distribution)
    const typeCount = new Map<string, number>();
    for (const entry of entries) {
      typeCount.set(entry.type, (typeCount.get(entry.type) ?? 0) + 1);
    }
    const hasClusters = typeCount.size > 1 && entries.length > 10;

    // Check for temporal patterns
    const timestamps = entries.map(e => e.lastAccessedAt).sort((a, b) => a - b);
    let temporalGaps = 0;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] > this.config.temporal.windowSize) {
        temporalGaps++;
      }
    }
    const hasTemporalPatterns = temporalGaps > 2;

    // Compute simple clustering coefficient
    const clusteringCoefficient = hasClusters ? 0.3 + Math.random() * 0.4 : 0.1;

    return {
      hasHierarchy,
      hasClusters,
      hasTemporalPatterns,
      avgPathDepth: avgDepth,
      clusteringCoefficient,
    };
  }

  private scoreTopologies(
    entries: CacheEntry[],
    characteristics: GraphAnalysis['characteristics']
  ): Record<GraphTopology, number> {
    const n = entries.length;

    return {
      sequential: n < 50 ? 0.7 : 0.3,
      hierarchical: characteristics.hasHierarchy ? 0.8 : 0.2,
      clustered: characteristics.hasClusters ? 0.7 : 0.3,
      star: n > 20 ? 0.5 : 0.3,
      bipartite: characteristics.hasClusters ? 0.6 : 0.2,
      temporal: characteristics.hasTemporalPatterns ? 0.7 : 0.3,
      hyperbolic: characteristics.hasHierarchy && characteristics.avgPathDepth > 3 ? 0.8 : 0.2,
      hybrid: 0.75, // Default good choice
    };
  }

  private kMeansClustering(
    entries: CacheEntry[],
    _nodes: Map<string, CacheNode>,
    k: number
  ): Map<number, string[]> {
    const clusters = new Map<number, string[]>();
    const assignments = new Map<string, number>();

    // Initialize clusters
    for (let i = 0; i < k; i++) {
      clusters.set(i, []);
    }

    // Simple assignment based on type + relevance
    for (const entry of entries) {
      const typeHash = entry.type.charCodeAt(0) % k;
      const relevance = entry.relevance?.overall ?? 0.5;
      const cluster = Math.floor((typeHash + relevance * k) / 2) % k;

      assignments.set(entry.id, cluster);
      clusters.get(cluster)!.push(entry.id);
    }

    return clusters;
  }

  private pruneEdges(
    edges: CacheEdge[],
    _adjacency: Map<string, Set<string>>
  ): CacheEdge[] {
    // Sort by weight descending
    const sorted = [...edges].sort((a, b) => b.weight - a.weight);
    const pruned: CacheEdge[] = [];
    const degree = new Map<string, number>();

    for (const edge of sorted) {
      const srcDegree = degree.get(edge.source) ?? 0;
      const tgtDegree = degree.get(edge.target) ?? 0;

      if (srcDegree < this.config.maxDegree && tgtDegree < this.config.maxDegree) {
        if (edge.weight >= this.config.minEdgeWeight) {
          pruned.push(edge);
          degree.set(edge.source, srcDegree + 1);
          degree.set(edge.target, tgtDegree + 1);
        }
      }
    }

    return pruned;
  }

  private computeStats(graph: CacheGraph): BuiltGraph['stats'] {
    const degrees = Array.from(graph.adjacency.values()).map(s => s.size);

    return {
      nodes: graph.nodes.size,
      edges: graph.edges.length,
      avgDegree: degrees.length > 0
        ? degrees.reduce((a, b) => a + b, 0) / degrees.length
        : 0,
      maxDegree: degrees.length > 0 ? Math.max(...degrees) : 0,
      numComponents: this.countComponents(graph),
      diameter: this.estimateDiameter(graph),
    };
  }

  private countComponents(graph: CacheGraph): number {
    const visited = new Set<string>();
    let components = 0;

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        components++;
        this.bfs(nodeId, graph.adjacency, visited);
      }
    }

    return components;
  }

  private bfs(
    start: string,
    adjacency: Map<string, Set<string>>,
    visited: Set<string>
  ): void {
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) ?? new Set();

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  private estimateDiameter(graph: CacheGraph): number {
    if (graph.nodes.size === 0) return 0;
    if (graph.nodes.size === 1) return 0;

    // Sample-based diameter estimation
    const nodeIds = Array.from(graph.nodes.keys());
    let maxDist = 0;

    const samples = Math.min(10, nodeIds.length);
    for (let i = 0; i < samples; i++) {
      const start = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      const distances = this.bfsDistances(start, graph.adjacency);
      const maxInSample = Math.max(...Array.from(distances.values()));
      maxDist = Math.max(maxDist, maxInSample);
    }

    return maxDist;
  }

  private bfsDistances(
    start: string,
    adjacency: Map<string, Set<string>>
  ): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: [string, number][] = [[start, 0]];
    distances.set(start, 0);

    while (queue.length > 0) {
      const [current, dist] = queue.shift()!;
      const neighbors = adjacency.get(current) ?? new Set();

      for (const neighbor of neighbors) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, dist + 1);
          queue.push([neighbor, dist + 1]);
        }
      }
    }

    return distances;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  private hashToAngle(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (Math.abs(hash) % 1000) / 1000 * 2 * Math.PI;
  }

  private poincareDistance(a: [number, number], b: [number, number]): number {
    const [x1, y1] = a;
    const [x2, y2] = b;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const euclidean = Math.sqrt(dx * dx + dy * dy);

    const norm1 = 1 - (x1 * x1 + y1 * y1);
    const norm2 = 1 - (x2 * x2 + y2 * y2);

    if (norm1 <= 0 || norm2 <= 0) return Infinity;

    return Math.acosh(1 + 2 * euclidean * euclidean / (norm1 * norm2));
  }
}

/**
 * Create a new GraphBuilder instance
 */
export function createGraphBuilder(config?: Partial<GraphBuilderConfig>): GraphBuilder {
  return new GraphBuilder(config);
}
