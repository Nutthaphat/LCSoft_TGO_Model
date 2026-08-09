import { Injectable } from '@angular/core';
import {
  EmissionFactor,
  Equipment,
  ProcessStream,
  StreamComponent,
  StreamTransport,
} from '../../../models/domain.model';
import {
  CalculationInput,
  CalculationSummary,
  ComponentCalculationDetail,
  EquipmentCalculationDetail,
  EquipmentEnergyLine,
  KW_TO_KWH_PER_HOUR,
  MMKCAL_TO_MJ,
  StreamCalculationDetail,
  TransportCalculationDetail,
} from '../models/calculation.model';

const ENERGY_MATERIAL_MAP = {
  Electricity: ['Grid Electricity', 'Electricity'],
  Heating: ['Process Steam', 'Steam', 'Heating'],
  Cooling: ['Cooling Utility', 'Cooling'],
} as const;

@Injectable({ providedIn: 'root' })
export class CalculationEngineService {
  calculate(input: CalculationInput): CalculationSummary {
    const factorIndex = this.buildFactorIndex(
      input.emissionFactors,
      input.preferredSourceIds ?? [],
    );

    const streamDetails: StreamCalculationDetail[] = [];
    const transportDetails: TransportCalculationDetail[] = [];
    const updatedStreams: ProcessStream[] = [];
    let streamCarbonKg = 0;
    let transportCarbonKg = 0;
    let missingFactorCount = 0;
    const warnings: string[] = [];
    const factorById = new Map(input.emissionFactors.map((factor) => [factor.id, factor]));

    for (const stream of input.streams) {
      const detail = this.calculateStream(stream, factorIndex);
      streamDetails.push(detail);
      streamCarbonKg += detail.carbonFootprintKg;
      missingFactorCount += detail.components.filter((c) => !c.matched && c.flowRate > 0).length;
      warnings.push(...detail.warnings);

      const transportDetail = this.calculateTransport(stream, factorById);
      transportDetails.push(transportDetail);
      transportCarbonKg += transportDetail.carbonFootprintKg;
      if (
        transportDetail.enabled &&
        transportDetail.inputMode === 'factor' &&
        !transportDetail.emissionFactorId
      ) {
        missingFactorCount += 1;
      }
      warnings.push(...transportDetail.warnings);

      const nextTransport = this.applyTransportResult(stream.transport, transportDetail);

      updatedStreams.push({
        ...stream,
        carbonFootprintKg: detail.carbonFootprintKg,
        emissionSourceId: this.resolveStreamSourceId(detail, input.emissionFactors, stream),
        transport: nextTransport,
        components: detail.components.map((component) => ({
          componentName: component.componentName,
          flowRate: component.flowRate,
          unit: component.unit,
          emissionFactorId: component.emissionFactorId,
          carbonFootprintKg: component.carbonFootprintKg,
        })),
      });
    }

    const equipmentDetails: EquipmentCalculationDetail[] = [];
    const updatedEquipment: Equipment[] = [];
    let equipmentCarbonKg = 0;

    for (const item of input.equipment) {
      const detail = this.calculateEquipment(item, factorIndex);
      equipmentDetails.push(detail);
      equipmentCarbonKg += detail.carbonFootprintKg;
      missingFactorCount += detail.energyLines.filter((line) => !line.matched).length;
      warnings.push(...detail.warnings);

      updatedEquipment.push({
        ...item,
        carbonFootprintKg: detail.carbonFootprintKg,
        emissionSourceId: this.resolveEquipmentSourceId(detail, input.emissionFactors, item),
      });
    }

    return {
      streamCarbonKg: this.round(streamCarbonKg),
      equipmentCarbonKg: this.round(equipmentCarbonKg),
      transportCarbonKg: this.round(transportCarbonKg),
      totalCarbonKg: this.round(streamCarbonKg + equipmentCarbonKg + transportCarbonKg),
      calculatedStreamCount: updatedStreams.length,
      calculatedEquipmentCount: updatedEquipment.length,
      missingFactorCount,
      warnings: [...new Set(warnings)],
      streams: streamDetails,
      transport: transportDetails,
      equipment: equipmentDetails,
      updatedStreams,
      updatedEquipment,
    };
  }

