'use strict';

const { PaymentProvider } = require('./PaymentProvider');

const SANDBOX_BASE = 'https://sandbox-api.paddle.com';
const PRODUCTION_BASE = 'https://api.paddle.com';

/**
 * Fournisseur Paddle (Paddle Billing) — appels REST directs à l'API Transactions (fetch natif
 * Node, même choix que PayPalProvider.js : pas de SDK npm officiel embarqué pour une intégration
 * aussi ciblée, cohérence avec le reste du module plutôt qu'une dépendance de plus).
 *
 * Authentification : un unique jeton API (Bearer), généré depuis le tableau de bord Paddle — pas
 * d'échange OAuth2 comme PayPal, Paddle n'en a pas besoin.
 *
 * Flux à deux temps comme PayPal : createOrder() crée une Transaction côté Paddle (status
 * 'created') avec un prix ad-hoc (non catalogué) correspondant au produit vendu ; c'est Paddle.js
 * côté client (PaddleButton.jsx) qui ouvre l'overlay de paiement pour cette transaction. Paddle ne
 * capture pas en deux temps comme PayPal (pas d'étape "capture" séparée) : la transaction devient
 * 'completed' dès que l'utilisateur paie dans l'overlay. captureOrder() ici sert donc de
 * VÉRIFICATION serveur — on relit la transaction chez Paddle et on ne considère l'achat payé que
 * si Paddle lui-même confirme status==='completed', jamais sur la seule foi du callback client.
 *
 * Remarque : le schéma exact de l'API Transactions de Paddle Billing peut évoluer côté Paddle —
 * à revalider avec un compte sandbox réel (voir vérification faite pour PayPal dans ce module).
 */
class PaddleProvider extends PaymentProvider {
  constructor(config) {
    super();
    this.apiKey = config?.config?.api_key;
    this.clientToken = config?.config?.client_token;
    this.mode = config?.mode === 'production' ? 'production' : 'sandbox';
    this.baseUrl = this.mode === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
    if (!this.apiKey) {
      throw new Error('Paddle non configuré (API Key manquante)');
    }
  }

  async _request(method, path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.error?.detail || data.error?.code || res.statusText;
      throw new Error(`Paddle API error (${res.status}): ${detail}`);
    }
    return data;
  }

  async createOrder({ amount, currency, description, metadata }) {
    const data = await this._request('POST', '/transactions', {
      items: [{
        price: {
          description: description ? String(description).slice(0, 200) : 'Achat iFilino',
          unit_price: { amount: String(Math.round(Number(amount) * 100)), currency_code: currency },
        },
        quantity: 1,
      }],
      custom_data: metadata || undefined,
    });
    return { providerOrderId: data.data?.id, status: 'created' };
  }

  async captureOrder(providerOrderId) {
    const data = await this._request('GET', `/transactions/${providerOrderId}`);
    const completed = data.data?.status === 'completed';
    return { status: completed ? 'completed' : 'failed', providerCaptureId: data.data?.id, raw: data };
  }

  // Remboursement total via l'API Adjustments — même limitation que PayPalProvider.js (pas de
  // remboursement partiel demandé pour l'instant).
  async refund(providerCaptureId) {
    const data = await this._request('POST', '/adjustments', {
      action: 'refund',
      transaction_id: providerCaptureId,
      reason: 'Remboursement demandé',
    });
    const status = data.data?.status;
    return { status: (status === 'approved' || status === 'pending_approval') ? 'completed' : 'failed' };
  }
}

module.exports = { PaddleProvider };
