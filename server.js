'use strict';

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
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

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for frontend
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

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

// Session avec persistance sur disque (survit aux redémarrages)
const sessionStorePath = path.join(__dirname, 'data', 'sessions');
app.use(session({
  ...config.session,
  store: new FileStore({
    path: sessionStorePath,
    ttl: 3600,           // 1 heure (3600 secondes)
    retries: 1,
    reapInterval: 3600, // Nettoyage toutes les heures
    logFn: () => {},    // Silencieux
  }),
  rolling: true,
}));

// Request logging
app.use(requestLogger);

// Static files
app.use(express.static(config.paths.public, {
  etag: true,
  maxAge: '1h',
}));

// API Routes
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
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback - serve index for non-API routes
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

// Initialize and start
async function initialize() {
  try {
    // Ensure directories exist
    await ensureDataDir();
    await fs.mkdir(config.paths.logs, { recursive: true });
    await fs.mkdir(config.paths.uploads, { recursive: true });

    // Seed super admins
    await initializeSuperAdmins();

    // Start server
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
  } catch (err) {
    console.error('Erreur au démarrage:', err);
    process.exit(1);
  }
}

initialize();

module.exports = app;
