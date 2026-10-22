'use strict';

// Moteur de stockage MySQL / MariaDB.
// Expose la même interface que fileDatabaseService (findAll, findById, create…)
// pour que les contrôleurs n'aient pas à connaître le moteur utilisé.
//
// Chaque table a des colonnes typées (voir database/schema.sql) et une colonne
// `extra` (JSON) qui reçoit les champs non prévus par le schéma.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config/appConfig');
const { generateId } = require('../utils/idGenerator');
const { sanitizeObject } = require('../utils/jsonValidator');
const { matchesQuery, applyQueryOptions } = require('../utils/queryHelpers');

const SCHEMA_FILE = path.join(__dirname, '..', 'database', 'schema.sql');

function columnKind(dataType, columnType) {
  const t = dataType.toLowerCase();
  if (t === 'tinyint' && /tinyint\(1\)/i.test(columnType)) return 'bool';
  if (['int', 'integer', 'smallint', 'mediumint', 'bigint', 'tinyint'].includes(t)) return 'int';
  if (['decimal', 'float', 'double'].includes(t)) return 'float';
  if (['datetime', 'timestamp', 'date'].includes(t)) return 'date';
  // MariaDB stocke le type JSON comme LONGTEXT
  if (t === 'json' || t === 'longtext') return 'json';
  return 'string';
}

