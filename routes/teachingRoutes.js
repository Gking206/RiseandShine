'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/teachingController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin, requireSuperAdmin } = require('../middleware/roleMiddleware');
const { validateBody, schemas } = require('../middleware/validationMiddleware');
const { validateFileUrls } = require('../middleware/fileUrlMiddleware');

router.use(requireAuth);

router.get('/', ctrl.listTeachings);
router.get('/galleries', ctrl.listGalleries);
router.get('/:id', ctrl.getTeachingById);
router.post('/', requireAdmin, validateBody(schemas.teaching), validateFileUrls('fichierUrl', 'lien'), ctrl.createTeaching);
router.put('/:id', requireAdmin, validateFileUrls('fichierUrl', 'lien'), ctrl.updateTeaching);
router.delete('/:id', requireAdmin, ctrl.deleteTeaching);
router.post('/:id/download', ctrl.incrementDownload);

router.post('/galleries', requireAdmin, validateFileUrls('imageUrl'), ctrl.addGalleryItem);
router.delete('/galleries/:id', requireAdmin, ctrl.deleteGalleryItem);

module.exports = router;
