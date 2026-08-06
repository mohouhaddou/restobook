'use strict';

/**
 * Combine l'état catalogue (admin) + la possession (achat) + l'état de génération en un seul
 * état effectif, calculé par visiteur — jamais stocké. Reproduit exactement le tableau de la
 * demande (section "États d'un produit") :
 *
 *   coming_soon                         -> "Bientôt disponible"
 *   ready_to_generate, non acheté       -> "Acheter"
 *   available, non acheté               -> "Acheter"
 *   acheté, fichier en cours            -> "Préparation..."
 *   acheté, fichier prêt                -> "Télécharger"
 *   acheté, génération échouée          -> message d'erreur (jamais un spinner infini)
 *   disabled                            -> "Bientôt disponible" (désactivé)
 *
 * @param {{ product: object, purchase?: object|null, generatedFile?: object|null }} params
 * @returns {{ state: string, purchased: boolean, downloadReady: boolean }}
 */
function computeEffectiveState({ product, purchase, generatedFile }) {
  const purchased = !!purchase && purchase.purchase_status === 'completed';

  if (product.status === 'disabled') return { state: 'disabled', purchased: false, downloadReady: false };
  if (product.status === 'coming_soon') return { state: 'coming_soon', purchased: false, downloadReady: false };

  if (purchased && generatedFile?.status === 'ready') {
    return { state: 'available', purchased: true, downloadReady: true };
  }
  if (purchased && (generatedFile?.status === 'generating' || generatedFile?.status === 'pending')) {
    return { state: 'generating', purchased: true, downloadReady: false };
  }
  if (purchased && generatedFile?.status === 'failed') {
    // Distinct de 'generating' : jamais de spinner infini côté frontend. Se relance de lui-même
    // au prochain appel qui invoque ensureGeneratedFile (nouvel achat, admin "regenerate").
    return { state: 'failed', purchased: true, downloadReady: false };
  }

  // ready_to_generate ou available, jamais acheté : le bouton propose l'achat.
  return { state: product.status, purchased: false, downloadReady: false };
}

module.exports = { computeEffectiveState };
