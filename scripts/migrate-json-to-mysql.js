'use strict';

// Copie les données des fichiers data/*.json vers la base MySQL.
// Usage : npm run db:migrate   (les variables DB_* doivent être définies dans .env)
// Le script peut être relancé sans risque : les enregistrements déjà présents
// (même id) sont ignorés.

const fs = require('fs');
const path = require('path');
const config = require('../config/appConfig');

if (!config.db.enabled) {
  console.error('❌ DB_HOST non défini. Renseignez les variables DB_* dans le fichier .env.');
  process.exit(1);
}

const db = require('../services/mysqlDatabaseService');

// Les utilisateurs d'abord : les profils membres les référencent.
const ORDER = [
  'users', 'members', 'testimonies', 'evangelism', 'finances', 'events',
  'teachings', 'reports', 'galleries', 'notifications', 'announcements',
  'logs', 'settings', 'support_requests', 'roles', 'permissions', 'assignments',
];

function readJson(collection) {
  const file = path.join(config.paths.data, `${collection}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn(`⚠️  ${collection}.json illisible : ${err.message}`);
    return [];
  }
}

async function main() {
  await db.init();
  const now = new Date().toISOString();
  const userIds = new Set();

  for (const collection of ORDER) {
    const records = readJson(collection);
    let inserted = 0;
    let skipped = 0;

    for (const original of records) {
      const record = { ...original };
      if (!record.id) { skipped++; continue; }
      record.createdAt = record.createdAt || now;
      record.updatedAt = record.updatedAt || record.createdAt;

      if (collection === 'members' && record.userId && !userIds.has(record.userId)) {
        record.userId = null; // utilisateur supprimé entre-temps
      }

      try {
        const ok = await db.insertRaw(collection, record, { ignoreDuplicates: true });
        ok ? inserted++ : skipped++;
      } catch (err) {
        skipped++;
        console.warn(`⚠️  ${collection} ${record.id} ignoré : ${err.message}`);
      }
    }

    if (collection === 'users') {
      const all = await db.findMany('users', {});
      all.forEach(u => userIds.add(u.id));
    }

    if (records.length) {
      console.log(`✅ ${collection.padEnd(16)} ${inserted} ajouté(s), ${skipped} ignoré(s)`);
    }
  }

  console.log('\nMigration terminée.');
  await db.pool.end();
}

main().catch(err => {
  console.error('❌ Migration échouée :', err.message);
  process.exit(1);
});
