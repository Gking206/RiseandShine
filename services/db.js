'use strict';

// Point d'entrée unique vers la base de données.
// MySQL dès que DB_HOST est défini (production Hostinger), sinon fichiers JSON.

const config = require('../config/appConfig');

module.exports = config.db.enabled
  ? require('./mysqlDatabaseService')
  : require('./fileDatabaseService');
