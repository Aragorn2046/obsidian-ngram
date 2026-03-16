// ─── Gap Panel — Gap analysis results overlay ─────────────────
// Zero Obsidian dependencies. DOM-only UI.
// Draggable (via header) and resizable (via corner handle).

import type { NodeDef } from '../types';
import type { ThemeColors } from './theme';
import type { GapSuggestion } from './graph-analysis';

// ─── Types ──────────────────────────────────────────────────

export interface GapPanelCallbacks {
  onNodeClick: (nodeId: string) => void;
  onCreateLink: (fromId: string, toId: string) => void;
  onRemoveLink: (fromId: string, toId: string) => void;
}

// ─── GapPanel ───────────────────────────────────────────────

export class GapPanel {
  private container: HTMLDivElement;
  private el: HTMLDivElement;
  private callbacks: GapPanelCallbacks;
  private theme: ThemeColors;
  private visible = false;
  private subtitleEl: HTMLDivElement | null = null;
  private listEl: HTMLDivElement | null = null;
  private cardCount = 0;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private elStartX = 0;
  private elStartY = 0;

  // Resize state
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;

  // Bound handlers for cleanup
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;

  constructor(
    container: HTMLDivElement,
    callbacks: GapPanelCallbacks,
    theme: ThemeColors,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.theme = theme;

    this.el = document.createElement('div');
    this.el.className = 'bp-gap-panel';
    this.applyPanelStyles();
    this.el.style.display = 'none';

    // Prevent wheel events from propagating (scrolling the panel shouldn't scroll the view)
    this.el.addEventListener('wheel', (e) => {
      e.stopPropagation();
    });

    this.container.appendChild(this.el);

    // Bind mouse handlers
    this.onMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
    this.onMouseUp = () => this.handleMouseUp();
  }

  // ─── Styles ───────────────────────────────────────────

  private applyPanelStyles(): void {
    Object.assign(this.el.style, {
      position: 'absolute',
      right: '12px',
      top: '50px',
      zIndex: '15',
      background: this.theme.panelBg,
      border: `1px solid ${this.theme.panelBorder}`,
      borderRadius: '8px',
      padding: '0',
      width: '340px',
      height: '420px',
      minWidth: '240px',
      minHeight: '200px',
      overflow: 'hidden',
      color: this.theme.panelText,
      fontSize: '12px',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    });
  }

  // ─── Drag & Resize ─────────────────────────────────────

  private convertToLeftTop(): void {
    // On first interaction, switch from right-based to left-based positioning
    if (this.el.style.right && this.el.style.right !== 'auto') {
      const rect = this.el.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      this.el.style.left = (rect.left - containerRect.left) + 'px';
      this.el.style.top = (rect.top - containerRect.top) + 'px';
      this.el.style.right = 'auto';
    }
  }

  private startDrag(e: MouseEvent): void {
    this.convertToLeftTop();
    this.dragging = true;
    this.resizing = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.elStartX = parseInt(this.el.style.left) || 0;
    this.elStartY = parseInt(this.el.style.top) || 0;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    e.preventDefault();
  }

