import { describe, expect, it } from 'vitest';
import { Equipment, ProcessStream } from '../../../models/domain.model';
import { DiagramService } from './diagram.service';

describe('DiagramService', () => {
  const service = new DiagramService();

  const streams: ProcessStream[] = [
    {
      id: 'str-1',
      projectId: 'p1',
      streamId: '1',
      name: 'Feed 1',
      phase: 'Liquid',
      temperatureC: 25,
      pressureAtm: 1,
      flowRate: 100,
      unit: 'kg/hr',
      category: 'Feed',
      components: [],
      emissionSourceId: null,
      carbonFootprintKg: 100,
    },
    {
      id: 'str-2',
      projectId: 'p1',
      streamId: '2',
      name: 'Product 1',
      phase: 'Liquid',
      temperatureC: 30,
      pressureAtm: 1,
      flowRate: 80,
      unit: 'kg/hr',
      category: 'Product',
      components: [],
      emissionSourceId: null,
      carbonFootprintKg: 50,
    },
  ];

  const equipment: Equipment[] = [
    {
      id: 'eq-1',
      projectId: 'p1',
      equipmentId: 'P1',
      name: 'P1',
      type: 'Pump',
      heatingDuty: null,
      coolingDuty: null,
      electricityConsumption: 10,
      energyUnit: 'kW',
      temperatureC: null,
      pressureAtm: null,
      emissionSourceId: null,
      carbonFootprintKg: 200,
    },
    {
      id: 'eq-2',
      projectId: 'p1',
      equipmentId: 'R1',
      name: 'R1',
      type: 'Reactor',
      heatingDuty: 1,
      coolingDuty: null,
      electricityConsumption: null,
      energyUnit: 'MMkcal/hr',
      temperatureC: 100,
      pressureAtm: 1,
      emissionSourceId: null,
      carbonFootprintKg: 400,
    },
  ];

  it('builds nodes for streams and equipment', () => {
    const graph = service.buildGraph(streams, equipment);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.links.length).toBeGreaterThan(0);
  });

  it('assigns Low/Medium/High colors by carbon ratio of max', () => {
    expect(service.carbonColor(0, 100)).toBe('#2E7D32');
    expect(service.carbonColor(50, 100)).toBe('#F9A825');
    expect(service.carbonColor(80, 100)).toBe('#C62828');
  });

  it('filters high carbon nodes', () => {
    const graph = service.buildGraph(streams, equipment, {
      search: '',
      showStreams: true,
      showEquipment: true,
      highCarbonOnly: true,
      minCarbonKg: 0,
    });

    expect(graph.nodes.every((node) => node.data.isHighCarbon)).toBe(true);
  });

  it('filters by search text', () => {
    const graph = service.buildGraph(streams, equipment, {
      search: 'reactor',
      showStreams: true,
      showEquipment: true,
      highCarbonOnly: false,
      minCarbonKg: 0,
    });

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].label).toBe('R1');
  });

  it('includes transport carbon on stream nodes', () => {
    const transportByStream = new Map<string, number>([['str-1', 25]]);
    const graph = service.buildGraph(
      streams,
      equipment,
      {
        search: '',
        showStreams: true,
        showEquipment: true,
        highCarbonOnly: false,
        minCarbonKg: 0,
      },
      null,
      transportByStream,
    );

    const feed = graph.nodes.find((node) => node.id === 'str-1');
    expect(feed?.data.processCarbonKg).toBe(100);
    expect(feed?.data.transportCarbonKg).toBe(25);
    expect(feed?.data.carbonFootprintKg).toBe(125);
    expect(feed?.data.subtitle).toContain('Transport');
  });
});
