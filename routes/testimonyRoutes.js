'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/testimonyController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');
const { validateFileUrls } = require('../middleware/fileUrlMiddleware');

router.use(requireAuth);

router.get('/', ctrl.listTestimonies);
router.get('/:id', ctrl.getTestimonyById);
router.post('/', validateBody(schemas.testimony), validateFileUrls('image'), ctrl.createTestimony);
router.put('/:id', validateFileUrls('image'), ctrl.updateTestimony);
router.put('/:id/moderate', requireAdmin, ctrl.moderateTestimony);
router.post('/:id/like', ctrl.likeTestimony);
router.post('/:id/comment', ctrl.addComment);
router.delete('/:id', ctrl.deleteTestimony);

module.exports = router;
