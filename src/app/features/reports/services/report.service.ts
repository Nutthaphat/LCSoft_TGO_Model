import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { EmissionDatabaseStore } from '../../../core/stores/emission-database.store';
import { ProjectStore } from '../../../core/stores/project.store';
import {
  ReportBundle,
  ReportExportOptions,
  ReportSection,
  ReportSummary,
} from '../models/report.model';

const ALL_SECTIONS: ReportSection[] = [
  'summary',
  'streams',
  'equipment',
  'emissionFactors',
  'calculations',
];

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly projectStore = inject(ProjectStore);
  private readonly emissionDb = inject(EmissionDatabaseStore);

  buildReport(): ReportBundle {
    const project = this.projectStore.project();
    const streams = [...this.projectStore.selectedStreams()].sort(
      (a, b) => b.carbonFootprintKg - a.carbonFootprintKg,
    );
    const equipment = [...this.projectStore.selectedEquipment()].sort(
      (a, b) => b.carbonFootprintKg - a.carbonFootprintKg,
    );
    const emissionSources = this.emissionDb.sources();
    const emissionFactors = this.emissionDb.factors();
    const calculations = this.projectStore.calculations();

    const streamCarbonKg = this.round(this.projectStore.streamCarbonKg());
    const equipmentCarbonKg = this.round(this.projectStore.equipmentCarbonKg());

    const summary: ReportSummary = {
      projectName: project.name,
      projectDescription: project.description,
      generatedAt: new Date().toISOString(),
      lastCalculationDate: project.lastCalculationDate,
      totalCarbonKg: this.round(streamCarbonKg + equipmentCarbonKg),
      streamCarbonKg,
      equipmentCarbonKg,
      streamCount: streams.length,
      equipmentCount: equipment.length,
      emissionSourceCount: emissionSources.length,
      emissionFactorCount: emissionFactors.length,
    };

    return {
      summary,
      project,
      streams,
      equipment,
      emissionSources,
      emissionFactors,
      calculations,
      topStreams: streams.slice(0, 10),
      topEquipment: equipment.slice(0, 10),
    };
  }

  exportExcel(
    options: ReportExportOptions = { sections: ALL_SECTIONS },
  ): void {
    const report = this.buildReport();
    const sections = options.sections.length ? options.sections : ALL_SECTIONS;
    const workbook = XLSX.utils.book_new();

    if (sections.includes('summary')) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(this.summarySheet(report)),
        'Summary',
      );
    }

    if (sections.includes('streams')) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(this.streamRows(report)),
        'Streams',
      );
    }

    if (sections.includes('equipment')) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(this.equipmentRows(report)),
        'Equipment',
      );
    }

    if (sections.includes('emissionFactors')) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(this.factorRows(report)),
        'Emission Factors',
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(this.sourceRows(report)),
        'Emission Sources',
      );
    }

    if (sections.includes('calculations')) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(this.calculationRows(report)),
        'Calculations',
      );
    }

    XLSX.writeFile(workbook, `${this.fileName(report, options)}.xlsx`);
  }

  exportPdf(options: ReportExportOptions = { sections: ALL_SECTIONS }): void {
    const report = this.buildReport();
    const sections = options.sections.length ? options.sections : ALL_SECTIONS;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    let y = 40;

    doc.setFontSize(16);
    doc.setTextColor(30, 80, 40);
    doc.text('LCSoft TGO — Carbon Footprint Report', 40, y);
    y += 22;

    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(`Project: ${report.summary.projectName}`, 40, y);
    y += 16;
    doc.text(`Generated: ${this.formatDateTime(report.summary.generatedAt)}`, 40, y);
    y += 16;
    doc.text(
      `Total CO₂e: ${this.formatNumber(report.summary.totalCarbonKg)} kg`,
      40,
      y,
    );
    y += 14;

    if (sections.includes('summary')) {
      y = this.addSectionTitle(doc, 'Carbon Footprint Summary', y);
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Stream Emissions (kg)', this.formatNumber(report.summary.streamCarbonKg)],
          ['Equipment Emissions (kg)', this.formatNumber(report.summary.equipmentCarbonKg)],
          ['Total Emissions (kg)', this.formatNumber(report.summary.totalCarbonKg)],
          ['Streams', String(report.summary.streamCount)],
          ['Equipment', String(report.summary.equipmentCount)],
          ['Emission Sources', String(report.summary.emissionSourceCount)],
          ['Emission Factors', String(report.summary.emissionFactorCount)],
          ['Last Calculation', report.summary.lastCalculationDate ?? '—'],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [46, 125, 50] },
      });
      y = this.tableEndY(doc) + 18;
    }

    if (sections.includes('streams')) {
      y = this.addSectionTitle(doc, 'Stream Summary', y);
      autoTable(doc, {
        startY: y,
        head: [['Stream', 'Phase', 'Category', 'Flow', 'CO₂e (kg)', 'Components']],
        body: report.streams.map((stream) => [
          stream.name,
          stream.phase,
          stream.category,
          `${this.formatNumber(stream.flowRate)} ${stream.unit}`,
          this.formatNumber(stream.carbonFootprintKg),
          String(stream.components.length),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [46, 125, 50] },
      });
      y = this.tableEndY(doc) + 18;
    }

    if (sections.includes('equipment')) {
      y = this.addSectionTitle(doc, 'Equipment Summary', y);
      autoTable(doc, {
        startY: y,
        head: [['Equipment', 'Type', 'Electricity', 'Heating', 'Cooling', 'CO₂e (kg)']],
        body: report.equipment.map((item) => [
          item.name,
          item.type,
          item.electricityConsumption == null
            ? '—'
            : `${this.formatNumber(item.electricityConsumption)} ${item.energyUnit}`,
          item.heatingDuty == null ? '—' : this.formatNumber(item.heatingDuty),
          item.coolingDuty == null ? '—' : this.formatNumber(item.coolingDuty),
          this.formatNumber(item.carbonFootprintKg),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [46, 125, 50] },
      });
      y = this.tableEndY(doc) + 18;
    }

    if (sections.includes('emissionFactors')) {
      y = this.addSectionTitle(doc, 'Emission Factor Summary', y);
      autoTable(doc, {
        startY: y,
        head: [['Material', 'Source', 'Category', 'Unit', 'kgCO₂e']],
        body: report.emissionFactors.map((factor) => [
          factor.material,
          report.emissionSources.find((source) => source.id === factor.sourceId)?.name ??
            factor.sourceId,
          factor.category,
          factor.unit,
          this.formatNumber(factor.carbonFactor, 4),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [46, 125, 50] },
      });
      y = this.tableEndY(doc) + 18;
    }

    if (sections.includes('calculations')) {
      y = this.addSectionTitle(doc, 'Calculation History', y);
      autoTable(doc, {
        startY: y,
        head: [['Version', 'Date', 'Streams (kg)', 'Equipment (kg)', 'Total (kg)']],
        body: report.calculations.map((calc) => [
          calc.version,
          calc.calculationDate,
          this.formatNumber(calc.streamCarbonKg),
          this.formatNumber(calc.equipmentCarbonKg),
          this.formatNumber(calc.totalCarbonKg),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [46, 125, 50] },
      });
    }

    doc.save(`${this.fileName(report, options)}.pdf`);
  }

  private summarySheet(report: ReportBundle): Array<Array<string | number>> {
    return [
      ['LCSoft TGO Carbon Footprint Report'],
      ['Project', report.summary.projectName],
      ['Description', report.summary.projectDescription || '—'],
      ['Generated At', this.formatDateTime(report.summary.generatedAt)],
      ['Last Calculation', report.summary.lastCalculationDate ?? '—'],
      [],
      ['Metric', 'Value'],
      ['Total CO₂e (kg)', report.summary.totalCarbonKg],
      ['Stream Emissions (kg)', report.summary.streamCarbonKg],
      ['Equipment Emissions (kg)', report.summary.equipmentCarbonKg],
      ['Total Streams', report.summary.streamCount],
      ['Total Equipment', report.summary.equipmentCount],
      ['Emission Sources', report.summary.emissionSourceCount],
      ['Emission Factors', report.summary.emissionFactorCount],
    ];
  }

  private streamRows(report: ReportBundle): Array<Record<string, string | number>> {
    return report.streams.map((stream) => ({
      'Stream ID': stream.streamId,
      Name: stream.name,
      Phase: stream.phase,
      Category: stream.category,
      'Temperature (C)': stream.temperatureC ?? '',
      'Pressure (atm)': stream.pressureAtm ?? '',
      'Flow Rate': stream.flowRate,
      Unit: stream.unit,
      Components: stream.components.length,
      'CO2e (kg)': stream.carbonFootprintKg,
    }));
  }

  private equipmentRows(report: ReportBundle): Array<Record<string, string | number>> {
    return report.equipment.map((item) => ({
      'Equipment ID': item.equipmentId,
      Name: item.name,
      Type: item.type,
      Electricity: item.electricityConsumption ?? '',
      'Heating Duty': item.heatingDuty ?? '',
      'Cooling Duty': item.coolingDuty ?? '',
      'Energy Unit': item.energyUnit,
      'CO2e (kg)': item.carbonFootprintKg,
    }));
  }

  private factorRows(report: ReportBundle): Array<Record<string, string | number>> {
    return report.emissionFactors.map((factor) => ({
      Material: factor.material,
      Source:
        report.emissionSources.find((source) => source.id === factor.sourceId)?.name ??
        factor.sourceId,
      Category: factor.category,
      Unit: factor.unit,
      'Carbon Factor (kgCO2e)': factor.carbonFactor,
      Description: factor.description,
    }));
  }

  private sourceRows(report: ReportBundle): Array<Record<string, string | number>> {
    return report.emissionSources.map((source) => ({
      Name: source.name,
      Organization: source.organization,
      Country: source.country,
      Year: source.year,
      Version: source.version,
      Reference: source.reference,
    }));
  }

  private calculationRows(report: ReportBundle): Array<Record<string, string | number>> {
    return report.calculations.map((calc) => ({
      Version: calc.version,
      Date: calc.calculationDate,
      'Stream CO2e (kg)': calc.streamCarbonKg,
      'Equipment CO2e (kg)': calc.equipmentCarbonKg,
      'Total CO2e (kg)': calc.totalCarbonKg,
    }));
  }

  private fileName(report: ReportBundle, options: ReportExportOptions): string {
    const base =
      options.fileNameBase?.trim() ||
      report.summary.projectName.replace(/[^\w\-]+/g, '_') ||
      'carbon-report';
    const stamp = new Date().toISOString().slice(0, 10);
    return `${base}_${stamp}`;
  }

  private formatNumber(value: number, digits = 1): string {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }

  private tableEndY(doc: jsPDF): number {
    const previous = (
      doc as jsPDF & { lastAutoTable?: { finalY?: number } }
    ).lastAutoTable?.finalY;
    return previous ?? 40;
  }

  private addSectionTitle(doc: jsPDF, title: string, y: number): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    let nextY = y;
    if (nextY > pageHeight - 80) {
      doc.addPage();
      nextY = 40;
    }
    doc.setFontSize(12);
    doc.setTextColor(30, 80, 40);
    doc.text(title, 40, nextY);
    return nextY + 10;
  }

  private round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
