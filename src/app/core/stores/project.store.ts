import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import {
  CalculationResult,
  CreateProjectInput,
  Equipment,
  ProcessStream,
  Project,
  ProjectListItem,
  ProjectWorkspace,
} from '../../models/domain.model';
import {
  MOCK_CALCULATIONS,
  MOCK_EQUIPMENT,
  MOCK_PROJECT,
  MOCK_STREAMS,
} from '../mock/mock-data';
import { ProjectPersistenceService } from '../services/project-persistence.service';
import { EmissionDatabaseStore } from './emission-database.store';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly persistence = inject(ProjectPersistenceService);
  private readonly emissionDb = inject(EmissionDatabaseStore);

  private readonly projectSignal = signal<Project>(MOCK_PROJECT);
  private readonly streamsSignal = signal<ProcessStream[]>(MOCK_STREAMS);
  private readonly equipmentSignal = signal<Equipment[]>(MOCK_EQUIPMENT);
  private readonly calculationsSignal = signal<CalculationResult[]>(MOCK_CALCULATIONS);
  private readonly selectedStreamIdsSignal = signal<Set<string>>(
    new Set(MOCK_STREAMS.map((stream) => stream.id)),
  );
  private readonly selectedEquipmentIdsSignal = signal<Set<string>>(
    new Set(MOCK_EQUIPMENT.map((item) => item.id)),
  );
  private readonly projectListSignal = signal<ProjectListItem[]>([]);
  private readonly dirtySignal = signal(false);
  private readonly lastSummaryWarningCount = signal(0);
  private readonly initializedSignal = signal(false);

  readonly project = this.projectSignal.asReadonly();
  readonly streams = this.streamsSignal.asReadonly();
  readonly equipment = this.equipmentSignal.asReadonly();
  readonly emissionSources = this.emissionDb.sources;
  readonly emissionFactors = this.emissionDb.factors;
  readonly calculations = this.calculationsSignal.asReadonly();
  readonly selectedStreamIds = this.selectedStreamIdsSignal.asReadonly();
  readonly selectedEquipmentIds = this.selectedEquipmentIdsSignal.asReadonly();
  readonly projectList = this.projectListSignal.asReadonly();
  readonly isDirty = this.dirtySignal.asReadonly();
  readonly lastWarningCount = this.lastSummaryWarningCount.asReadonly();
  readonly initialized = this.initializedSignal.asReadonly();

  readonly selectedStreams = computed(() => {
    const selected = this.selectedStreamIdsSignal();
    return this.streamsSignal().filter((stream) => selected.has(stream.id));
  });

  readonly selectedEquipment = computed(() => {
    const selected = this.selectedEquipmentIdsSignal();
    return this.equipmentSignal().filter((item) => selected.has(item.id));
  });

  readonly streamCarbonKg = computed(() =>
    this.selectedStreams().reduce((sum, stream) => sum + stream.carbonFootprintKg, 0),
  );

  readonly equipmentCarbonKg = computed(() =>
    this.selectedEquipment().reduce((sum, item) => sum + item.carbonFootprintKg, 0),
  );

  readonly totalCarbonKg = computed(() => this.streamCarbonKg() + this.equipmentCarbonKg());

  constructor() {
    this.initialize();
  }

  setStreams(streams: ProcessStream[]): void {
    const projectId = this.projectSignal().id;
    const next = streams.map((stream) => ({ ...stream, projectId }));
    this.streamsSignal.set(next);
    this.syncSelectionIds(
      next.map((stream) => stream.id),
      this.selectedStreamIdsSignal,
    );
    this.markDirtyAndPersist();
  }

  setEquipment(equipment: Equipment[]): void {
    const projectId = this.projectSignal().id;
    const next = equipment.map((item) => ({ ...item, projectId }));
    this.equipmentSignal.set(next);
    this.syncSelectionIds(
      next.map((item) => item.id),
      this.selectedEquipmentIdsSignal,
    );
    this.markDirtyAndPersist();
  }

  toggleStreamSelection(streamId: string, checked: boolean): void {
    this.toggleSelectionId(this.selectedStreamIdsSignal, streamId, checked);
  }

  toggleEquipmentSelection(equipmentId: string, checked: boolean): void {
    this.toggleSelectionId(this.selectedEquipmentIdsSignal, equipmentId, checked);
  }

  selectAllEquipment(): void {
    this.selectedEquipmentIdsSignal.set(
      new Set(this.equipmentSignal().map((item) => item.id)),
    );
  }

  clearStreamSelection(): void {
    this.selectedStreamIdsSignal.set(new Set());
  }

  clearEquipmentSelection(): void {
    this.selectedEquipmentIdsSignal.set(new Set());
  }

  applyCalculationResult(payload: {
    streams: ProcessStream[];
    equipment: Equipment[];
    result: CalculationResult;
    warningCount?: number;
  }): void {
    this.streamsSignal.set(payload.streams);
    this.equipmentSignal.set(payload.equipment);
    this.calculationsSignal.update((existing) => [payload.result, ...existing]);
    this.projectSignal.update((project) => ({
      ...project,
      lastCalculationDate: payload.result.calculationDate,
    }));
    this.lastSummaryWarningCount.set(payload.warningCount ?? 0);
    this.markDirtyAndPersist();
  }

  clearCalculations(): void {
    if (this.calculationsSignal().length === 0) {
      return;
    }

    this.calculationsSignal.set([]);
    this.projectSignal.update((project) => ({
      ...project,
      lastCalculationDate: null,
    }));
    this.lastSummaryWarningCount.set(0);
    this.markDirtyAndPersist();
  }

  createProject(input: CreateProjectInput): Project {
    const id = `proj-${Date.now()}`;
    const createdDate = new Date().toISOString().slice(0, 10);
    const project: Project = {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      createdDate,
      lastCalculationDate: input.seedDemoData ? MOCK_PROJECT.lastCalculationDate : null,
      selectedEmissionSourceIds:
        input.selectedEmissionSourceIds.length > 0
          ? input.selectedEmissionSourceIds
          : MOCK_PROJECT.selectedEmissionSourceIds,
    };

    const workspace: ProjectWorkspace = input.seedDemoData
      ? {
          project: { ...MOCK_PROJECT, ...project, id },
          streams: MOCK_STREAMS.map((stream) => ({ ...stream, projectId: id })),
          equipment: MOCK_EQUIPMENT.map((item) => ({ ...item, projectId: id })),
          calculations: MOCK_CALCULATIONS.map((calc) => ({
            ...calc,
            projectId: id,
            projectName: project.name,
          })),
          updatedAt: new Date().toISOString(),
        }
      : {
          project,
          streams: [],
          equipment: [],
          calculations: [],
          updatedAt: new Date().toISOString(),
        };

    this.persistence.saveWorkspace(workspace);
    this.upsertListItem(workspace);
    this.loadWorkspaceIntoState(workspace);
    this.persistence.saveActiveId(id);
    this.dirtySignal.set(false);
    return workspace.project;
  }

  openProject(id: string): boolean {
    const workspace = this.persistence.loadWorkspace(id);
    if (!workspace) {
      return false;
    }
    this.loadWorkspaceIntoState(workspace);
    this.persistence.saveActiveId(id);
    this.dirtySignal.set(false);
    return true;
  }

  saveProject(): ProjectWorkspace {
    const workspace = this.currentWorkspace();
    this.persistence.saveWorkspace(workspace);
    this.upsertListItem(workspace);
    this.persistence.saveActiveId(workspace.project.id);
    this.dirtySignal.set(false);
    return workspace;
  }

  updateProjectMeta(patch: Partial<Pick<Project, 'name' | 'description' | 'selectedEmissionSourceIds'>>): void {
    this.projectSignal.update((project) => ({
      ...project,
      ...patch,
      name: patch.name?.trim() ?? project.name,
      description: patch.description?.trim() ?? project.description,
    }));
    this.markDirtyAndPersist();
  }

  updateStoredProjectMeta(
    id: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'selectedEmissionSourceIds'>>,
  ): boolean {
    if (this.projectSignal().id === id) {
      this.updateProjectMeta(patch);
      return true;
    }

    const workspace = this.persistence.loadWorkspace(id);
    if (!workspace) {
      return false;
    }

    const updated: ProjectWorkspace = {
      ...workspace,
      project: {
        ...workspace.project,
        ...patch,
        name: patch.name?.trim() ?? workspace.project.name,
        description: patch.description?.trim() ?? workspace.project.description,
      },
      updatedAt: new Date().toISOString(),
    };

    this.persistence.saveWorkspace(updated);
    this.upsertListItem(updated);
    return true;
  }

  deleteProject(id: string): void {
    this.persistence.deleteWorkspace(id);
    const remaining = this.projectListSignal().filter((item) => item.id !== id);
    this.projectListSignal.set(remaining);
    this.persistence.saveIndex(remaining);

    if (this.projectSignal().id === id) {
      if (remaining.length > 0) {
        this.openProject(remaining[0].id);
      } else {
        const demo = this.createProject({
          name: 'Bioethanol Process Demo',
          description: 'Seeded demo project.',
          selectedEmissionSourceIds: MOCK_PROJECT.selectedEmissionSourceIds,
          seedDemoData: true,
        });
        void demo;
      }
    }
  }

  duplicateProject(id: string): Project | null {
    const source = this.persistence.loadWorkspace(id);
    if (!source) {
      return null;
    }

    const newId = `proj-${Date.now()}`;
    const name = `${source.project.name} (Copy)`;
    const workspace: ProjectWorkspace = {
      project: {
        ...source.project,
        id: newId,
        name,
        createdDate: new Date().toISOString().slice(0, 10),
      },
      streams: source.streams.map((stream) => ({
        ...stream,
        id: `${stream.id}-copy-${newId}`,
        projectId: newId,
      })),
      equipment: source.equipment.map((item) => ({
        ...item,
        id: `${item.id}-copy-${newId}`,
        projectId: newId,
      })),
      calculations: source.calculations.map((calc) => ({
        ...calc,
        id: `${calc.id}-copy-${newId}`,
        projectId: newId,
        projectName: name,
      })),
      updatedAt: new Date().toISOString(),
    };

    this.persistence.saveWorkspace(workspace);
    this.upsertListItem(workspace);
    this.loadWorkspaceIntoState(workspace);
    this.persistence.saveActiveId(newId);
    this.dirtySignal.set(false);
    return workspace.project;
  }

  exportActiveProject(): string {
    return JSON.stringify(this.currentWorkspace(), null, 2);
  }

  importProjectFromJson(raw: string): Project {
    const parsed = JSON.parse(raw) as ProjectWorkspace;
    if (!parsed?.project?.name || !Array.isArray(parsed.streams) || !Array.isArray(parsed.equipment)) {
      throw new Error('Invalid project file');
    }

    const id = `proj-${Date.now()}`;
    const workspace: ProjectWorkspace = {
      project: {
        ...parsed.project,
        id,
        name: parsed.project.name,
        createdDate: parsed.project.createdDate || new Date().toISOString().slice(0, 10),
      },
      streams: (parsed.streams ?? []).map((stream, index) => ({
        ...stream,
        id: stream.id || `str-import-${index}`,
        projectId: id,
      })),
      equipment: (parsed.equipment ?? []).map((item, index) => ({
        ...item,
        id: item.id || `eq-import-${index}`,
        projectId: id,
      })),
      calculations: (parsed.calculations ?? []).map((calc, index) => ({
        ...calc,
        id: calc.id || `calc-import-${index}`,
        projectId: id,
        projectName: parsed.project.name,
      })),
      updatedAt: new Date().toISOString(),
    };

    this.persistence.saveWorkspace(workspace);
    this.upsertListItem(workspace);
    this.loadWorkspaceIntoState(workspace);
    this.persistence.saveActiveId(id);
    this.dirtySignal.set(false);
    return workspace.project;
  }

  private initialize(): void {
    let index = this.persistence.loadIndex();

    if (index.length === 0) {
      const demoWorkspace = this.buildDemoWorkspace();
      this.persistence.saveWorkspace(demoWorkspace);
      index = [this.persistence.toListItem(demoWorkspace)];
      this.persistence.saveIndex(index);
      this.persistence.saveActiveId(demoWorkspace.project.id);
      this.loadWorkspaceIntoState(demoWorkspace);
    } else {
      const activeId = this.persistence.loadActiveId() ?? index[0].id;
      const workspace =
        this.persistence.loadWorkspace(activeId) ??
        this.persistence.loadWorkspace(index[0].id) ??
        this.buildDemoWorkspace();

      if (!this.persistence.loadWorkspace(workspace.project.id)) {
        this.persistence.saveWorkspace(workspace);
        index = [this.persistence.toListItem(workspace)];
        this.persistence.saveIndex(index);
      }

      this.projectListSignal.set(index);
      this.loadWorkspaceIntoState(workspace);
      this.persistence.saveActiveId(workspace.project.id);
    }

    this.projectListSignal.set(this.persistence.loadIndex());
    this.initializedSignal.set(true);
  }

  private buildDemoWorkspace(): ProjectWorkspace {
    return {
      project: { ...MOCK_PROJECT },
      streams: MOCK_STREAMS.map((stream) => ({ ...stream })),
      equipment: MOCK_EQUIPMENT.map((item) => ({ ...item })),
      calculations: MOCK_CALCULATIONS.map((calc) => ({ ...calc })),
      updatedAt: new Date().toISOString(),
    };
  }

  private currentWorkspace(): ProjectWorkspace {
    return {
      project: this.projectSignal(),
      streams: this.streamsSignal(),
      equipment: this.equipmentSignal(),
      calculations: this.calculationsSignal(),
      updatedAt: new Date().toISOString(),
    };
  }

  private loadWorkspaceIntoState(workspace: ProjectWorkspace): void {
    this.projectSignal.set(workspace.project);
    this.streamsSignal.set(workspace.streams);
    this.equipmentSignal.set(workspace.equipment);
    this.calculationsSignal.set(workspace.calculations);
    this.selectedStreamIdsSignal.set(new Set(workspace.streams.map((stream) => stream.id)));
    this.selectedEquipmentIdsSignal.set(
      new Set(workspace.equipment.map((item) => item.id)),
    );
  }

  private toggleSelectionId(
    target: WritableSignal<Set<string>>,
    id: string,
    checked: boolean,
  ): void {
    target.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private syncSelectionIds(ids: string[], target: WritableSignal<Set<string>>): void {
    const current = target();
    const retained = ids.filter((id) => current.has(id));
    const newIds = ids.filter((id) => !current.has(id));
    const knownTotal = ids.length - newIds.length;
    const allKnownWereSelected = knownTotal > 0 && retained.length === knownTotal;

    const next = new Set(retained);
    if (allKnownWereSelected || knownTotal === 0) {
      for (const id of newIds) {
        next.add(id);
      }
    }

    const unchanged =
      next.size === current.size && [...next].every((id) => current.has(id));
    if (!unchanged) {
      target.set(next);
    }
  }

  private upsertListItem(workspace: ProjectWorkspace): void {
    const item = this.persistence.toListItem(workspace);
    const without = this.projectListSignal().filter((entry) => entry.id !== item.id);
    this.projectListSignal.set(
      [item, ...without].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
    this.persistence.saveIndex(this.projectListSignal());
  }

  private markDirtyAndPersist(): void {
    this.dirtySignal.set(true);
    const workspace = this.currentWorkspace();
    this.persistence.saveWorkspace(workspace);
    this.upsertListItem(workspace);
    this.dirtySignal.set(false);
  }
}
