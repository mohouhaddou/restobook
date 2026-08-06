'use strict';

/**
 * Logique métier des listes de courses — extraite de shoppingListRoutes.js
 * pour rester pure (pas de req/res), testable et réutilisable (ex. par le
 * futur job de notifications). Toute la catégorisation automatique doit
 * passer par categorizeItem() ici, jamais dupliquée côté frontend.
 */

const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, ShoppingList, ShoppingListItem, Organization, HanoutProduct,
} = require('../../../models');
const { ITEM_CATEGORIES, CATEGORY_ORDER } = require('./shoppingCategoryConfig');
const productSearchService = require('../marketplace/productSearchService');
const { checkAndAwardBadges } = require('../marketplace/loyaltyService');

// ── Catégorisation automatique (mots-clés sur le nom de l'article) ─────────
function categorizeItem(name) {
  const n = (name || '').toLowerCase();
  for (const key of CATEGORY_ORDER) {
    const cfg = ITEM_CATEGORIES[key];
    if (cfg.keywords.some(k => n.includes(k))) return key;
  }
  return 'autre';
}

// ── Complète une liste (idempotent) et déclenche la gamification associée.
// Pose completed_at AVANT d'appeler checkAndAwardBadges (garde d'idempotence :
// un appel concurrent voit déjà completed_at non-null et ne recrédite rien).
async function maybeCompleteList(list) {
  if (list.completed_at) return { justCompleted: false, newBadges: [] };
  const items = await ShoppingListItem.findAll({ where: { list_id: list.id } });
  if (!items.length || items.some(i => !i.checked)) return { justCompleted: false, newBadges: [] };

  list.completed_at = new Date();
  await list.save();
  const newBadges = await checkAndAwardBadges(list.user_id, null);
  return { justCompleted: true, newBadges };
}

// ── Achats habituels (hanout uniquement — seul module avec un historique de
// commande en ligne exploitable ; pharmacie n'a pas de checkout réel, resto
// est hors périmètre Phase 1 car OrderItem ne garde pas de nom-snapshot).
async function getUsualPurchases(userId, limit = 20) {
  const rows = await sequelize.query(`
    SELECT hoi.product_id, MAX(hoi.product_name) AS product_name, MAX(hoi.unit) AS unit,
           COUNT(*) AS times_bought, MAX(ho.created_at) AS last_bought_at
    FROM hanout_order_items hoi
    JOIN hanout_orders ho ON ho.id = hoi.order_id
    WHERE ho.user_id = ? AND ho.status != 'cancelled' AND hoi.product_id IS NOT NULL
    GROUP BY hoi.product_id
    ORDER BY times_bought DESC, last_bought_at DESC
    LIMIT ?
  `, { replacements: [userId, limit], type: QueryTypes.SELECT });

  if (!rows.length) return [];

  const productIds = rows.map(r => r.product_id);
  const products = await HanoutProduct.findAll({
    where: { id: { [Op.in]: productIds } },
    include: [{ model: Organization, as: 'organization', attributes: ['id', 'slug', 'name', 'logo_url'] }],
  });
  const byId = new Map(products.map(p => [p.id, p]));

  return rows.map(r => {
    const p = byId.get(r.product_id);
    return {
      product_id: r.product_id,
      name: p ? p.name : r.product_name, // repli sur le snapshot si produit supprimé
      unit: p ? p.unit : r.unit,
      price: p ? Number(p.price) : null,
      image_url: p?.images?.[0] || null,
      available: p ? !!p.available : false,
      organization: p?.organization ? { id: p.organization.id, slug: p.organization.slug, name: p.organization.name, logo_url: p.organization.logo_url } : null,
      times_bought: Number(r.times_bought),
      last_bought_at: r.last_bought_at,
    };
  });
}

