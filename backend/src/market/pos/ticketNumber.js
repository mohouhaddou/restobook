'use strict';

const crypto = require('crypto');

/**
 * Génère un identifiant de ticket court : PXXXXXXXXXXXX (13 caractères).
 * Doit tenir à la fois dans orders.pickup_code (VARCHAR(16)) et
 * hanout_orders.order_number (VARCHAR(32)) — pas de préfixe de date ici,
 * le filtrage par jour se fait via created_at.
 */
function generateTicketNumber() {
  const rand = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `P${rand}`;
}

module.exports = { generateTicketNumber };
