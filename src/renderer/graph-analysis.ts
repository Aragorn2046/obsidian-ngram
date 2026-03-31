/**
 * Graph analysis algorithms for cluster detection, gap analysis,
 * and node importance scoring.
 *
 * Pure computation — no DOM or Obsidian dependencies.
 */

import type { NodeDef, WireDef } from '../types';
import { getWireNodeIds } from './canvas';

// ─── Adjacency ──────────────────────────────────────────────

/** Build an undirected adjacency map from nodes and wires. */
export function buildAdjacency(
  nodes: NodeDef[],
  wires: WireDef[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  // Seed every node so isolates appear in the map
  for (const n of nodes) {
    adj.set(n.id, new Set());
  }

  for (const w of wires) {
    const { from, to } = getWireNodeIds(w);
    if (!adj.has(from)) adj.set(from, new Set());
    if (!adj.has(to)) adj.set(to, new Set());
    adj.get(from)!.add(to);
    adj.get(to)!.add(from);
  }

  return adj;
}

// ─── Community Detection (Label Propagation) ────────────────

/**
 * Detect clusters via label propagation.
 *
 * Each node starts with its own label. On every iteration each node
 * adopts the most frequent label among its neighbours (ties broken
 * by smallest label). Converges after at most 20 iterations or when
 * no label changes.
 */
export function detectClusters(
  nodes: NodeDef[],
  wires: WireDef[],
): Map<string, number> {
  const adj = buildAdjacency(nodes, wires);
  const ids = nodes.map((n) => n.id);

  // Initial labels: index-based
  const idToIdx = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) idToIdx.set(ids[i], i);

  const labels = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) labels.set(ids[i], i);

  const MAX_ITER = 20;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;

    // Shuffle order for better convergence
    const order = [...ids];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    for (const nodeId of order) {
      const neighbors = adj.get(nodeId);
      if (!neighbors || neighbors.size === 0) continue;

      // Count neighbour label frequencies
      const freq = new Map<number, number>();
      for (const nb of neighbors) {
        const lbl = labels.get(nb)!;
        freq.set(lbl, (freq.get(lbl) ?? 0) + 1);
      }

      // Pick the most frequent label (smallest label breaks ties)
      let bestLabel = labels.get(nodeId)!;
      let bestCount = 0;
      for (const [lbl, cnt] of freq) {
        if (cnt > bestCount || (cnt === bestCount && lbl < bestLabel)) {
          bestLabel = lbl;
          bestCount = cnt;
        }
      }

      if (bestLabel !== labels.get(nodeId)) {
        labels.set(nodeId, bestLabel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Normalise labels to contiguous 0..k-1
  const uniqueLabels = [...new Set(labels.values())].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  uniqueLabels.forEach((lbl, idx) => remap.set(lbl, idx));

  const result = new Map<string, number>();
  for (const [id, lbl] of labels) {
    result.set(id, remap.get(lbl)!);
  }

  return result;
}

// ─── Betweenness Centrality (Approximate, BFS-sampled) ──────

/**
 * Approximate betweenness centrality by running BFS from up to 50
 * randomly sampled source nodes. Returns normalised 0-1 scores.
 */
export function betweennessCentrality(
  nodes: NodeDef[],
  wires: WireDef[],
): Map<string, number> {
  const adj = buildAdjacency(nodes, wires);
  const ids = nodes.map((n) => n.id);
  const n = ids.length;

  if (n === 0) return new Map();

  const scores = new Map<string, number>();
  for (const id of ids) scores.set(id, 0);

  // Sample up to 50 source nodes
  const sampleSize = Math.min(50, n);
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sources = shuffled.slice(0, sampleSize);

  // Brandes-style BFS from each source
  for (const s of sources) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const sigma = new Map<string, number>(); // shortest-path counts
    const dist = new Map<string, number>();
    const delta = new Map<string, number>();

    for (const id of ids) {
      predecessors.set(id, []);
      sigma.set(id, 0);
      dist.set(id, -1);
      delta.set(id, 0);
    }

    sigma.set(s, 1);
    dist.set(s, 0);

    const queue: string[] = [s];
    let qi = 0;

    while (qi < queue.length) {
      const v = queue[qi++];
      stack.push(v);
      const dv = dist.get(v)!;

      const neighbors = adj.get(v);
      if (!neighbors) continue;

      for (const w of neighbors) {
        // First visit
        if (dist.get(w)! < 0) {
          dist.set(w, dv + 1);
          queue.push(w);
        }
        // Shortest path via v?
        if (dist.get(w) === dv + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          predecessors.get(w)!.push(v);
        }
      }
    }

    // Back-propagation
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of predecessors.get(w)!) {
        const contribution =
          (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
        delta.set(v, delta.get(v)! + contribution);
      }
      if (w !== s) {
        scores.set(w, scores.get(w)! + delta.get(w)!);
      }
    }
  }

  // Normalise to 0-1
  let max = 0;
  for (const v of scores.values()) {
    if (v > max) max = v;
  }

  const result = new Map<string, number>();
  for (const [id, v] of scores) {
    result.set(id, max > 0 ? v / max : 0);
  }

  return result;
}

