'use strict';

// Moteur de stockage de secours : fichiers JSON dans data/.
// Utilisé uniquement quand aucune base MySQL n'est configurée (DB_HOST absent),
// par exemple pour un test rapide en local.

const { readFile, writeFile, ensureDataDir } = require('../utils/fileManager');
const { generateId } = require('../utils/idGenerator');
const { sanitizeObject } = require('../utils/jsonValidator');
const { matchesQuery, applyQueryOptions } = require('../utils/queryHelpers');

class FileDatabaseService {
  constructor() {
    this.driver = 'json';
  }

  async init() {
    await ensureDataDir();
  }

  async findAll(collection, options = {}) {
    const data = await readFile(collection);
    return applyQueryOptions(Array.isArray(data) ? data : [], options);
  }

  async findById(collection, id) {
    const data = await readFile(collection);
    return data.find(r => r.id === id) || null;
  }

  async findOne(collection, query) {
    const data = await readFile(collection);
    return data.find(record => matchesQuery(record, query)) || null;
  }

  async findMany(collection, query) {
    const data = await readFile(collection);
    return data.filter(record => matchesQuery(record, query));
  }

  async create(collection, recordData) {
    const data = await readFile(collection);
    const now = new Date().toISOString();
    const record = {
      id: generateId(),
      ...sanitizeObject(recordData),
      createdAt: now,
      updatedAt: now,
    };
    data.push(record);
    await writeFile(collection, data);
    return record;
  }

  async update(collection, id, updateData) {
    const data = await readFile(collection);
    const index = data.findIndex(r => r.id === id);
    if (index === -1) return null;
    const { id: _id, createdAt, ...safeUpdate } = sanitizeObject(updateData);
    data[index] = {
      ...data[index],
      ...safeUpdate,
      id,
      createdAt: data[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(collection, data);
    return data[index];
  }

  async delete(collection, id) {
    const data = await readFile(collection);
    const index = data.findIndex(r => r.id === id);
    if (index === -1) return false;
    data.splice(index, 1);
    await writeFile(collection, data);
    return true;
  }

  async count(collection, query = {}) {
    const data = await readFile(collection);
    return data.filter(record => matchesQuery(record, query)).length;
  }

  async sum(collection, field, query = {}) {
    const data = await readFile(collection);
    return data
      .filter(r => matchesQuery(r, query))
      .reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
  }

  async exists(collection, query) {
    const record = await this.findOne(collection, query);
    return record !== null;
  }
}

module.exports = new FileDatabaseService();
