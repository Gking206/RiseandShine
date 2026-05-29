'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/evangelismController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');

router.use(requireAuth);

router.get('/', ctrl.listEvangelism);
router.get('/stats', ctrl.getStats);
router.post('/', validateBody(schemas.evangelism), ctrl.createEvangelism);
router.put('/:id', ctrl.updateEvangelism);
router.delete('/:id', requireAdmin, ctrl.deleteEvangelism);

module.exports = router;
