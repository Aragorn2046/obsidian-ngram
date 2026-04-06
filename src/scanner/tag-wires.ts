// ─── Tag Wire Scanner ───────────────────────────────────────
// Creates wires between nodes that share tags.
// Only meaningful shared tags are counted — broad taxonomy tags
// (lang/*, status/*, type/*, and other structural metadata tags)
// are excluded from co-occurrence to reduce graph noise.

import type { WireDef, NodeDef } from "../types";
import type { FileInfo } from "./types";

/**
 * Tags that exist purely for structural/metadata classification.
 * Sharing these doesn't indicate a meaningful intellectual relationship
 * between notes — e.g. two notes both tagged #reference or #workflow
 * don't necessarily belong together in the graph.
 *
 * Prefixed entries use startsWith matching (e.g. "lang/" catches lang/en, lang/nl).
 * Exact entries use full tag equality.
 */
const STRUCTURAL_TAG_PREFIXES = [
  "lang/",
  "status/",
  "type/",
  "format/",
  "source/",
];

const STRUCTURAL_TAGS_EXACT = new Set([
  "#reference",
  "#workflow",
  "#config",
  "#note",
  "#index",
  "#moc",
  "#template",
  "#archive",
  "#inbox",
  "#todo",
  "#daily",
  "#weekly",
]);

function isMeaningfulTag(tag: string): boolean {
  const t = tag.toLowerCase();
  // Exclude exact structural tags
  if (STRUCTURAL_TAGS_EXACT.has(t)) return false;
  // Exclude tags matching structural prefixes
  for (const prefix of STRUCTURAL_TAG_PREFIXES) {
    if (t.startsWith(prefix) || t.startsWith("#" + prefix)) return false;
  }
  return true;
}

/**
 * Build tag-based wires: nodes sharing enough meaningful tags get a connection.
 * Structural/taxonomy tags are excluded from co-occurrence counting to reduce noise.
 * Default minSharedTags raised to 3 (from 2) to surface only strong co-occurrence.
 */
export function buildTagWires(
  nodes: NodeDef[],
  files: FileInfo[],
  nodeIdMap: Map<string, string>,
  existingWireKeys: Set<string>,
  minSharedTags: number = 3,
): WireDef[] {
  const wires: WireDef[] = [];

  // Build nodeId → meaningful tags lookup
  const fileTagMap = new Map<string, Set<string>>();
  for (const file of files) {
    const nodeId = nodeIdMap.get(file.path);
    if (!nodeId) continue;
    const meaningfulTags = file.tags
      .map(t => t.toLowerCase())
      .filter(isMeaningfulTag);
    if (meaningfulTags.length > 0) {
      fileTagMap.set(nodeId, new Set(meaningfulTags));
    }
  }

  // Compare all pairs of nodes with tags
  const nodeIds = [...fileTagMap.keys()];
  for (let i = 0; i < nodeIds.length; i++) {
    const aId = nodeIds[i];
    const aTags = fileTagMap.get(aId)!;

    for (let j = i + 1; j < nodeIds.length; j++) {
      const bId = nodeIds[j];
      const bTags = fileTagMap.get(bId)!;

      // Count shared meaningful tags
      let shared = 0;
      for (const tag of aTags) {
        if (bTags.has(tag)) shared++;
      }

      if (shared >= minSharedTags) {
        // Check both directions
        const wireKey1 = `${aId}→${bId}`;
        const wireKey2 = `${bId}→${aId}`;
        if (existingWireKeys.has(wireKey1) || existingWireKeys.has(wireKey2)) continue;
        existingWireKeys.add(wireKey1);

        wires.push({
          from: aId,
          to: bId,
          type: 'tag',
        });
      }
    }
  }

  return wires;
}
