const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emission_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT,
  country TEXT,
  year INTEGER,
  version TEXT,
  reference TEXT
);

CREATE TABLE IF NOT EXISTS emission_factors (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  category TEXT,
  material TEXT NOT NULL,
  unit TEXT,
  carbon_factor REAL NOT NULL,
  description TEXT,
  FOREIGN KEY (source_id) REFERENCES emission_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chemical_components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  formula TEXT,
  molecular_weight REAL
);

CREATE TABLE IF NOT EXISTS equipment_factors (
  id TEXT PRIMARY KEY,
  equipment_type TEXT NOT NULL,
  energy_type TEXT NOT NULL,
  carbon_factor REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_date TEXT,
  last_calculation_date TEXT,
  selected_emission_source_ids TEXT,
  updated_at TEXT,
  stream_count INTEGER DEFAULT 0,
  equipment_count INTEGER DEFAULT 0,
  total_carbon_kg REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_payloads (
  project_id TEXT PRIMARY KEY,
  streams_json TEXT NOT NULL,
  equipment_json TEXT NOT NULL,
  calculations_json TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`;

module.exports = { SCHEMA_SQL };
