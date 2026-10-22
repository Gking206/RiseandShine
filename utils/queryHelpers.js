'use strict';

// Logique de requête en mémoire partagée par les deux moteurs de stockage
// (fichiers JSON, et MySQL quand une requête porte sur un champ hors schéma).

function matchesQuery(record, query) {
  return Object.entries(query).every(([k, v]) => {
    if (v === null || v === undefined) return record[k] === null || record[k] === undefined;
    return record[k] === v;
  });
}

function applyQueryOptions(records, options = {}) {
  let results = [...records];

  if (options.filter) {
    results = results.filter(record =>
      Object.entries(options.filter).every(([key, val]) => {
        if (val === null || val === undefined) return true;
        return record[key] === val;
      })
    );
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

module.exports = { matchesQuery, applyQueryOptions };
