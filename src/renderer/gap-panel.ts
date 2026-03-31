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

  // ─── Styles ───────────────────────────────────────────

  private applyPanelStyles(): void {
    // Structural styles live in .bp-gap-panel CSS class.
    // Apply dynamic theme colors inline.
    this.el.style.background = this.theme.panelBg;
    this.el.style.border = `1px solid ${this.theme.panelBorder}`;
    this.el.style.color = this.theme.panelText;
  }

  // ─── Render ───────────────────────────────────────────

  private render(gaps: GapSuggestion[], nodeMap: Record<string, NodeDef>): void {
    // Clear safely
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    // ─── Header (drag handle) ──────────────────────────
    const header = document.createElement('div');
    header.className = 'bp-gap-header';

    header.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking close button
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      this.startDrag(e);
    });

    const titleEl = document.createElement('span');
    titleEl.className = 'bp-gap-title';
    titleEl.textContent = 'Gap Analysis';
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bp-gap-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    this.el.appendChild(header);

    // ─── Subtitle ─────────────────────────────────────
    this.subtitleEl = document.createElement('div');
    this.subtitleEl.className = 'bp-gap-subtitle';
    this.cardCount = gaps.length;
    this.updateSubtitle();
    this.el.appendChild(this.subtitleEl);

    // ─── Scrollable content area ─────────────────────
    const scrollArea = document.createElement('div');
    scrollArea.className = 'bp-gap-scroll';

    // ─── Gap Cards ────────────────────────────────────
    if (gaps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bp-gap-empty';
      empty.textContent = 'Run the analysis on a graph with tagged notes.';
      scrollArea.appendChild(empty);
    } else {
      this.listEl = document.createElement('div');
      this.listEl.className = 'bp-gap-list';

      for (const gap of gaps) {
        this.listEl.appendChild(this.buildGapCard(gap, nodeMap));
      }

      scrollArea.appendChild(this.listEl);
    }

    this.el.appendChild(scrollArea);

    // ─── Resize handle (bottom-right corner) ─────────
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'bp-gap-resize-handle';
    // Draw the resize grip (three diagonal lines)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    for (const offset of [4, 8, 12]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(offset));
      line.setAttribute('y1', '16');
      line.setAttribute('x2', '16');
      line.setAttribute('y2', String(offset));
      line.setAttribute('stroke', 'currentColor');
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
    card.className = 'bp-gap-card';
    card.style.background = this.theme.panelBg;
    card.style.border = `1px solid ${this.theme.panelBorder}`;

    // ─── Node names row ──────────────────────────────
    const nodesRow = document.createElement('div');
    nodesRow.className = 'bp-gap-nodes-row';

    const makeNodeLabel = (nodeId: string, node: NodeDef | undefined): HTMLSpanElement => {
      const span = document.createElement('span');
      span.className = 'bp-gap-node-label';
      span.textContent = node ? node.title : nodeId;
      span.title = node ? node.title : nodeId;
      span.style.color = this.theme.textPrimary;
      span.addEventListener('click', () => {
        this.callbacks.onNodeClick(nodeId);
      });
      return span;
    };

    nodesRow.appendChild(makeNodeLabel(gap.nodeA, nodeA));

    const arrowEl = document.createElement('span');
    arrowEl.className = 'bp-gap-arrow';
    arrowEl.textContent = '\u2194';
    arrowEl.style.color = this.theme.textMuted;
    nodesRow.appendChild(arrowEl);

    nodesRow.appendChild(makeNodeLabel(gap.nodeB, nodeB));

    // Score pill (right-aligned)
    if (gap.score !== undefined) {
      const scorePct = Math.round(gap.score * 100);
      const scoreEl = document.createElement('span');
      scoreEl.className = 'bp-gap-score';
      scoreEl.textContent = `${scorePct}%`;
      scoreEl.title = 'Similarity score';
      scoreEl.style.color = this.theme.textMuted;
      nodesRow.appendChild(scoreEl);
    }

    card.appendChild(nodesRow);

    // ─── Signal badges row (tags + shared links) ──────
    const hasTags = gap.sharedTags.length > 0;
    const hasLinks = gap.sharedLinks && gap.sharedLinks.length > 0;

    if (hasTags || hasLinks) {
      const badgesRow = document.createElement('div');
      badgesRow.className = 'bp-gap-tags-row';

      for (const tag of gap.sharedTags) {
        const badge = document.createElement('span');
        badge.className = 'bp-gap-tag-badge';
        badge.textContent = tag;
        badge.style.background = this.theme.buttonBg;
        badge.style.border = `1px solid ${this.theme.buttonBorder}`;
        badge.style.color = this.theme.panelText;
        badgesRow.appendChild(badge);
      }

      if (hasLinks) {
        const linkCount = gap.sharedLinks.length;
        // Show up to 2 named shared links, then "+N more"
        const displayLinks = gap.sharedLinks.slice(0, 2);
        for (const linkedId of displayLinks) {
          const linkedNode = nodeMap[linkedId];
          const badge = document.createElement('span');
          badge.className = 'bp-gap-tag-badge bp-gap-link-badge';
          const label = linkedNode ? linkedNode.title : linkedId;
          badge.textContent = '\u2192 ' + label;
          badge.title = 'Shared link: both notes link to "' + label + '"';
          badge.style.background = this.theme.buttonBg;
          badge.style.border = `1px solid ${this.theme.buttonBorder}`;
          badge.style.color = this.theme.panelText;
          badge.addEventListener('click', () => {
            this.callbacks.onNodeClick(linkedId);
          });
          badgesRow.appendChild(badge);
        }
        if (linkCount > 2) {
          const moreBadge = document.createElement('span');
          moreBadge.className = 'bp-gap-tag-badge';
          moreBadge.textContent = `+${linkCount - 2} shared`;
          moreBadge.title = `${linkCount - 2} more shared link targets`;
          moreBadge.style.background = this.theme.buttonBg;
          moreBadge.style.border = `1px solid ${this.theme.buttonBorder}`;
          moreBadge.style.color = this.theme.panelText;
          badgesRow.appendChild(moreBadge);
        }
      }

      card.appendChild(badgesRow);
    }

    // ─── Reason text ──────────────────────────────────
    if (gap.reason) {
      const reasonEl = document.createElement('div');
      reasonEl.className = 'bp-gap-reason';
      reasonEl.textContent = gap.reason;
      reasonEl.style.color = this.theme.textMuted;
      card.appendChild(reasonEl);
    }

    // ─── Action button row ─────────────────────────────
    const actionRow = document.createElement('div');
    actionRow.className = 'bp-gap-action-row';

    const makeActionBtn = (text: string, danger = false): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.className = danger ? 'bp-gap-btn bp-gap-btn--danger' : 'bp-gap-btn';
      btn.textContent = text;
      btn.style.background = this.theme.buttonBg;
      btn.style.border = `1px solid ${this.theme.buttonBorder}`;
      btn.style.color = this.theme.buttonText;
      return btn;
    };

    // Link button — creates link, transforms card to "linked" state
    const linkBtn = makeActionBtn('Link');

    // Unlink button — undoes the link, then removes the card
    const unlinkBtn = makeActionBtn('Unlink', true);
    unlinkBtn.style.display = 'none';

    // Status label
    const statusEl = document.createElement('span');
    statusEl.className = 'bp-gap-status';
    statusEl.style.display = 'none';
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
    if (this.visible) {
      this.hide();
    } else {
      // Show without re-rendering — caller should use show() with data for initial display
      this.visible = true;
      this.el.style.display = 'flex';
    }
  }

  /** Whether the panel is currently visible. */
  isVisible(): boolean {
    return this.visible;
  }

  /** Update theme colors. */
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
