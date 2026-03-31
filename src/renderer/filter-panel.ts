// ─── Filter Panel — Tag & Property filtering ─────────────────
// DOM-based overlay for filtering nodes by tags and frontmatter.

import type { NodeDef } from '../types';
import type { ThemeColors } from './theme';

// ─── Types ──────────────────────────────────────────────────

export interface FilterState {
  activeTags: Set<string>;         // selected tags (OR logic)
  propertyKey: string;             // active property key filter
  propertyValue: string;           // substring match for property value
  tagMode: 'any' | 'all';         // any = OR, all = AND
}

export interface FilterCallbacks {
  onFilterChange: (state: FilterState) => void;
}

// ─── Filter Panel ───────────────────────────────────────────

export class FilterPanel {
  private container: HTMLDivElement;
  private el: HTMLDivElement;
  private callbacks: FilterCallbacks;
  private theme: ThemeColors;
  private visible = false;

  // State
  private state: FilterState = {
    activeTags: new Set(),
    propertyKey: '',
    propertyValue: '',
    tagMode: 'any',
  };

  // Available options (computed from node data)
  private allTags: string[] = [];
  private allPropertyKeys: string[] = [];
  private tagCounts: Map<string, number> = new Map();

  constructor(
    container: HTMLDivElement,
    callbacks: FilterCallbacks,
    theme: ThemeColors,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.theme = theme;

    this.el = document.createElement('div');
    this.el.className = 'bp-filter-panel';
    this.applyStyles();
    this.el.style.display = 'none';
    this.container.appendChild(this.el);
  }

  // ─── Styles ───────────────────────────────────────────

  private applyStyles(): void {
    // Structural styles live in .bp-filter-panel CSS class.
    // Apply dynamic theme colors inline.
    this.el.style.background = this.theme.panelBg;
    this.el.style.border = `1px solid ${this.theme.panelBorder}`;
    this.el.style.color = this.theme.panelText;
  }

  // ─── Data ─────────────────────────────────────────────

  /** Rebuild available tags and properties from node data */
  setNodes(nodes: NodeDef[]): void {
    const tagSet = new Map<string, number>();
    const propKeys = new Set<string>();

    for (const n of nodes) {
      if (n.tags) {
        for (const t of n.tags) {
          tagSet.set(t, (tagSet.get(t) ?? 0) + 1);
        }
      }
      if (n.properties) {
        for (const key of Object.keys(n.properties)) {
          // Skip internal/obsidian metadata keys
          if (key === 'position' || key === 'cssclasses') continue;
          propKeys.add(key);
        }
      }
    }

    // Sort tags by frequency (most common first)
    this.allTags = [...tagSet.keys()].sort((a, b) => (tagSet.get(b) ?? 0) - (tagSet.get(a) ?? 0));
    this.tagCounts = tagSet;
    this.allPropertyKeys = [...propKeys].sort();

    // Remove stale active tags
    for (const t of this.state.activeTags) {
      if (!tagSet.has(t)) this.state.activeTags.delete(t);
    }

    if (this.visible) this.rebuild();
  }

  // ─── Build UI ─────────────────────────────────────────

  private rebuild(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'bp-filter-header';
    header.style.borderBottom = `1px solid ${this.theme.panelBorder}`;

    const title = document.createElement('span');
    title.className = 'bp-filter-title';
    title.textContent = 'Filters';
    header.appendChild(title);

    const clearBtn = this.createButton('Clear All');
    clearBtn.addEventListener('click', () => this.clearAll());
    header.appendChild(clearBtn);

    this.el.appendChild(header);

    // ── Tags Section ──
    if (this.allTags.length > 0) {
      const tagSection = document.createElement('div');
      tagSection.className = 'bp-filter-tag-section';

      const tagHeader = document.createElement('div');
      tagHeader.className = 'bp-filter-tag-header';

      const tagLabel = document.createElement('span');
      tagLabel.className = 'bp-filter-tag-label';
      tagLabel.textContent = 'Tags';
      tagHeader.appendChild(tagLabel);

      // Mode toggle (Any/All)
      const modeBtn = this.createButton(this.state.tagMode === 'any' ? 'Any' : 'All');
      modeBtn.title = this.state.tagMode === 'any'
        ? 'Showing nodes with ANY selected tag'
        : 'Showing nodes with ALL selected tags';
      modeBtn.addEventListener('click', () => {
        this.state.tagMode = this.state.tagMode === 'any' ? 'all' : 'any';
        modeBtn.textContent = this.state.tagMode === 'any' ? 'Any' : 'All';
        modeBtn.title = this.state.tagMode === 'any'
          ? 'Showing nodes with ANY selected tag'
          : 'Showing nodes with ALL selected tags';
        this.fireChange();
      });
      tagHeader.appendChild(modeBtn);

      tagSection.appendChild(tagHeader);

      // Tag checkboxes
      const tagList = document.createElement('div');
      tagList.className = 'bp-filter-tag-list';

      for (const tag of this.allTags) {
        const row = document.createElement('div');
        row.className = 'bp-filter-tag-row';

        const check = document.createElement('div');
        check.className = 'bp-filter-checkbox';
        check.style.border = `1px solid ${this.theme.textMuted}`;
        const isActive = this.state.activeTags.has(tag);
        this.syncCheck(check, isActive);

        const label = document.createElement('span');
        label.className = 'bp-filter-tag-name';
        label.textContent = tag;

        const count = document.createElement('span');
        count.className = 'bp-filter-tag-count';
        count.textContent = String(this.tagCounts.get(tag) ?? 0);
        count.style.color = this.theme.textMuted;

        row.appendChild(check);
        row.appendChild(label);
        row.appendChild(count);

        if (!isActive) {
          row.style.opacity = '0.6';
        }

        row.addEventListener('click', () => {
          if (this.state.activeTags.has(tag)) {
            this.state.activeTags.delete(tag);
            this.syncCheck(check, false);
            row.style.opacity = '0.6';
          } else {
            this.state.activeTags.add(tag);
            this.syncCheck(check, true);
            row.style.opacity = '1';
          }
          this.fireChange();
        });

        tagList.appendChild(row);
      }

      tagSection.appendChild(tagList);
      this.el.appendChild(tagSection);
    }

    // ── Property Filter Section ──
    if (this.allPropertyKeys.length > 0) {
      const propSection = document.createElement('div');

      const propLabel = document.createElement('span');
      propLabel.className = 'bp-filter-prop-label';
      propLabel.textContent = 'Property Filter';
      propSection.appendChild(propLabel);

      // Property key dropdown
      const keySelect = document.createElement('select');
      keySelect.className = 'bp-filter-select';
      keySelect.style.background = this.theme.buttonBg;
      keySelect.style.color = this.theme.buttonText;
      keySelect.style.border = `1px solid ${this.theme.buttonBorder}`;

      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '— select property —';
      keySelect.appendChild(emptyOpt);

      for (const key of this.allPropertyKeys) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key;
        if (key === this.state.propertyKey) opt.selected = true;
        keySelect.appendChild(opt);
      }

      keySelect.addEventListener('change', () => {
        this.state.propertyKey = keySelect.value;
        this.fireChange();
      });
      propSection.appendChild(keySelect);

      // Property value input
      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.className = 'bp-filter-input';
      valueInput.placeholder = 'value contains...';
      valueInput.value = this.state.propertyValue;
      valueInput.style.background = this.theme.buttonBg;
      valueInput.style.color = this.theme.buttonText;
      valueInput.style.border = `1px solid ${this.theme.buttonBorder}`;

      let inputTimer: ReturnType<typeof setTimeout> | null = null;
      valueInput.addEventListener('input', () => {
        if (inputTimer) clearTimeout(inputTimer);
        inputTimer = setTimeout(() => {
          this.state.propertyValue = valueInput.value;
          this.fireChange();
        }, 200);
      });
      propSection.appendChild(valueInput);

      this.el.appendChild(propSection);
    }

