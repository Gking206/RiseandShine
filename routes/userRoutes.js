'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireSuperAdmin, requireAdmin } = require('../middleware/roleMiddleware');

router.use(requireAuth);

router.get('/', requireSuperAdmin, ctrl.listUsers);
router.post('/', requireSuperAdmin, ctrl.createUser);
router.get('/analytics', requireAdmin, ctrl.getAnalytics);
router.get('/:id', requireAdmin, ctrl.getUserById);
router.put('/:id', requireSuperAdmin, ctrl.updateUser);
router.delete('/:id', requireSuperAdmin, ctrl.deleteUser);
router.put('/:id/role', requireSuperAdmin, ctrl.changeUserRole);
router.put('/:id/status', requireSuperAdmin, ctrl.toggleUserStatus);
router.put('/:id/reset-password', requireSuperAdmin, ctrl.resetUserPassword);

module.exports = router;
