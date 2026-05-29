'use strict';

const db = require('../services/fileDatabaseService');
const config = require('../config/appConfig');

async function listTeachings(req, res) {
  try {
    const { page = 1, limit = 12, categorie, type, search } = req.query;
    const filter = {};
    if (categorie) filter.categorie = categorie;
    if (type) filter.type = type;

    const result = await db.findAll(config.collections.TEACHINGS, {
      filter,
      search,
      searchFields: ['titre', 'description', 'auteur', 'categorie'],
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getTeachingById(req, res) {
  try {
    const teaching = await db.findById(config.collections.TEACHINGS, req.params.id);
    if (!teaching) return res.status(404).json({ success: false, message: 'Enseignement introuvable.' });
    await db.update(config.collections.TEACHINGS, teaching.id, { vues: (teaching.vues || 0) + 1 });
    res.json({ success: true, teaching });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function createTeaching(req, res) {
  try {
    const { titre, description, type, categorie, auteur, fichierUrl, lien, duree, tags } = req.body;

    const teaching = await db.create(config.collections.TEACHINGS, {
      titre: titre.trim(),
      description: description ? description.trim() : '',
      type,
      categorie,
      auteur: auteur ? auteur.trim() : req.user.nom,
      fichierUrl: fichierUrl || null,
      lien: lien || null,
      duree: duree || null,
      tags: tags || [],
      uploadParId: req.user.id,
      uploadParNom: req.user.nom,
      vues: 0,
      telechargements: 0,
      featured: false,
    });

    res.status(201).json({ success: true, message: 'Enseignement ajouté.', teaching });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function updateTeaching(req, res) {
  try {
    const { id } = req.params;
    const teaching = await db.findById(config.collections.TEACHINGS, id);
    if (!teaching) return res.status(404).json({ success: false, message: 'Enseignement introuvable.' });

    const { titre, description, type, categorie, auteur, fichierUrl, lien, duree, tags, featured } = req.body;
    const updates = {};
    if (titre) updates.titre = titre.trim();
    if (description !== undefined) updates.description = description;
    if (type) updates.type = type;
    if (categorie) updates.categorie = categorie;
    if (auteur) updates.auteur = auteur.trim();
    if (fichierUrl !== undefined) updates.fichierUrl = fichierUrl;
    if (lien !== undefined) updates.lien = lien;
    if (duree !== undefined) updates.duree = duree;
    if (tags) updates.tags = tags;
    if (featured !== undefined && req.user.role === 'super_admin') updates.featured = featured;

    const updated = await db.update(config.collections.TEACHINGS, id, updates);
    res.json({ success: true, message: 'Enseignement mis à jour.', teaching: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteTeaching(req, res) {
  try {
    const { id } = req.params;
    await db.delete(config.collections.TEACHINGS, id);
    res.json({ success: true, message: 'Enseignement supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function incrementDownload(req, res) {
  try {
    const teaching = await db.findById(config.collections.TEACHINGS, req.params.id);
    if (!teaching) return res.status(404).json({ success: false, message: 'Introuvable.' });
    await db.update(config.collections.TEACHINGS, teaching.id, { telechargements: (teaching.telechargements || 0) + 1 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function listGalleries(req, res) {
  try {
    const { page = 1, limit = 20, categorie } = req.query;
    const filter = {};
    if (categorie) filter.categorie = categorie;

    const result = await db.findAll(config.collections.GALLERIES, {
      filter,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function addGalleryItem(req, res) {
  try {
    const { titre, imageUrl, categorie, description, evenementId } = req.body;
    if (!imageUrl) return res.status(400).json({ success: false, message: 'URL de l\'image requis.' });

    const item = await db.create(config.collections.GALLERIES, {
      titre: titre ? titre.trim() : 'Sans titre',
      imageUrl,
      categorie: categorie || 'general',
      description: description || '',
      evenementId: evenementId || null,
      uploadParId: req.user.id,
      uploadParNom: req.user.nom,
    });

    res.status(201).json({ success: true, message: 'Image ajoutée.', item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteGalleryItem(req, res) {
  try {
    await db.delete(config.collections.GALLERIES, req.params.id);
    res.json({ success: true, message: 'Image supprimée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = {
  listTeachings, getTeachingById, createTeaching, updateTeaching,
  deleteTeaching, incrementDownload, listGalleries, addGalleryItem, deleteGalleryItem,
};
