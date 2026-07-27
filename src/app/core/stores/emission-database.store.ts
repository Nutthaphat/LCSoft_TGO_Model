import { Injectable, computed, inject, signal } from '@angular/core';
import { EmissionFactor, EmissionSource, EmissionDatabaseSnapshot } from '../../models/domain.model';
import {
  MOCK_EMISSION_FACTORS,
  MOCK_EMISSION_SOURCES,
} from '../mock/mock-data';
import { EmissionDatabasePersistenceService } from '../services/emission-database-persistence.service';

export type EmissionSourceInput = Omit<EmissionSource, 'id'> & { id?: string };
export type EmissionFactorInput = Omit<EmissionFactor, 'id'> & { id?: string };

@Injectable({ providedIn: 'root' })
export class EmissionDatabaseStore {
  private readonly persistence = inject(EmissionDatabasePersistenceService);

  private readonly sourcesSignal = signal<EmissionSource[]>([]);
  private readonly factorsSignal = signal<EmissionFactor[]>([]);
  private readonly updatedAtSignal = signal<string | null>(null);

  readonly sources = this.sourcesSignal.asReadonly();
  readonly factors = this.factorsSignal.asReadonly();
  readonly updatedAt = this.updatedAtSignal.asReadonly();

  readonly sourceCount = computed(() => this.sourcesSignal().length);
  readonly factorCount = computed(() => this.factorsSignal().length);

  readonly factorsBySource = computed(() => {
    const map = new Map<string, number>();
    for (const factor of this.factorsSignal()) {
      map.set(factor.sourceId, (map.get(factor.sourceId) ?? 0) + 1);
    }
    return map;
  });

  constructor() {
    this.initialize();
  }

  getSourceName(sourceId: string): string {
    return this.sourcesSignal().find((source) => source.id === sourceId)?.name ?? 'Unknown';
  }

  addSource(input: EmissionSourceInput): EmissionSource {
    this.assertUniqueSourceName(input.name);
    const source: EmissionSource = {
      id: input.id ?? `src-${Date.now()}`,
      name: input.name.trim(),
      organization: input.organization.trim(),
      country: input.country.trim(),
      year: input.year,
      version: input.version.trim(),
      reference: input.reference.trim(),
    };
    this.sourcesSignal.update((items) => [...items, source]);
    this.persist();
    return source;
  }

  updateSource(id: string, input: EmissionSourceInput): EmissionSource {
    this.assertUniqueSourceName(input.name, id);
    let updated: EmissionSource | null = null;
    this.sourcesSignal.update((items) =>
      items.map((item) => {
        if (item.id !== id) {
          return item;
        }
        updated = {
          ...item,
          name: input.name.trim(),
          organization: input.organization.trim(),
          country: input.country.trim(),
          year: input.year,
          version: input.version.trim(),
          reference: input.reference.trim(),
        };
        return updated;
      }),
    );
    if (!updated) {
      throw new Error('Emission source not found');
    }
    this.persist();
    return updated;
  }

  deleteSource(id: string, cascadeFactors = true): void {
    const linked = this.factorsSignal().filter((factor) => factor.sourceId === id);
    if (linked.length > 0 && !cascadeFactors) {
      throw new Error(
        `Cannot delete source: ${linked.length} emission factor(s) still reference it`,
      );
    }

    this.sourcesSignal.update((items) => items.filter((item) => item.id !== id));
    if (cascadeFactors) {
      this.factorsSignal.update((items) => items.filter((item) => item.sourceId !== id));
    }
    this.persist();
  }

  addFactor(input: EmissionFactorInput): EmissionFactor {
    this.assertSourceExists(input.sourceId);
    this.assertUniqueFactor(input.sourceId, input.material, input.unit);
    const factor: EmissionFactor = {
      id: input.id ?? `ef-${Date.now()}`,
      sourceId: input.sourceId,
      category: input.category.trim(),
      material: input.material.trim(),
      unit: input.unit.trim(),
      carbonFactor: input.carbonFactor,
      description: input.description.trim(),
    };
    this.factorsSignal.update((items) => [...items, factor]);
    this.persist();
    return factor;
  }

  updateFactor(id: string, input: EmissionFactorInput): EmissionFactor {
    this.assertSourceExists(input.sourceId);
    this.assertUniqueFactor(input.sourceId, input.material, input.unit, id);
    let updated: EmissionFactor | null = null;
    this.factorsSignal.update((items) =>
      items.map((item) => {
        if (item.id !== id) {
          return item;
        }
        updated = {
          ...item,
          sourceId: input.sourceId,
          category: input.category.trim(),
          material: input.material.trim(),
          unit: input.unit.trim(),
          carbonFactor: input.carbonFactor,
          description: input.description.trim(),
        };
        return updated;
      }),
    );
    if (!updated) {
      throw new Error('Emission factor not found');
    }
    this.persist();
    return updated;
  }

