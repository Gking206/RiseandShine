'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/memberController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin, requireSuperAdmin } = require('../middleware/roleMiddleware');

router.use(requireAuth);

router.get('/', requireAdmin, ctrl.listMembers);
router.get('/stats', requireAdmin, ctrl.getMemberStats);
router.get('/:id', requireAdmin, ctrl.getMemberById);
router.put('/:id', requireAdmin, ctrl.updateMember);
router.delete('/:id', requireSuperAdmin, ctrl.deleteMember);
router.put('/:id/reassign', requireSuperAdmin, ctrl.reassignMember);
router.get('/:id/reports', requireAdmin, ctrl.getConfidentialReports);
router.post('/:id/reports', requireAdmin, ctrl.createConfidentialReport);

module.exports = router;
