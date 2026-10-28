'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ctrl = require('../controllers/authController');
const config = require('../config/appConfig');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/roleMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');

// Protège contre les attaques par force brute. Ne compte que les échecs, et ne
// s'applique pas à /me : cette route est appelée à chaque page, et la limiter
// renvoyait l'utilisateur sur la page de connexion après quelques clics.
const authLimiter = rateLimit({
  windowMs: config.security.authRateLimit.windowMs,
  max: config.security.authRateLimit.max,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, validateBody(schemas.register), ctrl.register);
router.post('/login', authLimiter, validateBody(schemas.login), ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.getMe);
router.put('/profile', requireAuth, ctrl.updateProfile);
router.put('/change-password', requireAuth, ctrl.changePassword);
// Liste des admins (noms, identifiants, effectifs) : réservée au Super Admin,
// qui s'en sert pour assigner un membre lors de la création d'un compte.
router.get('/admins', requireAuth, requireSuperAdmin, ctrl.getAdminsForRegistration);

module.exports = router;
