import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { ProjectStore } from '../../../core/stores/project.store';
import { KpiCard } from '../components/kpi-card/kpi-card';
import { DashboardService } from '../services/dashboard.service';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

@Component({
  selector: 'app-dashboard-page',
  imports: [KpiCard, NgxEchartsDirective, DecimalPipe, DatePipe, RouterLink],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly dashboardService = inject(DashboardService);
  private readonly projectStore = inject(ProjectStore);

  readonly topLimit = signal<5 | 10 | 20>(5);

  readonly data = computed(() => {
    this.projectStore.streams();
    this.projectStore.equipment();
    this.projectStore.selectedStreamIds();
    this.projectStore.selectedEquipmentIds();
    return this.dashboardService.getDashboardData();
  });

  readonly categoryChart = computed<EChartsCoreOption>(() => {
    const categories = this.data().carbonByCategory;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 16, top: 24, bottom: 32 },
      xAxis: {
        type: 'category',
        data: categories.map((item) => item.category),
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
          data: categories.map((item) => Math.round(item.carbonKg)),
          itemStyle: { color: '#2E7D32', borderRadius: [8, 8, 0, 0] },
          barWidth: 36,
        },
      ],
    };
  });

  readonly contributorsChart = computed<EChartsCoreOption>(() => {
    const limit = this.topLimit();
    const items = this.data().topContributors.slice(0, limit).reverse();
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 120, right: 24, top: 16, bottom: 24 },
      xAxis: { type: 'value', name: 'kg CO₂e' },
      yAxis: {
        type: 'category',
        data: items.map((item) => item.name),
      },
      series: [
        {
          type: 'bar',
          data: items.map((item) => Math.round(item.carbonFootprintKg)),
          itemStyle: { color: '#1976D2', borderRadius: [0, 8, 8, 0] },
        },
      ],
    };
  });

  readonly sourceChart = computed<EChartsCoreOption>(() => {
    const usage = this.data().emissionSourceUsage.filter((item) => item.count > 0);
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}: {d}%' },
          data: usage.map((item) => ({
            name: item.sourceName,
            value: item.count,
          })),
          color: ['#2E7D32', '#1976D2', '#F9A825', '#6A1B9A'],
        },
      ],
    };
  });

  readonly trendChart = computed<EChartsCoreOption>(() => {
    const trend = this.data().carbonTrend;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 16, top: 24, bottom: 32 },
      xAxis: {
        type: 'category',
        data: trend.map((item) => item.label),
      },
      yAxis: { type: 'value', name: 'kg CO₂e' },
      series: [
        {
          type: 'line',
          smooth: true,
          data: trend.map((item) => Math.round(item.totalCarbonKg)),
          areaStyle: { color: 'rgba(46, 125, 50, 0.12)' },
          lineStyle: { color: '#2E7D32', width: 3 },
          itemStyle: { color: '#2E7D32' },
        },
      ],
    };
  });

  setTopLimit(limit: 5 | 10 | 20): void {
    this.topLimit.set(limit);
  }
}
