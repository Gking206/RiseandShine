'use strict';

const { readFile, writeFile } = require('../utils/fileManager');
const { generateId } = require('../utils/idGenerator');
const { sanitizeObject } = require('../utils/jsonValidator');

class FileDatabaseService {
  async findAll(collection, options = {}) {
    const data = await readFile(collection);
    let results = Array.isArray(data) ? [...data] : [];

    if (options.filter) {
      results = results.filter(record => {
        return Object.entries(options.filter).every(([key, val]) => {
          if (val === null || val === undefined) return true;
          return record[key] === val;
        });
      });
    }

    if (options.search && options.searchFields) {
      const q = options.search.toLowerCase();
      results = results.filter(record =>
        options.searchFields.some(field => {
          const v = record[field];
          return v && String(v).toLowerCase().includes(q);
        })
      );
    }

    if (options.sort) {
      const { field, order = 'asc' } = options.sort;
      results.sort((a, b) => {
        const va = a[field], vb = b[field];
        if (va < vb) return order === 'asc' ? -1 : 1;
        if (va > vb) return order === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    const total = results.length;

    if (options.page && options.limit) {
      const page = Math.max(1, parseInt(options.page));
      const limit = Math.min(100, parseInt(options.limit));
      const offset = (page - 1) * limit;
      results = results.slice(offset, offset + limit);
      return { data: results, total, page, limit, pages: Math.ceil(total / limit) };
    }

    if (options.limit) {
      results = results.slice(0, parseInt(options.limit));
    }

    return { data: results, total };
  }

  async findById(collection, id) {
    const data = await readFile(collection);
    return data.find(r => r.id === id) || null;
  }

  async findOne(collection, query) {
    const data = await readFile(collection);
    return data.find(record =>
      Object.entries(query).every(([k, v]) => record[k] === v)
    ) || null;
  }

  async findMany(collection, query) {
    const data = await readFile(collection);
    return data.filter(record =>
      Object.entries(query).every(([k, v]) => record[k] === v)
    );
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
    if (Object.keys(query).length === 0) return data.length;
    return data.filter(record =>
      Object.entries(query).every(([k, v]) => record[k] === v)
    ).length;
  }

  async aggregate(collection, groupByField) {
    const data = await readFile(collection);
    return data.reduce((acc, record) => {
      const key = record[groupByField] || 'inconnu';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  async sum(collection, field, query = {}) {
    const data = await readFile(collection);
    const filtered = Object.keys(query).length > 0
      ? data.filter(r => Object.entries(query).every(([k, v]) => r[k] === v))
      : data;
    return filtered.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
  }

  async exists(collection, query) {
    const record = await this.findOne(collection, query);
    return record !== null;
  }
}

module.exports = new FileDatabaseService();
