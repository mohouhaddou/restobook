'use strict';

/**
 * EmailService — abstraction pour l'envoi d'emails.
 *
 * Actuellement en mode "log" (développement).
 * Pour activer l'envoi réel, configurer nodemailer avec SMTP_HOST, SMTP_USER, SMTP_PASS dans .env
 * et remplacer les console.log par des appels nodemailer.transporter.sendMail().
 *
 * Canaux futurs : SendGrid, Mailgun, AWS SES, Brevo, etc.
 */

const isDev = process.env.NODE_ENV !== 'production';
const APP_URL = process.env.APP_URL || 'https://restobook.app';

// ── Helper log dev ────────────────────────────────────────────────────────────
function logDev(subject, to, body) {
  if (isDev) {
    console.log(`\n📧 [EmailService DEV] To: ${to} | Subject: ${subject}\n${body}\n`);
  }
}

// ── Confirmation email client ─────────────────────────────────────────────────
async function sendVerificationEmail(user, opts = {}) {
  const token = user.email_verification_token || 'DEMO_TOKEN';
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const subject = opts.pro
    ? `[RestoBook] Confirmez votre adresse email professionnelle`
    : `[RestoBook] Confirmez votre compte`;

  const body = opts.pro
    ? `Bonjour ${user.nom || ''},\n\nMerci de créer votre espace professionnel ${opts.orgName || ''} sur RestoBook.\n\nCliquez sur ce lien pour confirmer votre email :\n${verifyUrl}\n\nCe lien expire dans 24h.\n\n— L'équipe RestoBook`
    : `Bonjour ${user.nom || ''},\n\nMerci de rejoindre RestoBook !\n\nCliquez sur ce lien pour confirmer votre email :\n${verifyUrl}\n\nCe lien expire dans 24h.\n\n— L'équipe RestoBook`;

  logDev(subject, user.email, body);
  // TODO: remplacer par nodemailer.sendMail({ from, to, subject, text: body, html: toHtml(body) })
}

// ── Email générique ───────────────────────────────────────────────────────────
async function send({ to, subject, text, html }) {
  logDev(subject, to, text || html || '');
  // TODO: nodemailer
}

// ── Email récapitulatif commande ──────────────────────────────────────────────
async function sendOrderConfirmation(order, email) {
  if (!email) return;
  const subject = `[RestoBook] Commande #${order.pickup_code} confirmée`;
  const body = `Votre commande a bien été reçue !\nCode de retrait : ${order.pickup_code}\nMontant : ${Number(order.total_amount).toFixed(2)} MAD`;
  logDev(subject, email, body);
}

// ── Email statut commande ─────────────────────────────────────────────────────
async function sendOrderStatusUpdate(order, status, email) {
  if (!email) return;
  const subject = `[RestoBook] Commande #${order.pickup_code} — statut mis à jour`;
  const body = `Votre commande est maintenant : ${status}`;
  logDev(subject, email, body);
}

module.exports = { send, sendVerificationEmail, sendOrderConfirmation, sendOrderStatusUpdate };
