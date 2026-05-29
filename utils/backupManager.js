'use strict';

const fs = require('fs/promises');
const path = require('path');
const { readFile } = require('./fileManager');
const config = require('../config/appConfig');

const collectionsToBackup = Object.values(config.collections);

async function createFullBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(config.paths.data, 'backups', `full_${timestamp}`);
  await fs.mkdir(backupDir, { recursive: true });

  const results = [];
  for (const collection of collectionsToBackup) {
    try {
      const data = await readFile(collection);
      const backupFile = path.join(backupDir, `${collection}.json`);
      await fs.writeFile(backupFile, JSON.stringify(data, null, 2), 'utf8');
      results.push({ collection, status: 'success', count: Array.isArray(data) ? data.length : 1 });
    } catch (err) {
      results.push({ collection, status: 'error', error: err.message });
    }
  }

  const manifest = {
    timestamp: new Date().toISOString(),
    collections: results,
    backupDir,
  };
  await fs.writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

async function listBackups() {
  try {
    const backupDir = path.join(config.paths.data, 'backups');
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const backups = entries
      .filter(e => e.isDirectory() && e.name.startsWith('full_'))
      .map(e => ({ name: e.name, path: path.join(backupDir, e.name) }));
    return backups;
  } catch {
    return [];
  }
}

module.exports = { createFullBackup, listBackups };
