'use strict';

/**
 * Contrat commun à tout fournisseur de paiement — le seul point d'accès légitime pour tout code
 * métier de l'application. Personne ne doit jamais appeler un SDK/API de paiement directement ;
 * toujours passer par `registry.getProvider(key)` et cette interface.
 *
 * ── Pour ajouter un futur provider (Stripe, Google Pay, Apple Pay...) ────────────────────────
 * 1. Créer une classe qui étend PaymentProvider et implémente les 3 méthodes ci-dessous.
 * 2. L'ajouter à la map PROVIDERS dans registry.js (une seule ligne).
 * 3. Ajouter un row en base (table payment_providers, voir migrate_payment_providers.js) avec le
 *    `provider` correspondant et sa config JSON propre (jamais dans le code/l'env).
 * Aucun autre fichier de l'application ne doit changer — ni les routes, ni PurchaseModal.jsx.
 *
 * @typedef {{ providerOrderId: string, status: 'created'|'completed', approvalUrl?: string }} OrderResult
 * @typedef {{ status: 'completed'|'failed', providerCaptureId?: string, raw?: object }} CaptureResult
 */
class PaymentProvider {
  /**
   * Crée une commande de paiement. Pour un provider synchrone (Simulated), peut renvoyer
   * directement status:'completed'. Pour un provider à approbation utilisateur (PayPal), renvoie
   * status:'created' — la capture se fait ensuite via captureOrder() après approbation côté client.
   * @param {{ amount: number, currency: string, description?: string, metadata?: object }} params
   * @returns {Promise<OrderResult>}
   */
  async createOrder(_params) { throw new Error('PaymentProvider.createOrder() not implemented'); }

  /**
   * Capture un paiement déjà approuvé — SEULE source de vérité pour marquer un achat payé. Jamais
   * fait confiance à une confirmation venant du client.
   * @param {string} providerOrderId
   * @returns {Promise<CaptureResult>}
   */
  async captureOrder(_providerOrderId) { throw new Error('PaymentProvider.captureOrder() not implemented'); }

  /**
   * @param {string} providerCaptureId
   * @param {number} [amount] — partiel si fourni, total sinon
   * @returns {Promise<{ status: string }>}
   */
  async refund(_providerCaptureId, _amount) { throw new Error('PaymentProvider.refund() not implemented'); }
}

module.exports = { PaymentProvider };
