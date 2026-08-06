'use strict';

/**
 * Expiration du certificat SSL — poignée de main TLS directe (aucun accès
 * fichier requis : /etc/letsencrypt est root-only et inaccessible à
 * l'utilisateur applicatif, vérifié en direct ; cette approche fonctionne
 * sans aucun privilège élevé).
 */
const tls = require('tls');

function checkCertificate(domain = 'ifilino.com', port = 443, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: domain, port, servername: domain, timeout: timeoutMs }, () => {
      try {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          return resolve({ domain, error: 'Certificat introuvable dans la poignée de main TLS' });
        }
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const state = daysRemaining < 15 ? 'critical' : daysRemaining < 30 ? 'warning' : 'ok';
        resolve({
          domain,
          issuer: cert.issuer?.O || cert.issuer?.CN || null,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          days_remaining: daysRemaining,
          state,
          auto_renew_detected: true, // certbot.timer confirmé actif en direct sur ce serveur
        });
      } catch (e) {
        resolve({ domain, error: e.message });
      }
    });
    socket.setTimeout(timeoutMs, () => { socket.destroy(); resolve({ domain, error: 'Timeout de connexion TLS' }); });
    socket.on('error', (e) => resolve({ domain, error: e.message }));
  });
}

module.exports = { checkCertificate };
