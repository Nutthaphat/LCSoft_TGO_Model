const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { SCHEMA_SQL } = require('./schema');

async function createDatabase(userDataPath) {
  const dbPath = path.join(userDataPath, 'lcsoft-tgo.db');
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file),
  });

  let db;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.exec(SCHEMA_SQL);
  persistDb(db, dbPath);

  return {
    dbPath,
    persist() {
      persistDb(db, dbPath);
    },
    loadEmissionDatabase() {
      const sources = queryAll(
        db,
        `SELECT id, name, organization, country, year, version, reference
         FROM emission_sources ORDER BY name`,
      ).map((row) => ({
        id: row.id,
        name: row.name,
        organization: row.organization ?? '',
        country: row.country ?? '',
        year: Number(row.year) || 0,
        version: row.version ?? '',
        reference: row.reference ?? '',
      }));

      const factors = queryAll(
        db,
        `SELECT id, source_id AS sourceId, category, material, unit,
                carbon_factor AS carbonFactor, description
         FROM emission_factors ORDER BY material`,
      ).map((row) => ({
        id: row.id,
        sourceId: row.sourceId,
        category: row.category ?? '',
        material: row.material,
        unit: row.unit ?? '',
        carbonFactor: Number(row.carbonFactor) || 0,
        description: row.description ?? '',
      }));

      const updatedAt = getSetting(db, 'emission_updated_at');
      if (!sources.length) {
        return null;
      }

      return {
        sources,
        factors,
        updatedAt: updatedAt || new Date().toISOString(),
      };
    },
    saveEmissionDatabase(snapshot) {
      db.run('DELETE FROM emission_factors');
      db.run('DELETE FROM emission_sources');

      for (const source of snapshot.sources ?? []) {
        db.run(
          `INSERT INTO emission_sources (id, name, organization, country, year, version, reference)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            source.id,
            source.name,
            source.organization ?? '',
            source.country ?? '',
            source.year ?? 0,
            source.version ?? '',
            source.reference ?? '',
          ],
        );
      }

      for (const factor of snapshot.factors ?? []) {
        db.run(
          `INSERT INTO emission_factors
           (id, source_id, category, material, unit, carbon_factor, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            factor.id,
            factor.sourceId,
            factor.category ?? '',
            factor.material,
            factor.unit ?? '',
            factor.carbonFactor ?? 0,
            factor.description ?? '',
          ],
        );
      }

      setSetting(db, 'emission_updated_at', snapshot.updatedAt || new Date().toISOString());
      persistDb(db, dbPath);
    },
    listProjects() {
      return queryAll(
        db,
        `SELECT id, name, description, created_date AS createdDate,
                last_calculation_date AS lastCalculationDate, updated_at AS updatedAt,
                stream_count AS streamCount, equipment_count AS equipmentCount,
                total_carbon_kg AS totalCarbonKg
         FROM projects
         ORDER BY updated_at DESC`,
      ).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        createdDate: row.createdDate ?? '',
        lastCalculationDate: row.lastCalculationDate,
        updatedAt: row.updatedAt ?? '',
        streamCount: Number(row.streamCount) || 0,
        equipmentCount: Number(row.equipmentCount) || 0,
        totalCarbonKg: Number(row.totalCarbonKg) || 0,
      }));
    },
    getProjectWorkspace(id) {
      const project = queryOne(
        db,
        `SELECT id, name, description, created_date AS createdDate,
                last_calculation_date AS lastCalculationDate,
                selected_emission_source_ids AS selectedEmissionSourceIds,
                updated_at AS updatedAt
         FROM projects WHERE id = ?`,
        [id],
      );
      if (!project) {
        return null;
      }

      const payload = queryOne(
        db,
        `SELECT streams_json AS streamsJson, equipment_json AS equipmentJson,
                calculations_json AS calculationsJson
         FROM project_payloads WHERE project_id = ?`,
        [id],
      );

      return {
        project: {
          id: project.id,
          name: project.name,
          description: project.description ?? '',
          createdDate: project.createdDate ?? '',
          lastCalculationDate: project.lastCalculationDate,
          selectedEmissionSourceIds: safeJson(project.selectedEmissionSourceIds, []),
        },
        streams: safeJson(payload?.streamsJson, []),
        equipment: safeJson(payload?.equipmentJson, []),
        calculations: safeJson(payload?.calculationsJson, []),
        updatedAt: project.updatedAt ?? new Date().toISOString(),
      };
    },
    saveProjectWorkspace(workspace) {
      const project = workspace.project;
      const streamCarbon = (workspace.streams ?? []).reduce(
        (sum, item) => sum + (item.carbonFootprintKg || 0),
        0,
      );
      const equipmentCarbon = (workspace.equipment ?? []).reduce(
        (sum, item) => sum + (item.carbonFootprintKg || 0),
        0,
      );
      const updatedAt = workspace.updatedAt || new Date().toISOString();

      db.run(
        `INSERT INTO projects
         (id, name, description, created_date, last_calculation_date,
          selected_emission_source_ids, updated_at, stream_count, equipment_count, total_carbon_kg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name,
           description=excluded.description,
           created_date=excluded.created_date,
           last_calculation_date=excluded.last_calculation_date,
           selected_emission_source_ids=excluded.selected_emission_source_ids,
           updated_at=excluded.updated_at,
           stream_count=excluded.stream_count,
           equipment_count=excluded.equipment_count,
           total_carbon_kg=excluded.total_carbon_kg`,
        [
          project.id,
          project.name,
          project.description ?? '',
          project.createdDate ?? '',
          project.lastCalculationDate,
          JSON.stringify(project.selectedEmissionSourceIds ?? []),
          updatedAt,
          (workspace.streams ?? []).length,
          (workspace.equipment ?? []).length,
          Math.round((streamCarbon + equipmentCarbon) * 1000) / 1000,
        ],
      );

      db.run(
        `INSERT INTO project_payloads (project_id, streams_json, equipment_json, calculations_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           streams_json=excluded.streams_json,
           equipment_json=excluded.equipment_json,
           calculations_json=excluded.calculations_json`,
        [
          project.id,
          JSON.stringify(workspace.streams ?? []),
          JSON.stringify(workspace.equipment ?? []),
          JSON.stringify(workspace.calculations ?? []),
        ],
      );

      persistDb(db, dbPath);
    },
    deleteProject(id) {
      db.run('DELETE FROM project_payloads WHERE project_id = ?', [id]);
      db.run('DELETE FROM projects WHERE id = ?', [id]);
      const activeId = getSetting(db, 'active_project_id');
      if (activeId === id) {
        setSetting(db, 'active_project_id', '');
      }
      persistDb(db, dbPath);
    },
    getActiveProjectId() {
      const value = getSetting(db, 'active_project_id');
      return value || null;
    },
    setActiveProjectId(id) {
      setSetting(db, 'active_project_id', id || '');
      persistDb(db, dbPath);
    },
    backup() {
      persistDb(db, dbPath);
      const backupPath = path.join(
        path.dirname(dbPath),
        `lcsoft-tgo-backup-${Date.now()}.db`,
      );
      fs.copyFileSync(dbPath, backupPath);
      return { ok: true, backupPath };
    },
  };
}

function persistDb(db, dbPath) {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) {
    stmt.bind(params);
  }
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] ?? null;
}

function getSetting(db, key) {
  const row = queryOne(db, 'SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

function setSetting(db, key, value) {
  db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value],
  );
}

function safeJson(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

module.exports = { createDatabase };
