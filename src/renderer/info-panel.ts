// ─── Info Panel — Node detail display ────────────────────────
// Zero Obsidian dependencies. DOM-only UI.

import type { NodeDef, CategoryDef } from '../types';
import type { ThemeColors } from './theme';
import type { ConnectionList, ConnectionInfo } from './canvas';

// ─── Types ──────────────────────────────────────────────────

export interface InfoPanelCallbacks {
  onConnectionClick: (nodeId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────

/** Returns a readable text color for a given category color against dark backgrounds */
function readableColor(hex: string): string {
  // Parse hex
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Relative luminance (WCAG)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // If too dark for a dark background, lighten it
  if (lum < 0.25) {
    const boost = Math.round(Math.min(255, (r * 255) + 120));
    const boostG = Math.round(Math.min(255, (g * 255) + 120));
    const boostB = Math.round(Math.min(255, (b * 255) + 120));
    return `rgb(${boost}, ${boostG}, ${boostB})`;
  }
  return hex;
}

// ─── InfoPanel ──────────────────────────────────────────────

export class InfoPanel {
  private container: HTMLDivElement;
  private el: HTMLDivElement;
  private resizeHandle: HTMLDivElement;
  private callbacks: InfoPanelCallbacks;
  private theme: ThemeColors;
  private panelHeight = 400;
  private resizing = false;
  private resizeStartY = 0;
  private resizeStartH = 0;

  constructor(
    container: HTMLDivElement,
    callbacks: InfoPanelCallbacks,
    theme: ThemeColors,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.theme = theme;

    this.el = document.createElement('div');
    this.el.className = 'bp-info-panel';
    this.applyStyles();
    this.el.style.display = 'none';

    // Resize handle (top edge)
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'bp-info-resize-handle';
    // Visual indicator line
    const grip = document.createElement('div');
    grip.className = 'bp-info-resize-grip';
    grip.style.background = this.theme.textMuted;
    this.resizeHandle.appendChild(grip);
    this.el.appendChild(this.resizeHandle);

    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.resizing = true;
      this.resizeStartY = e.clientY;
      this.resizeStartH = this.panelHeight;
      document.addEventListener('mousemove', this.onResizeMove);
      document.addEventListener('mouseup', this.onResizeEnd);
    });

    this.container.appendChild(this.el);
  }

  private onResizeMove = (e: MouseEvent): void => {
    if (!this.resizing) return;
    // Dragging up = larger panel (negative dy = more height)
    const dy = this.resizeStartY - e.clientY;
    this.panelHeight = Math.max(150, Math.min(800, this.resizeStartH + dy));
    this.el.style.height = this.panelHeight + 'px';
    this.el.style.maxHeight = this.panelHeight + 'px';
  };

  private onResizeEnd = (): void => {
    this.resizing = false;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };

  // ─── Styles ───────────────────────────────────────────

  private applyStyles(): void {
    // Structural styles live in .bp-info-panel CSS class.
    // Apply dynamic theme colors inline.
    this.el.style.background = this.theme.panelBg;
    this.el.style.border = `1px solid ${this.theme.panelBorder}`;
    this.el.style.color = this.theme.panelText;
    this.el.style.height = this.panelHeight + 'px';
    this.el.style.maxHeight = this.panelHeight + 'px';
  }

  // ─── Show/Hide ────────────────────────────────────────

