'use strict';

function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const val = req.body[field];
      if (rules.required && (val === undefined || val === null || val === '')) {
        errors.push(`Le champ "${field}" est requis`);
        continue;
      }
      if (val !== undefined && val !== null && val !== '') {
        if (rules.minLength && String(val).length < rules.minLength) {
          errors.push(`"${field}" doit contenir au moins ${rules.minLength} caractères`);
        }
        if (rules.maxLength && String(val).length > rules.maxLength) {
          errors.push(`"${field}" ne peut pas dépasser ${rules.maxLength} caractères`);
        }
        if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
          errors.push(`"${field}" doit être une adresse email valide`);
        }
        if (rules.numeric && isNaN(Number(val))) {
          errors.push(`"${field}" doit être un nombre`);
        }
        if (rules.min !== undefined && Number(val) < rules.min) {
          errors.push(`"${field}" doit être au minimum ${rules.min}`);
        }
        if (rules.max !== undefined && Number(val) > rules.max) {
          errors.push(`"${field}" doit être au maximum ${rules.max}`);
        }
        if (rules.enum && !rules.enum.includes(val)) {
          errors.push(`"${field}" doit être l'une des valeurs: ${rules.enum.join(', ')}`);
        }
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }
    next();
  };
}

const schemas = {
  register: {
    nom: { required: true, minLength: 2, maxLength: 100 },
    email: { required: true, email: true },
    password: { required: true, minLength: 6, maxLength: 100 },
    telephone: { required: true, minLength: 8, maxLength: 20 },
    sexe: { required: true, enum: ['homme', 'femme'] },
  },
  login: {
    email: { required: true, email: true },
    password: { required: true },
  },
  evangelism: {
    nom: { required: true, minLength: 2, maxLength: 100 },
    telephone: { required: false },
    localisation: { required: false },
  },
  finance: {
    type: { required: true, enum: ['don', 'offrande', 'depense', 'budget_evenement'] },
    montant: { required: true, numeric: true, min: 0 },
    description: { required: true, minLength: 3, maxLength: 500 },
  },
  event: {
    titre: { required: true, minLength: 3, maxLength: 200 },
    dateDebut: { required: true },
    categorie: { required: true, enum: ['interne', 'public', 'partenaire_externe'] },
  },
  testimony: {
    titre: { required: true, minLength: 3, maxLength: 200 },
    contenu: { required: true, minLength: 10, maxLength: 5000 },
  },
  support: {
    sujet: { required: true, minLength: 3, maxLength: 200 },
    message: { required: true, minLength: 10, maxLength: 5000 },
  },
  teaching: {
    titre: { required: true, minLength: 3, maxLength: 200 },
    type: { required: true, enum: ['pdf', 'video', 'audio', 'image', 'lien', 'texte'] },
    categorie: { required: true, enum: ['predication', 'etude_biblique', 'conference', 'culte', 'formation', 'autre'] },
  },
};

module.exports = { validateBody, schemas };
