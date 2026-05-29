'use strict';

const { validateSession } = require('../services/authService');

function isApiRequest(req) {
  return (
    req.originalUrl.startsWith('/api/') ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json'))
  );
}

async function requireAuth(req, res, next) {
  try {
    const user = await validateSession(req);
    if (!user) {
      if (isApiRequest(req)) {
        return res.status(401).json({ success: false, message: 'Non authentifié. Veuillez vous connecter.' });
      }
      return res.redirect('/login.html');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const user = await validateSession(req);
    req.user = user || null;
    next();
  } catch {
    req.user = null;
    next();
  }
}

module.exports = { requireAuth, optionalAuth };
