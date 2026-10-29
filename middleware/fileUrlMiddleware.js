'use strict';

// Vérifie les champs qui contiennent l'adresse d'une image ou d'un fichier.
// Valeurs acceptées : vide, un fichier importé (/uploads/AAAA-MM/nom.ext) ou un
// lien http(s) sans guillemets ni espaces. Ces adresses sont insérées dans les
// pages : une valeur comme `x" onerror="…` exécuterait du code chez les visiteurs.

const UPLOADED = /^\/uploads\/\d{4}-\d{2}\/[A-Za-z0-9-]+\.[A-Za-z0-9]{2,5}$/;
const EXTERNAL = /^https?:\/\/[^\s"'<>`]+$/i;

function isSafeFileUrl(value) {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && (UPLOADED.test(value) || EXTERNAL.test(value));
}

function validateFileUrls(...fields) {
  return (req, res, next) => {
    for (const field of fields) {
      if (req.body && typeof req.body[field] === 'string') req.body[field] = req.body[field].trim();
      if (req.body && !isSafeFileUrl(req.body[field])) {
        return res.status(400).json({ success: false, message: 'Fichier ou lien invalide. Importez le fichier à nouveau.' });
      }
    }
    next();
  };
}

module.exports = { isSafeFileUrl, validateFileUrls };
