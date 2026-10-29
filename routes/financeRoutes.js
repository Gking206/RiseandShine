'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financeController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireSuperAdmin, requireAdmin } = require('../middleware/roleMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');
const { validateFileUrls } = require('../middleware/fileUrlMiddleware');

router.use(requireAuth);
router.use(requireAdmin); // Finances accessible aux admins et super admins uniquement

router.get('/', ctrl.listFinances);
router.get('/stats', requireSuperAdmin, ctrl.getStats);
router.post('/', validateBody(schemas.finance), validateFileUrls('recu'), ctrl.createTransaction);
router.put('/:id/approve', requireSuperAdmin, ctrl.approveTransaction);
router.delete('/:id', requireSuperAdmin, ctrl.deleteTransaction);

module.exports = router;
