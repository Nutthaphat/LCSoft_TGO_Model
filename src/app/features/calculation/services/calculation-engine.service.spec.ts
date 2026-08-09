import { describe, expect, it } from 'vitest';
import { EmissionFactor, Equipment, ProcessStream } from '../../../models/domain.model';
import { MMKCAL_TO_MJ } from '../models/calculation.model';
import { CalculationEngineService } from './calculation-engine.service';

describe('CalculationEngineService', () => {
  const engine = new CalculationEngineService();

  const factors: EmissionFactor[] = [
    {
      id: 'ef-water',
      sourceId: 'src-defra',
      category: 'Material',
      material: 'H2O',
      unit: 'kg',
      carbonFactor: 0.0003,
      description: '',
    },
    {
      id: 'ef-glucose',
      sourceId: 'src-ecoinvent',
      category: 'Material',
      material: 'GLUCOSE',
      unit: 'kg',
      carbonFactor: 0.85,
      description: '',
    },
    {
      id: 'ef-elec',
      sourceId: 'src-defra',
      category: 'Energy',
      material: 'Grid Electricity',
      unit: 'kWh',
      carbonFactor: 0.42,
      description: '',
    },
    {
      id: 'ef-steam',
      sourceId: 'src-ipcc',
      category: 'Energy',
      material: 'Process Steam',
      unit: 'MJ',
      carbonFactor: 0.065,
      description: '',
    },
    {
      id: 'ef-cool',
      sourceId: 'src-user',
      category: 'Energy',
      material: 'Cooling Utility',
      unit: 'MJ',
      carbonFactor: 0.02,
      description: '',
    },
    {
      id: 'ef-truck',
      sourceId: 'src-defra',
      category: 'Transport',
      material: 'Truck Freight',
      unit: 't·km',
      carbonFactor: 0.105,
      description: '',
    },
  ];

  it('calculates stream carbon as flow × emission factor', () => {
    expect(engine.calculateStreamCarbon(1000, 0.85)).toBe(850);
  });

  it('calculates electricity carbon as kWh × EF', () => {
    expect(engine.calculateElectricityCarbon(100, 0.42)).toBe(42);
  });

  it('calculates duty carbon with MMkcal to MJ conversion', () => {
    const expected = Math.round(2 * MMKCAL_TO_MJ * 0.065 * 1000) / 1000;
    expect(engine.calculateDutyCarbon(2, 0.065)).toBe(expected);
  });

  it('sums stream component footprints and auto-matches material EF', () => {
    const streams: ProcessStream[] = [
      {
        id: 's1',
        projectId: 'p1',
        streamId: '1',
        name: 'Feed',
        phase: 'Liquid',
        temperatureC: 25,
        pressureAtm: 1,
        flowRate: 1100,
        unit: 'kg/hr',
        category: 'Feed',
        emissionSourceId: null,
        carbonFootprintKg: 0,
        components: [
          {
            componentName: 'H2O',
            flowRate: 1000,
            unit: 'kg/hr',
            emissionFactorId: null,
            carbonFootprintKg: 0,
          },
          {
            componentName: 'GLUCOSE',
            flowRate: 100,
            unit: 'kg/hr',
            emissionFactorId: null,
            carbonFootprintKg: 0,
          },
        ],
      },
    ];

    const summary = engine.calculate({ streams, equipment: [], emissionFactors: factors });

    expect(summary.streamCarbonKg).toBe(85.3);
    expect(summary.updatedStreams[0].components[0].emissionFactorId).toBe('ef-water');
    expect(summary.updatedStreams[0].components[1].carbonFootprintKg).toBe(85);
    expect(summary.missingFactorCount).toBe(0);
  });

  it('calculates pump electricity and reactor heating/cooling', () => {
    const equipment: Equipment[] = [
      {
        id: 'e1',
        projectId: 'p1',
        equipmentId: 'P1',
        name: 'P1',
        type: 'Pump',
        heatingDuty: null,
        coolingDuty: null,
        electricityConsumption: 50,
        energyUnit: 'kW',
        temperatureC: null,
        pressureAtm: null,
        emissionSourceId: null,
        carbonFootprintKg: 0,
      },
      {
        id: 'e2',
        projectId: 'p1',
        equipmentId: 'R1',
        name: 'R1',
        type: 'Reactor',
        heatingDuty: 1,
        coolingDuty: 0.5,
        electricityConsumption: null,
        energyUnit: 'MMkcal/hr',
        temperatureC: 100,
        pressureAtm: 1,
        emissionSourceId: null,
        carbonFootprintKg: 0,
      },
    ];

    const summary = engine.calculate({
      streams: [],
      equipment,
      emissionFactors: factors,
    });

    const pumpCf = 50 * 0.42;
    const heatCf = 1 * MMKCAL_TO_MJ * 0.065;
    const coolCf = 0.5 * MMKCAL_TO_MJ * 0.02;
    const expected = Math.round((pumpCf + heatCf + coolCf) * 1000) / 1000;

    expect(summary.equipmentCarbonKg).toBe(expected);
    expect(summary.totalCarbonKg).toBe(expected);
    expect(summary.equipment[0].energyLines[0].convertedUnit).toBe('kWh');
    expect(summary.equipment[1].energyLines).toHaveLength(2);
  });

  it('reports missing emission factors without failing', () => {
    const streams: ProcessStream[] = [
      {
        id: 's1',
        projectId: 'p1',
        streamId: '2',
        name: 'Unknown Stream',
        phase: 'Liquid',
        temperatureC: null,
        pressureAtm: null,
        flowRate: 10,
        unit: 'kg/hr',
        category: 'Other',
        emissionSourceId: null,
        carbonFootprintKg: 0,
        components: [
          {
            componentName: 'UNKNOWN_CHEM',
            flowRate: 10,
            unit: 'kg/hr',
            emissionFactorId: null,
            carbonFootprintKg: 0,
          },
        ],
      },
    ];

    const summary = engine.calculate({ streams, equipment: [], emissionFactors: factors });

    expect(summary.streamCarbonKg).toBe(0);
    expect(summary.missingFactorCount).toBe(1);
    expect(summary.warnings[0]).toContain('UNKNOWN_CHEM');
  });

  it('prefers selected emission sources when materials collide', () => {
    const colliding: EmissionFactor[] = [
      {
        id: 'ef-glucose-old',
        sourceId: 'src-ipcc',
        category: 'Material',
        material: 'GLUCOSE',
        unit: 'kg',
        carbonFactor: 1.5,
        description: '',
      },
      {
        id: 'ef-glucose-new',
        sourceId: 'src-ecoinvent',
        category: 'Material',
        material: 'GLUCOSE',
        unit: 'kg',
        carbonFactor: 0.85,
        description: '',
      },
    ];

    const streams: ProcessStream[] = [
      {
        id: 's1',
        projectId: 'p1',
        streamId: '3',
        name: 'S3',
        phase: 'Liquid',
        temperatureC: null,
        pressureAtm: null,
        flowRate: 10,
        unit: 'kg/hr',
        category: 'Feed',
        emissionSourceId: null,
        carbonFootprintKg: 0,
        components: [
          {
            componentName: 'GLUCOSE',
            flowRate: 10,
            unit: 'kg/hr',
            emissionFactorId: null,
            carbonFootprintKg: 0,
          },
        ],
      },
    ];

    const summary = engine.calculate({
      streams,
      equipment: [],
      emissionFactors: colliding,
      preferredSourceIds: ['src-ecoinvent'],
    });

    expect(summary.updatedStreams[0].components[0].emissionFactorId).toBe('ef-glucose-new');
    expect(summary.streamCarbonKg).toBe(8.5);
  });

  it('calculates transport carbon from activity × factor and includes it in total', () => {
    const streams: ProcessStream[] = [
      {
        id: 's1',
        projectId: 'p1',
        streamId: '1',
        name: 'Feed',
        phase: 'Liquid',
        temperatureC: 25,
        pressureAtm: 1,
        flowRate: 0,
        unit: 'kg/hr',
        category: 'Feed',
        emissionSourceId: null,
        carbonFootprintKg: 0,
        components: [],
        transport: {
          enabled: true,
          inputMode: 'factor',
          emissionFactorId: 'ef-truck',
          activityAmount: 100,
          activityUnit: 't·km',
          manualCarbonFootprintKg: null,
          carbonFootprintKg: 0,
          notes: '',
        },
      },
    ];

    const summary = engine.calculate({ streams, equipment: [], emissionFactors: factors });

    expect(summary.transportCarbonKg).toBe(10.5);
    expect(summary.totalCarbonKg).toBe(10.5);
    expect(summary.updatedStreams[0].transport?.carbonFootprintKg).toBe(10.5);
  });

  it('uses manual transport carbon when input mode is manual', () => {
    const streams: ProcessStream[] = [
      {
        id: 's1',
        projectId: 'p1',
        streamId: '1',
        name: 'Feed',
        phase: 'Liquid',
        temperatureC: null,
        pressureAtm: null,
        flowRate: 0,
        unit: 'kg/hr',
        category: 'Feed',
        emissionSourceId: null,
        carbonFootprintKg: 0,
        components: [],
        transport: {
          enabled: true,
          inputMode: 'manual',
          emissionFactorId: null,
          activityAmount: 0,
          activityUnit: 't·km',
          manualCarbonFootprintKg: 42.5,
          carbonFootprintKg: 0,
          notes: '',
        },
      },
    ];

    const summary = engine.calculate({ streams, equipment: [], emissionFactors: factors });

    expect(summary.transportCarbonKg).toBe(42.5);
    expect(summary.transport[0].inputMode).toBe('manual');
    expect(summary.totalCarbonKg).toBe(42.5);
  });
});
