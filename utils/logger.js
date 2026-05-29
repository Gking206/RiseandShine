'use strict';

const fs = require('fs/promises');
const path = require('path');

const logsDir = require('../config/appConfig').paths.logs;

const LEVELS = { ERROR: 'ERROR', WARN: 'WARN', INFO: 'INFO', DEBUG: 'DEBUG' };

async function ensureLogsDir() {
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch {}
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

async function writeLog(level, message, meta) {
  await ensureLogsDir();
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `ras-${date}.log`);
  const line = formatMessage(level, message, meta);
  try {
    await fs.appendFile(logFile, line, 'utf8');
  } catch {}
  if (level === LEVELS.ERROR) {
    console.error(line.trim());
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(line.trim());
  }
}

const logger = {
  info: (msg, meta) => writeLog(LEVELS.INFO, msg, meta),
  warn: (msg, meta) => writeLog(LEVELS.WARN, msg, meta),
  error: (msg, meta) => writeLog(LEVELS.ERROR, msg, meta),
  debug: (msg, meta) => writeLog(LEVELS.DEBUG, msg, meta),
};

module.exports = logger;
