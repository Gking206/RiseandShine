'use strict';

// Vérifie la configuration SMTP en envoyant un e-mail de test.
// Usage : npm run mail:test -- destinataire@exemple.com

const config = require('../config/appConfig');
const mailService = require('../services/mailService');

async function main() {
  const to = process.argv[2] || config.mail.supportEmail;
  if (!mailService.isConfigured()) {
    console.error('❌ SMTP non configuré : renseignez SMTP_HOST, SMTP_USER et SMTP_PASSWORD dans .env.');
    process.exit(1);
  }
  const ok = await mailService.send({
    to,
    subject: 'Test e-mail — Plateforme Rise And Shine',
    text: "Si vous lisez ce message, l'envoi d'e-mails de la plateforme fonctionne.",
    html: "<p>Si vous lisez ce message, l'envoi d'e-mails de la plateforme <strong>Rise And Shine</strong> fonctionne.</p>",
  });
  console.log(ok ? `✅ E-mail de test envoyé à ${to}` : '❌ Échec de l\'envoi (voir le dossier logs/).');
  process.exit(ok ? 0 : 1);
}

main();