  /** Show info for a node, or hide if null */
  show(
    node: NodeDef | null,
    categories: Record<string, CategoryDef>,
    connections: ConnectionList,
    connectionCount: number,
  ): void {
    // Clear existing content
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    if (!node) {
      this.el.style.display = 'none';
      return;
    }

    this.el.style.display = 'block';
    const cat = categories[node.cat];
    if (!cat) return;

    const safeColor = readableColor(cat.color);

    // ─── Header row (title + category + path) ───
    const header = document.createElement('div');
    header.className = 'bp-info-header';
    header.style.borderBottom = `1px solid ${this.theme.panelBorder}`;

    // Title
    const h2 = document.createElement('h2');
    h2.className = 'bp-info-h2';
    h2.style.color = safeColor;
    h2.textContent = node.title;
    header.appendChild(h2);

    // Category + connection count on same line
    const metaRow = document.createElement('div');
    metaRow.className = 'bp-info-meta-row';

    const catDiv = document.createElement('span');
    catDiv.className = 'bp-info-cat-label';
    catDiv.style.color = safeColor + 'bb';
    catDiv.textContent = cat.label;
    metaRow.appendChild(catDiv);

    // Connection count badge
    const badge = document.createElement('span');
    badge.className = 'bp-info-conn-badge';
    badge.style.background = safeColor + '20';
    badge.style.color = safeColor;
    badge.textContent = connectionCount + ' connection' + (connectionCount !== 1 ? 's' : '');
    metaRow.appendChild(badge);

    header.appendChild(metaRow);

    // File path
    if (node.path) {
      const pathDiv = document.createElement('div');
      pathDiv.className = 'bp-info-path';
      pathDiv.style.color = this.theme.textMuted;
      pathDiv.textContent = node.path;
      header.appendChild(pathDiv);
    }

    this.el.appendChild(header);

    // ─── Connections: side-by-side columns ───
    const hasOutgoing = connections.outgoing.length > 0;
    const hasIncoming = connections.incoming.length > 0;

    if (hasOutgoing || hasIncoming) {
      const columns = document.createElement('div');
      columns.className = 'bp-info-columns';

      if (hasOutgoing) {
        const col = this.buildConnColumn('Outgoing', connections.outgoing, '\u2192', categories);
        col.style.flex = '1';
        col.style.minWidth = '0';
        columns.appendChild(col);
      }

      if (hasIncoming) {
        const col = this.buildConnColumn('Incoming', connections.incoming, '\u2190', categories);
        col.style.flex = '1';
        col.style.minWidth = '0';
        columns.appendChild(col);
      }

      this.el.appendChild(columns);
    }
  }

  // ─── Connection Column Builder ─────────────────────

  private buildConnColumn(
    title: string,
    items: ConnectionInfo[],
    arrowChar: string,
    categories: Record<string, CategoryDef>,
  ): HTMLDivElement {
    const col = document.createElement('div');
    col.className = 'bp-info-col';

    const h3 = document.createElement('h3');
    h3.className = 'bp-info-col-h3';
    h3.style.color = this.theme.panelTextMuted;
    h3.textContent = `${title} (${items.length})`;
    col.appendChild(h3);

    const list = document.createElement('div');
    list.className = 'bp-info-conn-list';

    for (const conn of items) {
      const row = document.createElement('div');
      row.className = 'bp-info-conn-row';
      row.style.color = this.theme.panelText;

      row.addEventListener('mouseenter', () => {
        row.style.color = this.theme.textPrimary;
      });
      row.addEventListener('mouseleave', () => {
        row.style.color = this.theme.panelText;
      });

      // Arrow
      const arrow = document.createElement('span');
      arrow.className = 'bp-info-conn-arrow';
      arrow.style.color = this.theme.textMuted;
      arrow.textContent = arrowChar;
      row.appendChild(arrow);

      // Color dot
      const dot = document.createElement('span');
      dot.className = 'bp-info-conn-dot';
      const connCat = categories[conn.node.cat];
      dot.style.background = connCat ? connCat.color : '#888';
      row.appendChild(dot);

      // Node name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'bp-info-conn-name';
      nameSpan.textContent = conn.node.title;
      row.appendChild(nameSpan);

      // Click to navigate
      const nodeId = conn.node.id;
      row.addEventListener('click', () => {
        this.callbacks.onConnectionClick(nodeId);
      });

      list.appendChild(row);
    }

    col.appendChild(list);
    return col;
  }

  // ─── Public API ───────────────────────────────────────

  /** Adjust right offset (e.g. when controls panel is open) */
  setRightOffset(_px: number): void {
    // Info panel is now on the left — no right offset needed
  }

  /** Update theme colors */
  setTheme(theme: ThemeColors): void {
    this.theme = theme;
    this.applyStyles();
  }

  /** Remove all DOM elements */
  destroy(): void {
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
