import { Injectable } from '@angular/core';
import { Equipment, ProcessStream } from '../../../models/domain.model';
import {
  DEFAULT_DIAGRAM_FILTERS,
  DiagramEdge,
  DiagramFilters,
  DiagramGraph,
  DiagramNode,
} from '../models/diagram.model';

const EQUIPMENT_ORDER: Record<string, number> = {
  Pump: 1,
  Compressor: 2,
  Reactor: 3,
  'Flash Drum': 4,
  'Heat Exchanger': 5,
  'Distillation Column': 6,
};

@Injectable({ providedIn: 'root' })
export class DiagramService {
  buildGraph(
    streams: ProcessStream[],
    equipment: Equipment[],
    filters: DiagramFilters = DEFAULT_DIAGRAM_FILTERS,
    selectedId: string | null = null,
  ): DiagramGraph {
    const maxCarbon = Math.max(
      1,
      ...streams.map((item) => item.carbonFootprintKg),
      ...equipment.map((item) => item.carbonFootprintKg),
    );

    const highThreshold = maxCarbon * 0.6;
    const query = filters.search.trim().toLowerCase();

    const streamNodes: DiagramNode[] = streams.map((stream) => {
      const label = stream.name;
      const isMatch = !query || this.matchesQuery(query, label, stream.phase, stream.category);
      return {
        id: stream.id,
        label,
        dimension: { width: 160, height: 64 },
        data: {
          kind: 'stream' as const,
          carbonFootprintKg: stream.carbonFootprintKg,
          color: this.carbonColor(stream.carbonFootprintKg, maxCarbon),
          isHighCarbon: stream.carbonFootprintKg >= highThreshold,
          isMatch,
          isSelected: selectedId === stream.id,
          stream,
          subtitle: `${stream.phase} · ${stream.category}`,
        },
      };
    });

    const equipmentNodes: DiagramNode[] = equipment.map((item) => {
      const label = item.name;
      const isMatch = !query || this.matchesQuery(query, label, item.type, item.energyUnit);
      return {
        id: item.id,
        label,
        dimension: { width: 170, height: 72 },
        data: {
          kind: 'equipment' as const,
          carbonFootprintKg: item.carbonFootprintKg,
          color: this.carbonColor(item.carbonFootprintKg, maxCarbon),
          isHighCarbon: item.carbonFootprintKg >= highThreshold,
          isMatch,
          isSelected: selectedId === item.id,
          equipment: item,
          subtitle: item.type,
        },
      };
    });

    const visibleNodes = [...streamNodes, ...equipmentNodes].filter((node) => {
      if (node.data.kind === 'stream' && !filters.showStreams) {
        return false;
      }
      if (node.data.kind === 'equipment' && !filters.showEquipment) {
        return false;
      }
      if (filters.highCarbonOnly && !node.data.isHighCarbon) {
        return false;
      }
      if (node.data.carbonFootprintKg < filters.minCarbonKg) {
        return false;
      }
      if (query && !node.data.isMatch) {
        return false;
      }
      return true;
    });

    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const links = this.buildLinks(streams, equipment, maxCarbon).filter(
      (link) => visibleIds.has(link.source) && visibleIds.has(link.target),
    );

    return { nodes: visibleNodes, links };
  }

  private buildLinks(
    streams: ProcessStream[],
    equipment: Equipment[],
    maxCarbon: number,
  ): DiagramEdge[] {
    const links: DiagramEdge[] = [];
    const sortedEquipment = [...equipment].sort(
      (a, b) => (EQUIPMENT_ORDER[a.type] ?? 99) - (EQUIPMENT_ORDER[b.type] ?? 99),
    );

    for (let i = 0; i < sortedEquipment.length - 1; i++) {
      const source = sortedEquipment[i];
      const target = sortedEquipment[i + 1];
      const carbon = (source.carbonFootprintKg + target.carbonFootprintKg) / 2;
      links.push({
        id: `eq-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        label: '',
        data: {
          carbonFootprintKg: carbon,
          color: this.carbonColor(carbon, maxCarbon),
        },
      });
    }

    const feeds = streams.filter((stream) => /feed/i.test(stream.category));
    const products = streams.filter((stream) => /product|recycle/i.test(stream.category));
    const processStreams = streams.filter(
      (stream) => !feeds.includes(stream) && !products.includes(stream),
    );

    const firstEquipment = sortedEquipment[0];
    const lastEquipment = sortedEquipment[sortedEquipment.length - 1];
    const midEquipment =
      sortedEquipment[Math.floor(sortedEquipment.length / 2)] ?? firstEquipment;

    for (const stream of feeds) {
      if (!firstEquipment) {
        break;
      }
      links.push({
        id: `feed-${stream.id}-${firstEquipment.id}`,
        source: stream.id,
        target: firstEquipment.id,
        data: {
          carbonFootprintKg: stream.carbonFootprintKg,
          color: this.carbonColor(stream.carbonFootprintKg, maxCarbon),
        },
      });
    }

    for (const stream of products) {
      if (!lastEquipment) {
        break;
      }
      links.push({
        id: `prod-${lastEquipment.id}-${stream.id}`,
        source: lastEquipment.id,
        target: stream.id,
        data: {
          carbonFootprintKg: stream.carbonFootprintKg,
          color: this.carbonColor(stream.carbonFootprintKg, maxCarbon),
        },
      });
    }

    processStreams.forEach((stream, index) => {
      if (!midEquipment) {
        return;
      }
      const target =
        sortedEquipment[index % Math.max(sortedEquipment.length, 1)] ?? midEquipment;
      links.push({
        id: `proc-${stream.id}-${target.id}`,
        source: stream.id,
        target: target.id,
        data: {
          carbonFootprintKg: stream.carbonFootprintKg,
          color: this.carbonColor(stream.carbonFootprintKg, maxCarbon),
        },
      });
    });

    // Fallback: if no equipment, connect streams in list order.
    if (sortedEquipment.length === 0) {
      for (let i = 0; i < streams.length - 1; i++) {
        links.push({
          id: `stream-${streams[i].id}-${streams[i + 1].id}`,
          source: streams[i].id,
          target: streams[i + 1].id,
          data: {
            carbonFootprintKg: streams[i].carbonFootprintKg,
            color: this.carbonColor(streams[i].carbonFootprintKg, maxCarbon),
          },
        });
      }
    }

    return links;
  }

  /** Low <33%, Medium 33–66%, High ≥66% of max carbon among current nodes. */
  carbonColor(value: number, max: number): string {
    const ratio = Math.min(1, Math.max(0, value / max));
    if (ratio < 0.33) {
      return '#2E7D32';
    }
    if (ratio < 0.66) {
      return '#F9A825';
    }
    return '#C62828';
  }

  private matchesQuery(query: string, ...parts: Array<string | null | undefined>): boolean {
    return parts.join(' ').toLowerCase().includes(query);
  }
}
