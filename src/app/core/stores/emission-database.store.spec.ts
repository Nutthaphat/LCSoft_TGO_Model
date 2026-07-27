import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmissionDatabaseStore } from './emission-database.store';

describe('EmissionDatabaseStore', () => {
  let store: EmissionDatabaseStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(EmissionDatabaseStore);
    store.restoreDefaults();
  });

  it('seeds default sources and factors', () => {
    expect(store.sourceCount()).toBeGreaterThan(0);
    expect(store.factorCount()).toBeGreaterThan(0);
  });

  it('adds and updates an emission source', () => {
    const created = store.addSource({
      name: 'TGO Local',
      organization: 'TGO',
      country: 'Thailand',
      year: 2026,
      version: '1.0',
      reference: 'Internal',
    });

    expect(store.sources().some((item) => item.id === created.id)).toBe(true);

    store.updateSource(created.id, {
      name: 'TGO Local Updated',
      organization: 'TGO',
      country: 'Thailand',
      year: 2026,
      version: '1.1',
      reference: 'Internal',
    });

    expect(store.getSourceName(created.id)).toBe('TGO Local Updated');
  });

  it('rejects duplicate source names', () => {
    expect(() =>
      store.addSource({
        name: 'IPCC',
        organization: 'X',
        country: 'Y',
        year: 2020,
        version: '1',
        reference: '',
      }),
    ).toThrow(/already exists/);
  });

  it('adds factor and cascades delete with source', () => {
    const source = store.addSource({
      name: 'Custom Source',
      organization: 'Lab',
      country: 'Thailand',
      year: 2026,
      version: '1.0',
      reference: '',
    });

    const factor = store.addFactor({
      sourceId: source.id,
      category: 'Material',
      material: 'CUSTOM_CHEM',
      unit: 'kg',
      carbonFactor: 1.2,
      description: 'test',
    });

    expect(store.factors().some((item) => item.id === factor.id)).toBe(true);

    store.deleteSource(source.id, true);
    expect(store.sources().some((item) => item.id === source.id)).toBe(false);
    expect(store.factors().some((item) => item.id === factor.id)).toBe(false);
  });

  it('exports and replaces database from JSON', () => {
    const exported = store.exportDatabase();
    store.addSource({
      name: 'Temp Source',
      organization: 'Temp',
      country: 'TH',
      year: 2026,
      version: '1',
      reference: '',
    });

    const snapshot = store.importDatabase(exported, 'replace');
    expect(snapshot.sources.some((item) => item.name === 'Temp Source')).toBe(false);
    expect(snapshot.sources.some((item) => item.name === 'IPCC')).toBe(true);
  });
});
