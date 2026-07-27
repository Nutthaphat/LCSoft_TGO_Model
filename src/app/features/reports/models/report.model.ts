import {
  CalculationResult,
  EmissionFactor,
  EmissionSource,
  Equipment,
  ProcessStream,
  Project,
} from '../../../models/domain.model';

export interface ReportSummary {
  projectName: string;
  projectDescription: string;
  generatedAt: string;
  lastCalculationDate: string | null;
  totalCarbonKg: number;
  streamCarbonKg: number;
  equipmentCarbonKg: number;
  streamCount: number;
  equipmentCount: number;
  emissionSourceCount: number;
  emissionFactorCount: number;
}

export interface ReportBundle {
  summary: ReportSummary;
  project: Project;
  streams: ProcessStream[];
  equipment: Equipment[];
  emissionSources: EmissionSource[];
  emissionFactors: EmissionFactor[];
  calculations: CalculationResult[];
  topStreams: ProcessStream[];
  topEquipment: Equipment[];
}

export type ReportSection =
  | 'summary'
  | 'streams'
  | 'equipment'
  | 'emissionFactors'
  | 'calculations';

export interface ReportExportOptions {
  sections: ReportSection[];
  fileNameBase?: string;
}
