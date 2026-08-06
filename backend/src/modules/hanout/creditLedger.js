'use strict';

/**
 * Grand-livre crédit clients (hanout) — extrait de creditRoutes.js pour être
 * réutilisable par le module POS (une vente à crédit POS crée un HanoutCredit
 * exactement comme le ferait un ajout manuel).
 */

const { HanoutCreditCustomer, HanoutCredit, HanoutCreditPayment, HanoutCreditAuditLog } = require('../../../models');

/* ── Recalcule le grand-livre d'un client (allocation FIFO des paiements) ── */
async function recomputeLedger(customerId, organizationId, t) {
  const credits  = await HanoutCredit.findAll({ where: { customer_id: customerId, organization_id: organizationId }, order: [['date', 'ASC'], ['id', 'ASC']], transaction: t });
  const payments = await HanoutCreditPayment.findAll({ where: { customer_id: customerId, organization_id: organizationId }, order: [['date', 'ASC'], ['id', 'ASC']], transaction: t });

  let pool = payments.reduce((s, p) => s + Number(p.amount), 0);
  for (const credit of credits) {
    const amt = Number(credit.amount);
    let paid = 0;
    if (pool >= amt)      { paid = amt; pool -= amt; }
    else if (pool > 0)    { paid = pool; pool = 0; }
    const status = paid >= amt ? 'paid' : (paid > 0 ? 'partial' : 'pending');
    if (Number(credit.paid_amount) !== paid || credit.status !== status) {
      await credit.update({ paid_amount: paid, status }, { transaction: t });
    }
  }

  const totalCredits  = credits.reduce((s, c) => s + Number(c.amount), 0);
  const totalPayments = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number((totalCredits - totalPayments).toFixed(2));
  const lastPurchase = credits.length  ? credits[credits.length - 1].date   : null;
  const lastPayment  = payments.length ? payments[payments.length - 1].date : null;

  await HanoutCreditCustomer.update(
    { balance, last_purchase_at: lastPurchase, last_payment_at: lastPayment },
    { where: { id: customerId }, transaction: t }
  );
}

async function logCreditAudit({ organization_id, user_id, user_name, action, entity_id, details }) {
  try {
    await HanoutCreditAuditLog.create({
      organization_id, user_id, user_name: user_name || null,
      action, entity_id, details: details || null,
    });
  } catch { /* l'audit ne doit jamais faire échouer l'opération principale */ }
}

module.exports = { recomputeLedger, logCreditAudit };
