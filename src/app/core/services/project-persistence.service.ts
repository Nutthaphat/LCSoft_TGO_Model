import { Injectable, signal } from '@angular/core';
import { getElectronApi, isElectronRuntime } from '../electron/electron-api';
import { ProjectListItem, ProjectWorkspace } from '../../models/domain.model';

const INDEX_KEY = 'lcsoft.projects.index';
const ACTIVE_KEY = 'lcsoft.projects.activeId';
const workspaceKey = (id: string): string => `lcsoft.projects.workspace.${id}`;

@Injectable({ providedIn: 'root' })
export class ProjectPersistenceService {
  private readonly readySignal = signal(false);
  private indexCache: ProjectListItem[] = [];
  private workspaceCache = new Map<string, ProjectWorkspace>();
  private activeIdCache: string | null = null;
  private mode: 'electron' | 'local' = 'local';

  readonly ready = this.readySignal.asReadonly();

  async init(): Promise<void> {
    const api = getElectronApi();
    if (api) {
      this.mode = 'electron';
      this.indexCache = (await api.projects.list()) ?? [];
      this.activeIdCache = await api.projects.getActiveId();
      this.workspaceCache.clear();
      for (const item of this.indexCache) {
        const workspace = await api.projects.get(item.id);
        if (workspace) {
          this.workspaceCache.set(item.id, workspace);
        }
      }
    } else {
      this.mode = 'local';
      this.indexCache = this.readJson<ProjectListItem[]>(INDEX_KEY) ?? [];
      this.activeIdCache = this.readRaw(ACTIVE_KEY);
      this.workspaceCache.clear();
      for (const item of this.indexCache) {
        const workspace = this.readJson<ProjectWorkspace>(workspaceKey(item.id));
        if (workspace) {
          this.workspaceCache.set(item.id, workspace);
        }
      }
    }
    this.readySignal.set(true);
  }

  isElectron(): boolean {
    return this.mode === 'electron' || isElectronRuntime();
  }

  loadIndex(): ProjectListItem[] {
    return [...this.indexCache];
  }

  saveIndex(items: ProjectListItem[]): void {
    this.indexCache = [...items];
    if (this.mode === 'local') {
      this.writeJson(INDEX_KEY, items);
      return;
    }
    // Electron index is derived from projects table; keep cache only.
  }

  loadActiveId(): string | null {
    return this.activeIdCache;
  }

  saveActiveId(id: string | null): void {
    this.activeIdCache = id;
    if (this.mode === 'electron') {
      void getElectronApi()?.projects.setActiveId(id);
      return;
    }
    if (id) {
      this.writeRaw(ACTIVE_KEY, id);
    } else {
      this.removeRaw(ACTIVE_KEY);
    }
  }

  loadWorkspace(id: string): ProjectWorkspace | null {
    return this.workspaceCache.get(id) ?? null;
  }

  saveWorkspace(workspace: ProjectWorkspace): void {
    this.workspaceCache.set(workspace.project.id, workspace);
    const item = this.toListItem(workspace);
    const without = this.indexCache.filter((entry) => entry.id !== item.id);
    this.indexCache = [item, ...without].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );

    if (this.mode === 'electron') {
      void getElectronApi()?.projects.save(workspace);
      return;
    }

    this.writeJson(workspaceKey(workspace.project.id), workspace);
    this.writeJson(INDEX_KEY, this.indexCache);
  }

  deleteWorkspace(id: string): void {
    this.workspaceCache.delete(id);
    this.indexCache = this.indexCache.filter((item) => item.id !== id);
    if (this.activeIdCache === id) {
      this.activeIdCache = this.indexCache[0]?.id ?? null;
    }

    if (this.mode === 'electron') {
      void getElectronApi()?.projects.delete(id);
      if (this.activeIdCache) {
        void getElectronApi()?.projects.setActiveId(this.activeIdCache);
      }
      return;
    }

    this.removeRaw(workspaceKey(id));
    this.writeJson(INDEX_KEY, this.indexCache);
    if (this.activeIdCache) {
      this.writeRaw(ACTIVE_KEY, this.activeIdCache);
    } else {
      this.removeRaw(ACTIVE_KEY);
    }
  }

  toListItem(workspace: ProjectWorkspace): ProjectListItem {
    const streamCarbon = workspace.streams.reduce(
      (sum, stream) => sum + stream.carbonFootprintKg,
      0,
    );
    const equipmentCarbon = workspace.equipment.reduce(
      (sum, item) => sum + item.carbonFootprintKg,
      0,
    );

    return {
      id: workspace.project.id,
      name: workspace.project.name,
      description: workspace.project.description,
      createdDate: workspace.project.createdDate,
      lastCalculationDate: workspace.project.lastCalculationDate,
      updatedAt: workspace.updatedAt,
      streamCount: workspace.streams.length,
      equipmentCount: workspace.equipment.length,
      totalCarbonKg: Math.round((streamCarbon + equipmentCarbon) * 1000) / 1000,
    };
  }

  private readJson<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore.
    }
  }

  private readRaw(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeRaw(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore.
    }
  }

  private removeRaw(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  }
}
