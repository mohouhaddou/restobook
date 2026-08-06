'use strict';

/**
 * EmailService — abstraction pour l'envoi d'emails Ifilino.
 *
 * Mode DEV  : les emails sont loggés dans la console (pas d'envoi réel).
 * Mode PROD : configurer SMTP_HOST, SMTP_USER, SMTP_PASS dans .env et décommenter nodemailer.
 *
 * SMTP recommandé : Hostinger Business Email (smtp.hostinger.com:587)
 * Canaux alternatifs : Brevo, SendGrid, Mailgun, AWS SES.
 */

const isDev = process.env.NODE_ENV !== 'production';
const { APP_NAME } = require('../../../config/branding');

const APP_URL        = process.env.APP_URL        || 'https://ifilino.com';
const SUPPORT_EMAIL  = process.env.SUPPORT_EMAIL  || 'contact@ifilino.com';
const NOREPLY_EMAIL  = process.env.NOREPLY_EMAIL  || 'noreply@ifilino.com';
const FROM_LABEL     = `${APP_NAME} <${NOREPLY_EMAIL}>`;
const YEAR           = new Date().getFullYear();

// ── Email footer HTML réutilisable ────────────────────────────────────────────
function htmlFooter() {
  return `
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:28px 0 16px">
  <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.6">
    © ${YEAR} ${APP_NAME} · <a href="${APP_URL}" style="color:#FF8A00;text-decoration:none">ifilino.com</a>
    · Des questions ? <a href="mailto:${SUPPORT_EMAIL}" style="color:#FF8A00;text-decoration:none">${SUPPORT_EMAIL}</a>
  </p>`;
}

// ── Wrapper email HTML ────────────────────────────────────────────────────────
function htmlWrap(content) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F9FAFB;font-family:'Inter',sans-serif">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07)">
  <div style="background:linear-gradient(135deg,#FF8A00,#FF3B30);padding:24px 32px">
    <span style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px">${APP_NAME}</span>
  </div>
  <div style="padding:32px">${content}</div>
  ${htmlFooter()}
</div></body></html>`;
}

// ── Helper log dev ─────────────────────────────────────────────────────────────
function logDev(subject, to, preview) {
  if (isDev) {
    console.log(`\n📧 [EmailService DEV]\n  To: ${to}\n  From: ${FROM_LABEL}\n  Subject: ${subject}\n  Preview: ${String(preview).slice(0,120)}\n`);
  }
}

// ── Envoi réel (nodemailer — décommenter en prod) ──────────────────────────────
async function sendMail({ to, subject, text, html }) {
  logDev(subject, to, text || '');
  if (!isDev) {
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    //   port: Number(process.env.SMTP_PORT) || 587,
    //   secure: process.env.SMTP_SECURE === 'true',
    //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // });
    // await transporter.sendMail({ from: FROM_LABEL, to, subject, text, html });
  }
}

// ── API publique ───────────────────────────────────────────────────────────────

async function send({ to, subject, text, html }) {
  await sendMail({ to, subject, text, html });
}

async function sendVerificationEmail(user, opts = {}) {
  const token = user.email_verification_token || 'DEMO_TOKEN';
  const verifyUrl = `${APP_URL}/restobook/api/auth/verify-email?token=${token}`;
  const subject = opts.pro
    ? `[${APP_NAME}] Confirmez votre adresse email professionnelle`
    : `[${APP_NAME}] Confirmez votre compte`;

  const content = opts.pro
    ? `<h2 style="color:#111827;margin:0 0 12px">Bienvenue ${user.nom || ''} 👋</h2>
       <p style="color:#6B7280;font-size:14px;line-height:1.6">Merci de créer votre espace professionnel <strong>${opts.orgName || ''}</strong> sur ${APP_NAME}.</p>
       <p style="color:#6B7280;font-size:14px">Cliquez pour confirmer votre email :</p>
       <a href="${verifyUrl}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:linear-gradient(135deg,#FF8A00,#FF3B30);color:#fff;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Confirmer mon email →</a>
       <p style="color:#9CA3AF;font-size:12px">Ce lien expire dans 24h.</p>`
    : `<h2 style="color:#111827;margin:0 0 12px">Bienvenue sur ${APP_NAME} 🎉</h2>
       <p style="color:#6B7280;font-size:14px;line-height:1.6">Merci de nous rejoindre ! Confirmez votre adresse email pour activer votre compte.</p>
       <a href="${verifyUrl}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:linear-gradient(135deg,#FF8A00,#FF3B30);color:#fff;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Confirmer mon compte →</a>
       <p style="color:#9CA3AF;font-size:12px">Ce lien expire dans 24h. Si vous n'avez pas créé ce compte, ignorez cet email.</p>`;

  await sendMail({ to: user.email, subject, html: htmlWrap(content), text: `Confirmez votre compte : ${verifyUrl}` });
}