// ─── Bridge Node Detection ──────────────────────────────────

/**
 * Find nodes whose neighbours span 2 or more different clusters.
 * These are "bridge" nodes that connect different communities.
 */
export function findBridgeNodes(
  nodes: NodeDef[],
  wires: WireDef[],
  clusters: Map<string, number>,
): Set<string> {
  const adj = buildAdjacency(nodes, wires);
  const bridges = new Set<string>();

  for (const [nodeId, neighbors] of adj) {
    const clusterSet = new Set<number>();
    const myCluster = clusters.get(nodeId);
    if (myCluster !== undefined) clusterSet.add(myCluster);

    for (const nb of neighbors) {
      const c = clusters.get(nb);
      if (c !== undefined) clusterSet.add(c);
    }

    if (clusterSet.size >= 2) {
      bridges.add(nodeId);
    }
  }

  return bridges;
}

// ─── Gap Detection ──────────────────────────────────────────

export interface GapSuggestion {
  nodeA: string;
  nodeB: string;
  sharedTags: string[];
  /** Node IDs of notes that both A and B link to (co-citation). */
  sharedLinks: string[];
  /**
   * Reserved for future use. Currently always [].
   * (Internal co-reference data — notes that link to both A and B — is
   * used in scoring but not exposed to the UI to avoid cluttering cards.)
   */
  sharedBacklinks: string[];
  /** Composite similarity score (0–1). */
  score: number;
  reason: string;
}

// English stopwords for content word filtering
const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'shall','can','not','no','nor','so','yet','both','either','each',
  'than','that','this','these','those','it','its','i','you','he','she',
  'we','they','what','which','who','whom','how','when','where','why',
  'all','any','few','more','most','other','some','such','as','if','then',
  'there','their','our','your','my','his','her','into','about','also',
  'up','out','over','after','before','between','through','during','under',
]);

/**
 * Extract significant lowercase words from a string (title or path).
 * Strips punctuation, filters stopwords, skips very short tokens.
 */
function extractWords(text: string): Set<string> {
  const words = new Set<string>();
  const tokens = text
    .toLowerCase()
    .replace(/[/_\-]/g, ' ')  // treat path separators as spaces
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/);
  for (const tok of tokens) {
    if (tok.length >= 3 && !STOPWORDS.has(tok)) {
      words.add(tok);
    }
  }
  return words;
}

/**
 * Jaccard similarity between two sets.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

/**
 * Returns true for content/topic tags; false for system metadata tags like
 * #Lang/en, #status/active, #type/reference. These namespace-prefixed tags
 * frequently appear across many notes and produce false gap signals.
 */
const METADATA_TAG_RE = /^#?(lang|language|status|type|year|date|source)\//i;
function isContentTag(tag: string): boolean {
  return !METADATA_TAG_RE.test(tag);
}

/**
 * Find the top folder segment of a node's path (first directory component).
 */
function topFolder(path: string | undefined): string {
  if (!path) return '';
  const slash = path.indexOf('/');
  return slash === -1 ? '' : path.slice(0, slash).toLowerCase();
}

/**
 * Content-aware gap detection. Identifies unlinked note pairs that are
 * topically related based on multiple signals:
 *
 *   1. Co-citation     — both notes link to a shared third note
 *   2. Co-reference    — the same note links to both of them
 *   3. Tag overlap     — shared YAML frontmatter tags
 *   4. Title similarity — word overlap in note titles / paths
 *
 * Returns top 30 suggestions sorted by composite score (descending).
 */
