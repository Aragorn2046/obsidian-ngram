// ─── Interaction — Mouse/keyboard event handling ────────────
// Zero Obsidian dependencies. Binds to canvas + container only.

import type { NodeDef, WireDef, CategoryDef, GroupDef } from '../types';
import {
  type ViewTransform,
  toWorld,
  isNodeVisible,
  getWireNodeIds,
  resolveWireEndpoint,
  NODE_W,
  PIN_H,
  PIN_R,
} from './canvas';

// ─── Callbacks ──────────────────────────────────────────────

export interface InteractionCallbacks {
  onNodeClick: (nodeId: string, shiftKey: boolean, ctrlKey: boolean) => void;
  onNodeHover: (nodeId: string | null) => void;
  onWireHover: (wireIndex: number | null) => void;
  onPanZoomChange: (panX: number, panY: number, zoom: number) => void;
  onBackgroundClick: () => void;
  onEscape: () => void;
  onSearchFocus: () => void;
  onNodeDragStart: (nodeId: string) => void;
  onNodeDragEnd: (nodeId: string, x: number, y: number) => void;
  onContextMenu: (nodeId: string | null, screenX: number, screenY: number) => void;
  onWireDraw: (fromNodeId: string, toNodeId: string) => void;
  onGroupClick: (groupLabel: string) => void;
  requestRedraw: () => void;
  onLassoComplete: (nodeIds: string[]) => void;
}

// ─── Data Accessors ─────────────────────────────────────────

export interface InteractionDataAccessors {
  getViewTransform: () => ViewTransform;
  setViewTransform: (vt: ViewTransform) => void;
  getNodes: () => NodeDef[];
  getWires: () => WireDef[];
  getNodeMap: () => Record<string, NodeDef>;
  getCategories: () => Record<string, CategoryDef>;
  getViewMode?: () => 'schematic' | 'organic';
  getOrganicRadii?: () => Map<string, number>;
  getGroups?: () => GroupDef[];
  getCollapsedNodeIds?: () => Set<string>;
}

// ─── Listener record for cleanup ────────────────────────────

interface ListenerRecord {
  target: EventTarget;
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: AddEventListenerOptions;
}

