'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');

router.post('/register', validateBody(schemas.register), ctrl.register);
router.post('/login', validateBody(schemas.login), ctrl.login);
router.post('/logout', requireAuth, ctrl.logout);
router.get('/me', requireAuth, ctrl.getMe);
router.put('/profile', requireAuth, ctrl.updateProfile);
router.put('/change-password', requireAuth, ctrl.changePassword);
router.get('/admins', ctrl.getAdminsForRegistration);

module.exports = router;
