'use strict';

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs/promises');

const config = require('./config/appConfig');
const logger = require('./utils/logger');
const { ensureDataDir } = require('./utils/fileManager');
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

const IS_VERCEL = !!process.env.VERCEL;

// ── Création synchrone des dossiers requis ──────────────────────────────────
// DOIT se faire AVANT l'instanciation de session-file-store.
// fs.mkdirSync avec recursive:true crée tous les parents manquants sans erreur.
const fssync = require('fs');
const _requiredDirs = [
  path.join(config.paths.data, 'sessions'),
  path.join(config.paths.data, 'backups'),
];
if (!IS_VERCEL) {
  _requiredDirs.push(config.paths.logs);
  _requiredDirs.push(config.paths.uploads);
}
for (const dir of _requiredDirs) {
  try { fssync.mkdirSync(dir, { recursive: true }); } catch {}
}

// ── Initialisation des données ──────────────────────────────────────────────
// Lancée immédiatement. Toutes les requêtes attendent via le middleware plus bas.
const _initPromise = (async () => {
  try {
    await ensureDataDir();
    await initializeSuperAdmins();
    console.log('✅ Initialisation terminée (super admins prêts).');
  } catch (err) {
    console.error('Erreur initialisation:', err);
  }
})();

// ── Application Express ─────────────────────────────────────────────────────
const app = express();

// Faire confiance au proxy de Render/Vercel pour les cookies HTTPS
// (sans cela, secure:true bloque les cookies derrière un reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware d'attente d'initialisation — DOIT être en premier
// Bloque chaque requête jusqu'à ce que les données soient prêtes.
app.use(async (req, res, next) => {
  try { await _initPromise; } catch {}
  next();
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({ origin: true, credentials: true }));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  message: { success: false, message: 'Trop de requêtes. Veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: config.security.authRateLimit.windowMs,
  max: config.security.authRateLimit.max,
  message: { success: false, message: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session — FileStore en local, MemoryStore sur Vercel
let sessionStore;
if (!IS_VERCEL) {
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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/evangelism', evangelismRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/testimonies', testimonyRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/teachings', teachingRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    app: config.app.name,
    version: config.app.version,
    environment: IS_VERCEL ? 'vercel' : config.app.env,
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const filePath = path.join(config.paths.public, req.path);
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

// ── Démarrage local (hors Vercel) ───────────────────────────────────────────
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
    console.error('Erreur au démarrage:', err);
    process.exit(1);
  });
}

// Export pour Vercel (module.exports = app suffit,
// Vercel appelle directement app(req, res))
module.exports = app;
