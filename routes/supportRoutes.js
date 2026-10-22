'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ctrl = require('../controllers/supportController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');

// Évite l'envoi massif d'e-mails vers la boîte d'assistance
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Trop de demandes d'assistance. Réessayez dans une heure." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', requireAuth, supportLimiter, validateBody(schemas.support), ctrl.createSupportRequest);

module.exports = router;
