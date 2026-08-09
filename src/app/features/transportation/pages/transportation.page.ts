import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toast } from 'ngx-sonner';
import { EmissionDatabaseStore } from '../../../core/stores/emission-database.store';
import { ProjectStore } from '../../../core/stores/project.store';
import {
  EmissionFactor,
  ProcessStream,
  StreamTransport,
  TransportInputMode,
} from '../../../models/domain.model';

@Component({
  selector: 'app-transportation-page',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './transportation.page.html',
  styleUrl: './transportation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportationPage {
  private readonly projectStore = inject(ProjectStore);
  private readonly emissionDb = inject(EmissionDatabaseStore);
  private readonly fb = inject(FormBuilder);

  readonly streams = this.projectStore.streams;
  readonly selectedStreamId = signal<string | null>(null);

  readonly transportFactors = computed(() =>
    this.emissionDb
      .factors()
      .filter((factor) => factor.category.toLowerCase() === 'transport')
      .slice()
      .sort((a, b) => a.material.localeCompare(b.material)),
  );

  readonly selectedStream = computed(() => {
    const id = this.selectedStreamId();
    if (!id) {
      return null;
    }
    return this.streams().find((stream) => stream.id === id) ?? null;
  });

  readonly enabledCount = computed(
    () => this.streams().filter((stream) => stream.transport?.enabled).length,
  );

  /** Live kg by stream id — updates when streams or Emission Database factors change. */
  readonly transportKgByStreamId = computed(() => {
    // Depend on transportFactors so EF edits refresh the table immediately.
    void this.transportFactors();
    const map = new Map<string, number>();
    for (const stream of this.streams()) {
      map.set(stream.id, this.projectStore.resolveTransportCarbonKg(stream.transport));
    }
    return map;
  });

  readonly totalTransportKg = computed(() =>
    [...this.transportKgByStreamId().values()].reduce((sum, value) => sum + value, 0),
  );

  readonly form = this.fb.nonNullable.group({
    enabled: [false],
    inputMode: ['factor' as TransportInputMode, Validators.required],
    emissionFactorId: [''],
    activityAmount: [0, [Validators.min(0)]],
    activityUnit: ['km'],
    manualCarbonFootprintKg: [0 as number | null, [Validators.min(0)]],
    notes: [''],
  });

  readonly formValue = signal(this.form.getRawValue());

  readonly selectedFactor = computed(() => {
    const factorId = this.formValue().emissionFactorId;
    return this.transportFactors().find((factor) => factor.id === factorId) ?? null;
  });

  readonly selectedFactorUnit = computed(() => this.selectedFactor()?.unit ?? 'km');

  readonly inputMode = computed(() => this.formValue().inputMode);

  readonly previewCarbonKg = computed(() =>
    this.resolveCarbonKg(this.formValue(), this.transportFactors()),
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const raw = this.form.getRawValue();
      const factor = this.transportFactors().find((item) => item.id === raw.emissionFactorId);
      if (
        raw.inputMode === 'factor' &&
        factor &&
        raw.activityUnit !== factor.unit
      ) {
        this.form.controls.activityUnit.setValue(factor.unit, { emitEvent: false });
        this.formValue.set({ ...raw, activityUnit: factor.unit });
        return;
      }
      this.formValue.set(this.form.getRawValue());
    });

    effect(() => {
      const stream = this.selectedStream();
      if (!stream) {
        return;
      }
      this.patchFormFromStream(stream);
    });
  }

  selectStream(stream: ProcessStream): void {
    this.selectedStreamId.set(stream.id);
  }

  clearSelection(): void {
    this.selectedStreamId.set(null);
  }

  sourceName(sourceId: string): string {
    return this.emissionDb.getSourceName(sourceId);
  }

  transportStatus(stream: ProcessStream): string {
    if (!stream.transport?.enabled) {
      return 'Off';
    }
    return stream.transport.inputMode === 'manual' ? 'Manual' : 'Factor';
  }

  streamTransportKg(stream: ProcessStream): number {
    return this.transportKgByStreamId().get(stream.id) ?? 0;
  }

  factorOptionLabel(factor: EmissionFactor): string {
    const source = this.sourceName(factor.sourceId);
    return `${factor.material} · ${factor.carbonFactor} kg CO₂e / ${factor.unit} · ${source}`;
  }

  save(): void {
    const stream = this.selectedStream();
    if (!stream) {
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.enabled && raw.inputMode === 'factor' && !raw.emissionFactorId) {
      toast.error('Select a transport emission factor from the database list');
      return;
    }

    if (raw.enabled && raw.inputMode === 'manual' && (raw.manualCarbonFootprintKg ?? 0) < 0) {
      toast.error('Manual CO₂e must be zero or greater');
      return;
    }

    const factors = this.transportFactors();
    const selectedFactor = factors.find((factor) => factor.id === raw.emissionFactorId);
    const carbonFootprintKg = this.resolveCarbonKg(raw, factors);

    const transport: StreamTransport = {
      enabled: raw.enabled,
      inputMode: raw.inputMode,
      emissionFactorId:
        raw.inputMode === 'factor' && raw.emissionFactorId ? raw.emissionFactorId : null,
      activityAmount: Number(raw.activityAmount) || 0,
      activityUnit:
        selectedFactor?.unit ||
        raw.activityUnit?.trim() ||
        'km',
      manualCarbonFootprintKg:
        raw.inputMode === 'manual' ? Number(raw.manualCarbonFootprintKg) || 0 : null,
      carbonFootprintKg,
      notes: raw.notes.trim(),
    };

    this.projectStore.updateStreamTransport(stream.id, transport);
    toast.success(`Saved transport settings for ${stream.name}`);
  }

  clearTransport(): void {
    const stream = this.selectedStream();
    if (!stream) {
      return;
    }
    this.projectStore.updateStreamTransport(stream.id, null);
    this.patchFormFromStream({ ...stream, transport: null });
    toast.success(`Cleared transport settings for ${stream.name}`);
  }

  private patchFormFromStream(stream: ProcessStream): void {
    const transport = stream.transport;
    const factors = this.transportFactors();
    const defaultFactorId = factors[0]?.id ?? '';
    const factorId = transport?.emissionFactorId ?? defaultFactorId;
    const selectedFactor = factors.find((factor) => factor.id === factorId);

    this.form.reset({
      enabled: transport?.enabled ?? false,
      inputMode: transport?.inputMode ?? 'factor',
      emissionFactorId: factorId,
      activityAmount: transport?.activityAmount ?? 0,
      activityUnit: selectedFactor?.unit ?? transport?.activityUnit ?? 'km',
      manualCarbonFootprintKg: transport?.manualCarbonFootprintKg ?? 0,
      notes: transport?.notes ?? '',
    });
    this.formValue.set(this.form.getRawValue());
  }

  private resolveCarbonKg(
    raw: {
      enabled: boolean;
      inputMode: TransportInputMode;
      emissionFactorId: string;
      activityAmount: number;
      manualCarbonFootprintKg: number | null;
    },
    factors: EmissionFactor[],
  ): number {
    if (!raw.enabled) {
      return 0;
    }

    if (raw.inputMode === 'manual') {
      return this.round(Number(raw.manualCarbonFootprintKg) || 0);
    }

    const factor = factors.find((item) => item.id === raw.emissionFactorId);
    if (!factor) {
      return 0;
    }

    return this.round((Number(raw.activityAmount) || 0) * factor.carbonFactor);
  }

  private round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
