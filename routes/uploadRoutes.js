'use strict';

// Import de fichiers (images, audio, vidéo, documents) depuis le téléphone ou l'ordinateur.
//
// Le fichier est envoyé par morceaux (config.upload.chunkSize) :
//   POST /api/uploads/chunk?accept=…&uploadId=…&index=…&total=…&size=…&name=…   (champ « chunk »)
// Chaque requête reste petite : elle passe les limites de taille et de durée du
// proxy de l'hébergeur, et un morceau perdu (coupure réseau) est simplement renvoyé.
// Le fichier terminé est enregistré dans <uploads>/AAAA-MM/<nom aléatoire>.<ext>
// et servi à l'adresse /uploads/AAAA-MM/<nom>.

const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const config = require('../config/appConfig');
const logger = require('../utils/logger');
const { generateId } = require('../utils/idGenerator');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const { kinds: KINDS, chunkSize: CHUNK_SIZE } = config.upload;
const TMP_DIR = path.join(config.paths.uploads, '.tmp'); // dossier « . » : jamais servi
const STALE_MS = 24 * 60 * 60 * 1000;

// Catégories acceptées selon le champ du formulaire
const ACCEPT = {
  image: ['image'],
  document: ['document', 'image'],
  audio: ['audio'],
  video: ['video'],
  av: ['image', 'audio', 'video'],
  media: ['image', 'audio', 'video', 'document'],
};

const KIND_LABELS = { image: 'image', audio: 'audio', video: 'vidéo', document: 'document' };

function kindOfExt(ext) {
  return Object.keys(KINDS).find(k => KINDS[k].exts.includes(ext)) || null;
}

function formatMb(bytes) {
  return bytes >= 1024 * 1024 * 1024 ? `${Math.round(bytes / 1024 / 1024 / 1024)} Go` : `${Math.round(bytes / 1024 / 1024)} Mo`;
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

async function removeStaleUploads() {
  try {
    const now = Date.now();
    for (const f of await fs.readdir(TMP_DIR)) {
      const p = path.join(TMP_DIR, f);
      const st = await fs.stat(p).catch(() => null);
      if (st && now - st.mtimeMs > STALE_MS) await fs.unlink(p).catch(() => {});
    }
  } catch {}
}

// Un morceau = au plus chunkSize octets (petite marge pour l'enveloppe multipart)
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHUNK_SIZE + 64 * 1024, files: 1, fields: 5 },
});

// Limite le nombre de FICHIERS (pas de morceaux) importés par heure
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  skip: req => req.query.index !== '0',
  message: { success: false, message: 'Trop de fichiers importés. Réessayez dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chunk', requireAuth, uploadLimiter, (req, res) => {
  chunkUpload.single('chunk')(req, res, async err => {
    try {
      if (err) {
        return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'Morceau de fichier trop grand.' : "Erreur lors de l'import du fichier.");
      }

      // ── Paramètres ────────────────────────────────────────
      const { uploadId } = req.query;
      const index = parseInt(req.query.index, 10);
      const total = parseInt(req.query.total, 10);
      const size = parseInt(req.query.size, 10);
      const name = String(req.query.name || '').slice(0, 200);
      const accept = ACCEPT[req.query.accept] ? req.query.accept : 'media';

      if (!/^[A-Za-z0-9-]{8,64}$/.test(uploadId || '') || !(index >= 0) || !(total >= 1) || index >= total || !(size >= 1)) {
        return fail(res, 400, "Paramètres d'import invalides.");
      }
      if (!req.file || !req.file.buffer.length) return fail(res, 400, 'Aucun fichier reçu.');

      const ext = (path.extname(name).slice(1) || '').toLowerCase();
      const kind = kindOfExt(ext);
      if (!kind || !ACCEPT[accept].includes(kind)) {
        const allowed = ACCEPT[accept].flatMap(k => KINDS[k].exts).map(e => e.toUpperCase()).join(', ');
        return fail(res, 400, `Format « .${ext || '?'} » non accepté ici. Formats possibles : ${allowed}.`);
      }
      if (size > KINDS[kind].maxSize) {
        return fail(res, 413, `Fichier trop volumineux : ${formatMb(size)}. Maximum ${formatMb(KINDS[kind].maxSize)} pour un fichier ${KIND_LABELS[kind]}.`);
      }
      if (total !== Math.ceil(size / CHUNK_SIZE)) return fail(res, 400, "Paramètres d'import invalides.");

      // ── Assemblage ────────────────────────────────────────
      await fs.mkdir(TMP_DIR, { recursive: true });
      const base = path.join(TMP_DIR, `${req.user.id}_${uploadId}`);
      const partPath = `${base}.part`;
      const metaPath = `${base}.json`;

      let meta;
      if (index === 0) {
        removeStaleUploads();
        meta = { received: 0, total, size, ext, kind, name };
        await fs.writeFile(partPath, Buffer.alloc(0));
      } else {
        meta = JSON.parse(await fs.readFile(metaPath, 'utf8').catch(() => 'null'));
        if (!meta || meta.total !== total || meta.size !== size || meta.ext !== ext) {
          return fail(res, 409, "L'import a été interrompu. Choisissez à nouveau le fichier.");
        }
      }

      if (index < meta.received) {
        // Morceau déjà reçu (la réponse s'était perdue) : rien à faire
        return res.json({ success: true, received: meta.received });
      }
      if (index > meta.received) {
        return res.status(409).json({ success: false, expected: meta.received, message: 'Morceau manquant.' });
      }

      await fs.appendFile(partPath, req.file.buffer);
      meta.received += 1;
      await fs.writeFile(metaPath, JSON.stringify(meta));

      if (meta.received < meta.total) {
        return res.json({ success: true, received: meta.received });
      }

      // ── Dernier morceau : vérification puis mise en place ─
      const stat = await fs.stat(partPath);
      if (stat.size !== size) {
        await Promise.all([fs.unlink(partPath).catch(() => {}), fs.unlink(metaPath).catch(() => {})]);
        return fail(res, 400, 'Le fichier reçu est incomplet. Réessayez.');
      }

      const month = new Date().toISOString().slice(0, 7); // AAAA-MM
      const finalDir = path.join(config.paths.uploads, month);
      await fs.mkdir(finalDir, { recursive: true });
      const fileName = `${generateId()}.${ext}`;
      await fs.rename(partPath, path.join(finalDir, fileName));
      await fs.unlink(metaPath).catch(() => {});

      logger.info('Fichier importé', { userId: req.user.id, file: fileName, size, kind });
      res.status(201).json({
        success: true,
        url: `/uploads/${month}/${fileName}`,
        name,
        size,
        kind,
      });
    } catch (e) {
      logger.error('Import fichier', { error: e.message });
      fail(res, 500, "Erreur lors de l'import du fichier.");
    }
  });
});

// Indique au navigateur la taille des morceaux et les formats acceptés
router.get('/config', requireAuth, (req, res) => {
  const kinds = {};
  for (const [k, v] of Object.entries(KINDS)) kinds[k] = { maxSize: v.maxSize, exts: v.exts };
  res.json({ success: true, chunkSize: CHUNK_SIZE, kinds, accept: ACCEPT });
});

module.exports = router;
