import { EmissionFactor, Equipment, ProcessStream } from '../../../models/domain.model';

export interface ComponentCalculationDetail {
  componentName: string;
  flowRate: number;
  unit: string;
  emissionFactorId: string | null;
  emissionFactorValue: number | null;
  carbonFootprintKg: number;
  matched: boolean;
  warning: string | null;
}

export interface StreamCalculationDetail {
  streamId: string;
  streamName: string;
  carbonFootprintKg: number;
  components: ComponentCalculationDetail[];
  warnings: string[];
}

export interface EquipmentEnergyLine {
  energyType: 'Electricity' | 'Heating' | 'Cooling';
  quantity: number;
  inputUnit: string;
  convertedQuantity: number;
  convertedUnit: string;
  emissionFactorId: string | null;
  emissionFactorValue: number | null;
  carbonFootprintKg: number;
  matched: boolean;
  warning: string | null;
}

export interface EquipmentCalculationDetail {
  equipmentId: string;
  equipmentName: string;
  type: string;
  carbonFootprintKg: number;
  energyLines: EquipmentEnergyLine[];
  warnings: string[];
}

export interface CalculationSummary {
  streamCarbonKg: number;
  equipmentCarbonKg: number;
  totalCarbonKg: number;
  calculatedStreamCount: number;
  calculatedEquipmentCount: number;
  missingFactorCount: number;
  warnings: string[];
  streams: StreamCalculationDetail[];
  equipment: EquipmentCalculationDetail[];
  updatedStreams: ProcessStream[];
  updatedEquipment: Equipment[];
}

export interface CalculationInput {
  streams: ProcessStream[];
  equipment: Equipment[];
  emissionFactors: EmissionFactor[];
  /** Preferred source ids when multiple materials match. Empty = any source. */
  preferredSourceIds?: string[];
}

/** 1 MMkcal = 4184 MJ */
export const MMKCAL_TO_MJ = 4184;

/** Continuous process hourly basis: 1 kW for 1 hour = 1 kWh */
export const KW_TO_KWH_PER_HOUR = 1;
