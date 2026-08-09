import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toast } from 'ngx-sonner';
import { ProjectStore } from '../../../core/stores/project.store';
import { CalculationSummary } from '../models/calculation.model';
import { CalculationService } from '../services/calculation.service';

@Component({
  selector: 'app-calculation-page',
  imports: [DecimalPipe, DatePipe],
  templateUrl: './calculation.page.html',
  styleUrl: './calculation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculationPage {
  private readonly calculationService = inject(CalculationService);
  private readonly projectStore = inject(ProjectStore);

  readonly project = this.projectStore.project;
  readonly streams = this.projectStore.streams;
  readonly equipment = this.projectStore.equipment;
  readonly calculations = this.projectStore.calculations;
  readonly selectedStreamIds = this.projectStore.selectedStreamIds;
  readonly selectedEquipmentIds = this.projectStore.selectedEquipmentIds;
  readonly selectedStreams = this.projectStore.selectedStreams;
  readonly selectedEquipment = this.projectStore.selectedEquipment;
  readonly streamCarbonKg = this.projectStore.streamCarbonKg;
  readonly equipmentCarbonKg = this.projectStore.equipmentCarbonKg;
  readonly transportCarbonKg = this.projectStore.transportCarbonKg;
  readonly totalCarbonKg = this.projectStore.totalCarbonKg;

  readonly running = signal(false);
  readonly lastSummary = signal<CalculationSummary | null>(null);

  readonly selectedStreamCount = computed(() => this.selectedStreamIds().size);
  readonly selectedEquipmentCount = computed(() => this.selectedEquipmentIds().size);
  readonly allEquipmentSelected = computed(() => {
    const equipment = this.equipment();
    const selected = this.selectedEquipmentIds();
    return equipment.length > 0 && equipment.every((item) => selected.has(item.id));
  });
  readonly canRun = computed(
    () =>
      !this.running() &&
      (this.selectedStreamCount() > 0 || this.selectedEquipmentCount() > 0) &&
      (this.streams().length > 0 || this.equipment().length > 0),
  );

  isStreamSelected(streamId: string): boolean {
    return this.selectedStreamIds().has(streamId);
  }

  isEquipmentSelected(equipmentId: string): boolean {
    return this.selectedEquipmentIds().has(equipmentId);
  }

  toggleStream(streamId: string, checked: boolean): void {
    this.projectStore.toggleStreamSelection(streamId, checked);
  }

  toggleEquipment(equipmentId: string, checked: boolean): void {
    this.projectStore.toggleEquipmentSelection(equipmentId, checked);
  }

  selectAllEquipment(): void {
    this.projectStore.selectAllEquipment();
  }

  clearStreamSelection(): void {
    this.projectStore.clearStreamSelection();
  }

  clearEquipmentSelection(): void {
    this.projectStore.clearEquipmentSelection();
  }

  onSelectAllEquipmentChange(checked: boolean): void {
    if (checked) {
      this.selectAllEquipment();
    } else {
      this.clearEquipmentSelection();
    }
  }

  clearHistory(): void {
    if (this.calculations().length === 0) {
      return;
    }

    this.projectStore.clearCalculations();
    this.lastSummary.set(null);
    toast.success('Calculation history cleared');
  }

  run(): void {
    if (!this.canRun()) {
      toast.error('Select at least one stream or equipment before running calculation');
      return;
    }

    this.running.set(true);
    try {
      const summary = this.calculationService.runCalculation({
        streamIds: [...this.selectedStreamIds()],
        equipmentIds: [...this.selectedEquipmentIds()],
      });
      this.lastSummary.set(summary);

      if (summary.missingFactorCount > 0) {
        toast.warning(
          `Calculated ${summary.totalCarbonKg.toLocaleString()} kg CO₂e with ${summary.missingFactorCount} missing factors`,
        );
      } else {
        toast.success(
          `Calculation complete: ${summary.totalCarbonKg.toLocaleString()} kg CO₂e (${summary.calculatedStreamCount} streams, ${summary.calculatedEquipmentCount} equipment)`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calculation failed';
      toast.error(message);
    } finally {
      this.running.set(false);
    }
  }
}