  private startResize(e: MouseEvent): void {
    this.convertToLeftTop();
    this.resizing = true;
    this.dragging = false;
    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;
    this.resizeStartW = this.el.offsetWidth;
    this.resizeStartH = this.el.offsetHeight;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    e.preventDefault();
    e.stopPropagation();
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.dragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.el.style.left = (this.elStartX + dx) + 'px';
      this.el.style.top = (this.elStartY + dy) + 'px';
    } else if (this.resizing) {
      const dx = e.clientX - this.resizeStartX;
      const dy = e.clientY - this.resizeStartY;
      const newW = Math.max(240, this.resizeStartW + dx);
      const newH = Math.max(200, this.resizeStartH + dy);
      this.el.style.width = newW + 'px';
      this.el.style.height = newH + 'px';
    }
  }

  private handleMouseUp(): void {
    this.dragging = false;
    this.resizing = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  // ─── Render ───────────────────────────────────────────

  private render(gaps: GapSuggestion[], nodeMap: Record<string, NodeDef>): void {
    // Clear safely
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    // ─── Header (drag handle) ──────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px 8px',
      borderBottom: `1px solid ${this.theme.panelBorder}`,
      background: this.theme.panelBg,
      cursor: 'grab',
      userSelect: 'none',
      flexShrink: '0',
    });

    header.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking close button
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      header.style.cursor = 'grabbing';
      this.startDrag(e);
    });
    header.addEventListener('mouseup', () => {
      header.style.cursor = 'grab';
    });

    const titleEl = document.createElement('span');
    Object.assign(titleEl.style, {
      fontSize: '13px',
      fontWeight: '600',
      color: this.theme.panelText,
      letterSpacing: '0.05em',
    });
    titleEl.textContent = 'Gap Analysis';
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: this.theme.panelTextMuted,
      fontSize: '16px',
      lineHeight: '1',
      padding: '0 2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = this.theme.panelText;
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = this.theme.panelTextMuted;
    });
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    this.el.appendChild(header);

    // ─── Subtitle ─────────────────────────────────────
    this.subtitleEl = document.createElement('div');
    Object.assign(this.subtitleEl.style, {
      padding: '5px 12px 8px',
      fontSize: '11px',
      color: this.theme.panelTextMuted,
      borderBottom: `1px solid ${this.theme.panelBorder}`,
      flexShrink: '0',
    });
    this.cardCount = gaps.length;
    this.updateSubtitle();
    this.el.appendChild(this.subtitleEl);

    // ─── Scrollable content area ─────────────────────
    const scrollArea = document.createElement('div');
    Object.assign(scrollArea.style, {
      flex: '1',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      minHeight: '0',
    });

    // ─── Gap Cards ────────────────────────────────────
    if (gaps.length === 0) {
      const empty = document.createElement('div');
      Object.assign(empty.style, {
        padding: '16px 12px',
        color: this.theme.panelTextMuted,
        fontSize: '11px',
        textAlign: 'center',
        fontStyle: 'italic',
      });
      empty.textContent = 'Run the analysis on a graph with tagged notes.';
      scrollArea.appendChild(empty);
    } else {
      this.listEl = document.createElement('div');
      Object.assign(this.listEl.style, {
        padding: '6px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      });

      for (const gap of gaps) {
        this.listEl.appendChild(this.buildGapCard(gap, nodeMap));
      }

      scrollArea.appendChild(this.listEl);
    }

    this.el.appendChild(scrollArea);

    // ─── Resize handle (bottom-right corner) ─────────
    const resizeHandle = document.createElement('div');
    Object.assign(resizeHandle.style, {
      position: 'absolute',
      right: '0',
      bottom: '0',
      width: '16px',
      height: '16px',
      cursor: 'nwse-resize',
      zIndex: '2',
    });
    // Draw the resize grip (three diagonal lines)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.style.opacity = '0.4';
    for (const offset of [4, 8, 12]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(offset));
      line.setAttribute('y1', '16');
      line.setAttribute('x2', '16');
      line.setAttribute('y2', String(offset));
      line.setAttribute('stroke', this.theme.panelText);
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }
    resizeHandle.appendChild(svg);

    resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));

    this.el.appendChild(resizeHandle);
  }

  // ─── Gap Card ─────────────────────────────────────────

  private buildGapCard(
    gap: GapSuggestion,
    nodeMap: Record<string, NodeDef>,
  ): HTMLDivElement {
    const nodeA = nodeMap[gap.nodeA];
    const nodeB = nodeMap[gap.nodeB];

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: this.theme.buttonBg,
      border: `1px solid ${this.theme.panelBorder}`,
      borderRadius: '5px',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    });

    // ─── Node names row ──────────────────────────────
    const nodesRow = document.createElement('div');
    Object.assign(nodesRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexWrap: 'wrap',
    });

    const makeNodeLabel = (nodeId: string, node: NodeDef | undefined): HTMLSpanElement => {
      const span = document.createElement('span');
      Object.assign(span.style, {
        cursor: 'pointer',
        color: this.theme.panelText,
        fontSize: '12px',
        fontWeight: '500',
        borderBottom: `1px dotted ${this.theme.panelBorder}`,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '130px',
        display: 'inline-block',
      });
      span.textContent = node ? node.title : nodeId;
      span.title = node ? node.title : nodeId;
      span.addEventListener('mouseenter', () => {
        span.style.color = this.theme.textPrimary;
        span.style.borderBottomColor = this.theme.panelText;
      });
      span.addEventListener('mouseleave', () => {
        span.style.color = this.theme.panelText;
        span.style.borderBottomColor = this.theme.panelBorder;
      });
      span.addEventListener('click', () => {
        this.callbacks.onNodeClick(nodeId);
      });
      return span;
    };

    nodesRow.appendChild(makeNodeLabel(gap.nodeA, nodeA));

    const arrowEl = document.createElement('span');
    Object.assign(arrowEl.style, {
      color: this.theme.panelTextMuted,
      fontSize: '11px',
      flexShrink: '0',
    });
    arrowEl.textContent = '\u2194';
    nodesRow.appendChild(arrowEl);

    nodesRow.appendChild(makeNodeLabel(gap.nodeB, nodeB));

    card.appendChild(nodesRow);

    // ─── Shared tags ──────────────────────────────────
    if (gap.sharedTags.length > 0) {
      const tagsRow = document.createElement('div');
      Object.assign(tagsRow.style, {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '3px',
      });

      for (const tag of gap.sharedTags) {
        const badge = document.createElement('span');
        Object.assign(badge.style, {
          display: 'inline-block',
          padding: '1px 5px',
          borderRadius: '3px',
          fontSize: '10px',
          background: this.theme.inputBg,
          border: `1px solid ${this.theme.panelBorder}`,
          color: this.theme.panelTextMuted,
          lineHeight: '1.5',
        });
        badge.textContent = '#' + tag;
        tagsRow.appendChild(badge);
      }

      card.appendChild(tagsRow);
    }

    // ─── Reason text ──────────────────────────────────
    if (gap.reason) {
      const reasonEl = document.createElement('div');
      Object.assign(reasonEl.style, {
        fontSize: '10px',
        color: this.theme.textMuted,
        fontStyle: 'italic',
        lineHeight: '1.4',
      });
      reasonEl.textContent = gap.reason;
      card.appendChild(reasonEl);
    }

    // ─── Action button row ─────────────────────────────
    const actionRow = document.createElement('div');
    Object.assign(actionRow.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '6px',
      marginTop: '2px',
    });

    const makeActionBtn = (text: string, danger = false): HTMLButtonElement => {
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        background: this.theme.buttonBg,
        border: `1px solid ${this.theme.buttonBorder}`,
        borderRadius: '4px',
        padding: '3px 10px',
        cursor: 'pointer',
        color: danger ? (this.theme.textError ?? '#e55') : this.theme.buttonText,
        fontSize: '11px',
        fontFamily: 'inherit',
        lineHeight: '1.4',
        transition: 'background 0.1s, opacity 0.15s',
      });
      btn.textContent = text;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = this.theme.buttonHoverBg;
        btn.style.color = danger ? (this.theme.textError ?? '#e55') : this.theme.panelText;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = this.theme.buttonBg;
        btn.style.color = danger ? (this.theme.textError ?? '#e55') : this.theme.buttonText;
      });
      return btn;
    };

    // Link button — creates link, transforms card to "linked" state
    const linkBtn = makeActionBtn('Link');

    // Unlink button — undoes the link, then removes the card
    const unlinkBtn = makeActionBtn('Unlink', true);
    unlinkBtn.style.display = 'none';

    // Status label
    const statusEl = document.createElement('span');
    Object.assign(statusEl.style, {
      fontSize: '10px',
      color: '#4ade80',
      fontWeight: '500',
      display: 'none',
      alignSelf: 'center',
    });
    statusEl.textContent = 'Linked \u2713';

    linkBtn.addEventListener('click', () => {
      this.callbacks.onCreateLink(gap.nodeA, gap.nodeB);
      // Transform to "linked" state
      linkBtn.style.display = 'none';
      unlinkBtn.style.display = '';
      statusEl.style.display = '';
      card.style.opacity = '0.6';
    });

    unlinkBtn.addEventListener('click', () => {
      this.callbacks.onRemoveLink(gap.nodeA, gap.nodeB);
      this.removeCard(card, gap);
    });

    actionRow.appendChild(statusEl);
    actionRow.appendChild(linkBtn);
    actionRow.appendChild(unlinkBtn);

    card.appendChild(actionRow);

    return card;
  }

  // ─── Card Management ─────────────────────────────────

  /** Remove a card with a fade-out animation and update the counter */
  private removeCard(card: HTMLDivElement, _gap: GapSuggestion): void {
    card.style.transition = 'opacity 0.25s, max-height 0.3s, margin 0.3s, padding 0.3s';
    card.style.opacity = '0';
    card.style.overflow = 'hidden';
    card.style.maxHeight = card.offsetHeight + 'px';

    setTimeout(() => {
      card.style.maxHeight = '0';
      card.style.margin = '0';
      card.style.padding = '0';
      card.style.border = 'none';
    }, 150);

    setTimeout(() => {
      card.remove();
      this.cardCount--;
      this.updateSubtitle();
    }, 400);
  }

  private updateSubtitle(): void {
    if (!this.subtitleEl) return;
    if (this.cardCount <= 0) {
      this.subtitleEl.textContent = 'All gaps resolved';
    } else {
      this.subtitleEl.textContent =
        `${this.cardCount} potential connection${this.cardCount !== 1 ? 's' : ''} remaining`;
    }
  }

  // ─── Public API ───────────────────────────────────────

  /** Populate and show the panel with gap analysis results. */
  show(gaps: GapSuggestion[], nodeMap: Record<string, NodeDef>): void {
    this.render(gaps, nodeMap);
    this.visible = true;
    this.el.style.display = 'flex';
  }

  /** Hide the panel. */
  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  /** Toggle visibility. */
  toggle(): void {
    if (this.visible) this.hide();
    else this.el.style.display = 'flex'; // show without re-rendering; caller should use show() with data
  }

  /** Whether the panel is currently visible. */
  isVisible(): boolean {
    return this.visible;
  }

  /** Update theme colors and re-apply panel-level styles. */
  setTheme(theme: ThemeColors): void {
    this.theme = theme;
    this.applyPanelStyles();
  }

  /** Shift the right position (e.g. when controls panel opens). Only applies before first drag. */
  setRightOffset(px: number): void {
    // Only update right if we haven't switched to left-based positioning yet
    if (this.el.style.right && this.el.style.right !== 'auto') {
      this.el.style.right = px + 'px';
    }
  }

  /** Remove the DOM element and clean up listeners. */
  destroy(): void {
    this.handleMouseUp(); // clean up any active drag/resize
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
