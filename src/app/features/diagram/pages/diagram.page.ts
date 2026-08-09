import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECElementEvent, EChartsCoreOption } from 'echarts/core';
import { ProjectStore } from '../../../core/stores/project.store';
import {
  DEFAULT_DIAGRAM_FILTERS,
  DiagramFilters,
  DiagramNode,
} from '../models/diagram.model';
import { DiagramService } from '../services/diagram.service';

echarts.use([
  BarChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const PIE_COLORS = [
  '#2E7D32',
  '#1976D2',
  '#F9A825',
  '#C62828',
  '#6A1B9A',
  '#00838F',
  '#EF6C00',
];

const TRANSPORT_COLOR = '#1565C0';
const PROCESS_COLOR = '#2E7D32';

@Component({
  selector: 'app-diagram-page',
  imports: [FormsModule, DecimalPipe, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './diagram.page.html',
  styleUrl: './diagram.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagramPage {
  private readonly projectStore = inject(ProjectStore);
  private readonly diagramService = inject(DiagramService);

  readonly project = this.projectStore.project;
  readonly streamCarbonKg = this.projectStore.streamCarbonKg;
  readonly equipmentCarbonKg = this.projectStore.equipmentCarbonKg;
  readonly transportCarbonKg = this.projectStore.transportCarbonKg;
  readonly totalCarbonKg = this.projectStore.totalCarbonKg;

  readonly filters = signal<DiagramFilters>({ ...DEFAULT_DIAGRAM_FILTERS });
  readonly selectedId = signal<string | null>(null);

  readonly transportKgByStreamId = computed(() => {
    const map = new Map<string, number>();
    for (const stream of this.projectStore.streams()) {
      map.set(stream.id, this.projectStore.resolveTransportCarbonKg(stream.transport));
    }
    return map;
  });

  readonly graph = computed(() => {
    const selectedStreamIds = this.projectStore.selectedStreamIds();
    const selectedEquipmentIds = this.projectStore.selectedEquipmentIds();
    const streams = this.projectStore
      .streams()
      .filter((stream) => selectedStreamIds.has(stream.id));
    const equipment = this.projectStore
      .equipment()
      .filter((item) => selectedEquipmentIds.has(item.id));

    return this.diagramService.buildGraph(
      streams,
      equipment,
      this.filters(),
      this.selectedId(),
      this.transportKgByStreamId(),
    );
  });

  readonly selectedNode = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return null;
    }
    return this.graph().nodes.find((node) => node.id === id) ?? null;
  });

  readonly nodeCount = computed(() => this.graph().nodes.length);

  readonly chartTitle = computed(() => {
    const node = this.selectedNode();
    if (!node) {
      return 'Carbon by node (process + transport)';
    }
    if (node.data.kind === 'stream') {
      return `${node.label} — material & transport CO₂e`;
    }
    return `${node.label} — CO₂e`;
  });

  readonly chartEmptyMessage = computed(() => {
    const node = this.selectedNode();
    if (!node) {
      return null;
    }
    if (node.data.kind === 'stream') {
      const comps = node.data.stream?.components ?? [];
      const hasComponentData = comps.some((c) => c.carbonFootprintKg > 0);
      const hasTransport = node.data.transportCarbonKg > 0;
      if (!hasComponentData && !hasTransport) {
        return 'No material or transport CO₂e data for this stream.';
      }
    }
    return null;
  });

  readonly activeChart = computed<EChartsCoreOption | null>(() => {
    if (this.chartEmptyMessage()) {
      return null;
    }
    const node = this.selectedNode();
    if (!node) {
      return this.buildOverviewChart();
    }
    if (node.data.kind === 'stream') {
      return this.buildStreamPieChart(node);
    }
    return this.buildEquipmentBarChart(node);
  });

  clearSelection(): void {
    this.selectedId.set(null);
  }

  setSearch(value: string): void {
    this.filters.update((current) => ({ ...current, search: value }));
  }

  toggleStreams(checked: boolean): void {
    this.filters.update((current) => ({ ...current, showStreams: checked }));
  }

  toggleEquipment(checked: boolean): void {
    this.filters.update((current) => ({ ...current, showEquipment: checked }));
  }

  toggleHighCarbon(checked: boolean): void {
    this.filters.update((current) => ({ ...current, highCarbonOnly: checked }));
  }

  setMinCarbon(value: number): void {
    this.filters.update((current) => ({
      ...current,
      minCarbonKg: Number.isFinite(value) ? value : 0,
    }));
  }

  selectFromList(node: DiagramNode): void {
    this.selectedId.set(node.id);
  }

  transportLabel(node: DiagramNode): string {
    if (node.data.kind !== 'stream' || node.data.transportCarbonKg <= 0) {
      return '';
    }
    const transport = node.data.stream?.transport;
    if (!transport?.enabled) {
      return '';
    }
    if (transport.inputMode === 'manual') {
      return 'Manual';
    }
    return `${transport.activityAmount} ${transport.activityUnit}`;
  }

  onChartClick(event: ECElementEvent): void {
    if (this.selectedNode()) {
      return;
    }
    if (event.seriesType !== 'bar' || event.dataIndex == null) {
      return;
    }
    const nodes = this.sortedOverviewNodes();
    const node = nodes[event.dataIndex];
    if (node) {
      this.selectedId.set(node.id);
    }
  }

  private sortedOverviewNodes(): DiagramNode[] {
    return [...this.graph().nodes].sort(
      (a, b) => a.data.carbonFootprintKg - b.data.carbonFootprintKg,
    );
  }

  private buildOverviewChart(): EChartsCoreOption {
    const nodes = this.sortedOverviewNodes();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const items = (Array.isArray(params) ? params : [params]) as Array<{
            seriesName?: string;
            name?: string;
            value?: number;
            marker?: string;
          }>;
          if (!items.length) {
            return '';
          }
          const name = items[0].name ?? '';
          const lines = items
            .filter((item) => Number(item.value ?? 0) > 0)
            .map(
              (item) =>
                `${item.marker ?? ''}${item.seriesName}: ${Number(item.value ?? 0).toLocaleString()} kg`,
            );
          const total = items.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
          return `${name}<br/>${lines.join('<br/>')}<br/><b>Total: ${total.toLocaleString()} kg</b>`;
        },
      },
      legend: {
        data: ['Process', 'Transport'],
        top: 0,
      },
      grid: { left: 140, right: 32, top: 40, bottom: 32 },
      xAxis: {
        type: 'value',
        name: 'kg CO₂e',
        axisLabel: { color: '#5f6b5f' },
      },
      yAxis: {
        type: 'category',
        data: nodes.map((node) => node.label),
        axisLabel: { color: '#5f6b5f', width: 120, overflow: 'truncate' },
      },
      series: [
        {
          name: 'Process',
          type: 'bar',
          stack: 'total',
          data: nodes.map((node) => ({
            value: Math.round(node.data.processCarbonKg),
            itemStyle: {
              color: node.data.kind === 'equipment' ? node.data.color : PROCESS_COLOR,
              borderRadius: node.data.transportCarbonKg > 0 ? 0 : [0, 8, 8, 0],
            },
          })),
          barMaxWidth: 28,
          cursor: 'pointer',
        },
        {
          name: 'Transport',
          type: 'bar',
          stack: 'total',
          data: nodes.map((node) => ({
            value: Math.round(node.data.transportCarbonKg),
            itemStyle: { color: TRANSPORT_COLOR, borderRadius: [0, 8, 8, 0] },
          })),
          barMaxWidth: 28,
          cursor: 'pointer',
        },
      ],
    };
  }

  private buildStreamPieChart(node: DiagramNode): EChartsCoreOption {
    const components = (node.data.stream?.components ?? []).filter(
      (c) => c.carbonFootprintKg > 0,
    );
    const data = components.map((c) => ({
      name: c.componentName,
      value: Math.round(c.carbonFootprintKg * 10) / 10,
    }));

    if (node.data.transportCarbonKg > 0) {
      data.push({
        name: 'Transportation',
        value: Math.round(node.data.transportCarbonKg * 10) / 10,
      });
    }

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} kg ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      color: PIE_COLORS,
      series: [
        {
          type: 'pie',
          radius: ['40%', '68%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{d}%' },
          data,
        },
      ],
    };
  }

  private buildEquipmentBarChart(node: DiagramNode): EChartsCoreOption {
    const value = node.data.equipment?.carbonFootprintKg ?? node.data.carbonFootprintKg;

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      xAxis: {
        type: 'category',
        data: ['CO₂e (kg)'],
        axisLabel: { color: '#5f6b5f' },
      },
      yAxis: {
        type: 'value',
        name: 'kg CO₂e',
        axisLabel: { color: '#5f6b5f' },
      },
      series: [
        {
          type: 'bar',
          data: [
            {
              value: Math.round(value * 10) / 10,
              itemStyle: { color: node.data.color, borderRadius: [8, 8, 0, 0] },
            },
          ],
          barMaxWidth: 64,
        },
      ],
    };
  }
}