    // ── Active filter count ──
    const activeCount = this.getActiveFilterCount();
    if (activeCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'bp-filter-active-badge';
      badge.style.borderTop = `1px solid ${this.theme.panelBorder}`;
      badge.style.color = this.theme.textMuted;
      badge.textContent = `${activeCount} active filter${activeCount > 1 ? 's' : ''}`;
      this.el.appendChild(badge);
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  private createButton(text: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'bp-filter-btn';
    btn.textContent = text;
    btn.style.background = this.theme.buttonBg;
    btn.style.border = `1px solid ${this.theme.buttonBorder}`;
    btn.style.color = this.theme.buttonText;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = this.theme.buttonHoverBg;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = this.theme.buttonBg;
    });
    return btn;
  }

  private syncCheck(check: HTMLDivElement, active: boolean): void {
    if (active) {
      check.textContent = '\u2713';
      check.style.background = 'rgba(255,255,255,0.1)';
    } else {
      check.textContent = '';
      check.style.background = 'transparent';
    }
  }

  private fireChange(): void {
    this.callbacks.onFilterChange({ ...this.state });
  }

  private clearAll(): void {
    this.state.activeTags.clear();
    this.state.propertyKey = '';
    this.state.propertyValue = '';
    this.fireChange();
    this.rebuild();
  }

  /** Count of active filters */
  getActiveFilterCount(): number {
    let count = 0;
    if (this.state.activeTags.size > 0) count++;
    if (this.state.propertyKey && this.state.propertyValue) count++;
    return count;
  }

  // ─── Public API ───────────────────────────────────────

  /** Check if a node passes the current filters */
  static passesFilter(node: NodeDef, state: FilterState): boolean {
    // Tag filter
    if (state.activeTags.size > 0) {
      const nodeTags = node.tags ?? [];
      if (state.tagMode === 'any') {
        // OR: node must have at least one of the active tags
        const match = nodeTags.some(t => state.activeTags.has(t));
        if (!match) return false;
      } else {
        // AND: node must have all active tags
        for (const t of state.activeTags) {
          if (!nodeTags.includes(t)) return false;
        }
      }
    }

    // Property filter
    if (state.propertyKey && state.propertyValue) {
      const props = node.properties;
      if (!props) return false;
      const val = props[state.propertyKey];
      if (val === undefined || val === null) return false;
      const valStr = String(val).toLowerCase();
      if (!valStr.includes(state.propertyValue.toLowerCase())) return false;
    }

    return true;
  }

  /** Get current filter state */
  getState(): FilterState {
    return { ...this.state };
  }

  /** Check if any filters are active */
  hasActiveFilters(): boolean {
    return this.state.activeTags.size > 0 ||
      (!!this.state.propertyKey && !!this.state.propertyValue);
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.rebuild();
      this.el.style.display = 'block';
    } else {
      this.el.style.display = 'none';
    }
  }

  show(): void {
    this.visible = true;
    this.rebuild();
    this.el.style.display = 'block';
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  setTheme(theme: ThemeColors): void {
    this.theme = theme;
    this.applyStyles();
    if (this.visible) this.rebuild();
  }

  destroy(): void {
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
