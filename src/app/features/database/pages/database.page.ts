import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toast } from 'ngx-sonner';
import { EmissionDatabaseStore } from '../../../core/stores/emission-database.store';
import { EmissionFactor, EmissionSource } from '../../../models/domain.model';

type EditorMode = 'closed' | 'create-source' | 'edit-source' | 'create-factor' | 'edit-factor';

@Component({
  selector: 'app-database-page',
  imports: [DecimalPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './database.page.html',
  styleUrl: './database.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatabasePage {
  private readonly emissionDb = inject(EmissionDatabaseStore);
  private readonly fb = inject(FormBuilder);

  readonly sources = this.emissionDb.sources;
  readonly factors = this.emissionDb.factors;
  readonly updatedAt = this.emissionDb.updatedAt;
  readonly sourceCount = this.emissionDb.sourceCount;
  readonly factorCount = this.emissionDb.factorCount;

  readonly sourceQuery = signal('');
  readonly factorQuery = signal('');
  readonly sourceFilterId = signal<string>('all');
  readonly categoryFilter = signal<string>('all');
  readonly editorMode = signal<EditorMode>('closed');
  readonly editingSourceId = signal<string | null>(null);
  readonly editingFactorId = signal<string | null>(null);
  readonly factorCategory = signal<string>('Material');

  readonly factorCategories = ['Material', 'Energy', 'Transport'] as const;

  readonly sourceForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    organization: ['', Validators.required],
    country: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1900)]],
    version: ['1.0', Validators.required],
    reference: [''],
  });

  readonly factorForm = this.fb.nonNullable.group({
    sourceId: ['', Validators.required],
    category: ['Material', Validators.required],
    material: ['', Validators.required],
    unit: ['kg', Validators.required],
    carbonFactor: [0, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  constructor() {
    this.factorForm.controls.category.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((category) => {
        this.factorCategory.set(category);
        if (category === 'Transport' && this.editorMode() === 'create-factor') {
          const unit = this.factorForm.controls.unit.value;
          if (!unit || unit === 'kg' || unit === 'kWh') {
            this.factorForm.controls.unit.setValue('km');
          }
        }
      });
  }

  readonly filteredSources = computed(() => {
    const query = this.sourceQuery().trim().toLowerCase();
    return this.sources().filter((source) => {
      if (!query) {
        return true;
      }
      return [source.name, source.organization, source.country, source.version]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  readonly filteredFactors = computed(() => {
    const query = this.factorQuery().trim().toLowerCase();
    const sourceId = this.sourceFilterId();
    const category = this.categoryFilter();
    return this.factors().filter((factor) => {
      if (sourceId !== 'all' && factor.sourceId !== sourceId) {
        return false;
      }
      if (category !== 'all' && factor.category.toLowerCase() !== category.toLowerCase()) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [factor.material, factor.category, factor.unit, factor.description]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  sourceName(sourceId: string): string {
    return this.emissionDb.getSourceName(sourceId);
  }

  openCreateSource(): void {
    this.editingSourceId.set(null);
    this.sourceForm.reset({
      name: '',
      organization: '',
      country: 'Thailand',
      year: new Date().getFullYear(),
      version: '1.0',
      reference: '',
    });
    this.editorMode.set('create-source');
  }

  openEditSource(source: EmissionSource): void {
    this.editingSourceId.set(source.id);
    this.sourceForm.reset({
      name: source.name,
      organization: source.organization,
      country: source.country,
      year: source.year,
      version: source.version,
      reference: source.reference,
    });
    this.editorMode.set('edit-source');
  }

  openCreateFactor(category: 'Material' | 'Energy' | 'Transport' = 'Material'): void {
    const defaultSourceId = this.sources()[0]?.id ?? '';
    this.editingFactorId.set(null);
    this.factorForm.reset({
      sourceId: defaultSourceId,
      category,
      material: '',
      unit: category === 'Transport' ? 'km' : category === 'Energy' ? 'kWh' : 'kg',
      carbonFactor: 0,
      description: '',
    });
    this.factorCategory.set(category);
    this.editorMode.set('create-factor');
  }

  openCreateTransportFactor(): void {
    this.categoryFilter.set('Transport');
    this.openCreateFactor('Transport');
  }

  openEditFactor(factor: EmissionFactor): void {
    this.editingFactorId.set(factor.id);
    this.factorForm.reset({
      sourceId: factor.sourceId,
      category: factor.category,
      material: factor.material,
      unit: factor.unit,
      carbonFactor: factor.carbonFactor,
      description: factor.description,
    });
    this.factorCategory.set(factor.category);
    this.editorMode.set('edit-factor');
  }

  closeEditor(): void {
    this.editorMode.set('closed');
    this.editingSourceId.set(null);
    this.editingFactorId.set(null);
  }

  saveSource(): void {
    if (this.sourceForm.invalid) {
      this.sourceForm.markAllAsTouched();
      return;
    }

    try {
      const value = this.sourceForm.getRawValue();
      if (this.editorMode() === 'edit-source' && this.editingSourceId()) {
        this.emissionDb.updateSource(this.editingSourceId()!, value);
        toast.success('Emission source updated');
      } else {
        this.emissionDb.addSource(value);
        toast.success('Emission source added');
      }
      this.closeEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save source');
    }
  }

  saveFactor(): void {
    if (this.factorForm.invalid) {
      this.factorForm.markAllAsTouched();
      return;
    }

    try {
      const raw = this.factorForm.getRawValue();
      const value = {
        ...raw,
        category: this.normalizeCategory(raw.category),
        material: raw.material.trim(),
        unit: raw.unit.trim(),
      };
      if (this.editorMode() === 'edit-factor' && this.editingFactorId()) {
        this.emissionDb.updateFactor(this.editingFactorId()!, value);
        toast.success('Emission factor updated');
      } else {
        this.emissionDb.addFactor(value);
        toast.success(
          value.category === 'Transport'
            ? 'Transport emission factor added'
            : 'Emission factor added',
        );
      }
      this.closeEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save factor');
    }
  }

  private normalizeCategory(category: string): string {
    const trimmed = category.trim();
    const match = this.factorCategories.find(
      (item) => item.toLowerCase() === trimmed.toLowerCase(),
    );
    return match ?? trimmed;
  }

  deleteSource(source: EmissionSource): void {
    const factorCount = this.factors().filter((item) => item.sourceId === source.id).length;
    const message =
      factorCount > 0
        ? `Delete source "${source.name}" and its ${factorCount} factor(s)?`
        : `Delete source "${source.name}"?`;
    if (!window.confirm(message)) {
      return;
    }

    try {
      this.emissionDb.deleteSource(source.id, true);
      toast.success(`Deleted source "${source.name}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  }

  deleteFactor(factor: EmissionFactor): void {
    if (!window.confirm(`Delete factor "${factor.material}"?`)) {
      return;
    }
    this.emissionDb.deleteFactor(factor.id);
    toast.success(`Deleted factor "${factor.material}"`);
  }

  exportDatabase(): void {
    const json = this.emissionDb.exportDatabase();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `emission-database-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Exported emission database');
  }

  async importDatabase(event: Event, mode: 'merge' | 'replace'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (mode === 'replace') {
        const confirmed = window.confirm(
          'Replace the entire emission database with this file?',
        );
        if (!confirmed) {
          return;
        }
      }

      const raw = await file.text();
      const snapshot = this.emissionDb.importDatabase(raw, mode);
      toast.success(
        `${mode === 'replace' ? 'Replaced' : 'Merged'} database (${snapshot.sources.length} sources, ${snapshot.factors.length} factors)`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      input.value = '';
    }
  }

  restoreDefaults(): void {
    if (!window.confirm('Restore default IPCC/DEFRA/ecoinvent seed data?')) {
      return;
    }
    this.emissionDb.restoreDefaults();
    toast.success('Restored default emission database');
  }
}
