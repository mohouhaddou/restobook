'use strict';

// Recalcule le grand-livre crédit d'un client pharmacie (allocation FIFO des
// paiements sur les crédits les plus anciens). Appelé après toute création/
// suppression de crédit ou de paiement pour éviter toute dérive de solde.
async function recomputeLedger(models, customerId, organizationId, t) {
  const { PharmacyCredit, PharmacyCreditPayment, PharmacyCustomer } = models;

  const credits  = await PharmacyCredit.findAll({ where: { customer_id: customerId, organization_id: organizationId }, order: [['date', 'ASC'], ['id', 'ASC']], transaction: t });
  const payments = await PharmacyCreditPayment.findAll({ where: { customer_id: customerId, organization_id: organizationId }, order: [['date', 'ASC'], ['id', 'ASC']], transaction: t });

  let pool = payments.reduce((s, p) => s + Number(p.amount), 0);
  for (const credit of credits) {
    const amt = Number(credit.amount);
    let paid = 0;
    if (pool >= amt)   { paid = amt; pool -= amt; }
    else if (pool > 0) { paid = pool; pool = 0; }
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

  await PharmacyCustomer.update(
    { balance, last_purchase_at: lastPurchase, last_payment_at: lastPayment },
    { where: { id: customerId }, transaction: t }
  );

  return balance;
}

module.exports = { recomputeLedger };
