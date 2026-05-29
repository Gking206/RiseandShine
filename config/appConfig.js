'use strict';

const path = require('path');

const config = {
  app: {
    name: 'Rise And Shine Platform',
    version: '1.0.0',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  paths: {
    data: path.join(__dirname, '..', 'data'),
    public: path.join(__dirname, '..', 'public'),
    uploads: path.join(__dirname, '..', 'public', 'uploads'),
    logs: path.join(__dirname, '..', 'logs'),
    backups: path.join(__dirname, '..', 'data', 'backups'),
  },

  session: {
    secret: process.env.SESSION_SECRET || 'RAS_SECRET_2024_RISE_AND_SHINE_MINISTRY_KEY_ULTRA_SECURE',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
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
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
    authRateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 10,
    },
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
  },

  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedImages: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocs: ['application/pdf'],
    allowedAudio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    allowedVideo: ['video/mp4', 'video/webm'],
  },

  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};

module.exports = config;
