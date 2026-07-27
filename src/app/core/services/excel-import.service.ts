import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import {
  Equipment,
  EquipmentType,
  ProcessStream,
  StreamPhase,
} from '../../models/domain.model';
import { ProjectStore } from '../stores/project.store';

export interface ImportSummary {
  streamsImported: number;
  equipmentImported: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ExcelImportService {
  private readonly projectStore = inject(ProjectStore);

  async importExampleFiles(): Promise<ImportSummary> {
    const [streamBook, equipmentBook] = await Promise.all([
      this.loadWorkbook('/examples/Stream table_LCSoft form.xlsx'),
      this.loadWorkbook('/examples/Eqiupment table_LCSoft form.xlsx'),
    ]);

    const streams = this.parseStreams(streamBook);
    const equipment = this.parseEquipment(equipmentBook);

    this.projectStore.setStreams(streams);
    this.projectStore.setEquipment(equipment);

    return {
      streamsImported: streams.length,
      equipmentImported: equipment.length,
      message: `Imported ${streams.length} streams and ${equipment.length} equipment items from LCSoft example files.`,
    };
  }

  async importStreamFile(file: File): Promise<number> {
    const workbook = await this.readFile(file);
    const streams = this.parseStreams(workbook);
    this.projectStore.setStreams(streams);
    return streams.length;
  }

  async importEquipmentFile(file: File): Promise<number> {
    const workbook = await this.readFile(file);
    const equipment = this.parseEquipment(workbook);
    this.projectStore.setEquipment(equipment);
    return equipment.length;
  }

  private async loadWorkbook(url: string): Promise<XLSX.WorkBook> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load example file: ${url}`);
    }
    const buffer = await response.arrayBuffer();
    return XLSX.read(buffer, { type: 'array' });
  }

  private async readFile(file: File): Promise<XLSX.WorkBook> {
    const buffer = await file.arrayBuffer();
    return XLSX.read(buffer, { type: 'array' });
  }

  private parseStreams(workbook: XLSX.WorkBook): ProcessStream[] {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    if (rows.length < 4) {
      return [];
    }

    const nameRow = rows[0] ?? [];
    const phaseRow = rows[2] ?? [];
    const tempRow = rows[3] ?? [];
    const pressureRow = rows[4] ?? [];
    const projectId = this.projectStore.project().id;

    const streams: ProcessStream[] = [];

    for (let col = 2; col < nameRow.length; col++) {
      const rawName = nameRow[col];
      if (rawName === null || rawName === undefined || rawName === '') {
        continue;
      }

      const streamId = String(rawName);
      const phase = this.toPhase(phaseRow[col]);
      const temperatureC = this.toNumber(tempRow[col]);
      const pressureAtm = this.toNumber(pressureRow[col]);

      const components = [];
      let totalFlow = 0;

      for (let rowIndex = 7; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!row) {
          continue;
        }
        const componentName = row[0];
        const flowRate = this.toNumber(row[col]);
        if (
          typeof componentName !== 'string' ||
          !componentName.trim() ||
          flowRate === null ||
          flowRate === 0
        ) {
          continue;
        }

        components.push({
          componentName: componentName.trim(),
          flowRate,
          unit: 'kg/hr',
          emissionFactorId: null,
          carbonFootprintKg: 0,
        });
        totalFlow += flowRate;
      }

      streams.push({
        id: `str-import-${streamId}`,
        projectId,
        streamId,
        name: `Stream ${streamId}`,
        phase,
        temperatureC,
        pressureAtm,
        flowRate: Math.round(totalFlow * 100) / 100,
        unit: 'kg/hr',
        category: 'Imported',
        components,
        emissionSourceId: null,
        carbonFootprintKg: 0,
      });
    }

    return streams;
  }

  private parseEquipment(workbook: XLSX.WorkBook): Equipment[] {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    const projectId = this.projectStore.project().id;
    const equipment: Equipment[] = [];
    let currentType: EquipmentType | null = null;
    let nameRow: (string | number | null)[] | null = null;

    const typeHeaders: Record<string, EquipmentType> = {
      Pump: 'Pump',
      Reactor: 'Reactor',
      Flash: 'Flash Drum',
      'Heat Exchanger': 'Heat Exchanger',
      Column: 'Distillation Column',
      Compressor: 'Compressor',
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) {
        continue;
      }

      const label = typeof row[0] === 'string' ? row[0].trim() : '';
      if (label in typeHeaders) {
        currentType = typeHeaders[label];
        nameRow = null;
        continue;
      }

      if (!currentType) {
        continue;
      }

      if (label.toLowerCase().includes('name')) {
        nameRow = row;
        const propertyRows: { key: string; values: (string | number | null)[] }[] = [];

        for (let j = i + 1; j < rows.length; j++) {
          const next = rows[j];
          if (!next) {
            continue;
          }
          const nextLabel = typeof next[0] === 'string' ? next[0].trim() : '';
          if (!nextLabel) {
            continue;
          }
          if (nextLabel in typeHeaders || nextLabel.toLowerCase().includes('name')) {
            break;
          }
          propertyRows.push({ key: nextLabel, values: next });
        }

        for (let col = 2; col < nameRow.length; col++) {
          const rawName = nameRow[col];
          if (rawName === null || rawName === undefined || rawName === '') {
            continue;
          }

          const name = String(rawName);
          const work = this.findNumeric(propertyRows, ['Work'], col);
          const duty = this.findNumeric(propertyRows, ['Duty'], col);
          const temperatureC = this.findNumeric(propertyRows, ['Temperature'], col);
          const pressureAtm = this.findNumeric(propertyRows, ['Pressure'], col);

          const heatingDuty = duty !== null && duty > 0 ? duty : null;
          const coolingDuty = duty !== null && duty < 0 ? Math.abs(duty) : null;

          equipment.push({
            id: `eq-import-${name}`,
            projectId,
            equipmentId: name,
            name,
            type: currentType,
            heatingDuty,
            coolingDuty,
            electricityConsumption: currentType === 'Pump' || currentType === 'Compressor' ? work : null,
            energyUnit:
              currentType === 'Pump' || currentType === 'Compressor' ? 'kW' : 'MMkcal/hr',
            temperatureC,
            pressureAtm,
            emissionSourceId: null,
            carbonFootprintKg: 0,
          });
        }
      }
    }

    return equipment;
  }

  private findNumeric(
    rows: { key: string; values: (string | number | null)[] }[],
    keys: string[],
    col: number,
  ): number | null {
    const match = rows.find((row) =>
      keys.some((key) => row.key.toLowerCase() === key.toLowerCase()),
    );
    return match ? this.toNumber(match.values[col]) : null;
  }

  private toNumber(value: string | number | null | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toPhase(value: string | number | null | undefined): StreamPhase {
    if (typeof value !== 'string') {
      return 'Unknown';
    }
    const normalized = value.trim();
    if (
      normalized === 'Liquid' ||
      normalized === 'Vapor' ||
      normalized === 'Mixed' ||
      normalized === 'Solid'
    ) {
      return normalized;
    }
    return 'Unknown';
  }
}
