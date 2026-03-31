// ─── Stats Bar — Node/wire/category counts ──────────────────
// Zero Obsidian dependencies. DOM-only UI.

import type { ThemeColors } from './theme';

// ─── StatsBar ───────────────────────────────────────────────

export class StatsBar {
  private container: HTMLDivElement;
  private el: HTMLDivElement;
  private theme: ThemeColors;

  constructor(container: HTMLDivElement, theme: ThemeColors) {
    this.container = container;
    this.theme = theme;

    this.el = document.createElement('div');
    this.el.className = 'bp-stats';
    this.applyStyles();
    this.container.appendChild(this.el);
  }

  // ─── Styles ───────────────────────────────────────────

  private applyStyles(): void {
    // All structural styles live in .bp-stats CSS class.
    // Only the dynamic theme color is applied inline.
    this.el.style.color = this.theme.textMuted;
  }

  // ─── Public API ───────────────────────────────────────

  /** Update displayed counts */
  update(nodeCount: number, wireCount: number, categoryCount: number): void {
    this.el.textContent =
      `${nodeCount} nodes \u00b7 ${wireCount} connections \u00b7 ${categoryCount} categories`;
  }

  /** Update theme colors */
  setTheme(theme: ThemeColors): void {
    this.theme = theme;
    this.applyStyles();
  }

  /** Remove DOM element */
  destroy(): void {
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
