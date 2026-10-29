'use strict';

// Import de fichiers (images, PDF, audio, vidéo) depuis le téléphone ou l'ordinateur.
// POST /api/uploads?accept=image|document|audio|video|media  (champ « file »)
// Les fichiers sont enregistrés dans public/uploads/AAAA-MM/ sous un nom aléatoire
// et servis à l'adresse /uploads/AAAA-MM/<nom>.

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const config = require('../config/appConfig');
const logger = require('../utils/logger');
const { generateId } = require('../utils/idGenerator');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const TYPES = config.upload.types;

// Catégories acceptées selon le champ du formulaire
const ACCEPT = {
  image: ['image'],
  document: ['document', 'image'],
  audio: ['audio'],
  video: ['video'],
  media: ['image', 'document', 'audio', 'video'],
};

const LABELS = {
  image: 'une image (JPG, PNG, GIF ou WEBP)',
  document: 'un PDF ou une image',
  audio: 'un fichier audio (MP3, M4A, WAV, OGG)',
  video: 'une vidéo (MP4, WEBM, MOV)',
  media: 'une image, un PDF, un audio ou une vidéo',
};

function formatMb(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} Mo`;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const month = new Date().toISOString().slice(0, 7); // AAAA-MM
    const dir = path.join(config.paths.uploads, month);
    fs.mkdir(dir, { recursive: true }, err => {
      req.uploadMonth = month;
      cb(err, dir);
    });
  },
  filename(req, file, cb) {
    // Nom aléatoire + extension déduite du type : le nom d'origine n'est jamais utilisé
    cb(null, generateId() + TYPES[file.mimetype].ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    const accept = ACCEPT[req.query.accept] ? req.query.accept : 'media';
    const type = TYPES[file.mimetype];
    if (!type || !ACCEPT[accept].includes(type.kind)) {
      const err = new Error(`Format non accepté. Choisissez ${LABELS[accept]}.`);
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Limite raisonnable pour éviter le remplissage du disque
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Trop de fichiers importés. Réessayez dans une heure." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', requireAuth, uploadLimiter, (req, res) => {
  upload.single('file')(req, res, err => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `Fichier trop volumineux (maximum ${formatMb(config.upload.maxSize)}).`
        : err.status === 400 ? err.message : "Erreur lors de l'import du fichier.";
      if (!err.status && err.code !== 'LIMIT_FILE_SIZE') logger.error('Import fichier', { error: err.message });
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });
    }

    const type = TYPES[req.file.mimetype];
    if (req.file.size > type.maxSize) {
      fs.unlink(req.file.path, () => {});
      return res.status(413).json({
        success: false,
        message: `Fichier trop volumineux (maximum ${formatMb(type.maxSize)} pour ce type de fichier).`,
      });
    }

    logger.info('Fichier importé', { userId: req.user.id, file: req.file.filename, size: req.file.size });
    res.status(201).json({
      success: true,
      url: `/uploads/${req.uploadMonth}/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      kind: type.kind,
    });
  });
});

module.exports = router;