  /**
   * Stream CF = Σ (component flow rate × emission factor)
   */
  calculateStreamCarbon(
    flowRate: number,
    carbonFactor: number,
  ): number {
    return this.round(flowRate * carbonFactor);
  }

  /**
   * Equipment electricity CF = energy(kWh) × EF(kgCO₂e/kWh)
   * Continuous process default: 1 kW for 1 hour = 1 kWh.
   */
  calculateElectricityCarbon(energyKwh: number, carbonFactorPerKwh: number): number {
    return this.round(energyKwh * carbonFactorPerKwh);
  }

  /**
   * Heating/cooling duty in MMkcal/hr converted to MJ, then × EF(kgCO₂e/MJ)
   */
  calculateDutyCarbon(dutyMMkcalPerHr: number, carbonFactorPerMj: number): number {
    const mj = Math.abs(dutyMMkcalPerHr) * MMKCAL_TO_MJ;
    return this.round(mj * carbonFactorPerMj);
  }

  private calculateTransport(
    stream: ProcessStream,
    factorById: Map<string, EmissionFactor>,
  ): TransportCalculationDetail {
    const transport = stream.transport;
    if (!transport?.enabled) {
      return {
        streamId: stream.streamId,
        streamName: stream.name,
        enabled: false,
        inputMode: transport?.inputMode ?? null,
        emissionFactorId: transport?.emissionFactorId ?? null,
        emissionFactorLabel: null,
        activityAmount: transport?.activityAmount ?? 0,
        activityUnit: transport?.activityUnit ?? 't·km',
        carbonFootprintKg: 0,
        warnings: [],
      };
    }

    if (transport.inputMode === 'manual') {
      const carbonFootprintKg = this.round(transport.manualCarbonFootprintKg ?? 0);
      return {
        streamId: stream.streamId,
        streamName: stream.name,
        enabled: true,
        inputMode: 'manual',
        emissionFactorId: null,
        emissionFactorLabel: null,
        activityAmount: transport.activityAmount,
        activityUnit: transport.activityUnit,
        carbonFootprintKg,
        warnings: [],
      };
    }

    const factor = transport.emissionFactorId
      ? factorById.get(transport.emissionFactorId)
      : undefined;

    if (!factor) {
      return {
        streamId: stream.streamId,
        streamName: stream.name,
        enabled: true,
        inputMode: 'factor',
        emissionFactorId: null,
        emissionFactorLabel: null,
        activityAmount: transport.activityAmount,
        activityUnit: transport.activityUnit,
        carbonFootprintKg: 0,
        warnings: [
          `${stream.name}: No transport emission factor selected or factor missing from database`,
        ],
      };
    }

    return {
      streamId: stream.streamId,
      streamName: stream.name,
      enabled: true,
      inputMode: 'factor',
      emissionFactorId: factor.id,
      emissionFactorLabel: factor.material,
      activityAmount: transport.activityAmount,
      activityUnit: transport.activityUnit || factor.unit,
      carbonFootprintKg: this.round(transport.activityAmount * factor.carbonFactor),
      warnings: [],
    };
  }

  private applyTransportResult(
    current: StreamTransport | null | undefined,
    detail: TransportCalculationDetail,
  ): StreamTransport | null {
    if (!current) {
      return null;
    }

    return {
      ...current,
      carbonFootprintKg: detail.carbonFootprintKg,
      emissionFactorId:
        detail.inputMode === 'factor' ? detail.emissionFactorId : current.emissionFactorId,
    };
  }

  private calculateStream(
    stream: ProcessStream,
    factorIndex: Map<string, EmissionFactor>,
  ): StreamCalculationDetail {
    const components: ComponentCalculationDetail[] = [];
    const warnings: string[] = [];
    let total = 0;

    for (const component of stream.components) {
      const detail = this.calculateComponent(component, factorIndex);
      components.push(detail);
      total += detail.carbonFootprintKg;
      if (detail.warning) {
        warnings.push(`${stream.name}: ${detail.warning}`);
      }
    }

    return {
      streamId: stream.streamId,
      streamName: stream.name,
      carbonFootprintKg: this.round(total),
      components,
      warnings,
    };
  }

