'use strict';

const db = require('../services/db');
const notifService = require('../services/notificationService');
const config = require('../config/appConfig');

async function listEvents(req, res) {
  try {
    const { page = 1, limit = 12, categorie, statut, upcoming } = req.query;
    const filter = {};
    if (categorie) filter.categorie = categorie;
    if (statut) filter.statut = statut;

    const result = await db.findAll(config.collections.EVENTS, {
      filter,
      sort: { field: 'dateDebut', order: 'asc' },
      page: parseInt(page),
      limit: parseInt(limit),
    });

    let data = result.data;
    if (upcoming === 'true') {
      const now = new Date();
      data = data.filter(e => new Date(e.dateDebut) >= now);
    }

    res.json({ success: true, ...result, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getEventById(req, res) {
  try {
    const event = await db.findById(config.collections.EVENTS, req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function createEvent(req, res) {
  try {
    const { titre, description, dateDebut, dateFin, lieu, categorie, intervenants, bannerUrl, capacite, lienInscription } = req.body;

    const event = await db.create(config.collections.EVENTS, {
      titre: titre.trim(),
      description: description ? description.trim() : '',
      dateDebut,
      dateFin: dateFin || dateDebut,
      lieu: lieu ? lieu.trim() : '',
      categorie,
      intervenants: intervenants || [],
      bannerUrl: bannerUrl || null,
      capacite: capacite ? parseInt(capacite) : null,
      lienInscription: lienInscription || null,
      statut: 'a_venir',
      rsvp: [],
      participantsConfirmes: [],
      createurId: req.user.id,
      createurNom: req.user.nom,
    });

    await notifService.notifyAdmins(`Nouvel événement créé: ${titre}`, 'evenement');
    res.status(201).json({ success: true, message: 'Événement créé.', event });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const event = await db.findById(config.collections.EVENTS, id);
    if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

    const { titre, description, dateDebut, dateFin, lieu, categorie, statut, intervenants, bannerUrl, capacite } = req.body;
    const updates = {};
    if (titre) updates.titre = titre.trim();
    if (description !== undefined) updates.description = description;
    if (dateDebut) updates.dateDebut = dateDebut;
    if (dateFin) updates.dateFin = dateFin;
    if (lieu !== undefined) updates.lieu = lieu;
    if (categorie) updates.categorie = categorie;
    if (statut) updates.statut = statut;
    if (intervenants) updates.intervenants = intervenants;
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;
    if (capacite !== undefined) updates.capacite = parseInt(capacite);

    const updated = await db.update(config.collections.EVENTS, id, updates);
    res.json({ success: true, message: 'Événement mis à jour.', event: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    await db.delete(config.collections.EVENTS, id);
    res.json({ success: true, message: 'Événement supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function rsvpEvent(req, res) {
  try {
    const { id } = req.params;
    const event = await db.findById(config.collections.EVENTS, id);
    if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable.' });

    if (event.capacite && (event.rsvp || []).length >= event.capacite) {
      return res.status(400).json({ success: false, message: 'Capacité maximale atteinte.' });
    }

    const rsvp = event.rsvp || [];
    const index = rsvp.findIndex(r => r.userId === req.user.id);

    if (index > -1) {
      rsvp.splice(index, 1);
      await db.update(config.collections.EVENTS, id, { rsvp });
      return res.json({ success: true, message: 'Inscription annulée.', inscrit: false, total: rsvp.length });
    }

    rsvp.push({ userId: req.user.id, nom: req.user.nom, date: new Date().toISOString() });
    await db.update(config.collections.EVENTS, id, { rsvp });
    res.json({ success: true, message: 'Inscription confirmée!', inscrit: true, total: rsvp.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { listEvents, getEventById, createEvent, updateEvent, deleteEvent, rsvpEvent };
