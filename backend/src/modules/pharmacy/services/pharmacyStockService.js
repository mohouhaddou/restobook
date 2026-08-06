'use strict';

/**
 * Stock pharmacie — extrait de pharmacy/proRoutes.js (où ces deux fonctions
 * étaient définies en interne, non exportées) pour être réutilisable par la
 * nouvelle route de commande client (publicRoutes.js POST /:slug/orders) en
 * plus du POS existant (proRoutes.js POST /sales). Extraction verbatim —
 * aucun changement de comportement pour les appelants existants.
 *
 * Le stock pharmacie n'est PAS un compteur décrémentable naïvement :
 * PharmacyMedicine.stock_quantity est recalculé depuis la somme des lots
 * actifs (PharmacyMedicineLot), consommés en FEFO (péremption la plus
 * proche d'abord).
 */

const { Op } = require('sequelize');
const { PharmacyMedicine, PharmacyMedicineLot } = require('../../../../models');

// Recalcule le stock global d'un médicament depuis ses lots actifs
async function recomputeMedicineStock(medicineId, t) {
  const total = await PharmacyMedicineLot.sum('quantity_remaining', {
    where: { medicine_id: medicineId, status: 'active' }, transaction: t,
  });
  await PharmacyMedicine.update({ stock_quantity: Number(total || 0) }, { where: { id: medicineId }, transaction: t });
}

// Consomme les lots d'un médicament en FEFO (péremption la plus proche d'abord)
async function consumeFefo(medicineId, organizationId, quantity, t) {
  const lots = await PharmacyMedicineLot.findAll({
    where: { medicine_id: medicineId, organization_id: organizationId, status: 'active', quantity_remaining: { [Op.gt]: 0 } },
    order: [['expiry_date', 'ASC'], ['id', 'ASC']], transaction: t, lock: t.LOCK.UPDATE,
  });
  let remaining = quantity;
  const consumed = []; // [{ lot_id, quantity }]
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.quantity_remaining);
    const newRemaining = lot.quantity_remaining - take;
    await lot.update({ quantity_remaining: newRemaining, status: newRemaining === 0 ? 'depleted' : 'active' }, { transaction: t });
    consumed.push({ lot_id: lot.id, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) return null; // stock insuffisant
  await recomputeMedicineStock(medicineId, t);
  return consumed;
}

// Restaure des lots précédemment consommés par consumeFefo (annulation de
// commande) — inverse exact : réincrémente quantity_remaining, repasse le
// lot en 'active' s'il était 'depleted', puis recalcule le stock global.
// N'existait pas avant cette fonctionnalité — le POS n'a jamais eu besoin
// d'annuler une vente déjà encaissée.
async function restoreConsumedLots(medicineId, consumedLots, t) {
  for (const { lot_id, quantity } of consumedLots || []) {
    const lot = await PharmacyMedicineLot.findByPk(lot_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!lot) continue; // lot supprimé entretemps — rien à restaurer
    const newRemaining = Number(lot.quantity_remaining) + Number(quantity);
    await lot.update({
      quantity_remaining: newRemaining,
      status: lot.status === 'depleted' ? 'active' : lot.status,
    }, { transaction: t });
  }
  await recomputeMedicineStock(medicineId, t);
}

module.exports = { recomputeMedicineStock, consumeFefo, restoreConsumedLots };