  private calculateComponent(
    component: StreamComponent,
    factorIndex: Map<string, EmissionFactor>,
  ): ComponentCalculationDetail {
    if (component.flowRate <= 0) {
      return {
        componentName: component.componentName,
        flowRate: component.flowRate,
        unit: component.unit,
        emissionFactorId: component.emissionFactorId,
        emissionFactorValue: null,
        carbonFootprintKg: 0,
        matched: true,
        warning: null,
      };
    }

    const factor =
      (component.emissionFactorId
        ? [...factorIndex.values()].find((item) => item.id === component.emissionFactorId)
        : undefined) ??
      factorIndex.get(this.normalizeKey(component.componentName));

    if (!factor) {
      return {
        componentName: component.componentName,
        flowRate: component.flowRate,
        unit: component.unit,
        emissionFactorId: null,
        emissionFactorValue: null,
        carbonFootprintKg: 0,
        matched: false,
        warning: `No emission factor for component "${component.componentName}"`,
      };
    }

    return {
      componentName: component.componentName,
      flowRate: component.flowRate,
      unit: component.unit,
      emissionFactorId: factor.id,
      emissionFactorValue: factor.carbonFactor,
      carbonFootprintKg: this.calculateStreamCarbon(component.flowRate, factor.carbonFactor),
      matched: true,
      warning: null,
    };
  }

  private calculateEquipment(
    equipment: Equipment,
    factorIndex: Map<string, EmissionFactor>,
  ): EquipmentCalculationDetail {
    const energyLines: EquipmentEnergyLine[] = [];
    const warnings: string[] = [];
    let total = 0;

    if (equipment.electricityConsumption !== null && equipment.electricityConsumption > 0) {
      const line = this.calculateEnergyLine(
        'Electricity',
        equipment.electricityConsumption,
        equipment.energyUnit || 'kW',
        factorIndex,
      );
      energyLines.push(line);
      total += line.carbonFootprintKg;
      if (line.warning) {
        warnings.push(`${equipment.name}: ${line.warning}`);
      }
    }

    if (equipment.heatingDuty !== null && equipment.heatingDuty > 0) {
      const line = this.calculateEnergyLine(
        'Heating',
        equipment.heatingDuty,
        equipment.energyUnit || 'MMkcal/hr',
        factorIndex,
      );
      energyLines.push(line);
      total += line.carbonFootprintKg;
      if (line.warning) {
        warnings.push(`${equipment.name}: ${line.warning}`);
      }
    }

    if (equipment.coolingDuty !== null && equipment.coolingDuty > 0) {
      const line = this.calculateEnergyLine(
        'Cooling',
        equipment.coolingDuty,
        equipment.energyUnit || 'MMkcal/hr',
        factorIndex,
      );
      energyLines.push(line);
      total += line.carbonFootprintKg;
      if (line.warning) {
        warnings.push(`${equipment.name}: ${line.warning}`);
      }
    }

    if (energyLines.length === 0) {
      warnings.push(`${equipment.name}: No energy consumption to calculate`);
    }

    return {
      equipmentId: equipment.equipmentId,
      equipmentName: equipment.name,
      type: equipment.type,
      carbonFootprintKg: this.round(total),
      energyLines,
      warnings,
    };
  }

