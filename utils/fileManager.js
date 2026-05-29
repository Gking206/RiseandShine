'use strict';

const fs = require('fs/promises');
const path = require('path');
const { safeParseJSON } = require('./jsonValidator');

const dataDir = path.join(__dirname, '..', 'data');

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'backups'), { recursive: true });
}

function getFilePath(collection) {
  return path.join(dataDir, `${collection}.json`);
}

async function readFile(collection) {
  await ensureDataDir();
  const filePath = getFilePath(collection);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return safeParseJSON(content, []);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeFile(collection, []);
      return [];
    }
    throw err;
  }
}

async function writeFile(collection, data) {
  await ensureDataDir();
  const filePath = getFilePath(collection);
  const tmpPath = filePath + '.tmp';
  const backupPath = path.join(dataDir, 'backups', `${collection}_${Date.now()}.bak`);

  // Backup existing file
  try {
    await fs.copyFile(filePath, backupPath);
  } catch {}

  // Write to temp file first
  const jsonStr = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, jsonStr, 'utf8');

  // Rename temp to real (atomic on most OS)
  await fs.rename(tmpPath, filePath);

  // Clean old backups (keep last 5)
  await cleanOldBackups(collection);
}

async function cleanOldBackups(collection) {
  try {
    const backupDir = path.join(dataDir, 'backups');
    const files = await fs.readdir(backupDir);
    const collectionBackups = files
      .filter(f => f.startsWith(`${collection}_`) && f.endsWith('.bak'))
      .sort();
    if (collectionBackups.length > 5) {
      const toDelete = collectionBackups.slice(0, collectionBackups.length - 5);
      await Promise.all(toDelete.map(f => fs.unlink(path.join(backupDir, f)).catch(() => {})));
    }
  } catch {}
}

async function fileExists(collection) {
  try {
    await fs.access(getFilePath(collection));
    return true;
  } catch {
    return false;
  }
}

module.exports = { readFile, writeFile, fileExists, ensureDataDir, getFilePath };
