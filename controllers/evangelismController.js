'use strict';

const db = require('../services/db');
const notifService = require('../services/notificationService');
const analyticsService = require('../services/analyticsService');
const config = require('../config/appConfig');

async function listEvangelism(req, res) {
  try {
    const { page = 1, limit = 20, search, statut } = req.query;
    const filter = {};

    if (req.user.role === 'admin') filter.adminId = req.user.id;
    if (req.user.role === 'membre') filter.membreId = req.user.id;
    if (statut) filter.statut = statut;

    const result = await db.findAll(config.collections.EVANGELISM, {
      filter,
      search,
      searchFields: ['nom', 'telephone', 'localisation'],
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function createEvangelism(req, res) {
  try {
    const { nom, telephone, localisation, dateEvangelisation, demandesPriere, notes } = req.body;

    // Find admin for follow-up
    let adminId = null;
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      adminId = req.user.id;
    } else {
      const member = await db.findOne(config.collections.MEMBERS, { userId: req.user.id });
      if (member) adminId = member.adminId;
    }

    const record = await db.create(config.collections.EVANGELISM, {
      nom: nom.trim(),
      telephone: telephone ? telephone.trim() : '',
      localisation: localisation ? localisation.trim() : '',
      dateEvangelisation: dateEvangelisation || new Date().toISOString(),
      demandesPriere: demandesPriere || '',
      notes: notes || '',
      statut: 'nouveau',
      membreId: req.user.id,
      membreNom: req.user.nom,
      adminId,
      historique: [{ date: new Date().toISOString(), statut: 'nouveau', notes: 'Enregistrement initial' }],
    });

    if (adminId && adminId !== req.user.id) {
      await notifService.notifyUser(adminId, `Nouvelle personne évangélisée: ${nom} par ${req.user.nom}`, 'evangelisme');
    }

    res.status(201).json({ success: true, message: 'Personne évangélisée enregistrée.', record });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function updateEvangelism(req, res) {
  try {
    const { id } = req.params;
    const { nom, telephone, localisation, statut, notes, demandesPriere } = req.body;

    const record = await db.findById(config.collections.EVANGELISM, id);
    if (!record) return res.status(404).json({ success: false, message: 'Enregistrement introuvable.' });

    if (req.user.role === 'admin' && record.adminId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const updates = {};
    if (nom) updates.nom = nom.trim();
    if (telephone) updates.telephone = telephone.trim();
    if (localisation) updates.localisation = localisation.trim();
    if (notes !== undefined) updates.notes = notes;
    if (demandesPriere !== undefined) updates.demandesPriere = demandesPriere;

    if (statut && statut !== record.statut) {
      updates.statut = statut;
      const historique = [...(record.historique || []), {
        date: new Date().toISOString(),
        statut,
        notes: notes || '',
        parId: req.user.id,
        parNom: req.user.nom,
      }];
      updates.historique = historique;
    }

    const updated = await db.update(config.collections.EVANGELISM, id, updates);
    res.json({ success: true, message: 'Dossier d\'évangélisation mis à jour.', record: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteEvangelism(req, res) {
  try {
    const { id } = req.params;
    const record = await db.findById(config.collections.EVANGELISM, id);
    if (!record) return res.status(404).json({ success: false, message: 'Enregistrement introuvable.' });

    if (req.user.role === 'admin' && record.adminId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    await db.delete(config.collections.EVANGELISM, id);
    res.json({ success: true, message: 'Dossier supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getStats(req, res) {
  try {
    const stats = await analyticsService.getEvangelismStats(req.user.id, req.user.role);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { listEvangelism, createEvangelism, updateEvangelism, deleteEvangelism, getStats };
