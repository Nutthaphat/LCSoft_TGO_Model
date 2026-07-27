import { Injectable, inject } from '@angular/core';
import { CalculationResult } from '../../../models/domain.model';
import { ProjectStore } from '../../../core/stores/project.store';
import { CalculationSummary } from '../models/calculation.model';
import { CalculationEngineService } from './calculation-engine.service';

export interface CalculationSelection {
  streamIds?: string[];
  equipmentIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class CalculationService {
  private readonly engine = inject(CalculationEngineService);
  private readonly projectStore = inject(ProjectStore);

  runCalculation(selection?: string[] | CalculationSelection): CalculationSummary {
    const { selectedStreamIds, selectedEquipmentIds } = this.normalizeSelection(selection);
    const project = this.projectStore.project();
    const allStreams = this.projectStore.streams();
    const allEquipment = this.projectStore.equipment();

    const streamsToCalculate =
      selectedStreamIds === null
        ? allStreams
        : allStreams.filter((stream) => selectedStreamIds.has(stream.id));

    const equipmentToCalculate =
      selectedEquipmentIds === null
        ? allEquipment
        : allEquipment.filter((item) => selectedEquipmentIds.has(item.id));

    if (streamsToCalculate.length === 0 && equipmentToCalculate.length === 0) {
      throw new Error('Select at least one stream or equipment before running calculation');
    }

    const summary = this.engine.calculate({
      streams: streamsToCalculate,
      equipment: equipmentToCalculate,
      emissionFactors: this.projectStore.emissionFactors(),
      preferredSourceIds: project.selectedEmissionSourceIds,
    });

    const updatedStreamsById = new Map(
      summary.updatedStreams.map((stream) => [stream.id, stream]),
    );
    const mergedStreams = allStreams.map(
      (stream) => updatedStreamsById.get(stream.id) ?? stream,
    );

    const updatedEquipmentById = new Map(
      summary.updatedEquipment.map((item) => [item.id, item]),
    );
    const mergedEquipment = allEquipment.map(
      (item) => updatedEquipmentById.get(item.id) ?? item,
    );

    const nextVersion = this.nextVersion(this.projectStore.calculations());
    const result: CalculationResult = {
      id: `calc-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      calculationDate: new Date().toISOString().slice(0, 10),
      totalCarbonKg: summary.totalCarbonKg,
      streamCarbonKg: summary.streamCarbonKg,
      equipmentCarbonKg: summary.equipmentCarbonKg,
      version: nextVersion,
    };

    this.projectStore.applyCalculationResult({
      streams: mergedStreams,
      equipment: mergedEquipment,
      result,
      warningCount: summary.warnings.length,
    });

    return summary;
  }

  preview(selection?: string[] | CalculationSelection): CalculationSummary {
    const { selectedStreamIds, selectedEquipmentIds } = this.normalizeSelection(selection);
    const project = this.projectStore.project();
    const allStreams = this.projectStore.streams();
    const allEquipment = this.projectStore.equipment();

    const streamsToCalculate =
      selectedStreamIds === null
        ? allStreams
        : allStreams.filter((stream) => selectedStreamIds.has(stream.id));

    const equipmentToCalculate =
      selectedEquipmentIds === null
        ? allEquipment
        : allEquipment.filter((item) => selectedEquipmentIds.has(item.id));

    return this.engine.calculate({
      streams: streamsToCalculate,
      equipment: equipmentToCalculate,
      emissionFactors: this.projectStore.emissionFactors(),
      preferredSourceIds: project.selectedEmissionSourceIds,
    });
  }

  private normalizeSelection(selection?: string[] | CalculationSelection): {
    selectedStreamIds: Set<string> | null;
    selectedEquipmentIds: Set<string> | null;
  } {
    if (selection === undefined) {
      return { selectedStreamIds: null, selectedEquipmentIds: null };
    }

    if (Array.isArray(selection)) {
      return {
        selectedStreamIds: new Set(selection),
        selectedEquipmentIds: null,
      };
    }

    return {
      selectedStreamIds:
        selection.streamIds === undefined ? null : new Set(selection.streamIds),
      selectedEquipmentIds:
        selection.equipmentIds === undefined ? null : new Set(selection.equipmentIds),
    };
  }

  private nextVersion(existing: CalculationResult[]): string {
    const numbers = existing
      .map((item) => Number(item.version.replace(/\D/g, '')))
      .filter((value) => Number.isFinite(value));
    const max = numbers.length ? Math.max(...numbers) : 0;
    return `v${max + 1}`;
  }
}
