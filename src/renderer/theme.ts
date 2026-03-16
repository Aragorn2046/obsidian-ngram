// ─── Theme — Color resolution for dark/light mode ───────────
// Zero Obsidian dependencies. Pure color constants.

import type { CategoryDef } from '../types';

export interface ThemeColors {
  // Canvas
  background: string;
  gridMinor: string;
  gridMajor: string;

  // Nodes
  nodeFill: string;
  nodeBorder: string;
  nodeShadow: string;
  headerDivider: string;

  // Pins
  pinFill: string;
  pinStroke: string;
  pinLabel: string;

  // Wires
  wireDefault: string;
  wireInactiveAlpha: number;
  wireActiveAlpha: number;
  wireNormalAlpha: number;

  // Selection
  selectionGlowAlpha: number;
  pathColor: string;
  searchHighlight: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // UI panels
  panelBg: string;
  panelBorder: string;
  panelText: string;
  panelTextMuted: string;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
  buttonHoverBg: string;
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
}

const DARK_THEME: ThemeColors = {
  background: '#000000',
  gridMinor: '#0a0d12',
  gridMajor: '#111827',

  nodeFill: '#0d1117',
  nodeBorder: '#1f2937',
  nodeShadow: 'rgba(0,0,0,0.6)',
  headerDivider: '#1f2937',

  pinFill: '#374151',
  pinStroke: '#4b5563',
  pinLabel: '#6b7280',

  wireDefault: '#374151',
  wireInactiveAlpha: 0.07,
  wireActiveAlpha: 0.85,
  wireNormalAlpha: 0.5,

  selectionGlowAlpha: 0.9,
  pathColor: '#22d3ee',
  searchHighlight: '#22d3ee',

  textPrimary: '#f3f4f6',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',

  panelBg: 'rgba(17,24,39,0.85)',
  panelBorder: 'rgba(55,65,81,0.5)',
  panelText: '#9ca3af',
  panelTextMuted: '#6b7280',
  buttonBg: 'rgba(31,41,55,0.5)',
  buttonBorder: 'rgba(55,65,81,0.5)',
  buttonText: '#9ca3af',
  buttonHoverBg: 'rgba(8,51,68,0.3)',
  inputBg: 'rgba(17,24,39,0.95)',
  inputBorder: 'rgba(55,65,81,0.5)',
  inputFocusBorder: '#22d3ee',
};

const LIGHT_THEME: ThemeColors = {
  background: '#f5f6f8',
  gridMinor: '#e8eaed',
  gridMajor: '#d5d8de',

  nodeFill: '#ffffff',
  nodeBorder: '#d0d3da',
  nodeShadow: 'rgba(0,0,0,0.1)',
  headerDivider: '#d0d3da',

  pinFill: '#aab',
  pinStroke: '#889',
  pinLabel: '#667',

  wireDefault: '#999',
  wireInactiveAlpha: 0.1,
  wireActiveAlpha: 0.9,
  wireNormalAlpha: 0.45,

  selectionGlowAlpha: 0.9,
  pathColor: '#0891b2',
  searchHighlight: '#0891b2',

  textPrimary: '#1a1d23',
  textSecondary: '#445',
  textMuted: '#889',

  panelBg: 'rgba(255,255,255,0.95)',
  panelBorder: '#d0d3da',
  panelText: '#445',
  panelTextMuted: '#889',
  buttonBg: 'rgba(240,242,245,0.9)',
  buttonBorder: '#d0d3da',
  buttonText: '#445',
  buttonHoverBg: '#e0e2e6',
  inputBg: 'rgba(255,255,255,0.95)',
  inputBorder: '#d0d3da',
  inputFocusBorder: '#0891b2',
};

/** Get theme colors for the given mode */
export function getTheme(mode: 'dark' | 'light'): ThemeColors {
  return mode === 'dark' ? DARK_THEME : LIGHT_THEME;
}

/** Resolve a category's colors with a helper to create alpha-suffixed hex strings */
export function resolveCategory(
  cat: CategoryDef,
  _mode: 'dark' | 'light',
): { color: string; dark: string; colorAlpha: (alpha: string) => string } {
  return {
    color: cat.color,
    dark: cat.dark,
    colorAlpha: (alpha: string) => cat.color + alpha,
  };
}
