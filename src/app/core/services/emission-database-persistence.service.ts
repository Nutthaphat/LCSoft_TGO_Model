import { Injectable, signal } from '@angular/core';
import {
  EmissionDatabaseSnapshot,
  EmissionFactor,
  EmissionSource,
} from '../../models/domain.model';
import { getElectronApi } from '../electron/electron-api';

const DB_KEY = 'lcsoft.emission.database';

@Injectable({ providedIn: 'root' })
export class EmissionDatabasePersistenceService {
  private readonly readySignal = signal(false);
  private cache: EmissionDatabaseSnapshot | null = null;
  private mode: 'electron' | 'local' = 'local';

  readonly ready = this.readySignal.asReadonly();

  async init(): Promise<void> {
    const api = getElectronApi();
    if (api) {
      this.mode = 'electron';
      this.cache = await api.emission.load();
    } else {
      this.mode = 'local';
      this.cache = this.readJson<EmissionDatabaseSnapshot>(DB_KEY);
    }
    this.readySignal.set(true);
  }

  load(): EmissionDatabaseSnapshot | null {
    return this.cache ? structuredClone(this.cache) : null;
  }

  save(snapshot: EmissionDatabaseSnapshot): void {
    this.cache = structuredClone(snapshot);
    if (this.mode === 'electron') {
      void getElectronApi()?.emission.save(snapshot);
      return;
    }
    this.writeJson(DB_KEY, snapshot);
  }

  clear(): void {
    this.cache = null;
    if (this.mode === 'electron') {
      void getElectronApi()?.emission.save({
        sources: [],
        factors: [],
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    try {
      localStorage.removeItem(DB_KEY);
    } catch {
      // Ignore.
    }
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
}
