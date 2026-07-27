import { describe, expect, it, beforeEach } from 'vitest';
import { ProjectPersistenceService } from './project-persistence.service';
import { ProjectWorkspace } from '../../models/domain.model';

describe('ProjectPersistenceService', () => {
  const service = new ProjectPersistenceService();

  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads workspace + index', () => {
    const workspace: ProjectWorkspace = {
      project: {
        id: 'proj-test',
        name: 'Test',
        description: 'desc',
        createdDate: '2026-07-20',
        lastCalculationDate: null,
        selectedEmissionSourceIds: [],
      },
      streams: [],
      equipment: [],
      calculations: [],
      updatedAt: '2026-07-20T10:00:00.000Z',
    };

    service.saveWorkspace(workspace);
    service.saveIndex([service.toListItem(workspace)]);
    service.saveActiveId(workspace.project.id);

    expect(service.loadWorkspace('proj-test')?.project.name).toBe('Test');
    expect(service.loadIndex()).toHaveLength(1);
    expect(service.loadActiveId()).toBe('proj-test');
  });

  it('builds list item totals from stream and equipment carbon', () => {
    const workspace: ProjectWorkspace = {
      project: {
        id: 'proj-test',
        name: 'Test',
        description: '',
        createdDate: '2026-07-20',
        lastCalculationDate: null,
        selectedEmissionSourceIds: [],
      },
      streams: [
        {
          id: 's1',
          projectId: 'proj-test',
          streamId: '1',
          name: 'S1',
          phase: 'Liquid',
          temperatureC: null,
          pressureAtm: null,
          flowRate: 1,
          unit: 'kg/hr',
          category: 'Feed',
          components: [],
          emissionSourceId: null,
          carbonFootprintKg: 10,
        },
      ],
      equipment: [
        {
          id: 'e1',
          projectId: 'proj-test',
          equipmentId: 'P1',
          name: 'P1',
          type: 'Pump',
          heatingDuty: null,
          coolingDuty: null,
          electricityConsumption: 1,
          energyUnit: 'kW',
          temperatureC: null,
          pressureAtm: null,
          emissionSourceId: null,
          carbonFootprintKg: 5.5,
        },
      ],
      calculations: [],
      updatedAt: '2026-07-20T10:00:00.000Z',
    };

    const item = service.toListItem(workspace);
    expect(item.totalCarbonKg).toBe(15.5);
    expect(item.streamCount).toBe(1);
    expect(item.equipmentCount).toBe(1);
  });
});
