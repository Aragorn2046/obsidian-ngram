# Ngram Roadmap — Future Features

## v0.2.0 — Accept All Gaps

**Problem:** Gap panel shows suggestions one at a time. Users with many gaps want batch operations.

**Design:**
- Add "Accept All" button to gap panel header (next to existing controls)
- Each gap card gets a checkbox for selective batch accept
- "Accept Selected" / "Accept All" creates `[[wikilinks]]` in the source notes
- Undo buffer: store accepted gaps in session memory, allow "Undo Last Batch"
- Safety: confirm dialog showing count before bulk write ("Create 12 new wikilinks?")

**Implementation notes:**
- Leverage existing wire-drag write-back logic in `interaction.ts`
- Gap panel already has action buttons per card — extend with checkbox column
- Batch write: iterate accepted gaps, append `[[nodeB]]` to nodeA's file content

---

## v0.3.0 — Semantic Embeddings

**Problem:** Current gap analysis uses co-citation and title similarity. Semantic embeddings would find deeper topical relationships.

**Design:**
- Compute embeddings for each note using a local model (Transformers.js or Ollama)
- Store embeddings in plugin data.json (cache, recompute on file change)
- Cosine similarity between note embeddings → weighted into gap scoring
- Settings: enable/disable embeddings, model selection, similarity threshold

**Implementation notes:**
- `src/scanner/embeddings.ts` — new module for embedding computation
- Integration point: `graph-analysis.ts findGaps()` already has weighted scoring — add embedding signal
- Performance: compute embeddings lazily on first gap panel open, cache aggressively
- Fallback: if no model available, gap analysis works exactly as today (co-citation + tags + title)
- Consider: Obsidian 1.5+ may ship built-in embeddings API — design for swap-in

**Open questions:**
- Bundle a WASM model vs. require Ollama? Trade-off: bundle size vs. setup friction
- Embedding dimension? 384 (MiniLM) is fast, 768 (BERT) is better
- Incremental updates: re-embed only changed files, or full recompute?

---

## v0.4.0 — 3D Graph View

**Problem:** Large vaults (1000+ notes) make 2D graphs cluttered. A 3D view with depth adds another dimension for separation.

**Design:**
- Third view mode alongside Schematic and Organic: "3D"
- WebGL rendering via Three.js (or lighter alternative like regl)
- Force-directed layout in 3D (extend existing force simulation with z-axis)
- Camera controls: orbit, pan, zoom (trackpad + mouse)
- Clusters naturally separate in 3D space — less overlap than 2D
- Node labels face camera (billboarding)
- Same coloring, sizing, and interaction model as Organic mode

**Implementation notes:**
- `src/renderer/three-view.ts` — new renderer, implements same interface as canvas renderer
- Shared: graph-analysis, scanner, types, settings — only rendering layer changes
- Performance: instanced meshes for nodes, line segments for wires, LOD for labels
- Mobile: fall back to Organic 2D (WebGL support varies on mobile Obsidian)

**Open questions:**
- Three.js adds ~150KB to bundle. Acceptable for a plugin?
- VR/AR mode? Obsidian runs in Electron — WebXR is technically possible
- Stereotype: "3D graphs look cool but aren't more useful." Counter: cluster separation genuinely improves with the third dimension for dense graphs. Need to validate with real vault data.

---

## Backlog (Unprioritized)

- **Time-based animation** — show vault growth over time (git history or file creation dates)
- **Graph diff** — compare two snapshots of the vault graph, highlight what changed
- **Collaborative view** — share graph state via URL for team vaults
- **AI-generated labels** — use LLM to name detected clusters
- **Custom layout algorithms** — tree, radial, hierarchical options beyond force-directed
- **Tag cloud overlay** — show most common tags as a word cloud layer on the graph