function toDb(kind, value) {
  if (value === undefined || value === null) return null;
  switch (kind) {
    case 'bool':
      if (typeof value === 'string') return ['true', '1', 'oui', 'on'].includes(value.toLowerCase()) ? 1 : 0;
      return value ? 1 : 0;
    case 'int': {
      const n = parseInt(value, 10);
      return Number.isNaN(n) ? null : n;
    }
    case 'float': {
      const n = parseFloat(value);
      return Number.isNaN(n) ? null : n;
    }
    case 'date': {
      if (value === '') return null;
      const d = value instanceof Date ? value : new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    case 'json':
      return JSON.stringify(value);
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

function fromDb(kind, value) {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'bool': return Boolean(value);
    case 'date': return value instanceof Date ? value.toISOString() : value;
    case 'json':
      if (typeof value !== 'string') return value;
      try { return JSON.parse(value); } catch { return value; }
    default: return value;
  }
}

class MySQLDatabaseService {
  constructor() {
    this.driver = 'mysql';
    this.pool = null;
    this.tables = {}; // { tableName: { colName: { kind, nullable } } }
    this._initPromise = null;
  }

  init() {
    if (!this._initPromise) {
      this._initPromise = this._init().catch(err => {
        this._initPromise = null; // permettre une nouvelle tentative
        throw err;
      });
    }
    return this._initPromise;
  }

  async _init() {
    const c = config.db;
    this.pool = mysql.createPool({
      host: c.host,
      port: c.port,
      user: c.user,
      password: c.password,
      database: c.name,
      waitForConnections: true,
      connectionLimit: c.connectionLimit,
      charset: 'utf8mb4',
      timezone: 'Z',
      decimalNumbers: true,
    });

    await this._applySchema();
    await this._loadColumns();
  }

  async _applySchema() {
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8')
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }

  async _loadColumns() {
    const [rows] = await this.pool.query(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()`
    );
    this.tables = {};
    for (const r of rows) {
      const table = r.TABLE_NAME;
      if (!this.tables[table]) this.tables[table] = {};
      this.tables[table][r.COLUMN_NAME] = {
        kind: columnKind(r.DATA_TYPE, r.COLUMN_TYPE),
        nullable: r.IS_NULLABLE === 'YES',
      };
    }
  }

  async _columns(collection) {
    await this.init();
    const cols = this.tables[collection];
    if (!cols) throw new Error(`Table MySQL inconnue: ${collection}`);
    return cols;
  }

  // ── Conversion enregistrement <-> ligne ──────────────────
  _rowToRecord(cols, row) {
    const record = {};
    for (const [name, value] of Object.entries(row)) {
      if (name === 'extra') continue;
      record[name] = fromDb(cols[name] ? cols[name].kind : 'string', value);
    }
    const extra = fromDb('json', row.extra);
    if (extra && typeof extra === 'object') {
      for (const [k, v] of Object.entries(extra)) {
        if (!(k in record)) record[k] = v;
      }
    }
    return record;
  }

  _recordToRow(cols, record, { forInsert }) {
    const row = {};
    const extra = {};
    for (const [key, value] of Object.entries(record)) {
      if (value === undefined || key === 'extra') continue;
      const col = cols[key];
      if (!col) {
        extra[key] = value;
        continue;
      }
      const dbValue = toDb(col.kind, value);
      // Laisser MySQL appliquer la valeur par défaut d'une colonne NOT NULL
      if (dbValue === null && (!col.nullable || forInsert)) continue;
      row[key] = dbValue;
    }
    if ('extra' in cols) row.extra = Object.keys(extra).length ? JSON.stringify(extra) : null;
    return row;
  }

  // ── Construction des clauses WHERE ───────────────────────
  // Retourne null si un champ n'existe pas comme colonne (filtrage en mémoire).
  _where(cols, query, { skipNull = false } = {}) {
    const parts = [];
    const params = [];
    for (const [key, value] of Object.entries(query || {})) {
      if (skipNull && (value === null || value === undefined)) continue;
      const col = cols[key];
      if (!col || key === 'extra') return null;
      if (value === null || value === undefined) {
        parts.push(`\`${key}\` IS NULL`);
      } else {
        parts.push(`\`${key}\` = ?`);
        params.push(toDb(col.kind, value));
      }
    }
    return { sql: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', parts, params };
  }

  async _all(collection) {
    const cols = await this._columns(collection);
    const [rows] = await this.pool.query(`SELECT * FROM \`${collection}\``);
    return rows.map(r => this._rowToRecord(cols, r));
  }

  // ── Interface publique ───────────────────────────────────
  async findAll(collection, options = {}) {
    const cols = await this._columns(collection);
    const where = this._where(cols, options.filter, { skipNull: true });
    const searchable = !options.search || (options.searchFields || []).every(f => cols[f]);
    const sortable = !options.sort || cols[options.sort.field];

    if (!where || !searchable || !sortable) {
      return applyQueryOptions(await this._all(collection), options);
    }

    const parts = [...where.parts];
    const params = [...where.params];
    if (options.search && options.searchFields && options.searchFields.length) {
      const like = `%${String(options.search).replace(/[\\%_]/g, m => '\\' + m)}%`;
      parts.push(`(${options.searchFields.map(f => `\`${f}\` LIKE ?`).join(' OR ')})`);
      options.searchFields.forEach(() => params.push(like));
    }
    const whereSql = parts.length ? ` WHERE ${parts.join(' AND ')}` : '';

    const orderSql = options.sort
      ? ` ORDER BY \`${options.sort.field}\` ${(options.sort.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`
      : ' ORDER BY `createdAt` DESC';

    const [[{ total }]] = await this.pool.query(
      `SELECT COUNT(*) AS total FROM \`${collection}\`${whereSql}`, params
    );

    let limitSql = '';
    let pageInfo = null;
    if (options.page && options.limit) {
      const page = Math.max(1, parseInt(options.page));
      const limit = Math.min(100, parseInt(options.limit));
      limitSql = ` LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
      pageInfo = { page, limit, pages: Math.ceil(total / limit) };
    } else if (options.limit) {
      limitSql = ` LIMIT ${Math.max(0, parseInt(options.limit))}`;
    }

    const [rows] = await this.pool.query(
      `SELECT * FROM \`${collection}\`${whereSql}${orderSql}${limitSql}`, params
    );
    const data = rows.map(r => this._rowToRecord(cols, r));
    return pageInfo ? { data, total, ...pageInfo } : { data, total };
  }

  async findById(collection, id) {
    const cols = await this._columns(collection);
    const [rows] = await this.pool.query(`SELECT * FROM \`${collection}\` WHERE \`id\` = ? LIMIT 1`, [id]);
    return rows.length ? this._rowToRecord(cols, rows[0]) : null;
  }

  async findOne(collection, query) {
    const cols = await this._columns(collection);
    const where = this._where(cols, query);
    if (!where) return (await this._all(collection)).find(r => matchesQuery(r, query)) || null;
    const [rows] = await this.pool.query(`SELECT * FROM \`${collection}\`${where.sql} LIMIT 1`, where.params);
    return rows.length ? this._rowToRecord(cols, rows[0]) : null;
  }

  async findMany(collection, query) {
    const cols = await this._columns(collection);
    const where = this._where(cols, query);
    if (!where) return (await this._all(collection)).filter(r => matchesQuery(r, query));
    const [rows] = await this.pool.query(`SELECT * FROM \`${collection}\`${where.sql}`, where.params);
    return rows.map(r => this._rowToRecord(cols, r));
  }

  async create(collection, recordData) {
    const now = new Date().toISOString();
    const record = {
      id: generateId(),
      ...sanitizeObject(recordData),
      createdAt: now,
      updatedAt: now,
    };
    await this.insertRaw(collection, record);
    return record;
  }

  // Insère un enregistrement tel quel (id et dates conservés). Utilisé par la migration.
  async insertRaw(collection, record, { ignoreDuplicates = false } = {}) {
    const cols = await this._columns(collection);
    const row = this._recordToRow(cols, record, { forInsert: true });
    const keys = Object.keys(row);
    const [result] = await this.pool.query(
      `INSERT ${ignoreDuplicates ? 'IGNORE ' : ''}INTO \`${collection}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      keys.map(k => row[k])
    );
    return result.affectedRows > 0;
  }

  async update(collection, id, updateData) {
    const existing = await this.findById(collection, id);
    if (!existing) return null;
    const cols = await this._columns(collection);
    const { id: _id, createdAt, ...safeUpdate } = sanitizeObject(updateData);
    const merged = {
      ...existing,
      ...safeUpdate,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const { id: _rowId, createdAt: _c, ...row } = this._recordToRow(cols, merged, { forInsert: false });
    const keys = Object.keys(row);
    await this.pool.query(
      `UPDATE \`${collection}\` SET ${keys.map(k => `\`${k}\` = ?`).join(', ')} WHERE \`id\` = ?`,
      [...keys.map(k => row[k]), id]
    );
    return merged;
  }

  async delete(collection, id) {
    await this._columns(collection);
    const [result] = await this.pool.query(`DELETE FROM \`${collection}\` WHERE \`id\` = ?`, [id]);
    return result.affectedRows > 0;
  }

  async count(collection, query = {}) {
    const cols = await this._columns(collection);
    const where = this._where(cols, query);
    if (!where) return (await this._all(collection)).filter(r => matchesQuery(r, query)).length;
    const [[{ total }]] = await this.pool.query(
      `SELECT COUNT(*) AS total FROM \`${collection}\`${where.sql}`, where.params
    );
    return Number(total);
  }

  async sum(collection, field, query = {}) {
    const cols = await this._columns(collection);
    const where = this._where(cols, query);
    if (!where || !cols[field]) {
      return (await this._all(collection))
        .filter(r => matchesQuery(r, query))
        .reduce((s, r) => s + (Number(r[field]) || 0), 0);
    }
    const [[{ total }]] = await this.pool.query(
      `SELECT COALESCE(SUM(\`${field}\`), 0) AS total FROM \`${collection}\`${where.sql}`, where.params
    );
    return Number(total);
  }

  async exists(collection, query) {
    return (await this.findOne(collection, query)) !== null;
  }
}

module.exports = new MySQLDatabaseService();
