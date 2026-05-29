'use strict';

const authService = require('../services/authService');
const db = require('../services/fileDatabaseService');
const notifService = require('../services/notificationService');
const config = require('../config/appConfig');
const { generateId } = require('../utils/idGenerator');
const logger = require('../utils/logger');

async function register(req, res) {
  try {
    const { nom, email, password, telephone, sexe, age, ville, adminId } = req.body;

    const exists = await db.exists(config.collections.USERS, { email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Cette adresse email est déjà utilisée.' });
    }

    // Find or auto-assign admin
    let assignedAdminId = adminId;
    if (!assignedAdminId) {
      const admins = await db.findMany(config.collections.USERS, { role: 'admin' });
      if (admins.length > 0) {
        let minMembers = Infinity;
        let selectedAdmin = null;
        for (const admin of admins) {
          const count = await db.count(config.collections.MEMBERS, { adminId: admin.id });
          if (count < config.memberLimits.max && count < minMembers) {
            minMembers = count;
            selectedAdmin = admin;
          }
        }
        if (selectedAdmin) assignedAdminId = selectedAdmin.id;
      }
    } else {
      const memberCount = await db.count(config.collections.MEMBERS, { adminId: assignedAdminId });
      if (memberCount >= config.memberLimits.max) {
        return res.status(400).json({ success: false, message: 'Cet administrateur a atteint la limite de membres.' });
      }
    }

    const hashedPassword = await authService.hashPassword(password);
    const user = await db.create(config.collections.USERS, {
      nom: nom.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'membre',
      telephone: telephone.trim(),
      sexe,
      age: age ? parseInt(age) : null,
      ville: ville ? ville.trim() : '',
      avatar: null,
      actif: true,
      adminId: assignedAdminId || null,
    });

    // Create member profile
    await db.create(config.collections.MEMBERS, {
      userId: user.id,
      adminId: assignedAdminId || null,
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

    // Notify admin
    if (assignedAdminId) {
      await notifService.notifyUser(assignedAdminId, `Nouveau membre inscrit: ${user.nom}`, 'nouveau_membre');
    }
    await notifService.notifySuperAdmins(`Nouveau membre inscrit: ${user.nom}`, 'nouveau_membre');

    const { password: _pwd, ...safeUser } = user;
    await authService.createSession(req, user);

    res.status(201).json({
      success: true,
      message: 'Inscription réussie. Bienvenue dans Rise And Shine!',
      user: safeUser,
    });
  } catch (err) {
    logger.error('Erreur inscription', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const emailLower = email.toLowerCase().trim();

    const lockStatus = authService.checkLoginAttempts(emailLower);
    if (lockStatus.locked) {
      return res.status(429).json({
        success: false,
        message: `Compte temporairement verrouillé. Réessayez dans ${lockStatus.remaining} minute(s).`,
      });
    }

    const user = await authService.findUserByEmail(emailLower);
    if (!user) {
      authService.recordLoginAttempt(emailLower, false);
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }

    if (user.actif === false) {
      return res.status(401).json({ success: false, message: 'Votre compte a été désactivé. Contactez un administrateur.' });
    }

    const isValid = await authService.comparePassword(password, user.password);
    if (!isValid) {
      authService.recordLoginAttempt(emailLower, false);
      const attempts = authService.checkLoginAttempts(emailLower);
      const remaining = config.security.maxLoginAttempts - attempts.attempts;
      return res.status(401).json({
        success: false,
        message: `Email ou mot de passe incorrect. ${remaining > 0 ? `${remaining} tentative(s) restante(s).` : 'Compte verrouillé.'}`,
      });
    }

    authService.recordLoginAttempt(emailLower, true);
    await authService.createSession(req, user);

    // Update last login
    await db.update(config.collections.USERS, user.id, { dernierConnexion: new Date().toISOString() });

    await db.create(config.collections.LOGS, {
      userId: user.id,
      action: 'connexion',
      details: { ip: req.ip },
    });

    const { password: _pwd, ...safeUser } = user;
    res.json({
      success: true,
      message: `Bienvenue, ${user.nom}!`,
      user: safeUser,
    });
  } catch (err) {
    logger.error('Erreur connexion', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur lors de la connexion.' });
  }
}

async function logout(req, res) {
  try {
    if (req.user) {
      await db.create(config.collections.LOGS, {
        userId: req.user.id,
        action: 'deconnexion',
        details: {},
      });
    }
    await authService.destroySession(req);
    res.json({ success: true, message: 'Déconnexion réussie.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la déconnexion.' });
  }
}

async function getMe(req, res) {
  try {
    const { password: _pwd, ...safeUser } = req.user;
    const unread = await notifService.getUnreadCount(req.user.id);
    res.json({ success: true, user: safeUser, notificationsNonLues: unread });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function changePassword(req, res) {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({ success: false, message: 'Les deux mots de passe sont requis.' });
    }
    if (nouveauMotDePasse.length < 6) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }
    const isValid = await authService.comparePassword(ancienMotDePasse, req.user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect.' });
    }
    const newHash = await authService.hashPassword(nouveauMotDePasse);
    await db.update(config.collections.USERS, req.user.id, { password: newHash });
    res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors du changement de mot de passe.' });
  }
}

async function updateProfile(req, res) {
  try {
    const { nom, telephone, ville, age, avatar, email } = req.body;
    const updates = {};
    if (nom) updates.nom = nom.trim();
    if (telephone) updates.telephone = telephone.trim();
    if (ville) updates.ville = ville.trim();
    if (age) updates.age = parseInt(age);
    if (avatar !== undefined) updates.avatar = avatar;

    // Modification d'email avec vérification d'unicité
    if (email && email.toLowerCase().trim() !== req.user.email) {
      const newEmail = email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ success: false, message: 'Adresse email invalide.' });
      }
      const exists = await db.findOne(config.collections.USERS, { email: newEmail });
      if (exists && exists.id !== req.user.id) {
        return res.status(400).json({ success: false, message: 'Cette adresse email est déjà utilisée par un autre compte.' });
      }
      updates.email = newEmail;
      // Mettre à jour la session avec le nouvel email
      req.session.email = newEmail;
    }

    const updated = await db.update(config.collections.USERS, req.user.id, updates);

    // Sync member profile
    const member = await db.findOne(config.collections.MEMBERS, { userId: req.user.id });
    if (member) {
      const memberUpdates = {};
      if (updates.nom) memberUpdates.nom = updates.nom;
      if (updates.telephone) memberUpdates.telephone = updates.telephone;
      if (updates.ville) memberUpdates.ville = updates.ville;
      if (updates.age) memberUpdates.age = updates.age;
      if (updates.avatar !== undefined) memberUpdates.avatar = updates.avatar;
      await db.update(config.collections.MEMBERS, member.id, memberUpdates);
    }

    const { password: _pwd, ...safeUser } = updated;
    res.json({ success: true, message: 'Profil mis à jour.', user: safeUser });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
  }
}

async function getAdminsForRegistration(req, res) {
  try {
    const admins = await db.findMany(config.collections.USERS, { role: 'admin' });
    const adminsWithCount = await Promise.all(
      admins.map(async (admin) => {
        const count = await db.count(config.collections.MEMBERS, { adminId: admin.id });
        return { id: admin.id, nom: admin.nom, membresActuels: count, limite: config.memberLimits.max };
      })
    );
    const available = adminsWithCount.filter(a => a.membresActuels < config.memberLimits.max);
    res.json({ success: true, admins: available });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { register, login, logout, getMe, changePassword, updateProfile, getAdminsForRegistration };
