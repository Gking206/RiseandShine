'use strict';

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/appConfig');
const logger = require('./utils/logger');
const db = require('./services/db');
const { initializeSuperAdmins } = require('./services/authService');
const { requestLogger, errorHandler } = require('./middleware/loggerMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const memberRoutes = require('./routes/memberRoutes');
const evangelismRoutes = require('./routes/evangelismRoutes');
const financeRoutes = require('./routes/financeRoutes');
const testimonyRoutes = require('./routes/testimonyRoutes');
const eventRoutes = require('./routes/eventRoutes');
const teachingRoutes = require('./routes/teachingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const supportRoutes = require('./routes/supportRoutes');

const IS_VERCEL = !!process.env.VERCEL;

// ── Création synchrone des dossiers requis ──────────────────────────────────
const fssync = require('fs');
const _requiredDirs = [config.paths.data];
if (!config.db.enabled) {
  _requiredDirs.push(path.join(config.paths.data, 'sessions'), path.join(config.paths.data, 'backups'));
}
if (!IS_VERCEL) {
  _requiredDirs.push(config.paths.logs, config.paths.uploads);
}
for (const dir of _requiredDirs) {
  try { fssync.mkdirSync(dir, { recursive: true }); } catch {}
}

if (config.app.env === 'production' && !process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET non défini : définissez-le dans les variables d\'environnement.');
}

// ── Initialisation des données ──────────────────────────────────────────────
// Lancée immédiatement. Toutes les requêtes attendent via le middleware plus bas.
const _initPromise = (async () => {
  await db.init();
  await initializeSuperAdmins();
  console.log(`✅ Initialisation terminée (base : ${db.driver === 'mysql' ? 'MySQL' : 'fichiers JSON'}).`);
})();

// ── Application Express ─────────────────────────────────────────────────────
const app = express();

// L'application tourne derrière le proxy HTTPS de l'hébergeur (Hostinger) :
// nécessaire pour que le cookie de session sécurisé soit bien émis.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));

// Middleware d'attente d'initialisation — DOIT être en premier
app.use(async (req, res, next) => {
  try {
    await _initPromise;
    next();
  } catch (err) {
    next(err);
  }
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({ origin: true, credentials: true }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sessions — MySQL en production, fichiers en local, mémoire sur Vercel
let sessionStore;
if (config.db.enabled) {
  const MySQLSessionStore = require('./services/mysqlSessionStore');
  sessionStore = new MySQLSessionStore(db, { ttlMs: config.session.cookie.maxAge });
} else if (!IS_VERCEL) {
  const FileStore = require('session-file-store')(session);
  sessionStore = new FileStore({
    path: path.join(config.paths.data, 'sessions'),
    ttl: 3600,
    retries: 1,
    reapInterval: 3600,
    logFn: () => {},
  });
}

app.use(session({
  ...config.session,
  ...(sessionStore ? { store: sessionStore } : {}),
  rolling: true,
}));

// Request logging
app.use(requestLogger);

// Fichiers statiques
app.use(express.static(config.paths.public, { etag: true, maxAge: '1h' }));

// ── Routes API ──────────────────────────────────────────────────────────────
// La limite globale ne s'applique qu'à l'API : les fichiers CSS/JS/images
// ne doivent pas consommer le quota (sinon /api/auth/me finissait en 429 et
// l'utilisateur était renvoyé vers la connexion).
app.use('/api', rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  message: { success: false, message: 'Trop de requêtes. Veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/evangelism', evangelismRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/testimonies', testimonyRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/teachings', teachingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/support', supportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    app: config.app.name,
    version: config.app.version,
    environment: IS_VERCEL ? 'vercel' : config.app.env,
    database: db.driver,
    timestamp: new Date().toISOString(),
  });
});

// Route API inconnue
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable.' });
});

// SPA fallback
app.get('*', (req, res, next) => {
  const filePath = path.join(config.paths.public, req.path);
  if (!filePath.startsWith(config.paths.public)) return next();
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(config.paths.public, 'index.html'), (err2) => {
        if (err2) next(err2);
      });
    }
  });
});

// Error handler
app.use(errorHandler);

// ── Démarrage (hors Vercel) ─────────────────────────────────────────────────
if (!IS_VERCEL) {
  _initPromise.then(() => {
    const PORT = config.app.port;
    app.listen(PORT, () => {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║     RISE AND SHINE PLATFORM v1.0       ║');
      console.log('╠════════════════════════════════════════╣');
      console.log(`║  Serveur: http://localhost:${PORT}         ║`);
      console.log(`║  Env:     ${config.app.env.padEnd(30)}║`);
      console.log('╚════════════════════════════════════════╝\n');
      logger.info(`Serveur démarré sur le port ${PORT}`);
    });
  }).catch(err => {
    console.error('❌ Erreur au démarrage (vérifiez les paramètres DB_* de la base MySQL):', err.message);
    process.exit(1);
  });
}

module.exports = app;
