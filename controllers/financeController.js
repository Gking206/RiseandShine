'use strict';

const db = require('../services/fileDatabaseService');
const analyticsService = require('../services/analyticsService');
const notifService = require('../services/notificationService');
const config = require('../config/appConfig');

async function listFinances(req, res) {
  try {
    const { page = 1, limit = 20, type, statut, dateDebut, dateFin } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (statut) filter.statut = statut;

    const result = await db.findAll(config.collections.FINANCES, {
      filter,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    let data = result.data;

    if (dateDebut || dateFin) {
      data = data.filter(r => {
        const d = new Date(r.createdAt);
        if (dateDebut && d < new Date(dateDebut)) return false;
        if (dateFin && d > new Date(dateFin)) return false;
        return true;
      });
    }

    res.json({ success: true, ...result, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function createTransaction(req, res) {
  try {
    const { type, montant, description, categorie, dateTransaction, recu, evenementId } = req.body;

    const record = await db.create(config.collections.FINANCES, {
      type,
      montant: parseFloat(montant),
      description: description.trim(),
      categorie: categorie || 'general',
      dateTransaction: dateTransaction || new Date().toISOString(),
      recu: recu || null,
      evenementId: evenementId || null,
      statut: req.user.role === 'super_admin' ? 'approuve' : 'en_attente',
      soumisParId: req.user.id,
      soumisParNom: req.user.nom,
      approbateurId: req.user.role === 'super_admin' ? req.user.id : null,
      dateApprobation: req.user.role === 'super_admin' ? new Date().toISOString() : null,
    });

    if (req.user.role !== 'super_admin') {
      await notifService.notifySuperAdmins(
        `Nouvelle transaction en attente: ${type} - ${montant} FCFA par ${req.user.nom}`,
        'finance'
      );
    }

    res.status(201).json({ success: true, message: 'Transaction enregistrée.', record });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function approveTransaction(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approuve' or 'rejete'

    const record = await db.findById(config.collections.FINANCES, id);
    if (!record) return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
    if (record.statut !== 'en_attente') {
      return res.status(400).json({ success: false, message: 'Cette transaction a déjà été traitée.' });
    }

    const updated = await db.update(config.collections.FINANCES, id, {
      statut: action === 'approuve' ? 'approuve' : 'rejete',
      approbateurId: req.user.id,
      approbateurNom: req.user.nom,
      dateApprobation: new Date().toISOString(),
    });

    if (record.soumisParId) {
      await notifService.notifyUser(
        record.soumisParId,
        `Votre transaction a été ${action === 'approuve' ? 'approuvée' : 'rejetée'}.`,
        'finance'
      );
    }

    res.json({ success: true, message: `Transaction ${action}.`, record: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteTransaction(req, res) {
  try {
    const { id } = req.params;
    const record = await db.findById(config.collections.FINANCES, id);
    if (!record) return res.status(404).json({ success: false, message: 'Transaction introuvable.' });

    await db.delete(config.collections.FINANCES, id);
    res.json({ success: true, message: 'Transaction supprimée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getStats(req, res) {
  try {
    const stats = await analyticsService.getFinanceStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { listFinances, createTransaction, approveTransaction, deleteTransaction, getStats };
