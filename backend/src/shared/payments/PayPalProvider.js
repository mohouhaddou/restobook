'use strict';

const { PaymentProvider } = require('./PaymentProvider');

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const PRODUCTION_BASE = 'https://api-m.paypal.com';

// Cache du jeton OAuth2 au niveau module (pas par instance) — un jeton PayPal vit ~9h, le
// régénérer à chaque appel serait un aller-retour réseau inutile par achat. Clé = client_id+mode,
// pour ne jamais mélanger un jeton sandbox avec des identifiants production.
const tokenCache = new Map(); // key -> { accessToken, expiresAt }

/**
 * Fournisseur PayPal — appels REST directs à l'API v2 Orders (fetch natif Node, déjà utilisé
 * partout ailleurs dans ce projet). Pas de SDK npm : les SDK serveur officiels PayPal
 * (@paypal/checkout-server-sdk) sont dépréciés/en transition vers un nouveau SDK au moment de
 * l'écriture — appeler l'API REST directement évite ce risque de dépendance instable pour une
 * intégration aussi simple (3 endpoints).
 *
 * Flux à deux temps (contrairement à SimulatedPaymentProvider) : createOrder() ne fait que créer
 * la commande côté PayPal (status 'created') — c'est le SDK JS côté client (PayPalButton.jsx) qui
 * fait approuver l'utilisateur, puis le backend appelle captureOrder() pour finaliser. Le paiement
 * n'est JAMAIS considéré confirmé avant que captureOrder() renvoie 'completed'.
 */
class PayPalProvider extends PaymentProvider {
  constructor(config) {
    super();
    this.clientId = config?.config?.client_id;
    this.clientSecret = config?.config?.client_secret;
    this.mode = config?.mode === 'production' ? 'production' : 'sandbox';
    this.baseUrl = this.mode === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal non configuré (Client ID / Secret manquants)');
    }
  }

  async _getAccessToken() {
    const cacheKey = `${this.clientId}:${this.mode}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`PayPal auth error: ${data.error_description || res.statusText}`);

    // Marge de sécurité de 60s avant l'expiration réelle — jamais utiliser un jeton sur le point
    // d'expirer pour une requête qui pourrait arriver juste après.
    tokenCache.set(cacheKey, { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 });
    return data.access_token;
  }

  async _request(method, path, body) {
    const token = await this._getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.details?.[0]?.description || data.message || res.statusText;
      throw new Error(`PayPal API error (${res.status}): ${detail}`);
    }
    return data;
  }

  async createOrder({ amount, currency, description, metadata }) {
    const data = await this._request('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: currency, value: Number(amount).toFixed(2) },
        description: description ? String(description).slice(0, 127) : undefined,
        custom_id: metadata ? JSON.stringify(metadata).slice(0, 127) : undefined,
      }],
    });
    return { providerOrderId: data.id, status: 'created' };
  }

  async captureOrder(providerOrderId) {
    const data = await this._request('POST', `/v2/checkout/orders/${providerOrderId}/capture`, {});
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const completed = data.status === 'COMPLETED' && capture?.status === 'COMPLETED';
    return { status: completed ? 'completed' : 'failed', providerCaptureId: capture?.id, raw: data };
  }

  // Remboursement total uniquement pour l'instant (aucun flux de remboursement partiel demandé) —
  // un remboursement partiel nécessiterait de connaître la devise d'origine, non disponible ici
  // sans étendre la signature de l'interface pour un besoin qui n'existe pas encore.
  async refund(providerCaptureId) {
    const data = await this._request('POST', `/v2/payments/captures/${providerCaptureId}/refund`, {});
    return { status: data.status === 'COMPLETED' ? 'completed' : 'failed' };
  }
}

module.exports = { PayPalProvider };