export function findGaps(
  nodes: NodeDef[],
  wires: WireDef[],
): GapSuggestion[] {
  if (nodes.length < 2) return [];

  // ─── Build adjacency structures ──────────────────────────

  // Direct-connection set (undirected, for exclusion)
  const connected = new Set<string>();
  // Directed out-neighbors: nodeId → Set of nodeIds it links to
  const outNeighbors = new Map<string, Set<string>>();
  // Directed in-neighbors: nodeId → Set of nodeIds that link to it
  const inNeighbors = new Map<string, Set<string>>();

  for (const n of nodes) {
    outNeighbors.set(n.id, new Set());
    inNeighbors.set(n.id, new Set());
  }

  for (const w of wires) {
    const { from, to } = getWireNodeIds(w);
    connected.add(`${from}|${to}`);
    connected.add(`${to}|${from}`);
    outNeighbors.get(from)?.add(to);
    inNeighbors.get(to)?.add(from);
  }

  // ─── Per-node derived data ───────────────────────────────

  const nodeTags = new Map<string, Set<string>>();
  const nodeWords = new Map<string, Set<string>>();

  for (const n of nodes) {
    nodeTags.set(n.id, new Set(n.tags ?? []));
    // Extract words from title + path for lightweight content similarity
    const words = extractWords(n.title);
    for (const w of extractWords(n.path ?? '')) words.add(w);
    nodeWords.set(n.id, words);
  }

  // ─── Candidate scoring ───────────────────────────────────
  // Score map: pairKey → running score + detail accumulators
  interface PairData {
    score: number;
    sharedLinks: Set<string>;
    sharedBacklinks: Set<string>;
    sharedTags: string[];
    titleJaccard: number;
  }

  const pairs = new Map<string, PairData>();

  const getPair = (a: string, b: string): PairData => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!pairs.has(key)) {
      pairs.set(key, {
        score: 0,
        sharedLinks: new Set(),
        sharedBacklinks: new Set(),
        sharedTags: [],
        titleJaccard: 0,
      });
    }
    return pairs.get(key)!;
  };

  // 1. Co-citation: for each note X, pair up all notes that link to X
  //    (i.e. share X as an out-neighbor)
  for (const [targetId, sources] of inNeighbors) {
    const sourceArr = [...sources];
    for (let i = 0; i < sourceArr.length; i++) {
      for (let j = i + 1; j < sourceArr.length; j++) {
        const a = sourceArr[i];
        const b = sourceArr[j];
        if (connected.has(`${a}|${b}`)) continue;
        const pd = getPair(a, b);
        pd.sharedLinks.add(targetId);
      }
    }
  }

  // 2. Co-reference: for each note X, pair up all notes that X links to
  //    (X links to both A and B → A and B are co-referenced by X)
  for (const [sourceId, targets] of outNeighbors) {
    const targetArr = [...targets];
    for (let i = 0; i < targetArr.length; i++) {
      for (let j = i + 1; j < targetArr.length; j++) {
        const a = targetArr[i];
        const b = targetArr[j];
        if (connected.has(`${a}|${b}`)) continue;
        const pd = getPair(a, b);
        pd.sharedBacklinks.add(sourceId);
      }
    }
  }

  // 3. Tag overlap: build tag index → pairs (metadata tags excluded)
  const tagIndex = new Map<string, string[]>();
  for (const n of nodes) {
    for (const tag of (n.tags ?? []).filter(isContentTag)) {
      if (!tagIndex.has(tag)) tagIndex.set(tag, []);
      tagIndex.get(tag)!.push(n.id);
    }
  }

  for (const [tag, nodeIds] of tagIndex) {
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i];
        const b = nodeIds[j];
        if (connected.has(`${a}|${b}`)) continue;
        const pd = getPair(a, b);
        if (!pd.sharedTags.includes(tag)) pd.sharedTags.push(tag);
      }
    }
  }

  // 4. Title/path word similarity — computed on-demand for candidates
  //    that already have some signal, then also scan all pairs in same top-folder

  // First pass: assign scores to all pairs found so far
  const clusters = detectClusters(nodes, wires);

  for (const [key, pd] of pairs) {
    const sepIdx = key.indexOf('|');
    if (sepIdx === -1) continue;
    const a = key.slice(0, sepIdx);
    const b = key.slice(sepIdx + 1);
    const wordsA = nodeWords.get(a);
    const wordsB = nodeWords.get(b);
    if (wordsA && wordsB) {
      pd.titleJaccard = jaccard(wordsA, wordsB);
    }
  }

  // Second pass: scan same-folder pairs that don't yet appear in our map
  // (avoids O(n²) scan for all nodes by only checking same top-folder)
  const folderIndex = new Map<string, string[]>();
  for (const n of nodes) {
    const f = topFolder(n.path);
    if (!f) continue;
    if (!folderIndex.has(f)) folderIndex.set(f, []);
    folderIndex.get(f)!.push(n.id);
  }

  for (const [, folderNodes] of folderIndex) {
    for (let i = 0; i < folderNodes.length; i++) {
      for (let j = i + 1; j < folderNodes.length; j++) {
        const a = folderNodes[i];
        const b = folderNodes[j];
        if (connected.has(`${a}|${b}`)) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!pairs.has(key)) {
          // Only add if title similarity is meaningful
          const sim = jaccard(nodeWords.get(a)!, nodeWords.get(b)!);
          if (sim >= 0.15) {
            pairs.set(key, {
              score: 0,
              sharedLinks: new Set(),
              sharedBacklinks: new Set(),
              sharedTags: [],
              titleJaccard: sim,
            });
          }
        }
      }
    }
  }

  // ─── Composite scoring ───────────────────────────────────
  //
  // Weights (tuned for vault-scale graphs):
  //   co-citation shared link  → 0.30 per shared node (capped contribution)
  //   co-reference             → 0.15 per shared source (capped)
  //   shared tag               → 0.20 per tag (capped)
  //   title Jaccard            → 0.35 * jaccard
  //   cross-cluster bonus      → +0.10

  const WEIGHT_LINK   = 0.30;
  const WEIGHT_BACKLINK = 0.15;
  const WEIGHT_TAG    = 0.20;
  const WEIGHT_TITLE  = 0.35;
  const BONUS_CLUSTER = 0.10;

  const suggestions: GapSuggestion[] = [];

  for (const [key, pd] of pairs) {
    const sepIdx = key.indexOf('|');
    if (sepIdx === -1) continue;
    const a = key.slice(0, sepIdx);
    const b = key.slice(sepIdx + 1);

    const linkCount = pd.sharedLinks.size;
    const blCount   = pd.sharedBacklinks.size;
    const tagCount  = pd.sharedTags.length;

    // Cap contributions so a single signal can't dominate
    const linkScore = Math.min(linkCount * WEIGHT_LINK, 0.60);
    const blScore   = Math.min(blCount   * WEIGHT_BACKLINK, 0.45);
    const tagScore  = Math.min(tagCount  * WEIGHT_TAG, 0.60);
    const titleScore = pd.titleJaccard * WEIGHT_TITLE;

    let score = linkScore + blScore + tagScore + titleScore;

    // Cross-cluster bonus
    if (clusters.get(a) !== clusters.get(b)) {
      score += BONUS_CLUSTER;
    }

    // Require at least one meaningful signal (avoids noise)
    const hasSignal =
      linkCount > 0 ||
      blCount > 0 ||
      tagCount > 0 ||
      pd.titleJaccard >= 0.20;

    if (!hasSignal || score < 0.15) continue;

    // Build reason string describing the strongest signals
    const parts: string[] = [];

    if (linkCount > 0) {
      parts.push(
        linkCount === 1
          ? 'both link to a common note'
          : `both link to ${linkCount} common notes`,
      );
    }
    if (blCount > 0) {
      // blCount here is the number of unique source-pair encodings,
      // which approximates common citing notes
      parts.push('referenced together by shared notes');
    }
    if (tagCount > 0) {
      const tagList = pd.sharedTags.slice(0, 3).join(', ');
      parts.push(
        tagCount === 1
          ? `share tag ${tagList}`
          : `share tags ${tagList}${tagCount > 3 ? ` +${tagCount - 3} more` : ''}`,
      );
    }
    if (pd.titleJaccard >= 0.20) {
      parts.push('similar titles');
    }

    const signalSummary = parts.length > 0
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) +
        (parts.length > 1 ? '; also ' + parts.slice(1).join(', ') : '') + '.'
      : 'Topical overlap detected.';

    const clusterNote =
      clusters.get(a) !== clusters.get(b)
        ? ' Linking would bridge two separate graph clusters.'
        : '';

    suggestions.push({
      nodeA: a,
      nodeB: b,
      sharedTags: pd.sharedTags,
      sharedLinks: [...pd.sharedLinks],
      sharedBacklinks: [],  // internal encoding not exposed to UI
      score: Math.min(score, 1),
      reason: signalSummary + clusterNote,
    });
  }

  // Sort by score descending, limit to 30
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, 30);
}