async function sendOrderConfirmation(order, email) {
  if (!email) return;
  const subject = `[${APP_NAME}] Commande #${order.pickup_code} confirmée ✅`;
  const content = `
    <h2 style="color:#111827;margin:0 0 12px">Commande confirmée !</h2>
    <div style="background:#F0FDF4;border-radius:8px;padding:16px;border:1px solid #BBF7D0;margin:0 0 16px">
      <p style="margin:0;font-size:22px;font-weight:800;color:#15803D;letter-spacing:2px">${order.pickup_code}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#16A34A;font-weight:600">Code de retrait</p>
    </div>
    <p style="color:#6B7280;font-size:14px">Montant total : <strong style="color:#111827">${Number(order.total_amount).toFixed(2)} MAD</strong></p>`;
  await sendMail({ to: email, subject, html: htmlWrap(content), text: `Commande #${order.pickup_code} confirmée — ${Number(order.total_amount).toFixed(2)} MAD` });
}

async function sendOrderStatusUpdate(order, status, email) {
  if (!email) return;
  const subject = `[${APP_NAME}] Commande #${order.pickup_code} — ${status}`;
  const content = `
    <h2 style="color:#111827;margin:0 0 12px">Mise à jour de votre commande</h2>
    <p style="color:#6B7280;font-size:14px">Votre commande <strong>#${order.pickup_code}</strong> est maintenant : <strong style="color:#FF8A00">${status}</strong></p>`;
  await sendMail({ to: email, subject, html: htmlWrap(content), text: `Commande #${order.pickup_code} : ${status}` });
}

async function sendProRegistrationPending({ to, name, org_name, module: mod }) {
  if (!to) return;
  const subject = `[${APP_NAME}] Votre demande d'inscription est en cours de traitement`;
  const content = `
    <div style="font-size:40px;margin-bottom:16px">📋</div>
    <h2 style="color:#111827;margin:0 0 12px">Demande reçue, ${name} !</h2>
    <p style="color:#6B7280;font-size:14px;line-height:1.6">
      Votre demande de création d'espace professionnel pour <strong>${org_name}</strong>
      (module <strong>${mod}</strong>) a bien été reçue.
    </p>
    <div style="background:#FFF7ED;border-radius:8px;padding:16px;border:1px solid #FED7AA;margin:16px 0">
      <p style="margin:0;font-size:13px;color:#92400E;font-weight:600">⏱ Validation sous 24 heures ouvrées</p>
    </div>
    <p style="color:#6B7280;font-size:13px">Vous recevrez un email dès que votre espace sera activé.</p>`;
  await sendMail({ to, subject, html: htmlWrap(content), text: `Inscription pro reçue pour ${org_name}. Validation sous 24h.` });
}

async function sendCourierWelcome({ to, name }) {
  if (!to) return;
  const subject = `[${APP_NAME}] Bienvenue dans le réseau de livreurs ${APP_NAME} 🛵`;
  const content = `
    <div style="font-size:40px;margin-bottom:16px">🛵</div>
    <h2 style="color:#111827;margin:0 0 12px">Bienvenue ${name} !</h2>
    <p style="color:#6B7280;font-size:14px;line-height:1.6">
      Votre compte livreur ${APP_NAME} a été créé. Connectez-vous dès maintenant pour compléter
      votre profil et téléverser vos documents (permis, carte grise, assurance).
    </p>
    <div style="background:#FFF7ED;border-radius:8px;padding:16px;border:1px solid #FED7AA;margin:16px 0">
      <p style="margin:0;font-size:13px;color:#92400E;font-weight:600">📄 Vos documents doivent être vérifiés avant de recevoir vos premières livraisons</p>
    </div>
    <p style="color:#6B7280;font-size:13px">À très vite sur les routes !</p>`;
  await sendMail({ to, subject, html: htmlWrap(content), text: `Bienvenue ${name} ! Connectez-vous pour compléter votre profil livreur.` });
}

module.exports = {
  send,
  sendVerificationEmail,
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendProRegistrationPending,
  sendCourierWelcome,
  // Emails disponibles
  SUPPORT_EMAIL,
  NOREPLY_EMAIL,
  APP_URL,
};
