// ─── Organic Controls Panel — Sliders for force parameters ───
// DOM-based overlay panel matching Obsidian's Graph View style.
// Zero Obsidian dependencies.

import type { OrganicForceSettings, FontStyle, ViewProfile, ViewMode } from '../types';
import type { ThemeColors } from './theme';

export interface OrganicControlsCallbacks {
  onForceChange: (forces: OrganicForceSettings) => void;
  onAnimate: () => void;
  onFontChange?: (family: string, style: FontStyle) => void;
  onProfileSave?: (name: string) => void;
  onProfileLoad?: (profile: ViewProfile) => void;
  onProfileDelete?: (name: string) => void;
}

export class OrganicControlsPanel {
  private el: HTMLDivElement;
  private container: HTMLDivElement;
  private callbacks: OrganicControlsCallbacks;
  private forces: OrganicForceSettings;
  private visible = false;
  private fontFamily: string;
  private fontStyle: FontStyle;
  private profiles: ViewProfile[] = [];
  private viewMode: ViewMode = 'organic';
  private organicSizing = true;

  constructor(
    container: HTMLDivElement,
    callbacks: OrganicControlsCallbacks,
    forces: OrganicForceSettings,
    theme: ThemeColors,
    fontFamily = 'system-ui',
    fontStyle: FontStyle = 'bold',
    profiles: ViewProfile[] = [],
    viewMode: ViewMode = 'organic',
    organicSizing = true,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.forces = { ...forces };
    this.fontFamily = fontFamily;
    this.fontStyle = fontStyle;
    this.profiles = profiles;
    this.viewMode = viewMode;
    this.organicSizing = organicSizing;

    this.el = document.createElement('div');
    this.el.className = 'blueprint-organic-controls';
    this.el.style.display = 'none'; // Explicitly hidden — only shown via Controls toolbar button
    this.container.appendChild(this.el);

    this.render();
  }

