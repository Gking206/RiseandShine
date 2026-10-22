'use strict';

const db = require('../services/db');
const mailService = require('../services/mailService');
const config = require('../config/appConfig');
const logger = require('../utils/logger');

async function createSupportRequest(req, res) {
  try {
    const sujet = String(req.body.sujet || '').trim();
    const message = String(req.body.message || '').trim();

    const request = await db.create(config.collections.SUPPORT_REQUESTS, {
      userId: req.user.id,
      userNom: req.user.nom,
      userEmail: req.user.email,
      sujet,
      message,
      statut: 'envoyee',
      emailEnvoye: false,
    });

    const sent = await mailService.sendSupportRequest(req.user, sujet, message);
    if (!sent) {
      await db.update(config.collections.SUPPORT_REQUESTS, request.id, { statut: 'echec_envoi' });
      return res.status(502).json({
        success: false,
        message: "Votre demande n'a pas pu être envoyée par e-mail. Réessayez plus tard ou écrivez directement à " + config.mail.supportEmail,
      });
    }

    await db.update(config.collections.SUPPORT_REQUESTS, request.id, { emailEnvoye: true });
    res.status(201).json({
      success: true,
      message: "Votre demande d'assistance a bien été envoyée. Nous vous répondrons par e-mail.",
    });
  } catch (err) {
    logger.error('Demande assistance', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { createSupportRequest };
