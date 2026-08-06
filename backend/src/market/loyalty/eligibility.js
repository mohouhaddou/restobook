'use strict';

/**
 * Calcule le montant éligible aux points/cashback après exclusion des
 * produits/catégories configurés dans la règle résolue. `actualTotal` est le
 * montant réellement payé (après remise/cashback utilisé) — le résultat est
 * ce montant proratisé par la part des lignes éligibles dans le sous-total
 * complet, pour ne jamais faire gagner des points/cashback sur une remise.
 * Sans exclusion configurée, retourne `actualTotal` tel quel (comportement
 * inchangé). Fonction pure — chaque appelant construit sa propre liste de
 * lignes (POS a déjà `lines` avec le produit catalogue ; les hooks commande/
 * livraison chargent OrderItem+MenuItem pour obtenir product_id/category_id).
 */
function computeEligibleAmount(lineItems, rule, actualTotal) {
  const excludedProducts = new Set((rule.excluded_products || []).map(Number));
  const excludedCategories = new Set((rule.excluded_categories || []).map(Number));
  if (!excludedProducts.size && !excludedCategories.size) return Number(actualTotal);

  const fullSubtotal = lineItems.reduce((s, l) => s + Number(l.line_total), 0);
  if (fullSubtotal <= 0) return 0;

  const eligibleSubtotal = lineItems.reduce((s, l) => {
    if (excludedProducts.has(Number(l.product_id))) return s;
    if (l.category_id != null && excludedCategories.has(Number(l.category_id))) return s;
    return s + Number(l.line_total);
  }, 0);

  return Number((Number(actualTotal) * (eligibleSubtotal / fullSubtotal)).toFixed(2));
}

module.exports = { computeEligibleAmount };