// ─── InteractionManager ─────────────────────────────────────

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private container: HTMLDivElement;
  private data: InteractionDataAccessors;
  private callbacks: InteractionCallbacks;
  private listeners: ListenerRecord[] = [];

  // Drag state
  private dragging: NodeDef | null = null;
  private dragOff = { x: 0, y: 0 };
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private didDrag = false;
  public mouseX = 0;
  public mouseY = 0;

  // Wire-draw state
  private wireDrawing = false;
  private wireDrawSource: NodeDef | null = null;
  private wireDrawEndX = 0;
  private wireDrawEndY = 0;

  // Lasso state
  private lassoMode = false;
  private lassoPoints: { x: number; y: number }[] = [];
  private lassoActive = false;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLDivElement,
    data: InteractionDataAccessors,
    callbacks: InteractionCallbacks,
  ) {
    this.canvas = canvas;
    this.container = container;
    this.data = data;
    this.callbacks = callbacks;
    this.bindEvents();
  }

  // ─── Event Binding ──────────────────────────────────────

  private addListener(
    target: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(event, handler, options);
    this.listeners.push({ target, event, handler, options });
  }

  private bindEvents(): void {
    // Mouse events on canvas
    this.addListener(this.canvas, 'mousedown', this.onMouseDown);
    this.addListener(this.canvas, 'mousemove', this.onMouseMove);
    this.addListener(this.canvas, 'mouseup', this.onMouseUp);
    this.addListener(this.canvas, 'dblclick', this.onDoubleClick);
    this.addListener(this.canvas, 'wheel', this.onWheel, { passive: false });
    this.addListener(this.canvas, 'contextmenu', this.onContextMenu);

    // Touch events on canvas (mobile support)
    this.addListener(this.canvas, 'touchstart', this.onTouchStart, { passive: false });
    this.addListener(this.canvas, 'touchmove', this.onTouchMove, { passive: false });
    this.addListener(this.canvas, 'touchend', this.onTouchEnd, { passive: false });

    // Keyboard events on container
    this.addListener(this.container, 'keydown', this.onKeyDown);
  }

  // ─── Touch State ────────────────────────────────────────

  private touchStartDist = 0;       // distance between two fingers at pinch start
  private touchStartZoom = 1;       // zoom at pinch start
  private touchStartPanX = 0;       // panX at pinch start
  private touchStartPanY = 0;       // panY at pinch start
  private touchStartMidX = 0;       // midpoint X at pinch start
  private touchStartMidY = 0;       // midpoint Y at pinch start
  private lastTapTime = 0;          // timestamp of last tap (for double-tap detection)
  private lastTapNodeId: string | null = null;

  private getTouchPos(touch: Touch): { mx: number; my: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { mx: touch.clientX - rect.left, my: touch.clientY - rect.top };
  }

  private onTouchStart = (e: Event): void => {
    const te = e as TouchEvent;
    te.preventDefault();

    if (te.touches.length === 1) {
      // Single finger — treat like mousedown
      const { mx, my } = this.getTouchPos(te.touches[0]);
      this.mouseX = mx;
      this.mouseY = my;

      const n = this.getNodeAt(mx, my);
      if (n) {
        const vt = this.data.getViewTransform();
        this.dragging = n;
        this.dragOff.x = (mx - vt.panX) / vt.zoom - n.x;
        this.dragOff.y = (my - vt.panY) / vt.zoom - n.y;
        this.callbacks.onNodeDragStart(n.id);
      } else {
        const vt = this.data.getViewTransform();
        this.isPanning = true;
        this.panStart.x = mx - vt.panX;
        this.panStart.y = my - vt.panY;
      }
      this.didDrag = false;

    } else if (te.touches.length === 2) {
      // Two fingers — pinch-to-zoom
      this.dragging = null;
      this.isPanning = false;
      const t0 = this.getTouchPos(te.touches[0]);
      const t1 = this.getTouchPos(te.touches[1]);
      this.touchStartDist = Math.hypot(t1.mx - t0.mx, t1.my - t0.my);
      const vt = this.data.getViewTransform();
      this.touchStartZoom = vt.zoom;
      this.touchStartPanX = vt.panX;
      this.touchStartPanY = vt.panY;
      this.touchStartMidX = (t0.mx + t1.mx) / 2;
      this.touchStartMidY = (t0.my + t1.my) / 2;
    }
  };

  private onTouchMove = (e: Event): void => {
    const te = e as TouchEvent;
    te.preventDefault();

    if (te.touches.length === 1) {
      const { mx, my } = this.getTouchPos(te.touches[0]);
      this.mouseX = mx;
      this.mouseY = my;
      this.didDrag = true;

      if (this.dragging) {
        const vt = this.data.getViewTransform();
        this.dragging.x = (mx - vt.panX) / vt.zoom - this.dragOff.x;
        this.dragging.y = (my - vt.panY) / vt.zoom - this.dragOff.y;
        this.callbacks.requestRedraw();
      } else if (this.isPanning) {
        const vt = this.data.getViewTransform();
        const newPanX = mx - this.panStart.x;
        const newPanY = my - this.panStart.y;
        this.data.setViewTransform({ panX: newPanX, panY: newPanY, zoom: vt.zoom });
        this.callbacks.onPanZoomChange(newPanX, newPanY, vt.zoom);
        this.callbacks.requestRedraw();
      }

    } else if (te.touches.length === 2 && this.touchStartDist > 0) {
      // Pinch-to-zoom
      const t0 = this.getTouchPos(te.touches[0]);
      const t1 = this.getTouchPos(te.touches[1]);
      const dist = Math.hypot(t1.mx - t0.mx, t1.my - t0.my);
      const scale = dist / this.touchStartDist;
      let newZoom = Math.max(0.15, Math.min(2.5, this.touchStartZoom * scale));

      // Zoom anchored to pinch midpoint
      const midX = (t0.mx + t1.mx) / 2;
      const midY = (t0.my + t1.my) / 2;
      const wx = (this.touchStartMidX - this.touchStartPanX) / this.touchStartZoom;
      const wy = (this.touchStartMidY - this.touchStartPanY) / this.touchStartZoom;
      const newPanX = midX - wx * newZoom;
      const newPanY = midY - wy * newZoom;

      this.data.setViewTransform({ panX: newPanX, panY: newPanY, zoom: newZoom });
      this.callbacks.onPanZoomChange(newPanX, newPanY, newZoom);
      this.callbacks.requestRedraw();
    }
  };

  private onTouchEnd = (e: Event): void => {
    const te = e as TouchEvent;
    te.preventDefault();

    if (te.changedTouches.length >= 1 && !this.didDrag) {
      const { mx, my } = this.getTouchPos(te.changedTouches[0]);
      const n = this.getNodeAt(mx, my);
      if (n) {
        // Double-tap detection (within 300ms on same node = focus)
        const now = Date.now();
        if (now - this.lastTapTime < 300 && this.lastTapNodeId === n.id) {
          // Double-tap: open the note
          this.callbacks.onNodeClick(n.id, false, true);
          this.lastTapTime = 0;
          this.lastTapNodeId = null;
        } else {
          // Single tap: select node
          this.callbacks.onNodeClick(n.id, false, false);
          this.lastTapTime = now;
          this.lastTapNodeId = n.id;
        }
      } else if (!this.dragging) {
        this.callbacks.onBackgroundClick();
      }
    }

    if (this.dragging) {
      this.callbacks.onNodeDragEnd(this.dragging.id, this.dragging.x, this.dragging.y);
    }

    this.dragging = null;
    this.isPanning = false;
    this.didDrag = false;
    this.touchStartDist = 0;
  };

  // ─── Hit Testing ────────────────────────────────────────

  /** Find node at screen position (reverse iteration — top-drawn nodes first) */
  getNodeAt(mx: number, my: number): NodeDef | null {
    const vt = this.data.getViewTransform();
    const categories = this.data.getCategories();
    const world = toWorld(mx, my, vt);
    const nodes = this.data.getNodes();
    const isOrganic = this.data.getViewMode?.() === 'organic';
    const radii = isOrganic ? this.data.getOrganicRadii?.() : null;
    const collapsedNodeIds = this.data.getCollapsedNodeIds?.();

    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!isNodeVisible(n, categories)) continue;
      // Skip nodes in collapsed groups
      if (collapsedNodeIds && collapsedNodeIds.has(n.id)) continue;

      if (isOrganic && radii) {
        // Circular hit-test: node center is (n.x, n.y)
        const r = radii.get(n.id) ?? 35;
        const dx = world.x - n.x;
        const dy = world.y - n.y;
        if (dx * dx + dy * dy <= r * r) {
          return n;
        }
      } else {
        // Rectangular hit-test
        const nw = (n as any).w ?? NODE_W;
        const nh = (n as any).h ?? 60;
        if (
          world.x >= n.x &&
          world.x <= n.x + nw &&
          world.y >= n.y &&
          world.y <= n.y + nh
        ) {
          return n;
        }
      }
    }
    return null;
  }

  /** Find collapsed group pill at screen position */
  getCollapsedGroupAt(mx: number, my: number): GroupDef | null {
    const groups = this.data.getGroups?.();
    if (!groups) return null;
    const vt = this.data.getViewTransform();

    for (const group of groups) {
      if (!group.collapsed) continue;

      // Collapsed pill: centered in group bounds, 180x50 world units
      const pillW = 180;
      const pillH = 50;
      const cx = group.x + group.w / 2;
      const cy = group.y + group.h / 2;
      const px = cx - pillW / 2;
      const py = cy - pillH / 2;

      const world = toWorld(mx, my, vt);
      if (world.x >= px && world.x <= px + pillW &&
          world.y >= py && world.y <= py + pillH) {
        return group;
      }
    }
    return null;
  }

  /** Check if a screen position is near an output pin of a node */
  getPinAt(mx: number, my: number): { node: NodeDef; side: 'out' } | null {
    const vt = this.data.getViewTransform();
    const categories = this.data.getCategories();
    const nodes = this.data.getNodes();
    const hitR = Math.max(12, PIN_R * vt.zoom * 2); // generous hit area

    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!isNodeVisible(n, categories)) continue;
      const nw = (n as any).w ?? NODE_W;
      const hh = (n as any).headerH ?? 26;
      const ph = PIN_H * vt.zoom;

      // Check output pins (right edge)
      for (let pi = 0; pi < n.pins.out.length; pi++) {
        const px = (n.x + nw) * vt.zoom + vt.panX;
        const py = (n.y + hh + pi * PIN_H + PIN_H / 2 + 4) * vt.zoom + vt.panY;
        const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
        if (dist < hitR) {
          return { node: n, side: 'out' };
        }
      }
    }
    return null;
  }

  /** Enable lasso selection mode */
  setLassoMode(enabled: boolean): void {
    this.lassoMode = enabled;
    this.lassoPoints = [];
    this.canvas.style.cursor = enabled ? 'crosshair' : 'default';
  }

  isLassoMode(): boolean {
    return this.lassoMode;
  }

  getLassoPoints(): { x: number; y: number }[] {
    return this.lassoPoints;
  }

  /** Get current wire-draw state for rendering the temporary wire */
  getWireDrawState(): { active: boolean; sourceNode: NodeDef | null; endX: number; endY: number } {
    return {
      active: this.wireDrawing,
      sourceNode: this.wireDrawSource,
      endX: this.wireDrawEndX,
      endY: this.wireDrawEndY,
    };
  }

  /** Find wire at screen position (bezier sampling with threshold=8) */
  getWireAt(mx: number, my: number): number | null {
    const vt = this.data.getViewTransform();
    const categories = this.data.getCategories();
    const nodeMap = this.data.getNodeMap();
    const wires = this.data.getWires();
    const threshold = 8;

    for (let idx = wires.length - 1; idx >= 0; idx--) {
      const w = wires[idx];
      const ends = getWireNodeIds(w);
      const fromNode = nodeMap[ends.from];
      const toNode = nodeMap[ends.to];
      if (!fromNode || !toNode) continue;
      if (!isNodeVisible(fromNode, categories) || !isNodeVisible(toNode, categories)) continue;

      const p1 = resolveWireEndpoint(w.from, nodeMap);
      const p2 = resolveWireEndpoint(w.to, nodeMap);
      const x1 = p1.x * vt.zoom + vt.panX;
      const y1 = p1.y * vt.zoom + vt.panY;
      const x2 = p2.x * vt.zoom + vt.panX;
      const y2 = p2.y * vt.zoom + vt.panY;
      const dx = Math.abs(x2 - x1) * 0.5;

      for (let t = 0; t <= 1; t += 0.05) {
        const it = 1 - t;
        const bx =
          it * it * it * x1 +
          3 * it * it * t * (x1 + dx) +
          3 * it * t * t * (x2 - dx) +
          t * t * t * x2;
        const by =
          it * it * it * y1 +
          3 * it * it * t * y1 +
          3 * it * t * t * y2 +
          t * t * t * y2;
        const d = Math.sqrt((mx - bx) * (mx - bx) + (my - by) * (my - by));
        if (d < threshold) return idx;
      }
    }
    return null;
  }

  // ─── Mouse Handlers ─────────────────────────────────────

  private onMouseDown = (e: Event): void => {
    const me = e as MouseEvent;
    this.didDrag = false;
    const rect = this.canvas.getBoundingClientRect();
    const mx = me.clientX - rect.left;
    const my = me.clientY - rect.top;

    // Lasso mode: left button starts recording lasso polygon
    if (this.lassoMode && me.button === 0) {
      const vt = this.data.getViewTransform();
      const worldPos = toWorld(mx, my, vt);
      this.lassoPoints = [worldPos];
      this.lassoActive = true;
      return;
    }

    // Check for pin hit first (wire-draw mode)
    const pinHit = this.getPinAt(mx, my);
    if (pinHit) {
      this.wireDrawing = true;
      this.wireDrawSource = pinHit.node;
      this.wireDrawEndX = mx;
      this.wireDrawEndY = my;
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    const n = this.getNodeAt(mx, my);
    if (n) {
      const vt = this.data.getViewTransform();
      this.dragging = n;
      this.dragOff.x = (mx - vt.panX) / vt.zoom - n.x;
      this.dragOff.y = (my - vt.panY) / vt.zoom - n.y;
      this.callbacks.onNodeDragStart(n.id);
    } else {
      const vt = this.data.getViewTransform();
      this.isPanning = true;
      this.panStart.x = mx - vt.panX;
      this.panStart.y = my - vt.panY;
    }
  };

  private onMouseMove = (e: Event): void => {
    const me = e as MouseEvent;
    const rect = this.canvas.getBoundingClientRect();
    const mx = me.clientX - rect.left;
    const my = me.clientY - rect.top;
    this.mouseX = mx;
    this.mouseY = my;

    if (this.lassoActive) {
      const vt = this.data.getViewTransform();
      const worldPos = toWorld(mx, my, vt);
      this.lassoPoints.push(worldPos);
      this.callbacks.requestRedraw();
      return;
    }

    if (this.wireDrawing) {
      this.wireDrawEndX = mx;
      this.wireDrawEndY = my;
      // Highlight target node
      const target = this.getNodeAt(mx, my);
      if (target && target !== this.wireDrawSource) {
        this.canvas.style.cursor = 'copy';
      } else {
        this.canvas.style.cursor = 'crosshair';
      }
      this.callbacks.requestRedraw();
      return;
    }

    if (this.dragging) {
      this.didDrag = true;
      const vt = this.data.getViewTransform();
      this.dragging.x = (mx - vt.panX) / vt.zoom - this.dragOff.x;
      this.dragging.y = (my - vt.panY) / vt.zoom - this.dragOff.y;
      this.callbacks.requestRedraw();
    } else if (this.isPanning) {
      this.didDrag = true;
      const vt = this.data.getViewTransform();
      const newPanX = mx - this.panStart.x;
      const newPanY = my - this.panStart.y;
      this.data.setViewTransform({ panX: newPanX, panY: newPanY, zoom: vt.zoom });
      this.callbacks.onPanZoomChange(newPanX, newPanY, vt.zoom);
      this.callbacks.requestRedraw();
    } else {
      // Hover detection
      const n = this.getNodeAt(mx, my);
      if (n) {
        this.canvas.style.cursor = 'pointer';
        this.callbacks.onNodeHover(n.id);
        this.callbacks.onWireHover(null);
      } else {
        const group = this.getCollapsedGroupAt(mx, my);
        if (group) {
          this.canvas.style.cursor = 'pointer';
          this.callbacks.onNodeHover(null);
          this.callbacks.onWireHover(null);
        } else {
          const wi = this.getWireAt(mx, my);
          this.callbacks.onWireHover(wi);
          this.callbacks.onNodeHover(null);
          this.canvas.style.cursor = wi !== null ? 'crosshair' : 'default';
        }
      }
      this.callbacks.requestRedraw();
    }
  };

  private onMouseUp = (e: Event): void => {
    const me = e as MouseEvent;

    // Lasso completion
    if (this.lassoActive) {
      const polygon = this.lassoPoints;
      const nodes = this.data.getNodes();
      const categories = this.data.getCategories();
      const isOrganic = this.data.getViewMode?.() === 'organic';
      const radii = isOrganic ? this.data.getOrganicRadii?.() : null;
      const collapsedNodeIds = this.data.getCollapsedNodeIds?.();

      const selectedIds: string[] = [];
      for (const n of nodes) {
        if (!isNodeVisible(n, categories)) continue;
        if (collapsedNodeIds && collapsedNodeIds.has(n.id)) continue;

        let cx: number;
        let cy: number;
        if (isOrganic) {
          // Organic: node center is (n.x, n.y)
          cx = n.x;
          cy = n.y;
        } else {
          // Schematic: center of the node rectangle
          const nw = (n as any).w ?? NODE_W;
          const nh = (n as any).h ?? 60;
          cx = n.x + nw / 2;
          cy = n.y + nh / 2;
        }

        if (polygon.length >= 3 && this.isPointInPolygon(cx, cy, polygon)) {
          selectedIds.push(n.id);
        }
      }

      this.callbacks.onLassoComplete(selectedIds);

      // Reset lasso state
      this.lassoActive = false;
      this.lassoPoints = [];
      this.lassoMode = false;
      this.canvas.style.cursor = 'default';
      this.callbacks.requestRedraw();
      return;
    }

    // Wire-draw completion
    if (this.wireDrawing && this.wireDrawSource) {
      const rect = this.canvas.getBoundingClientRect();
      const mx = me.clientX - rect.left;
      const my = me.clientY - rect.top;
      const target = this.getNodeAt(mx, my);
      if (target && target !== this.wireDrawSource) {
        this.callbacks.onWireDraw(this.wireDrawSource.id, target.id);
      }
      this.wireDrawing = false;
      this.wireDrawSource = null;
      this.canvas.style.cursor = 'default';
      this.callbacks.requestRedraw();
      return;
    }

    if (!this.didDrag) {
      const rect = this.canvas.getBoundingClientRect();
      const mx = me.clientX - rect.left;
      const my = me.clientY - rect.top;
      const n = this.getNodeAt(mx, my);
      if (n) {
        this.callbacks.onNodeClick(n.id, me.shiftKey, me.ctrlKey || me.metaKey);
      } else {
        // Check for collapsed group pill click
        const group = this.getCollapsedGroupAt(mx, my);
        if (group) {
          this.callbacks.onGroupClick(group.label);
        } else {
          this.callbacks.onBackgroundClick();
        }
      }
    } else if (this.dragging) {
      // Node was dragged — fire drag-end for position persistence
      this.callbacks.onNodeDragEnd(this.dragging.id, this.dragging.x, this.dragging.y);
    }
    this.dragging = null;
    this.isPanning = false;
  };

  /** Find non-collapsed group at screen position (clicking on the group label area) */
  getGroupLabelAt(mx: number, my: number): GroupDef | null {
    const groups = this.data.getGroups?.();
    if (!groups) return null;
    const vt = this.data.getViewTransform();
    const world = toWorld(mx, my, vt);

    for (const group of groups) {
      if (group.collapsed) continue;
      // Label is drawn above the group box: x+10, y-4
      // Hit area: within group.x to group.x+group.w, group.y-30 to group.y
      if (world.x >= group.x && world.x <= group.x + group.w &&
          world.y >= group.y - 30 && world.y <= group.y + 5) {
        return group;
      }
    }
    return null;
  }

  private onDoubleClick = (e: Event): void => {
    const me = e as MouseEvent;
    const rect = this.canvas.getBoundingClientRect();
    const mx = me.clientX - rect.left;
    const my = me.clientY - rect.top;

    // Double-click on group label = toggle collapse
    const group = this.getGroupLabelAt(mx, my);
    if (group) {
      this.callbacks.onGroupClick(group.label);
      return;
    }
  };

  private onContextMenu = (e: Event): void => {
    const me = e as MouseEvent;
    me.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = me.clientX - rect.left;
    const my = me.clientY - rect.top;
    const n = this.getNodeAt(mx, my);
    this.callbacks.onContextMenu(n ? n.id : null, me.clientX, me.clientY);
  };

  private onWheel = (e: Event): void => {
    const we = e as WheelEvent;
    we.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mx = we.clientX - rect.left;
    const my = we.clientY - rect.top;

    const vt = this.data.getViewTransform();
    const wx = (mx - vt.panX) / vt.zoom;
    const wy = (my - vt.panY) / vt.zoom;

    let newZoom = vt.zoom * (we.deltaY < 0 ? 1.1 : 0.9);
    newZoom = Math.max(0.15, Math.min(2.5, newZoom));

    const newPanX = mx - wx * newZoom;
    const newPanY = my - wy * newZoom;

    this.data.setViewTransform({ panX: newPanX, panY: newPanY, zoom: newZoom });
    this.callbacks.onPanZoomChange(newPanX, newPanY, newZoom);
    this.callbacks.requestRedraw();
  };

  private onKeyDown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if ((ke.ctrlKey || ke.metaKey) && ke.key === 'f') {
      ke.preventDefault();
      this.callbacks.onSearchFocus();
    }
    if (ke.key === 'Escape') {
      this.callbacks.onEscape();
    }
  };

  // ─── Geometry Helpers ───────────────────────────────────

  /** Ray casting point-in-polygon test */
  private isPointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects =
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  // ─── Cleanup ────────────────────────────────────────────

  destroy(): void {
    for (const { target, event, handler, options } of this.listeners) {
      target.removeEventListener(event, handler, options);
    }
    this.listeners = [];
    this.canvas.style.cursor = 'default';
  }
}
