'use strict';

const db = require('../services/fileDatabaseService');
const notifService = require('../services/notificationService');
const config = require('../config/appConfig');

async function listTestimonies(req, res) {
  try {
    const { page = 1, limit = 12, statut, featured } = req.query;
    const filter = {};

    if (req.user.role === 'membre') {
      filter.statut = 'approuve';
    } else if (statut) {
      filter.statut = statut;
    }
    if (featured === 'true') filter.featured = true;

    const result = await db.findAll(config.collections.TESTIMONIES, {
      filter,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getTestimonyById(req, res) {
  try {
    const testimony = await db.findById(config.collections.TESTIMONIES, req.params.id);
    if (!testimony) return res.status(404).json({ success: false, message: 'Témoignage introuvable.' });
    if (req.user.role === 'membre' && testimony.statut !== 'approuve' && testimony.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    res.json({ success: true, testimony });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function createTestimony(req, res) {
  try {
    const { titre, contenu, type, image } = req.body;

    const testimony = await db.create(config.collections.TESTIMONIES, {
      userId: req.user.id,
      auteurNom: req.user.nom,
      auteurAvatar: req.user.avatar,
      titre: titre.trim(),
      contenu: contenu.trim(),
      type: type || 'temoignage',
      image: image || null,
      statut: 'en_attente',
      featured: false,
      likes: [],
      commentaires: [],
      vues: 0,
    });

    await notifService.notifyAdmins(`Nouveau témoignage soumis par ${req.user.nom}: "${titre}"`, 'temoignage');
    res.status(201).json({ success: true, message: 'Témoignage soumis pour approbation.', testimony });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function updateTestimony(req, res) {
  try {
    const { id } = req.params;
    const testimony = await db.findById(config.collections.TESTIMONIES, id);
    if (!testimony) return res.status(404).json({ success: false, message: 'Témoignage introuvable.' });

    if (testimony.userId !== req.user.id && req.user.role === 'membre') {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const { titre, contenu, type, image } = req.body;
    const updates = {};
    if (titre) updates.titre = titre.trim();
    if (contenu) updates.contenu = contenu.trim();
    if (type) updates.type = type;
    if (image !== undefined) updates.image = image;
    if (req.user.role === 'membre') updates.statut = 'en_attente'; // Reset to pending on edit

    const updated = await db.update(config.collections.TESTIMONIES, id, updates);
    res.json({ success: true, message: 'Témoignage mis à jour.', testimony: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function moderateTestimony(req, res) {
  try {
    const { id } = req.params;
    const { action, featured } = req.body; // action: 'approuve', 'rejete'

    const testimony = await db.findById(config.collections.TESTIMONIES, id);
    if (!testimony) return res.status(404).json({ success: false, message: 'Témoignage introuvable.' });

    const updates = {};
    if (action) updates.statut = action;
    if (featured !== undefined) updates.featured = featured;
    updates.moderateurId = req.user.id;
    updates.moderateurNom = req.user.nom;
    updates.dateModeration = new Date().toISOString();

    const updated = await db.update(config.collections.TESTIMONIES, id, updates);

    if (action && testimony.userId) {
      const msg = action === 'approuve'
        ? 'Votre témoignage a été approuvé et publié!'
        : 'Votre témoignage n\'a pas pu être publié.';
      await notifService.notifyUser(testimony.userId, msg, 'temoignage');
    }

    res.json({ success: true, message: `Témoignage ${action || 'mis à jour'}.`, testimony: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function likeTestimony(req, res) {
  try {
    const { id } = req.params;
    const testimony = await db.findById(config.collections.TESTIMONIES, id);
    if (!testimony) return res.status(404).json({ success: false, message: 'Témoignage introuvable.' });

    const likes = testimony.likes || [];
    const userIndex = likes.indexOf(req.user.id);
    if (userIndex > -1) {
      likes.splice(userIndex, 1);
    } else {
      likes.push(req.user.id);
    }

    await db.update(config.collections.TESTIMONIES, id, { likes });
    res.json({ success: true, likes: likes.length, liked: userIndex === -1 });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function addComment(req, res) {
  try {
    const { id } = req.params;
    const { contenu } = req.body;
    if (!contenu || contenu.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Commentaire trop court.' });
    }

    const testimony = await db.findById(config.collections.TESTIMONIES, id);
    if (!testimony) return res.status(404).json({ success: false, message: 'Témoignage introuvable.' });

    const commentaires = testimony.commentaires || [];
    commentaires.push({
      id: require('../utils/idGenerator').generateId(),
      userId: req.user.id,
      auteurNom: req.user.nom,
      contenu: contenu.trim(),
      date: new Date().toISOString(),
    });

    await db.update(config.collections.TESTIMONIES, id, { commentaires });
    res.json({ success: true, message: 'Commentaire ajouté.', commentaires });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteTestimony(req, res) {
  try {
    const { id } = req.params;
    const testimony = await db.findById(config.collections.TESTIMONIES, id);
    if (!testimony) return res.status(404).json({ success: false, message: 'Témoignage introuvable.' });

    if (testimony.userId !== req.user.id && req.user.role === 'membre') {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    await db.delete(config.collections.TESTIMONIES, id);
    res.json({ success: true, message: 'Témoignage supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = {
  listTestimonies, getTestimonyById, createTestimony, updateTestimony,
  moderateTestimony, likeTestimony, addComment, deleteTestimony,
};
