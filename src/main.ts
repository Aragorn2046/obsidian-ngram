import { Plugin, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_BLUEPRINT, DEFAULT_SETTINGS } from "./types";
import type { NgramSettings } from "./types";
import { BlueprintView } from "./view";
import { NgramSettingTab } from "./settings";

export default class NgramPlugin extends Plugin {
  settings: NgramSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_BLUEPRINT,
      (leaf: WorkspaceLeaf) => new BlueprintView(leaf, this)
    );

    this.addRibbonIcon("network", "Open Ngram", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-ngram",
      name: "Open Ngram",
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: "ngram-refresh",
      name: "Ngram: Refresh",
      checkCallback: (checking: boolean) => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_BLUEPRINT);
        if (leaves.length === 0) return false;
        if (!checking) {
          leaves.forEach((leaf) => {
            if (leaf.view instanceof BlueprintView) {
              leaf.view.forceRescan();
            }
          });
        }
        return true;
      },
    });

    this.addSettingTab(new NgramSettingTab(this.app, this));
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_BLUEPRINT)[0];

    if (!leaf) {
      const newLeaf = workspace.getLeaf("tab");
      await newLeaf.setViewState({
        type: VIEW_TYPE_BLUEPRINT,
        active: true,
      });
      leaf = newLeaf;
    }

    workspace.revealLeaf(leaf);
  }

  settingsChanged(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_BLUEPRINT).forEach((leaf) => {
      const view = leaf.view as BlueprintView;
      view.onSettingsChanged();
    });
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    // Preserve cache data when saving settings
    const existing = (await this.loadData()) || {};
    await this.saveData({ ...existing, ...this.settings });
  }
}
