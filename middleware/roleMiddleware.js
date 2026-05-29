'use strict';

const { hasRole } = require('../services/permissionService');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    const allowed = roles.some(role => hasRole(req.user.role, role));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Accès refusé. Permissions insuffisantes.' });
    }
    next();
  };
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux Super Administrateurs.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ success: false, message: 'Accès réservé aux Administrateurs.' });
  }
  next();
}

module.exports = { requireRole, requireSuperAdmin, requireAdmin };
