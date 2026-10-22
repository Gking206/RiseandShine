'use strict';

const db = require('../services/db');
const notifService = require('../services/notificationService');
const config = require('../config/appConfig');

async function listMembers(req, res) {
  try {
    const { page = 1, limit = 20, search, statut, adminId } = req.query;
    const filter = {};

    if (req.user.role === 'admin') {
      filter.adminId = req.user.id;
    } else if (adminId) {
      filter.adminId = adminId;
    }

    if (statut) filter.statut = statut;

    const result = await db.findAll(config.collections.MEMBERS, {
      filter,
      search,
      searchFields: ['nom', 'email', 'telephone', 'ville'],
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getMemberById(req, res) {
  try {
    const member = await db.findById(config.collections.MEMBERS, req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Membre introuvable.' });

    // Access control
    if (req.user.role === 'admin' && member.adminId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    if (req.user.role === 'membre' && member.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    // Get testimonies
    const testimonies = await db.findMany(config.collections.TESTIMONIES, { userId: member.userId });
    // Get evangelism
    const evangelism = await db.findMany(config.collections.EVANGELISM, { memberId: member.id });

    res.json({ success: true, member, testimonies, evangelism });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function updateMember(req, res) {
  try {
    const { id } = req.params;
    const member = await db.findById(config.collections.MEMBERS, id);
    if (!member) return res.status(404).json({ success: false, message: 'Membre introuvable.' });

    if (req.user.role === 'admin' && member.adminId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const { nom, email, telephone, ville, age, statut, notes, baptise } = req.body;
    const updates = {};
    if (nom) updates.nom = nom.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (telephone) updates.telephone = telephone.trim();
    if (ville) updates.ville = ville.trim();
    if (age !== undefined) updates.age = parseInt(age);
    if (statut) updates.statut = statut;
    if (notes !== undefined) updates.notes = notes;
    if (baptise !== undefined) updates.baptise = baptise;

    const updated = await db.update(config.collections.MEMBERS, id, updates);
    res.json({ success: true, message: 'Membre mis à jour.', member: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteMember(req, res) {
  try {
    const { id } = req.params;
    const member = await db.findById(config.collections.MEMBERS, id);
    if (!member) return res.status(404).json({ success: false, message: 'Membre introuvable.' });

    await db.delete(config.collections.MEMBERS, id);
    res.json({ success: true, message: 'Membre supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function reassignMember(req, res) {
  try {
    const { id } = req.params;
    const { newAdminId } = req.body;

    const member = await db.findById(config.collections.MEMBERS, id);
    if (!member) return res.status(404).json({ success: false, message: 'Membre introuvable.' });

    const newAdmin = await db.findById(config.collections.USERS, newAdminId);
    if (!newAdmin || (newAdmin.role !== 'admin' && newAdmin.role !== 'super_admin')) {
      return res.status(400).json({ success: false, message: 'Administrateur invalide.' });
    }

    const currentCount = await db.count(config.collections.MEMBERS, { adminId: newAdminId });
    if (currentCount >= config.memberLimits.max) {
      return res.status(400).json({ success: false, message: 'Cet administrateur a atteint la limite de membres.' });
    }

    await db.update(config.collections.MEMBERS, id, { adminId: newAdminId });
    if (member.userId) {
      await db.update(config.collections.USERS, member.userId, { adminId: newAdminId });
    }

    await notifService.notifyUser(newAdminId, `Le membre ${member.nom} vous a été assigné.`, 'reassignment');
    res.json({ success: true, message: 'Membre réassigné avec succès.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getConfidentialReports(req, res) {
  try {
    const { id } = req.params;
    const member = await db.findById(config.collections.MEMBERS, id);
    if (!member) return res.status(404).json({ success: false, message: 'Membre introuvable.' });

    if (req.user.role === 'admin' && member.adminId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const reports = await db.findMany(config.collections.REPORTS, { memberId: id });
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function createConfidentialReport(req, res) {
  try {
    const { id } = req.params;
    const { titre, contenu, type, dateObservation } = req.body;

    if (!titre || !contenu) {
      return res.status(400).json({ success: false, message: 'Titre et contenu requis.' });
    }

    const member = await db.findById(config.collections.MEMBERS, id);
    if (!member) return res.status(404).json({ success: false, message: 'Membre introuvable.' });

    if (req.user.role === 'admin' && member.adminId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const report = await db.create(config.collections.REPORTS, {
      memberId: id,
      membreNom: member.nom,
      adminId: req.user.id,
      adminNom: req.user.nom,
      titre: titre.trim(),
      contenu: contenu.trim(),
      type: type || 'observation',
      dateObservation: dateObservation || new Date().toISOString(),
      confidentiel: true,
    });

    res.status(201).json({ success: true, message: 'Rapport créé.', report });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getMemberStats(req, res) {
  try {
    const adminFilter = req.user.role === 'admin' ? { adminId: req.user.id } : {};
    const [total, actifs, inactifs] = await Promise.all([
      db.count(config.collections.MEMBERS, adminFilter),
      db.count(config.collections.MEMBERS, { ...adminFilter, statut: 'actif' }),
      db.count(config.collections.MEMBERS, { ...adminFilter, statut: 'inactif' }),
    ]);
    res.json({ success: true, stats: { total, actifs, inactifs } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = {
  listMembers, getMemberById, updateMember, deleteMember,
  reassignMember, getConfidentialReports, createConfidentialReport, getMemberStats,
};
