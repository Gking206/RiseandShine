'use strict';

const { v4: uuidv4 } = require('uuid');

function generateId() {
  return uuidv4();
}

function generateShortId(prefix = '') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = prefix;
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateMemberId() {
  return generateShortId('RAS-');
}

function generateTransactionId() {
  return generateShortId('TXN-');
}

function generateEventId() {
  return generateShortId('EVT-');
}

module.exports = {
  generateId,
  generateShortId,
  generateMemberId,
  generateTransactionId,
  generateEventId,
};
