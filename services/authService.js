'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config/appConfig');
const db = require('./db');

const loginAttempts = new Map();

async function hashPassword(password) {
  return bcrypt.hash(password, config.security.saltRounds);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function checkLoginAttempts(email) {
  const key = email.toLowerCase();
  const record = loginAttempts.get(key);
  if (!record) return { locked: false, attempts: 0 };

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remaining = Math.ceil((record.lockedUntil - Date.now()) / 1000 / 60);
    return { locked: true, remaining, attempts: record.count };
  }

  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(key);
    return { locked: false, attempts: 0 };
  }

  return { locked: false, attempts: record.count };
}

function recordLoginAttempt(email, success) {
  const key = email.toLowerCase();
  if (success) {
    loginAttempts.delete(key);
    return;
  }

  const record = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  record.count += 1;

  if (record.count >= config.security.maxLoginAttempts) {
    record.lockedUntil = Date.now() + config.security.lockDuration;
  }

  loginAttempts.set(key, record);
}

async function findUserByEmail(email) {
  return db.findOne(config.collections.USERS, { email: email.toLowerCase() });
}

function createSession(req, user) {
  return new Promise((resolve, reject) => {
    // Nouvel identifiant de session à chaque connexion (anti fixation de session)
    req.session.regenerate(regenErr => {
      if (regenErr) return reject(regenErr);
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.email = user.email;
      req.session.nom = user.nom;
      req.session.createdAt = new Date().toISOString();
      // Sauvegarder explicitement avant de répondre, pour que la page suivante
      // trouve la session (sinon retour à la page de connexion).
      req.session.save(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy(err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function validateSession(req) {
  if (!req.session || !req.session.userId) return null;
  const user = await db.findById(config.collections.USERS, req.session.userId);
  if (!user || user.actif === false) return null;
  return user;
}

async function initializeSuperAdmins() {
  for (const adminData of config.superAdmins) {
    const exists = await db.exists(config.collections.USERS, { email: adminData.email });
    if (!exists) {
      const hashedPassword = await hashPassword(adminData.password);
      await db.create(config.collections.USERS, {
        nom: adminData.nom,
        email: adminData.email,
        password: hashedPassword,
        role: adminData.role,
        actif: true,
        telephone: '',
        sexe: '',
        age: null,
        ville: '',
        avatar: null,
        permissions: [],
      });
      console.log(`✅ Super Admin créé: ${adminData.email}`);
    }
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  checkLoginAttempts,
  recordLoginAttempt,
  findUserByEmail,
  createSession,
  destroySession,
  validateSession,
  initializeSuperAdmins,
};
