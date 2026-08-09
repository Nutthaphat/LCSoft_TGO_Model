import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReportService);
  });

  it('builds a report bundle from the active project', () => {
    const report = service.buildReport();

    expect(report.summary.projectName.length).toBeGreaterThan(0);
    expect(report.summary.totalCarbonKg).toBe(
      Math.round(
        (report.summary.streamCarbonKg +
          report.summary.equipmentCarbonKg +
          report.summary.transportCarbonKg) *
          1000,
      ) / 1000,
    );
    expect(report.summary.streamCount).toBe(report.streams.length);
    expect(report.summary.equipmentCount).toBe(report.equipment.length);
    expect(report.topStreams.length).toBeLessThanOrEqual(10);
    expect(report.topEquipment.length).toBeLessThanOrEqual(10);
  });

  it('sorts streams and equipment by carbon descending', () => {
    const report = service.buildReport();

    for (let i = 1; i < report.streams.length; i++) {
      expect(report.streams[i - 1].carbonFootprintKg).toBeGreaterThanOrEqual(
        report.streams[i].carbonFootprintKg,
      );
    }

    for (let i = 1; i < report.equipment.length; i++) {
      expect(report.equipment[i - 1].carbonFootprintKg).toBeGreaterThanOrEqual(
        report.equipment[i].carbonFootprintKg,
      );
    }
  });

  it('includes transport emissions in summary totals', () => {
    const report = service.buildReport();
    expect(report.summary.transportCarbonKg).toBeTypeOf('number');
    expect(report.summary.transportCarbonKg).toBeGreaterThanOrEqual(0);
    expect(report.summary.totalCarbonKg).toBeGreaterThanOrEqual(
      report.summary.streamCarbonKg + report.summary.equipmentCarbonKg,
    );
  });
});
