import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { ProjectStore } from '../../../core/stores/project.store';
import { ReportSection } from '../models/report.model';
import { ReportService } from '../services/report.service';

@Component({
  selector: 'app-reports-page',
  imports: [DecimalPipe, DatePipe, FormsModule],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly reportService = inject(ReportService);
  private readonly projectStore = inject(ProjectStore);

  readonly project = this.projectStore.project;
  readonly exporting = signal(false);
  readonly includeSummary = signal(true);
  readonly includeStreams = signal(true);
  readonly includeEquipment = signal(true);
  readonly includeFactors = signal(true);
  readonly includeCalculations = signal(true);

  readonly report = computed(() => {
    this.projectStore.selectedStreamIds();
    this.projectStore.selectedEquipmentIds();
    this.projectStore.streams();
    this.projectStore.equipment();
    this.projectStore.emissionFactors();
    this.projectStore.calculations();
    return this.reportService.buildReport();
  });

  readonly selectedSections = computed<ReportSection[]>(() => {
    const sections: ReportSection[] = [];
    if (this.includeSummary()) {
      sections.push('summary');
    }
    if (this.includeStreams()) {
      sections.push('streams');
    }
    if (this.includeEquipment()) {
      sections.push('equipment');
    }
    if (this.includeFactors()) {
      sections.push('emissionFactors');
    }
    if (this.includeCalculations()) {
      sections.push('calculations');
    }
    return sections;
  });

  exportExcel(): void {
    this.runExport(() => {
      this.reportService.exportExcel({ sections: this.selectedSections() });
      toast.success('Excel report downloaded');
    });
  }

  exportPdf(): void {
    this.runExport(() => {
      this.reportService.exportPdf({ sections: this.selectedSections() });
      toast.success('PDF report downloaded');
    });
  }

  private runExport(action: () => void): void {
    if (this.selectedSections().length === 0) {
      toast.error('Select at least one report section');
      return;
    }

    this.exporting.set(true);
    try {
      action();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      toast.error(message);
    } finally {
      this.exporting.set(false);
    }
  }
}
