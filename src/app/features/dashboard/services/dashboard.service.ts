import { Injectable, inject } from '@angular/core';
import {
  CarbonContributor,
  DashboardData,
  DashboardKpis,
  EmissionSourceUsage,
} from '../../../models/domain.model';
import { ProjectStore } from '../../../core/stores/project.store';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly projectStore = inject(ProjectStore);

  getDashboardData(): DashboardData {
    const project = this.projectStore.project();
    const streams = this.projectStore.selectedStreams();
    const equipment = this.projectStore.selectedEquipment();
    const sources = this.projectStore.emissionSources();
    const calculations = this.projectStore.calculations();

    const streamCarbonKg = this.projectStore.streamCarbonKg();
    const equipmentCarbonKg = this.projectStore.equipmentCarbonKg();
    const transportCarbonKg = this.projectStore.transportCarbonKg();
    const totalCarbonKg = this.projectStore.totalCarbonKg();

    const topStreams = [...streams].sort(
      (a, b) => b.carbonFootprintKg - a.carbonFootprintKg,
    );
    const topEquipment = [...equipment].sort(
      (a, b) => b.carbonFootprintKg - a.carbonFootprintKg,
    );

    const contributors: CarbonContributor[] = [
      ...streams.map((stream) => ({
        id: stream.id,
        name: stream.name,
        type: 'Stream' as const,
        carbonFootprintKg: stream.carbonFootprintKg,
      })),
      ...equipment.map((item) => ({
        id: item.id,
        name: item.name,
        type: 'Equipment' as const,
        carbonFootprintKg: item.carbonFootprintKg,
      })),
    ]
      .sort((a, b) => b.carbonFootprintKg - a.carbonFootprintKg)
      .slice(0, 10);

    const usageMap = new Map<string, number>();
    for (const stream of streams) {
      if (stream.emissionSourceId) {
        usageMap.set(
          stream.emissionSourceId,
          (usageMap.get(stream.emissionSourceId) ?? 0) + 1,
        );
      }
    }
    for (const item of equipment) {
      if (item.emissionSourceId) {
        usageMap.set(
          item.emissionSourceId,
          (usageMap.get(item.emissionSourceId) ?? 0) + 1,
        );
      }
    }

    const totalUsage = [...usageMap.values()].reduce((sum, value) => sum + value, 0) || 1;
    const emissionSourceUsage: EmissionSourceUsage[] = sources.map((source) => {
      const count = usageMap.get(source.id) ?? 0;
      return {
        sourceId: source.id,
        sourceName: source.name,
        count,
        percentage: Math.round((count / totalUsage) * 1000) / 10,
      };
    });

    const kpis: DashboardKpis = {
      totalCarbonKg,
      totalStreams: streams.length,
      totalEquipment: equipment.length,
      totalEmissionSources: sources.length,
      totalStreamEmissionsKg: streamCarbonKg,
      totalEquipmentEmissionsKg: equipmentCarbonKg,
      totalTransportEmissionsKg: transportCarbonKg,
      highestCarbonStream: topStreams[0]?.name ?? null,
      highestCarbonEquipment: topEquipment[0]?.name ?? null,
      averageCarbonPerStream: streams.length ? streamCarbonKg / streams.length : 0,
      averageCarbonPerEquipment: equipment.length
        ? equipmentCarbonKg / equipment.length
        : 0,
      lastCalculationDate: project.lastCalculationDate,
    };

    return {
      project,
      kpis,
      topContributors: contributors,
      carbonByCategory: [
        { category: 'Streams', carbonKg: streamCarbonKg },
        { category: 'Equipment', carbonKg: equipmentCarbonKg },
        { category: 'Transportation', carbonKg: transportCarbonKg },
      ],
      emissionSourceUsage,
      carbonTrend: [...calculations]
        .reverse()
        .map((calc) => ({
          label: calc.version,
          totalCarbonKg: calc.totalCarbonKg,
        })),
      recentCalculations: calculations,
      topStreams: topStreams.slice(0, 5),
      topEquipment: topEquipment.slice(0, 5),
    };
  }
}