  deleteFactor(id: string): void {
    this.factorsSignal.update((items) => items.filter((item) => item.id !== id));
    this.persist();
  }

  exportDatabase(): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }

  importDatabase(raw: string, mode: 'merge' | 'replace' = 'merge'): EmissionDatabaseSnapshot {
    const parsed = JSON.parse(raw) as EmissionDatabaseSnapshot;
    if (!Array.isArray(parsed?.sources) || !Array.isArray(parsed?.factors)) {
      throw new Error('Invalid emission database file');
    }

    const sources = parsed.sources.map((source, index) => this.normalizeSource(source, index));
    const factors = parsed.factors.map((factor, index) => this.normalizeFactor(factor, index));

    if (mode === 'replace') {
      this.sourcesSignal.set(sources);
      this.factorsSignal.set(factors);
    } else {
      const sourceMap = new Map(this.sourcesSignal().map((item) => [item.id, item]));
      for (const source of sources) {
        sourceMap.set(source.id, source);
      }
      const factorMap = new Map(this.factorsSignal().map((item) => [item.id, item]));
      for (const factor of factors) {
        factorMap.set(factor.id, factor);
      }
      this.sourcesSignal.set([...sourceMap.values()]);
      this.factorsSignal.set([...factorMap.values()]);
    }

    this.persist();
    return this.snapshot();
  }

  restoreDefaults(): void {
    this.sourcesSignal.set(MOCK_EMISSION_SOURCES.map((item) => ({ ...item })));
    this.factorsSignal.set(MOCK_EMISSION_FACTORS.map((item) => ({ ...item })));
    this.persist();
  }

  private initialize(): void {
    const saved = this.persistence.load();
    if (saved?.sources?.length) {
      this.sourcesSignal.set(saved.sources);
      this.factorsSignal.set(saved.factors ?? []);
      this.updatedAtSignal.set(saved.updatedAt);
      return;
    }
    this.restoreDefaults();
  }

  private snapshot(): EmissionDatabaseSnapshot {
    return {
      sources: this.sourcesSignal(),
      factors: this.factorsSignal(),
      updatedAt: this.updatedAtSignal() ?? new Date().toISOString(),
    };
  }

  private persist(): void {
    const updatedAt = new Date().toISOString();
    this.updatedAtSignal.set(updatedAt);
    this.persistence.save({
      sources: this.sourcesSignal(),
      factors: this.factorsSignal(),
      updatedAt,
    });
  }

  private assertSourceExists(sourceId: string): void {
    if (!this.sourcesSignal().some((source) => source.id === sourceId)) {
      throw new Error('Selected emission source does not exist');
    }
  }

  private assertUniqueSourceName(name: string, excludeId?: string): void {
    const normalized = name.trim().toLowerCase();
    const duplicate = this.sourcesSignal().some(
      (source) =>
        source.id !== excludeId && source.name.trim().toLowerCase() === normalized,
    );
    if (duplicate) {
      throw new Error(`Emission source "${name.trim()}" already exists`);
    }
  }

  private assertUniqueFactor(
    sourceId: string,
    material: string,
    unit: string,
    excludeId?: string,
  ): void {
    const materialKey = material.trim().toUpperCase();
    const unitKey = unit.trim().toLowerCase();
    const duplicate = this.factorsSignal().some(
      (factor) =>
        factor.id !== excludeId &&
        factor.sourceId === sourceId &&
        factor.material.trim().toUpperCase() === materialKey &&
        factor.unit.trim().toLowerCase() === unitKey,
    );
    if (duplicate) {
      throw new Error(
        `Factor for "${material.trim()}" (${unit.trim()}) already exists in this source`,
      );
    }
  }

  private normalizeSource(source: EmissionSource, index: number): EmissionSource {
    return {
      id: source.id || `src-import-${index}-${Date.now()}`,
      name: String(source.name ?? '').trim() || `Source ${index + 1}`,
      organization: String(source.organization ?? '').trim(),
      country: String(source.country ?? '').trim(),
      year: Number(source.year) || new Date().getFullYear(),
      version: String(source.version ?? '').trim() || '1.0',
      reference: String(source.reference ?? '').trim(),
    };
  }

  private normalizeFactor(factor: EmissionFactor, index: number): EmissionFactor {
    return {
      id: factor.id || `ef-import-${index}-${Date.now()}`,
      sourceId: String(factor.sourceId ?? '').trim(),
      category: String(factor.category ?? '').trim() || 'Other',
      material: String(factor.material ?? '').trim() || `Material ${index + 1}`,
      unit: String(factor.unit ?? '').trim() || 'kg',
      carbonFactor: Number(factor.carbonFactor) || 0,
      description: String(factor.description ?? '').trim(),
    };
  }
}
