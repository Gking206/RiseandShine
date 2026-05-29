'use strict';

function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function safeParseJSON(str, fallback = []) {
  try {
    const parsed = JSON.parse(str);
    return parsed;
  } catch {
    return fallback;
  }
}

function validateRecord(record, requiredFields = []) {
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Le record doit être un objet'] };
  }
  const errors = [];
  for (const field of requiredFields) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      errors.push(`Le champ "${field}" est requis`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      sanitized[key] = sanitizeString(val);
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      sanitized[key] = sanitizeObject(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

module.exports = { isValidJSON, safeParseJSON, validateRecord, sanitizeString, sanitizeObject };
