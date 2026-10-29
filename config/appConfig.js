'use strict';

const path = require('path');

// Charger le fichier .env s'il existe (Node 22 : sans dépendance externe).
// Les variables déjà définies dans l'environnement (hPanel Hostinger) restent prioritaires.
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}

// Sur Vercel, le système de fichiers est en lecture seule sauf /tmp
const IS_VERCEL = !!process.env.VERCEL;
const DATA_ROOT = IS_VERCEL ? '/tmp/ras-data' : path.join(__dirname, '..', 'data');
const LOGS_ROOT = IS_VERCEL ? '/tmp/ras-logs' : path.join(__dirname, '..', 'logs');

const config = {
  app: {
    name: 'Rise And Shine Platform',
    version: '1.0.0',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  paths: {
    data: DATA_ROOT,
    public: path.join(__dirname, '..', 'public'),
    // Fichiers importés. UPLOADS_DIR permet de les placer hors du dossier de
    // l'application, pour qu'un redéploiement ne les efface pas.
    uploads: process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.join(__dirname, '..', 'public', 'uploads'),
    logs: LOGS_ROOT,
    backups: path.join(DATA_ROOT, 'backups'),
  },

  session: {
    secret: process.env.SESSION_SECRET || 'RAS_SECRET_2024_RISE_AND_SHINE_MINISTRY_KEY_ULTRA_SECURE',
    resave: false,
    saveUninitialized: false,
    cookie: {
      // 'auto' : cookie sécurisé uniquement si la requête arrive en HTTPS
      // (via le proxy de l'hébergeur). Avec `true`, le navigateur ne recevait
      // pas le cookie quand le proxy n'était pas reconnu, ce qui renvoyait
      // l'utilisateur sur la page de connexion juste après s'être connecté.
      secure: 'auto',
      httpOnly: true,
      maxAge: 3600 * 1000, // 1 heure (3600 secondes)
      sameSite: 'lax',
    },
    name: 'ras.session',
  },

  security: {
    saltRounds: 12,
    maxLoginAttempts: 5,
    lockDuration: 15 * 60 * 1000, // 15 minutes
    // Limite globale appliquée aux seules routes /api (pas aux fichiers statiques).
    // Chaque page du tableau de bord déclenche plusieurs appels API.
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 1000,
    },
    // Limite appliquée uniquement aux tentatives de connexion / inscription échouées
    authRateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 20,
    },
  },

  db: {
    enabled: !!process.env.DB_HOST,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },

  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true') !== 'false',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    supportEmail: process.env.SUPPORT_EMAIL || 'riseandshinebf@gmail.com',
    appUrl: process.env.APP_URL || '',
  },

  roles: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MEMBRE: 'membre',
  },

  memberLimits: {
    min: 1,
    max: 40,
  },

  superAdmins: [
    {
      nom: 'Directeur Général',
      email: 'superadmin@riseandshine.org',
      password: 'RAS@SuperAdmin2024',
      role: 'super_admin',
    },
    {
      nom: 'Admin Principal',
      email: 'admin.general@riseandshine.org',
      password: 'RAS@Admin2024',
      role: 'super_admin',
    },
  ],

  collections: {
    USERS: 'users',
    MEMBERS: 'members',
    ROLES: 'roles',
    PERMISSIONS: 'permissions',
    TESTIMONIES: 'testimonies',
    EVANGELISM: 'evangelism',
    FINANCES: 'finances',
    EVENTS: 'events',
    TEACHINGS: 'teachings',
    REPORTS: 'reports',
    GALLERIES: 'galleries',
    NOTIFICATIONS: 'notifications',
    ANNOUNCEMENTS: 'announcements',
    LOGS: 'logs',
    ASSIGNMENTS: 'assignments',
    SETTINGS: 'settings',
    SUPPORT_REQUESTS: 'support_requests',
  },

  // Liens réseaux sociaux modifiables par le Super Admin
  socialNetworks: ['facebook', 'instagram', 'youtube', 'tiktok', 'whatsapp'],

  // Fichiers importés depuis le téléphone ou l'ordinateur.
  // Type MIME autorisé -> extension enregistrée sur le disque, et taille maximale.
  // (Pas de SVG ni de HTML : ils pourraient contenir du code exécuté par le navigateur.)
  upload: {
    types: {
      'image/jpeg':      { ext: '.jpg',  kind: 'image', maxSize: 10 * 1024 * 1024 },
      'image/png':       { ext: '.png',  kind: 'image', maxSize: 10 * 1024 * 1024 },
      'image/gif':       { ext: '.gif',  kind: 'image', maxSize: 10 * 1024 * 1024 },
      'image/webp':      { ext: '.webp', kind: 'image', maxSize: 10 * 1024 * 1024 },
      'application/pdf': { ext: '.pdf',  kind: 'document', maxSize: 20 * 1024 * 1024 },
      'audio/mpeg':      { ext: '.mp3',  kind: 'audio', maxSize: 50 * 1024 * 1024 },
      'audio/mp4':       { ext: '.m4a',  kind: 'audio', maxSize: 50 * 1024 * 1024 },
      'audio/x-m4a':     { ext: '.m4a',  kind: 'audio', maxSize: 50 * 1024 * 1024 },
      'audio/wav':       { ext: '.wav',  kind: 'audio', maxSize: 50 * 1024 * 1024 },
      'audio/ogg':       { ext: '.ogg',  kind: 'audio', maxSize: 50 * 1024 * 1024 },
      'video/mp4':       { ext: '.mp4',  kind: 'video', maxSize: 100 * 1024 * 1024 },
      'video/webm':      { ext: '.webm', kind: 'video', maxSize: 100 * 1024 * 1024 },
      'video/quicktime': { ext: '.mov',  kind: 'video', maxSize: 100 * 1024 * 1024 },
    },
    maxSize: 100 * 1024 * 1024, // plafond absolu (le plus grand des maxSize ci-dessus)
  },

  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};

module.exports = config;