// ── Meilleur commerce unique pour couvrir une liste ─────────────────────────
// Algorithme volontairement simple et explicable : priorité lexicographique
// (couverture > prix total > proximité/livraison). La pharmacie est exclue du
// score (pas de vrai checkout iFilino) mais listée à part pour transparence.
async function computeBestStore(items, { userLat = null, userLng = null } = {}) {
  // Un item sans source_module (ajout manuel/préset, jamais recherché dans la
  // marketplace) reste candidat — on le cherche par nom comme les autres.
  // Seul source_module==='resto' exclut explicitement (plat resto, jamais en
  // vente chez un hanout/pharmacie).
  const candidates = items.filter(i => !i.checked && i.source_module !== 'resto');
  const pharmacyItems = candidates.filter(i => i.source_module === 'pharmacie');
  const hanoutItems = candidates.filter(i => i.source_module !== 'pharmacie');

  if (!hanoutItems.length) {
    return {
      recommended: null,
      missing_items: hanoutItems.map(i => ({ id: i.id, name: i.name })),
      excluded_pharmacy_items: pharmacyItems.map(i => ({ id: i.id, name: i.name })),
      potential_savings_if_split: 0,
    };
  }

  // Coverage map : org_id -> { business, matched: Map(item_id -> {price, product_id}) }
  const coverage = new Map();

  for (const item of hanoutItems) {
    const { hanout } = await productSearchService.searchProducts({
      q: item.name, userLat, userLng, modules: ['hanout'], limit: 30,
    });
    if (!hanout.length) continue;
    for (const p of hanout) {
      const orgId = p.business?.id;
      if (!orgId) continue;
      if (!coverage.has(orgId)) coverage.set(orgId, { business: p.business, matched: new Map(), distance_km: p.distance_km, eta_range: p.eta_range });
      const entry = coverage.get(orgId);
      const existing = entry.matched.get(item.id);
      if (!existing || p.price < existing.price) {
        entry.matched.set(item.id, { price: p.price, product_id: p.id });
      }
    }
  }

  if (!coverage.size) {
    return {
      recommended: null,
      missing_items: hanoutItems.map(i => ({ id: i.id, name: i.name })),
      excluded_pharmacy_items: pharmacyItems.map(i => ({ id: i.id, name: i.name })),
      potential_savings_if_split: 0,
    };
  }

  const scored = [...coverage.entries()].map(([orgId, entry]) => {
    const coverageCount = entry.matched.size;
    const totalPrice = [...entry.matched.values()].reduce((s, m) => s + Number(m.price), 0);
    const distance = entry.distance_km ?? 15;
    const score = coverageCount * 1_000_000 - totalPrice - distance * 5;
    return { orgId, entry, coverageCount, totalPrice, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const orgRow = await Organization.findByPk(best.orgId, { attributes: ['delivery_fee'] });
  const deliveryFee = Number(orgRow?.delivery_fee || 0);

  const matchedItemIds = new Set(best.entry.matched.keys());
  const missingFromBest = hanoutItems.filter(i => !matchedItemIds.has(i.id)).map(i => ({ id: i.id, name: i.name }));

  // "Économies potentielles" — texte informatif seul, jamais un flux de
  // découpage/checkout multi-commerces réel (décision verrouillée).
  const cheapestPerItem = new Map();
  for (const entry of coverage.values()) {
    for (const [itemId, m] of entry.matched) {
      const cur = cheapestPerItem.get(itemId);
      if (!cur || m.price < cur) cheapestPerItem.set(itemId, m.price);
    }
  }
  const cheapestTotal = [...matchedItemIds].reduce((s, id) => s + (cheapestPerItem.get(id) || 0), 0);
  const potentialSavings = Math.max(0, Math.round((best.totalPrice - cheapestTotal) * 100) / 100);

  return {
    recommended: {
      organization_id: best.orgId,
      business_name: best.entry.business?.name,
      slug: best.entry.business?.slug,
      coverage_count: best.coverageCount,
      total_items: hanoutItems.length,
      total_price: Math.round(best.totalPrice * 100) / 100,
      distance_km: best.entry.distance_km,
      delivery_fee: deliveryFee,
      eta_range: best.entry.eta_range,
      matched_items: [...best.entry.matched.entries()].map(([itemId, m]) => ({ item_id: itemId, product_id: m.product_id, price: m.price })),
    },
    missing_items: missingFromBest,
    excluded_pharmacy_items: pharmacyItems.map(i => ({ id: i.id, name: i.name })),
    potential_savings_if_split: potentialSavings,
  };
}

// ── Génération d'une liste à partir d'un préset curé (transaction atomique).
async function materializePreset(userId, presetKey, opts = {}) {
  const { PRESETS } = require('./shoppingListPresets');
  const preset = PRESETS[presetKey];
  if (!preset) { const e = new Error('Préset introuvable'); e.status = 404; throw e; }

  return sequelize.transaction(async (t) => {
    const list = await ShoppingList.create({
      user_id: userId, name: opts.name || preset.name, icon: preset.icon || '🛒', preset_key: presetKey,
    }, { transaction: t });

    const items = [];
    for (const it of preset.items) {
      const category = it.category || categorizeItem(it.name);
      // Best-effort : tente d'attacher un prix/image réel via le catalogue
      // interne (appel en-process, jamais de self-HTTP) — silencieux en cas d'échec.
      let estimated_price = null, image_url = null;
      try {
        const { hanout } = await productSearchService.searchProducts({ q: it.name, modules: ['hanout'], limit: 3 });
        if (hanout.length) { estimated_price = hanout[0].price; image_url = hanout[0].images?.[0] || null; }
      } catch (_) { /* meilleur effort seulement */ }

      items.push(await ShoppingListItem.create({
        list_id: list.id, name: it.name, quantity: it.quantity || null,
        quantity_value: it.quantity_value || null, quantity_unit: it.quantity_unit || null,
        category, estimated_price,
        image_url,
      }, { transaction: t }));
    }
    return { ...list.toJSON(), items: items.map(i => i.toJSON()) };
  });
}

module.exports = {
  categorizeItem,
  maybeCompleteList,
  getUsualPurchases,
  computeBestStore,
  materializePreset,
};
