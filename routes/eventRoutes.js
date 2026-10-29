'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/eventController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');
const { validateFileUrls } = require('../middleware/fileUrlMiddleware');

router.use(requireAuth);

router.get('/', ctrl.listEvents);
router.get('/:id', ctrl.getEventById);
router.post('/', requireAdmin, validateBody(schemas.event), validateFileUrls('bannerUrl', 'lienInscription'), ctrl.createEvent);
router.put('/:id', requireAdmin, validateFileUrls('bannerUrl'), ctrl.updateEvent);
router.delete('/:id', requireAdmin, ctrl.deleteEvent);
router.post('/:id/rsvp', ctrl.rsvpEvent);

module.exports = router;