  private calculateEnergyLine(
    energyType: 'Electricity' | 'Heating' | 'Cooling',
    quantity: number,
    inputUnit: string,
    factorIndex: Map<string, EmissionFactor>,
  ): EquipmentEnergyLine {
    const factor = this.resolveEnergyFactor(energyType, factorIndex);

    if (!factor) {
      return {
        energyType,
        quantity,
        inputUnit,
        convertedQuantity: quantity,
        convertedUnit: inputUnit,
        emissionFactorId: null,
        emissionFactorValue: null,
        carbonFootprintKg: 0,
        matched: false,
        warning: `No emission factor for ${energyType}`,
      };
    }

    if (energyType === 'Electricity') {
      const kwh = this.toKwh(quantity, inputUnit);
      return {
        energyType,
        quantity,
        inputUnit,
        convertedQuantity: kwh,
        convertedUnit: 'kWh',
        emissionFactorId: factor.id,
        emissionFactorValue: factor.carbonFactor,
        carbonFootprintKg: this.calculateElectricityCarbon(kwh, factor.carbonFactor),
        matched: true,
        warning: null,
      };
    }

    const mj = this.toMj(quantity, inputUnit);
    return {
      energyType,
      quantity,
      inputUnit,
      convertedQuantity: mj,
      convertedUnit: 'MJ',
      emissionFactorId: factor.id,
      emissionFactorValue: factor.carbonFactor,
      carbonFootprintKg: this.round(mj * factor.carbonFactor),
      matched: true,
      warning: null,
    };
  }

  private resolveEnergyFactor(
    energyType: 'Electricity' | 'Heating' | 'Cooling',
    factorIndex: Map<string, EmissionFactor>,
  ): EmissionFactor | undefined {
    for (const material of ENERGY_MATERIAL_MAP[energyType]) {
      const factor = factorIndex.get(this.normalizeKey(material));
      if (factor) {
        return factor;
      }
    }
    return undefined;
  }

  private toKwh(quantity: number, unit: string): number {
    const normalized = unit.trim().toLowerCase();
    if (normalized === 'kwh') {
      return quantity;
    }
    if (normalized === 'kw' || normalized === 'kw/hr' || normalized === '') {
      return quantity * KW_TO_KWH_PER_HOUR;
    }
    if (normalized === 'mw') {
      return quantity * 1000 * KW_TO_KWH_PER_HOUR;
    }
    return quantity * KW_TO_KWH_PER_HOUR;
  }

  private toMj(quantity: number, unit: string): number {
    const normalized = unit.trim().toLowerCase();
    const abs = Math.abs(quantity);
    if (normalized === 'mj' || normalized === 'mj/hr') {
      return abs;
    }
    if (normalized === 'mmkcal/hr' || normalized === 'mmkcal' || normalized === '') {
      return abs * MMKCAL_TO_MJ;
    }
    if (normalized === 'kcal/hr' || normalized === 'kcal') {
      return abs * 0.004184;
    }
    if (normalized === 'gj' || normalized === 'gj/hr') {
      return abs * 1000;
    }
    return abs * MMKCAL_TO_MJ;
  }

  private buildFactorIndex(
    factors: EmissionFactor[],
    preferredSourceIds: string[],
  ): Map<string, EmissionFactor> {
    const preferred = new Set(preferredSourceIds);
    const sorted = [...factors].sort((a, b) => {
      const aPreferred = preferred.has(a.sourceId) ? 0 : 1;
      const bPreferred = preferred.has(b.sourceId) ? 0 : 1;
      return aPreferred - bPreferred;
    });

    const index = new Map<string, EmissionFactor>();
    for (const factor of sorted) {
      const key = this.normalizeKey(factor.material);
      if (!index.has(key)) {
        index.set(key, factor);
      }
    }
    return index;
  }

  private resolveStreamSourceId(
    detail: StreamCalculationDetail,
    factors: EmissionFactor[],
    stream: ProcessStream,
  ): string | null {
    const firstMatched = detail.components.find((item) => item.emissionFactorId);
    if (!firstMatched?.emissionFactorId) {
      return stream.emissionSourceId;
    }
    return factors.find((factor) => factor.id === firstMatched.emissionFactorId)?.sourceId ??
      stream.emissionSourceId;
  }

  private resolveEquipmentSourceId(
    detail: EquipmentCalculationDetail,
    factors: EmissionFactor[],
    equipment: Equipment,
  ): string | null {
    const firstMatched = detail.energyLines.find((line) => line.emissionFactorId);
    if (!firstMatched?.emissionFactorId) {
      return equipment.emissionSourceId;
    }
    return factors.find((factor) => factor.id === firstMatched.emissionFactorId)?.sourceId ??
      equipment.emissionSourceId;
  }

  private normalizeKey(value: string): string {
    return value.trim().toUpperCase();
  }

  private round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
