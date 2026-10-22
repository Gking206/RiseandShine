'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/roleMiddleware');

// Lecture publique : la page d'accueil affiche les liens sans connexion
router.get('/social', ctrl.getSocialLinks);
router.put('/social', requireAuth, requireSuperAdmin, ctrl.updateSocialLinks);

module.exports = router;
