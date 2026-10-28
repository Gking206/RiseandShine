'use strict';

// Envoi d'e-mails via SMTP (boîte mail Hostinger, Gmail avec mot de passe
// d'application, etc.). Configuré par les variables SMTP_* du fichier .env.

const nodemailer = require('nodemailer');
const config = require('../config/appConfig');
const logger = require('../utils/logger');

let transporter = null;

function isConfigured() {
  const m = config.mail;
  return !!(m.host && m.user && m.password);
}

function getTransporter() {
  if (!transporter) {
    const m = config.mail;
    transporter = nodemailer.createTransport({
      host: m.host,
      port: m.port,
      secure: m.secure,
      auth: { user: m.user, pass: m.password },
      // Sans ces délais, un serveur SMTP injoignable bloque l'envoi jusqu'à
      // 2 minutes (valeur par défaut de nodemailer).
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f2ee;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eadfd3;">
    <div style="background:linear-gradient(135deg,#F4B63F,#E2541B);padding:20px 24px;color:#ffffff;">
      <div style="font-size:18px;font-weight:bold;letter-spacing:1px;">RISE AND SHINE</div>
      <div style="font-size:13px;opacity:0.9;">${escapeHtml(title)}</div>
    </div>
    <div style="padding:24px;font-size:15px;line-height:1.6;">${bodyHtml}</div>
    <div style="padding:16px 24px;background:#faf7f3;font-size:12px;color:#8a7f74;text-align:center;">
      « Lève-toi, sois éclairée, car ta lumière arrive » — Ésaïe 60:1
    </div>
  </div>
</body></html>`;
}

// Envoie un e-mail. Retourne true si envoyé, false si SMTP non configuré ou en échec.
async function send({ to, subject, html, text, replyTo }) {
  if (!isConfigured()) {
    logger.warn('E-mail non envoyé : SMTP non configuré', { to, subject });
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: `"Rise And Shine" <${config.mail.from}>`,
      to,
      subject,
      html,
      text,
      replyTo,
    });
    logger.info('E-mail envoyé', { to, subject });
    return true;
  } catch (err) {
    logger.error('Échec envoi e-mail', { to, subject, error: err.message });
    return false;
  }
}

async function sendRegistrationConfirmation(user) {
  const loginUrl = config.mail.appUrl ? `${config.mail.appUrl.replace(/\/$/, '')}/login.html` : '';
  const html = layout('Confirmation de création de compte', `
    <p>Bonjour <strong>${escapeHtml(user.nom)}</strong>,</p>
    <p>Votre compte sur la plateforme <strong>Rise And Shine</strong> a bien été créé. Bienvenue dans la famille !</p>
    <p style="background:#faf7f3;border-left:4px solid #F4B63F;padding:12px 16px;border-radius:6px;">
      Identifiant de connexion : <strong>${escapeHtml(user.email)}</strong>
    </p>
    ${loginUrl ? `<p style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(loginUrl)}" style="background:#E2541B;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;">Se connecter</a>
    </p>` : ''}
    <p>Si vous n'êtes pas à l'origine de cette inscription, répondez simplement à cet e-mail.</p>
    <p>Que Dieu vous bénisse,<br>L'équipe Rise And Shine</p>
  `);
  const text = `Bonjour ${user.nom},\n\nVotre compte Rise And Shine a bien été créé.\nIdentifiant : ${user.email}\n${loginUrl ? `Connexion : ${loginUrl}\n` : ''}\nQue Dieu vous bénisse,\nL'équipe Rise And Shine`;
  return send({ to: user.email, subject: 'Bienvenue sur Rise And Shine — Compte créé', html, text });
}

async function sendSupportRequest(user, sujet, message) {
  const html = layout("Nouvelle demande d'assistance", `
    <p><strong>De :</strong> ${escapeHtml(user.nom)} &lt;${escapeHtml(user.email)}&gt;</p>
    ${user.telephone ? `<p><strong>Téléphone :</strong> ${escapeHtml(user.telephone)}</p>` : ''}
    <p><strong>Sujet :</strong> ${escapeHtml(sujet)}</p>
    <div style="background:#faf7f3;border-radius:6px;padding:12px 16px;white-space:pre-wrap;">${escapeHtml(message)}</div>
    <p style="font-size:13px;color:#8a7f74;">Répondez directement à cet e-mail pour contacter le membre.</p>
  `);
  const text = `Demande d'assistance de ${user.nom} <${user.email}>\nTéléphone : ${user.telephone || '-'}\nSujet : ${sujet}\n\n${message}`;
  return send({
    to: config.mail.supportEmail,
    subject: `[Assistance RAS] ${sujet}`,
    html,
    text,
    replyTo: user.email,
  });
}

module.exports = { isConfigured, send, sendRegistrationConfirmation, sendSupportRequest };
