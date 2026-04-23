# Ngram Roadmap — Future Features

## v0.2.0 — UX Polish & Filter Refinement

**Goal:** Make the graph more navigable and reduce visual noise for large vaults.

**Design:**
- Node search bar with live highlight (keyboard shortcut, e.g. Cmd+K)
- Filter panel: by tag, folder, link depth (1st/2nd/3rd degree from selected node), creation date range
- Saved filter presets — name and store filter combinations in plugin data.json
- Mini-map overlay in corner for large graphs (show full graph, highlight visible viewport)
- Edge weight slider — hide weak co-citation edges below threshold to reduce clutter
- Node detail panel: click a node → side panel shows note title, tags, linked notes count, excerpt

**Implementation notes:**
- Filter state managed in `SettingsManager` or ephemeral session state
- Leverage existing `graph-analysis.ts` edge weights for filter thresholds
- Node detail panel: read note content via Obsidian `vault.read()` API

---

## v0.3.0 — Shelby Infrastructure Visualization

**Goal:** Add a second visualization domain alongside vault-concepts: Shelby's live infrastructure (machines, MCP servers, services, data flows).

**Design:**
- Toggle in toolbar: "Vault" | "Shelby Infra" — switches data source and layout
- Infra node types: Machine (Dawn/Dusk/Day), MCPServer, Service, DataFlow, SkillFile
- Edge types: `runs-on`, `connects-to`, `reads-from`, `writes-to`, `triggers`
- Node coloring by type (distinct palette, legend in sidebar)
- Data sources:
  - `~/.claude.json` → MCP servers per machine
  - `MEMORY.md` + `vault/Config/` → services and their relationships
  - `ai-wiki/` articles → higher-level infrastructure descriptions
  - Port Registry → active ports per service
- Infra graph is read-only (no wire-drag, no gap analysis)
- Refresh button + last-updated timestamp (data can go stale)

**Implementation notes:**
- New data loader: `src/data/infra-loader.ts` — reads config files, parses JSON/YAML/Markdown, builds graph
- New node/edge type definitions in `src/types.ts` alongside existing vault types
- Toggle in `src/view.ts` — swap data loader + disable gap panel for infra mode
- Graph coloring: extend existing color system with new type map
- Ship as opt-in (settings toggle) since it requires macOS/Day to be useful

---

## v0.4.0 — Mobile Touch & Deep Vault Linking

**Goal:** Make Ngram usable on Obsidian mobile (iOS/Android) and deepen integration with vault content.

**Design — Mobile touch:**
- Replace hover-dependent interactions with tap-to-focus (single tap selects node, opens detail panel)
- Two-finger pinch-to-zoom, one-finger pan (replace scroll-wheel equivalents)
- Tap on wire → show edge detail (shared tags / co-citations)
- Long-press on node → context menu (Open Note, Focus Graph, Copy Title)
- Detect mobile viewport and switch to touch mode automatically (`PointerEvent` API)

**Design — Deep vault linking:**
- Node double-tap / double-click → opens the note in the editor (existing Obsidian `workspace.openLinkText()`)
- "Linked to" panel: selecting a node shows its direct connections as clickable list
- Backlink integration: show backlink count as node badge
- Graph-to-note navigation: pressing a note's heading in the detail panel jumps to that section

**Implementation notes:**
- Touch event handling in `src/renderer/interaction.ts` — add `pointerdown/pointermove/pointerup` handlers (replaces separate mouse + touch)
- `PointerEvent.pointerType === 'touch'` to distinguish touch from mouse
- Force-graph lib (d3-force or custom): verify pan/zoom works via `transform` on touch; may need custom gesture layer
- Mobile testing: use Obsidian mobile beta + BrowserStack for iOS Safari / Android Chrome device coverage
- Feature-flag: `enableMobileTouch` setting (default: auto-detect) for rollback if issues

---

## Prior Milestone Proposals (Deferred)

The following milestones were proposed in an earlier planning cycle. They remain valid but are deprioritized behind the v0.2–v0.4 cycle above.

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

### Semantic Embeddings (was v0.3)

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

### 3D Graph View (was v0.4)

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