// ─── PageRank ───────────────────────────────────────────────

/**
 * Simplified PageRank. 20 iterations, damping factor 0.85.
 * Returns normalised 0-1 scores.
 */
export function pageRank(
  nodes: NodeDef[],
  wires: WireDef[],
): Map<string, number> {
  const ids = nodes.map((n) => n.id);
  const n = ids.length;

  if (n === 0) return new Map();

  const DAMPING = 0.85;
  const ITERATIONS = 20;

  // Build outgoing adjacency (directed)
  const outAdj = new Map<string, string[]>();
  for (const id of ids) outAdj.set(id, []);

  for (const w of wires) {
    const { from, to } = getWireNodeIds(w);
    if (outAdj.has(from)) {
      outAdj.get(from)!.push(to);
    }
  }

  // Build incoming adjacency
  const inAdj = new Map<string, string[]>();
  for (const id of ids) inAdj.set(id, []);

  for (const w of wires) {
    const { from, to } = getWireNodeIds(w);
    if (inAdj.has(to)) {
      inAdj.get(to)!.push(from);
    }
  }

  // Initialise scores
  const scores = new Map<string, number>();
  const initVal = 1 / n;
  for (const id of ids) scores.set(id, initVal);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const newScores = new Map<string, number>();

    // Collect dangling node mass (nodes with no outgoing links)
    let danglingSum = 0;
    for (const id of ids) {
      if (outAdj.get(id)!.length === 0) {
        danglingSum += scores.get(id)!;
      }
    }

    const base = (1 - DAMPING) / n + (DAMPING * danglingSum) / n;

    for (const id of ids) {
      let inSum = 0;
      for (const src of inAdj.get(id)!) {
        const outCount = outAdj.get(src)!.length;
        if (outCount > 0) {
          inSum += scores.get(src)! / outCount;
        }
      }
      newScores.set(id, base + DAMPING * inSum);
    }

    // Update scores
    for (const [id, v] of newScores) scores.set(id, v);
  }

  // Normalise to 0-1
  let max = 0;
  for (const v of scores.values()) {
    if (v > max) max = v;
  }

  const result = new Map<string, number>();
  for (const [id, v] of scores) {
    result.set(id, max > 0 ? v / max : 0);
  }

  return result;
}

