'use strict';

const db = require('../services/fileDatabaseService');
const authService = require('../services/authService');
const notifService = require('../services/notificationService');
const config = require('../config/appConfig');
const logger = require('../utils/logger');

async function listUsers(req, res) {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role) filter.role = role;

    const result = await db.findAll(config.collections.USERS, {
      filter,
      search,
      searchFields: ['nom', 'email', 'telephone'],
      page: parseInt(page),
      limit: parseInt(limit),
    });

    const users = result.data.map(({ password, ...u }) => u);
    res.json({ success: true, ...result, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getUserById(req, res) {
  try {
    const user = await db.findById(config.collections.USERS, req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    const { password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { nom, email, telephone, ville, age, role, actif } = req.body;

    const user = await db.findById(config.collections.USERS, id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    // Only super admin can change roles
    if (role && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Seul un Super Admin peut changer les rôles.' });
    }

    // Prevent demoting the last super admin
    if (role && role !== 'super_admin' && user.role === 'super_admin') {
      const superAdminCount = await db.count(config.collections.USERS, { role: 'super_admin' });
      if (superAdminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Impossible de rétrograder le dernier Super Admin.' });
      }
    }

    const updates = {};
    if (nom) updates.nom = nom.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (telephone) updates.telephone = telephone.trim();
    if (ville) updates.ville = ville.trim();
    if (age) updates.age = parseInt(age);
    if (role && req.user.role === 'super_admin') updates.role = role;
    if (actif !== undefined && req.user.role === 'super_admin') updates.actif = actif;

    const updated = await db.update(config.collections.USERS, id, updates);
    const { password, ...safeUser } = updated;

    await notifService.notifyUser(id, 'Votre profil a été mis à jour par un administrateur.', 'profile_update');
    res.json({ success: true, message: 'Utilisateur mis à jour.', user: safeUser });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    const user = await db.findById(config.collections.USERS, id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    if (user.role === 'super_admin') {
      const count = await db.count(config.collections.USERS, { role: 'super_admin' });
      if (count <= 1) {
        return res.status(400).json({ success: false, message: 'Impossible de supprimer le dernier Super Admin.' });
      }
    }

    await db.delete(config.collections.USERS, id);
    res.json({ success: true, message: 'Utilisateur supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function changeUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['membre', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide.' });
    }

    const user = await db.findById(config.collections.USERS, id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    // If promoting to admin, check if we need to create admin assignment record
    await db.update(config.collections.USERS, id, { role });

    await notifService.notifyUser(id, `Votre rôle a été modifié: ${role}`, 'role_change');
    res.json({ success: true, message: `Rôle mis à jour: ${role}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const user = await db.findById(config.collections.USERS, id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    const newStatus = !user.actif;
    await db.update(config.collections.USERS, id, { actif: newStatus });

    const msg = newStatus ? 'Compte réactivé.' : 'Compte désactivé.';
    await notifService.notifyUser(id, msg, 'account_status');
    res.json({ success: true, message: msg, actif: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }
    const hashed = await authService.hashPassword(newPassword);
    await db.update(config.collections.USERS, id, { password: hashed });
    await notifService.notifyUser(id, 'Votre mot de passe a été réinitialisé.', 'password_reset');
    res.json({ success: true, message: 'Mot de passe réinitialisé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getAnalytics(req, res) {
  try {
    const analyticsService = require('../services/analyticsService');
    const stats = await analyticsService.getDashboardStats(req.user.id, req.user.role);
    const evangelismStats = await analyticsService.getEvangelismStats(req.user.id, req.user.role);
    const membersGrowth = await analyticsService.getMembersGrowth();
    let financeStats = null;
    if (req.user.role === 'super_admin') {
      financeStats = await analyticsService.getFinanceStats();
    }
    res.json({ success: true, stats, evangelismStats, membersGrowth, financeStats });
  } catch (err) {
    logger.error('Analytics error', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function createUser(req, res) {
  try {
    const { nom, email, password, telephone, sexe, age, ville, role, adminId } = req.body;

    if (!nom || !nom.trim()) {
      return res.status(400).json({ success: false, message: 'Le nom est requis.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Adresse email invalide.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const validRoles = ['membre', 'admin', 'super_admin'];
    const userRole = validRoles.includes(role) ? role : 'membre';

    const exists = await db.exists(config.collections.USERS, { email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Cette adresse email est déjà utilisée.' });
    }

    // Pour un membre : trouver ou vérifier l'admin assigné
    let assignedAdminId = null;
    if (userRole === 'membre') {
      if (adminId) {
        const adminUser = await db.findById(config.collections.USERS, adminId);
        if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'super_admin')) {
          return res.status(400).json({ success: false, message: 'Administrateur invalide.' });
        }
        const count = await db.count(config.collections.MEMBERS, { adminId });
        if (count >= config.memberLimits.max) {
          return res.status(400).json({ success: false, message: `Cet administrateur a atteint sa limite (${config.memberLimits.max} membres).` });
        }
        assignedAdminId = adminId;
      } else {
        // Auto-assignation à l'admin avec le moins de membres
        const admins = await db.findMany(config.collections.USERS, { role: 'admin' });
        let minCount = Infinity;
        for (const admin of admins) {
          const count = await db.count(config.collections.MEMBERS, { adminId: admin.id });
          if (count < config.memberLimits.max && count < minCount) {
            minCount = count;
            assignedAdminId = admin.id;
          }
        }
      }
    }

    const hashedPassword = await authService.hashPassword(password);
    const user = await db.create(config.collections.USERS, {
      nom: nom.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: userRole,
      telephone: telephone ? telephone.trim() : '',
      sexe: sexe || '',
      age: age ? parseInt(age) : null,
      ville: ville ? ville.trim() : '',
      avatar: null,
      actif: true,
      adminId: assignedAdminId,
      permissions: [],
    });

    // Créer le profil membre si rôle = membre
    if (userRole === 'membre') {
      await db.create(config.collections.MEMBERS, {
        userId: user.id,
        adminId: assignedAdminId,
        nom: user.nom,
        email: user.email,
        telephone: user.telephone,
        sexe: user.sexe,
        age: user.age,
        ville: user.ville,
        statut: 'actif',
        avatar: null,
        notes: '',
        baptise: false,
        dateAdhesion: new Date().toISOString(),
      });
      if (assignedAdminId) {
        await notifService.notifyUser(assignedAdminId, `Nouveau membre ajouté par le Super Admin: ${user.nom}`, 'nouveau_membre');
      }
    }

    await notifService.notifyUser(user.id, `Bienvenue sur Rise And Shine, ${user.nom} ! Votre compte a été créé.`, 'bienvenue');

    const roleLabel = userRole === 'admin' ? 'Administrateur' : userRole === 'super_admin' ? 'Super Admin' : 'Membre';
    const { password: _pwd, ...safeUser } = user;
    res.status(201).json({ success: true, message: `${roleLabel} créé avec succès.`, user: safeUser });
  } catch (err) {
    logger.error('Erreur création utilisateur', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { listUsers, getUserById, createUser, updateUser, deleteUser, changeUserRole, toggleUserStatus, resetUserPassword, getAnalytics };
