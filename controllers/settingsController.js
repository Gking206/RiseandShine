'use strict';

const db = require('../services/db');
const config = require('../config/appConfig');
const logger = require('../utils/logger');

const socialKey = (network) => `social_${network}`;

async function readSocialLinks() {
  const links = {};
  for (const network of config.socialNetworks) {
    const row = await db.findOne(config.collections.SETTINGS, { cle: socialKey(network) });
    links[network] = row && row.valeur ? row.valeur : '';
  }
  return links;
}

function isValidLink(url) {
  if (!url) return true; // vide = lien désactivé
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function getSocialLinks(req, res) {
  try {
    res.json({ success: true, links: await readSocialLinks() });
  } catch (err) {
    logger.error('Lecture liens sociaux', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function updateSocialLinks(req, res) {
  try {
    const input = req.body || {};
    for (const network of config.socialNetworks) {
      if (input[network] === undefined) continue;
      const url = String(input[network] || '').trim();
      if (!isValidLink(url)) {
        return res.status(400).json({
          success: false,
          message: `Lien ${network} invalide. Il doit commencer par https://`,
        });
      }
    }

    for (const network of config.socialNetworks) {
      if (input[network] === undefined) continue;
      const url = String(input[network] || '').trim();
      const cle = socialKey(network);
      const existing = await db.findOne(config.collections.SETTINGS, { cle });
      if (existing) {
        await db.update(config.collections.SETTINGS, existing.id, { valeur: url });
      } else {
        await db.create(config.collections.SETTINGS, { cle, valeur: url });
      }
    }

    await db.create(config.collections.LOGS, {
      userId: req.user.id,
      userNom: req.user.nom,
      userRole: req.user.role,
      action: 'modification_liens_sociaux',
      details: {},
    });

    res.json({ success: true, message: 'Liens des réseaux sociaux mis à jour.', links: await readSocialLinks() });
  } catch (err) {
    logger.error('Mise à jour liens sociaux', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { getSocialLinks, updateSocialLinks };