  show(): void {
    this.visible = true;
    this.el.style.display = 'block';
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  setForces(forces: OrganicForceSettings): void {
    this.forces = { ...forces };
    this.render();
  }

  setProfiles(profiles: ViewProfile[]): void {
    this.profiles = [...profiles];
    this.render();
  }

  setViewState(viewMode: ViewMode, organicSizing: boolean): void {
    this.viewMode = viewMode;
    this.organicSizing = organicSizing;
  }

  setTheme(_theme: ThemeColors): void {
    // Theme handled via CSS vars
  }

  destroy(): void {
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  private render(): void {
    // Clear existing content safely
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    // ─── Display section ─────────────────────────────
    this.addSectionHeader('Display');

    this.addToggle('Arrows', this.forces.arrows, (val) => {
      this.forces.arrows = val;
      this.emit();
    });

    this.addSlider('Text fade threshold', this.forces.textFadeThreshold, 0, 1, 0.01, (val) => {
      this.forces.textFadeThreshold = val;
      this.emit();
    });

    this.addSlider('Node size', this.forces.nodeSize, 0.1, 1, 0.01, (val) => {
      this.forces.nodeSize = val;
      this.emit();
    });

    this.addSlider('Link thickness', this.forces.linkThickness, 0.1, 1, 0.01, (val) => {
      this.forces.linkThickness = val;
      this.emit();
    });

    // ─── Typography section ──────────────────────────
    this.addSectionHeader('Typography');

    this.addDropdown('Font', this.fontFamily, [
      { value: 'system-ui', label: 'System UI' },
      { value: 'Inter, sans-serif', label: 'Inter' },
      { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
      { value: 'Arial, sans-serif', label: 'Arial' },
      { value: 'Georgia, serif', label: 'Georgia' },
      { value: "'Courier New', monospace", label: 'Courier New' },
      { value: 'monospace', label: 'Monospace' },
      { value: "'Segoe UI', sans-serif", label: 'Segoe UI' },
      { value: "'SF Pro', system-ui, sans-serif", label: 'SF Pro' },
      { value: 'Verdana, sans-serif', label: 'Verdana' },
      { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
      { value: "'Palatino Linotype', serif", label: 'Palatino' },
    ], (val) => {
      this.fontFamily = val;
      this.callbacks.onFontChange?.(this.fontFamily, this.fontStyle);
    });

    this.addDropdown('Style', this.fontStyle, [
      { value: 'bold', label: 'Bold' },
      { value: 'normal', label: 'Normal' },
      { value: 'italic', label: 'Italic' },
    ], (val) => {
      this.fontStyle = val as FontStyle;
      this.callbacks.onFontChange?.(this.fontFamily, this.fontStyle);
    });

    // ─── Profiles section ─────────────────────────────
    this.addSectionHeader('Profiles');
    this.renderProfileControls();

    // Redistribute button
    const animBtn = document.createElement('button');
    animBtn.className = 'blueprint-organic-animate-btn';
    animBtn.textContent = 'Redistribute';
    animBtn.title = 'Restart physics simulation — nodes rearrange to reduce overlap and find optimal positions';
    animBtn.addEventListener('click', () => this.callbacks.onAnimate());
    this.el.appendChild(animBtn);

    // ─── Forces section ──────────────────────────────
    this.addSectionHeader('Forces');

    this.addSlider('Center force', this.forces.centerForce, 0, 1, 0.01, (val) => {
      this.forces.centerForce = val;
      this.emit();
    });

    this.addSlider('Repel force', this.forces.repelForce, 0, 1, 0.01, (val) => {
      this.forces.repelForce = val;
      this.emit();
    });

    this.addSlider('Link force', this.forces.linkForce, 0, 1, 0.01, (val) => {
      this.forces.linkForce = val;
      this.emit();
    });

    this.addSlider('Link distance', this.forces.linkDistance, 0, 1, 0.01, (val) => {
      this.forces.linkDistance = val;
      this.emit();
    });
  }

  private addSectionHeader(label: string): void {
    const header = document.createElement('div');
    header.className = 'blueprint-organic-section';
    header.textContent = label;
    this.el.appendChild(header);
  }

  private addSlider(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'blueprint-organic-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'blueprint-organic-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'blueprint-organic-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    slider.addEventListener('input', () => {
      onChange(parseFloat(slider.value));
    });
    row.appendChild(slider);

    this.el.appendChild(row);
  }

  private addToggle(
    label: string,
    value: boolean,
    onChange: (val: boolean) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'blueprint-organic-row blueprint-organic-toggle-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'blueprint-organic-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const toggle = document.createElement('div');
    toggle.className = 'blueprint-organic-toggle' + (value ? ' is-active' : '');
    toggle.addEventListener('click', () => {
      const newVal = !toggle.classList.contains('is-active');
      if (newVal) toggle.classList.add('is-active');
      else toggle.classList.remove('is-active');
      onChange(newVal);
    });

    const knob = document.createElement('div');
    knob.className = 'blueprint-organic-toggle-knob';
    toggle.appendChild(knob);
    row.appendChild(toggle);

    this.el.appendChild(row);
  }

  private addDropdown(
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (val: string) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'blueprint-organic-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'blueprint-organic-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const select = document.createElement('select');
    select.className = 'blueprint-organic-dropdown';
    for (const opt of options) {
      const optEl = document.createElement('option');
      optEl.value = opt.value;
      optEl.textContent = opt.label;
      if (opt.value === value) optEl.selected = true;
      select.appendChild(optEl);
    }
    select.addEventListener('change', () => {
      onChange(select.value);
    });
    row.appendChild(select);

    this.el.appendChild(row);
  }

  private renderProfileControls(): void {
    // Profile selector + load
    if (this.profiles.length > 0) {
      const loadRow = document.createElement('div');
      loadRow.className = 'blueprint-organic-row blueprint-profile-row';

      const select = document.createElement('select');
      select.className = 'blueprint-organic-dropdown blueprint-profile-select';
      for (const p of this.profiles) {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        select.appendChild(opt);
      }
      loadRow.appendChild(select);

      const loadBtn = document.createElement('button');
      loadBtn.className = 'blueprint-organic-animate-btn blueprint-profile-btn';
      loadBtn.textContent = 'Load';
      loadBtn.title = 'Apply this profile';
      loadBtn.addEventListener('click', () => {
        const profile = this.profiles.find(p => p.name === select.value);
        if (profile) this.callbacks.onProfileLoad?.(profile);
      });
      loadRow.appendChild(loadBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'blueprint-organic-animate-btn blueprint-profile-btn blueprint-profile-btn-danger';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete this profile';
      delBtn.addEventListener('click', () => {
        this.callbacks.onProfileDelete?.(select.value);
      });
      loadRow.appendChild(delBtn);

      this.el.appendChild(loadRow);
    }

    // Save current as new profile
    const saveRow = document.createElement('div');
    saveRow.className = 'blueprint-organic-row blueprint-profile-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'blueprint-organic-dropdown blueprint-profile-input';
    nameInput.placeholder = 'Profile name...';
    saveRow.appendChild(nameInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'blueprint-organic-animate-btn blueprint-profile-btn';
    saveBtn.textContent = 'Save';
    saveBtn.title = 'Save current settings as a profile';
    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (name) this.callbacks.onProfileSave?.(name);
    });
    saveRow.appendChild(saveBtn);

    this.el.appendChild(saveRow);
  }

  private emit(): void {
    this.callbacks.onForceChange({ ...this.forces });
  }
}
