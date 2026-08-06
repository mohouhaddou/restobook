'use strict';

const crypto = require('crypto');
const { PaymentProvider } = require('./PaymentProvider');

/**
 * Fournisseur de paiement simulé — aucun appel réseau, aucune passerelle réelle. Complète
 * immédiatement (status 'completed' dès createOrder, jamais d'étape d'approbation) : c'est le
 * comportement déjà utilisé par l'achat "Simuler l'achat" des produits numériques Kids, préservé
 * ici à l'identique après généralisation de l'interface.
 */
class SimulatedPaymentProvider extends PaymentProvider {
  async createOrder({ amount, currency }) {
    const providerOrderId = `SIM-${crypto.randomUUID()}`;
    return { providerOrderId, status: 'completed', amount, currency };
  }

  async captureOrder(providerOrderId) {
    return { status: 'completed', providerCaptureId: providerOrderId };
  }

  async refund() {
    return { status: 'completed' };
  }
}

module.exports = { SimulatedPaymentProvider };
