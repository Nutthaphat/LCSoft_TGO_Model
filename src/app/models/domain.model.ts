export type EquipmentType =
  | 'Pump'
  | 'Reactor'
  | 'Compressor'
  | 'Heat Exchanger'
  | 'Distillation Column'
  | 'Flash Drum';

export type EnergyType = 'Electricity' | 'Heating' | 'Cooling' | 'Steam' | 'Gas';

export type StreamPhase = 'Liquid' | 'Vapor' | 'Mixed' | 'Solid' | 'Unknown';

export interface EmissionSource {
  id: string;
  name: string;
  organization: string;
  country: string;
  year: number;
  version: string;
  reference: string;
}

export interface EmissionFactor {
  id: string;
  sourceId: string;
  category: string;
  material: string;
  unit: string;
  carbonFactor: number;
  description: string;
}

export interface EmissionDatabaseSnapshot {
  sources: EmissionSource[];
  factors: EmissionFactor[];
  updatedAt: string;
}

export interface ChemicalComponent {
  id: string;
  name: string;
  formula: string;
  molecularWeight: number;
}

export interface StreamComponent {
  componentName: string;
  flowRate: number;
  unit: string;
  emissionFactorId: string | null;
  carbonFootprintKg: number;
}

export type TransportInputMode = 'factor' | 'manual';

export interface StreamTransport {
  enabled: boolean;
  inputMode: TransportInputMode;
  emissionFactorId: string | null;
  activityAmount: number;
  activityUnit: string;
  manualCarbonFootprintKg: number | null;
  carbonFootprintKg: number;
  notes: string;
}

export interface ProcessStream {
  id: string;
  projectId: string;
  streamId: string;
  name: string;
  phase: StreamPhase;
  temperatureC: number | null;
  pressureAtm: number | null;
  flowRate: number;
  unit: string;
  category: string;
  components: StreamComponent[];
  emissionSourceId: string | null;
  carbonFootprintKg: number;
  /** Per-stream transportation CF config; null/undefined = none. */
  transport?: StreamTransport | null;
}

export interface Equipment {
  id: string;
  projectId: string;
  equipmentId: string;
  name: string;
  type: EquipmentType;
  heatingDuty: number | null;
  coolingDuty: number | null;
  electricityConsumption: number | null;
  energyUnit: string;
  temperatureC: number | null;
  pressureAtm: number | null;
  emissionSourceId: string | null;
  carbonFootprintKg: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdDate: string;
  lastCalculationDate: string | null;
  selectedEmissionSourceIds: string[];
}

/** Full local project payload (streams + equipment + calculation history). */
export interface ProjectWorkspace {
  project: Project;
  streams: ProcessStream[];
  equipment: Equipment[];
  calculations: CalculationResult[];
  updatedAt: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  createdDate: string;
  lastCalculationDate: string | null;
  updatedAt: string;
  streamCount: number;
  equipmentCount: number;
  totalCarbonKg: number;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  selectedEmissionSourceIds: string[];
  seedDemoData?: boolean;
}

export interface CalculationResult {
  id: string;
  projectId: string;
  projectName: string;
  calculationDate: string;
  totalCarbonKg: number;
  streamCarbonKg: number;
  equipmentCarbonKg: number;
  transportCarbonKg: number;
  version: string;
}

export interface CarbonContributor {
  id: string;
  name: string;
  type: 'Stream' | 'Equipment';
  carbonFootprintKg: number;
}

export interface EmissionSourceUsage {
  sourceId: string;
  sourceName: string;
  count: number;
  percentage: number;
}

export interface CarbonTrendPoint {
  label: string;
  totalCarbonKg: number;
}

export interface DashboardKpis {
  totalCarbonKg: number;
  totalStreams: number;
  totalEquipment: number;
  totalEmissionSources: number;
  totalStreamEmissionsKg: number;
  totalEquipmentEmissionsKg: number;
  totalTransportEmissionsKg: number;
  highestCarbonStream: string | null;
  highestCarbonEquipment: string | null;
  averageCarbonPerStream: number;
  averageCarbonPerEquipment: number;
  lastCalculationDate: string | null;
}

export interface DashboardData {
  project: Project;
  kpis: DashboardKpis;
  topContributors: CarbonContributor[];
  carbonByCategory: { category: string; carbonKg: number }[];
  emissionSourceUsage: EmissionSourceUsage[];
  carbonTrend: CarbonTrendPoint[];
  recentCalculations: CalculationResult[];
  topStreams: ProcessStream[];
  topEquipment: Equipment[];
}