// ─── Node Importance ────────────────────────────────────────

export type ImportanceMetric = 'connections' | 'betweenness' | 'pagerank';

/**
 * Compute a normalised 0-1 importance score for a single node
 * using the specified metric.
 */
export function nodeImportance(
  nodeId: string,
  nodes: NodeDef[],
  wires: WireDef[],
  metric: ImportanceMetric,
): number {
  switch (metric) {
    case 'connections': {
      // (inDegree + outDegree) / maxDegree
      const degreeMap = new Map<string, number>();
      for (const n of nodes) degreeMap.set(n.id, 0);

      for (const w of wires) {
        const { from, to } = getWireNodeIds(w);
        if (degreeMap.has(from)) degreeMap.set(from, degreeMap.get(from)! + 1);
        if (degreeMap.has(to)) degreeMap.set(to, degreeMap.get(to)! + 1);
      }

      let maxDegree = 0;
      for (const d of degreeMap.values()) {
        if (d > maxDegree) maxDegree = d;
      }

      const nodeDegree = degreeMap.get(nodeId) ?? 0;
      return maxDegree > 0 ? nodeDegree / maxDegree : 0;
    }

    case 'betweenness': {
      const scores = betweennessCentrality(nodes, wires);
      return scores.get(nodeId) ?? 0;
    }

    case 'pagerank': {
      const scores = pageRank(nodes, wires);
      return scores.get(nodeId) ?? 0;
    }

    default:
      return 0;
  }
}
