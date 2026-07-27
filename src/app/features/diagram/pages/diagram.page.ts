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

const PIE_COLORS = ['#2E7D32', '#1976D2', '#F9A825', '#C62828', '#6A1B9A', '#00838F'];

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
  readonly filters = signal<DiagramFilters>({ ...DEFAULT_DIAGRAM_FILTERS });
  readonly selectedId = signal<string | null>(null);

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
      return 'Carbon by node (kg CO₂e)';
    }
    if (node.data.kind === 'stream') {
      return `${node.label} — component CO₂e`;
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
      const hasData = comps.some((c) => c.carbonFootprintKg > 0);
      if (!comps.length || !hasData) {
        return 'No component CO₂e data for this stream.';
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
          const items = Array.isArray(params) ? params : [params];
          const first = items[0] as { name?: string; value?: number } | undefined;
          if (!first) {
            return '';
          }
          return `${first.name}<br/>${Number(first.value ?? 0).toLocaleString()} kg CO₂e`;
        },
      },
      grid: { left: 140, right: 32, top: 24, bottom: 32 },
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
          type: 'bar',
          data: nodes.map((node) => ({
            value: Math.round(node.data.carbonFootprintKg),
            itemStyle: { color: node.data.color, borderRadius: [0, 8, 8, 0] },
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
          data: components.map((c) => ({
            name: c.componentName,
            value: Math.round(c.carbonFootprintKg * 10) / 10,
          })),
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
