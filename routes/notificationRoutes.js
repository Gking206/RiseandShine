'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const notifService = require('../services/notificationService');
const db = require('../services/fileDatabaseService');
const config = require('../config/appConfig');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const notifs = await notifService.getUserNotifications(req.user.id);
    const unread = notifs.filter(n => !n.lu).length;
    res.json({ success: true, notifications: notifs, nonLues: unread });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    await notifService.markAsRead(req.params.id);
    res.json({ success: true, message: 'Notification marquée comme lue.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const count = await notifService.markAllAsRead(req.user.id);
    res.json({ success: true, message: `${count} notification(s) marquées comme lues.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.delete(config.collections.NOTIFICATIONS, req.params.id);
    res.json({ success: true, message: 'Notification supprimée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Announcements
router.get('/announcements', async (req, res) => {
  try {
    const result = await db.findAll(config.collections.ANNOUNCEMENTS, {
      filter: { actif: true },
      sort: { field: 'createdAt', order: 'desc' },
      limit: 10,
    });
    res.json({ success: true, announcements: result.data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.post('/announcements', requireAdmin, async (req, res) => {
  try {
    const { titre, contenu, priorite, expireAt } = req.body;
    if (!titre || !contenu) return res.status(400).json({ success: false, message: 'Titre et contenu requis.' });

    const ann = await db.create(config.collections.ANNOUNCEMENTS, {
      titre: titre.trim(),
      contenu: contenu.trim(),
      priorite: priorite || 'normale',
      expireAt: expireAt || null,
      actif: true,
      createurId: req.user.id,
      createurNom: req.user.nom,
    });

    res.status(201).json({ success: true, announcement: ann });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.delete('/announcements/:id', requireAdmin, async (req, res) => {
  try {
    await db.delete(config.collections.ANNOUNCEMENTS, req.params.id);
    res.json({ success: true, message: 'Annonce supprimée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;
