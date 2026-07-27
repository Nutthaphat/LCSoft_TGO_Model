import { ProjectListItem, ProjectWorkspace } from '../../models/domain.model';
import { EmissionDatabaseSnapshot } from '../../models/domain.model';

export interface ElectronAppInfo {
  isElectron: boolean;
  dbPath: string;
  userDataPath: string;
}

export interface ElectronApi {
  getInfo: () => Promise<ElectronAppInfo>;
  emission: {
    load: () => Promise<EmissionDatabaseSnapshot | null>;
    save: (snapshot: EmissionDatabaseSnapshot) => Promise<{ ok: boolean }>;
  };
  projects: {
    list: () => Promise<ProjectListItem[]>;
    get: (id: string) => Promise<ProjectWorkspace | null>;
    save: (workspace: ProjectWorkspace) => Promise<{ ok: boolean }>;
    delete: (id: string) => Promise<{ ok: boolean }>;
    getActiveId: () => Promise<string | null>;
    setActiveId: (id: string | null) => Promise<{ ok: boolean }>;
  };
  backup: () => Promise<{ ok: boolean; backupPath: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}

export function getElectronApi(): ElectronApi | null {
  return typeof window !== 'undefined' && window.electronAPI ? window.electronAPI : null;
}

export function isElectronRuntime(): boolean {
  return getElectronApi() !== null;
}
