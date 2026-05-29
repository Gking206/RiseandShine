'use strict';

const logger = require('../utils/logger');
const db = require('../services/fileDatabaseService');
const config = require('../config/appConfig');

function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = req.user?.id || 'anonymous';
    logger.info(`${method} ${originalUrl} ${res.statusCode} ${duration}ms`, { userId, ip });
  });

  next();
}

async function activityLogger(action, details = {}) {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          await db.create(config.collections.LOGS, {
            userId: req.user.id,
            userNom: req.user.nom,
            userRole: req.user.role,
            action,
            details,
            ip: req.ip,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
          });
        } catch {}
      }
    });
    next();
  };
}

function errorHandler(err, req, res, next) {
  logger.error(`Erreur non gérée: ${err.message}`, { stack: err.stack, url: req.originalUrl });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Une erreur interne s\'est produite.' : err.message,
  });
}

module.exports = { requestLogger, activityLogger, errorHandler };
