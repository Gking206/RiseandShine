'use strict';

const { hasPermission } = require('../services/permissionService');

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission requise: ${permission}`,
      });
    }
    next();
  };
}

module.exports = { requirePermission };
