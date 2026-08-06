'use strict';

/**
 * Service POS — dispatch moteur (resto/hanout), ventes, stock, crédit, sessions de caisse.
 *
 * Une vente POS n'est PAS une 3ème table de commandes : c'est une ligne
 * Order (moteur resto, catalogue MenuItem) ou HanoutOrder (moteur hanout,
 * catalogue HanoutProduct) taguée source='POS', choisie automatiquement
 * selon business.module. La Pharmacie est explicitement hors-scope (elle a
 * déjà son propre flux de vente) et rejetée en amont.
 */

const { Op } = require('sequelize');
const {
  sequelize, Business, Organization,
  Order, OrderItem, MenuItem,
  HanoutOrder, HanoutOrderItem, HanoutProduct,
  CashRegisterSession, HanoutCreditCustomer,
  User, LoyaltyPoints, CashbackAccount, CashbackTransaction,
} = require('../../../models');
const { hasPermission, PERMISSIONS } = require('../../../auth/permissions');
const { recomputeLedger, logCreditAudit } = require('../hanout/creditLedger');
const { creditOrderPoints } = require('../marketplace/loyaltyService');
const { creditOrderCashback } = require('../loyalty/cashbackEarnService');
const { reverseOrderLoyalty } = require('../loyalty/reversalService');
const { resolveLoyaltyRule } = require('../loyalty/ruleEngine');
const { computeEligibleAmount } = require('../loyalty/eligibility');
const { generateTicketNumber } = require('./ticketNumber');
const { normalizeBarcode } = require('../../shared/utils/barcode');
const { getTier } = require('../../shared/config/loyaltyTiers');
const NotificationService = require('../../shared/notifications/NotificationService');

class PosError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/* ══════════════════════════════════════════════════════════════════════════
   DISPATCH MOTEUR
══════════════════════════════════════════════════════════════════════════ */

async function resolvePosEngine(req) {
  const orgId = req.user.organization_id;
  const business = await Business.findOne({ where: { organization_id: orgId } });

  if (business?.module === 'pharmacie') {
    throw new PosError('PHARMACY_NOT_SUPPORTED', 403);
  }
  if (!business) throw new PosError('NO_BUSINESS_PROFILE', 400);

  const isHanout = business.module === 'hanout' || (!business.module && req.org?.type === 'hanout');

  if (isHanout) {
    return {
      engine: 'hanout',
      business,
      OrderModel: HanoutOrder,
      ItemModel: HanoutOrderItem,
      CatalogModel: HanoutProduct,
      totalField: 'total',
    };
  }
  return {
    engine: 'resto',
    business,
    OrderModel: Order,
    ItemModel: OrderItem,
    CatalogModel: MenuItem,
    totalField: 'total_amount',
  };
}

function catalogInfo(engine, row) {
  return engine === 'hanout'
    ? { id: row.id, name: row.name, price: Number(row.price || 0), unit: row.unit || 'pièce' }
    : { id: row.id, name: row.libelle, price: Number(row.prix || 0), unit: null };
}

function ticketFieldsFor(engine, order) {
  return engine === 'hanout'
    ? { ticket_number: order.order_number, total_amount: Number(order.total) }
    : { ticket_number: order.pickup_code, total_amount: Number(order.total_amount) };
}

/* ══════════════════════════════════════════════════════════════════════════
   SESSIONS DE CAISSE
══════════════════════════════════════════════════════════════════════════ */

async function getOpenSession(businessId) {
  return CashRegisterSession.findOne({ where: { business_id: businessId, status: 'OPEN' } });
}

async function requireOpenSession(req, business) {
  const session = await getOpenSession(business.id);
  if (session) return session;
  const org = req.org || await Organization.findByPk(req.user.organization_id);
  if (org?.settings?.pos_allow_sale_without_session) return null;
  throw new PosError('NO_OPEN_SESSION');
}

async function openSession(req, { opening_amount }) {
  const { business } = await resolvePosEngine(req);
  const existing = await getOpenSession(business.id);
  if (existing) throw new PosError('SESSION_ALREADY_OPEN');

  return CashRegisterSession.create({
    organization_id: req.user.organization_id,
    business_id: business.id,
    cashier_id: req.user.id,
    opening_amount: opening_amount || 0,
    status: 'OPEN',
    opened_at: new Date(),
  });
}

async function closeSession(req, { counted_cash, notes }) {
  const { business } = await resolvePosEngine(req);
  const session = await getOpenSession(business.id);
  if (!session) throw new PosError('NO_OPEN_SESSION');

  const canCloseAny = hasPermission(req.user.role, PERMISSIONS.POS_SESSION_CLOSE_ANY);
  if (session.cashier_id !== req.user.id && !canCloseAny) {
    throw new PosError('FORBIDDEN_SESSION_CLOSE', 403);
  }

  const expected = Number(session.opening_amount) + Number(session.total_cash);
  const counted = Number(counted_cash);
  const diff = Number((counted - expected).toFixed(2));

  session.status = 'CLOSED';
  session.closing_amount = counted;
  session.counted_cash = counted;
  session.expected_cash = expected;
  session.cash_difference = diff;
  session.closed_at = new Date();
  if (notes) session.notes = notes;
  await session.save();

  if (Math.abs(diff) > 50) {
    NotificationService.create({
      type: 'SYSTEM',
      organization_id: req.user.organization_id,
      recipient_id: null,
      title: '⚠️ Écart de caisse détecté',
      message: `Écart de ${diff.toFixed(2)} MAD à la fermeture de la caisse (session #${session.id}).`,
      entity_type: 'SYSTEM',
      entity_id: session.id,
      priority: 'high',
      data: { session_id: session.id, cash_difference: diff },
    }).catch(() => {});
  }

  return session;
}

async function getCurrentSession(req) {
  const { business } = await resolvePosEngine(req);
  return getOpenSession(business.id);
}

/* ══════════════════════════════════════════════════════════════════════════
   CATALOGUE / CLIENTS (lecture seule, pour la grille de vente)
══════════════════════════════════════════════════════════════════════════ */

async function listCatalog(req, { q } = {}) {
  const { engine, CatalogModel } = await resolvePosEngine(req);
  const orgId = req.user.organization_id;

  const where = { organization_id: orgId };
  if (engine === 'hanout') where.available = true; else where.actif = true;
  if (q) {
    const like = `%${q}%`;
    where[engine === 'hanout' ? 'name' : 'libelle'] = { [Op.like]: like };
  }

  const CategoryModel = engine === 'hanout' ? require('../../../models').HanoutCategory : require('../../../models').MenuCategory;
  const rows = await CatalogModel.findAll({
    where,
    include: [{ model: CategoryModel, as: 'category', required: false }],
    order: [['category_id', 'ASC']],
  });

  const products = rows.map(row => {
    const info = catalogInfo(engine, row);
    return {
      id: info.id, name: info.name, price: info.price, unit: info.unit, sku: row.sku || null, barcode: row.barcode || null,
      track_stock: !!row.track_stock, stock_quantity: row.stock_quantity,
      category_id: row.category_id || null,
      category_name: row.category?.name || null,
      image_url: row.image_url || (Array.isArray(row.images) ? row.images[0] : null) || null,
    };
  });

  const categoryMap = new Map();
  for (const p of products) {
    const key = p.category_id || 0;
    if (!categoryMap.has(key)) categoryMap.set(key, { id: key, name: p.category_name || 'Sans catégorie' });
  }

  return { engine, products, categories: Array.from(categoryMap.values()) };
}

/**
 * Recherche un produit du business par code-barres, pour le scan POS.
 * N'a de sens que pour le moteur hanout : MenuItem (resto, plats/menus) n'a
 * volontairement pas de champ barcode — retourne null proprement dans ce cas.
 */
async function findBusinessProductByBarcode(req, barcode) {
  const { engine, CatalogModel } = await resolvePosEngine(req);
  if (engine !== 'hanout') return null;

  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  const orgId = req.user.organization_id;
  const row = await CatalogModel.findOne({ where: { organization_id: orgId, barcode: normalized } });
  if (!row) return null;

  const info = catalogInfo(engine, row);
  return {
    id: info.id, name: info.name, price: info.price, unit: info.unit,
    track_stock: !!row.track_stock, stock_quantity: row.stock_quantity,
    barcode: row.barcode,
  };
}

async function getBusinessInfo(req) {
  const { business } = await resolvePosEngine(req);
  return {
    name: business.name, logo: business.logo || null,
    address: business.address || null, phone: business.phone || null,
  };
}

async function searchCustomers(req, { q } = {}) {
  const orgId = req.user.organization_id;
  const where = { organization_id: orgId, active: true };
  if (q) {
    const like = `%${q}%`;
    where[Op.or] = [{ name: { [Op.like]: like } }, { phone: { [Op.like]: like } }];
  }
  const customers = await HanoutCreditCustomer.findAll({ where, order: [['name', 'ASC']], limit: 20 });
  return { customers };
}

/* ══════════════════════════════════════════════════════════════════════════
   CARTE IFILINO — identification client marketplace + cashback en caisse
   Distincte de HanoutCreditCustomer (client crédit hanout) : c'est un
   compte User (rôle "customer") qui a commandé sur la marketplace et
   possède un QR de carte (voir IfilinoCard.jsx, valeur `IFILINO-{user.id}`).
══════════════════════════════════════════════════════════════════════════ */

async function lookupCard(req, cardCode) {
  const match = /^IFILINO-(\d+)$/.exec(String(cardCode || '').trim());
  if (!match) throw new PosError('INVALID_CARD_CODE');

  const userId = Number(match[1]);
  const user = await User.findOne({
    where: { id: userId, role: 'customer' },
    attributes: ['id', 'nom', 'avatar_url', 'loyalty_points'],
  });
  if (!user) throw new PosError('CUSTOMER_NOT_FOUND', 404);

  const [totalEarned, cashbackAccount] = await Promise.all([
    LoyaltyPoints.sum('total_earned', { where: { user_id: userId } }),
    CashbackAccount.findOne({ where: { user_id: userId } }),
  ]);

  return {
    user: { id: user.id, nom: user.nom, avatar_url: user.avatar_url },
    tier: getTier(totalEarned || 0),
    loyalty_points: user.loyalty_points || 0,
    cashback_balance: Number(cashbackAccount?.balance || 0),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   VENTE POS
══════════════════════════════════════════════════════════════════════════ */

async function createPosSale(req, payload) {
  const ctx = await resolvePosEngine(req);
  const { engine, business, OrderModel, ItemModel, CatalogModel } = ctx;
  const orgId = req.user.organization_id;
  const session = await requireOpenSession(req, business);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new PosError('EMPTY_CART');

  const paymentMethod = String(payload.payment_method || 'cash').toLowerCase();
  if (!['cash', 'card', 'credit', 'online'].includes(paymentMethod)) {
    throw new PosError('INVALID_PAYMENT_METHOD');
  }

  const ids = [...new Set(items.map(i => Number(i.catalog_item_id)))];
  const catalogRows = await CatalogModel.findAll({ where: { id: ids, organization_id: orgId } });
  if (catalogRows.length !== ids.length) throw new PosError('ITEM_NOT_FOUND');
  const catalogMap = new Map(catalogRows.map(row => [row.id, row]));

  let customer = null;
  if (payload.customer_id) {
    customer = await HanoutCreditCustomer.findOne({ where: { id: payload.customer_id, organization_id: orgId } });
    if (!customer) throw new PosError('CUSTOMER_NOT_FOUND');
  }
  if (paymentMethod === 'credit' && !customer) throw new PosError('CUSTOMER_REQUIRED_FOR_CREDIT');

  // Client carte iFilino (marketplace) — distinct de HanoutCreditCustomer ci-dessus.
  const cardUserId = payload.customer_user_id ? Number(payload.customer_user_id) : null;
  if (cardUserId) {
    const cardUser = await User.findOne({ where: { id: cardUserId, role: 'customer' } });
    if (!cardUser) throw new PosError('CARD_CUSTOMER_NOT_FOUND');
  }
  const requestedCashback = Number(payload.cashback_used || 0);
  if (requestedCashback > 0 && !cardUserId) throw new PosError('CARD_REQUIRED_FOR_CASHBACK');

  const lines = items.map(i => {
    const row = catalogMap.get(Number(i.catalog_item_id));
    const info = catalogInfo(engine, row);
    const quantity = Math.max(1, Number(i.quantity || 1));
    const discountPercent = Math.min(100, Math.max(0, Number(i.discount_percent || 0)));
    const lineTotal = Number((info.price * quantity * (1 - discountPercent / 100)).toFixed(2));
    return { row, info, quantity, discountPercent, unitPrice: info.price, lineTotal };
  });

  const subtotal = Number(lines.reduce((s, l) => s + l.lineTotal, 0).toFixed(2));
  const manualDiscount = Number(payload.discount_amount || 0);
  // Le cashback utilisé est plafonné au sous-total restant après la remise manuelle —
  // le montant réellement débité (vérifié contre le solde réel) est recalculé dans la transaction.
  const cashbackUsedCap = Math.max(0, Number((subtotal - manualDiscount).toFixed(2)));
  const cashbackRequested = Math.min(requestedCashback, cashbackUsedCap);
  let discountAmount = Number((manualDiscount + cashbackRequested).toFixed(2));
  const taxAmount = 0; // v1 : pas de config TVA par produit — voir organization.settings.pos_tax_rate (fast-follow)
  let total = Math.max(0, Number((subtotal - discountAmount + taxAmount).toFixed(2)));

  const t = await sequelize.transaction();
  try {
    // Stock : vérifier puis décrémenter (transactionnel, bloque avant tout commit si insuffisant)
    for (const line of lines) {
      if (line.row.track_stock && Number(line.row.stock_quantity || 0) < line.quantity) {
        throw new PosError('INSUFFICIENT_STOCK');
      }
    }
    for (const line of lines) {
      if (line.row.track_stock) {
        await CatalogModel.decrement('stock_quantity', { by: line.quantity, where: { id: line.row.id }, transaction: t });
      }
    }

    // Cashback carte iFilino : relecture verrouillée pour empêcher un double-débit concurrent.
    let cashbackAccount = null;
    let cashbackUsed = 0;
    if (cardUserId && cashbackRequested > 0) {
      cashbackAccount = await CashbackAccount.findOne({
        where: { user_id: cardUserId }, transaction: t, lock: t.LOCK.UPDATE,
      });
      const available = Number(cashbackAccount?.balance || 0);
      if (available <= 0) throw new PosError('INSUFFICIENT_CASHBACK');
      cashbackUsed = Math.min(cashbackRequested, available);
      if (cashbackUsed !== cashbackRequested) {
        discountAmount = Number((manualDiscount + cashbackUsed).toFixed(2));
        total = Math.max(0, Number((subtotal - discountAmount + taxAmount).toFixed(2)));
      }
    }

    const ticketNumber = generateTicketNumber();
    const paymentStatus = paymentMethod === 'credit' ? 'pending' : 'paid';

    let order;
    if (engine === 'hanout') {
      order = await OrderModel.create({
        organization_id: orgId,
        order_number: ticketNumber,
        customer_name: customer?.name || 'Client comptoir',
        customer_phone: customer?.phone || '-',
        user_id: cardUserId || null,
        delivery_type: 'in_store',
        subtotal, total, tax_amount: taxAmount,
        status: 'delivered',
        source: 'POS',
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        cashier_id: req.user.id,
        cash_register_session_id: session?.id || null,
        notes: payload.notes || null,
        items_snapshot: lines.map(l => ({ name: l.info.name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal })),
      }, { transaction: t });

      for (const line of lines) {
        await ItemModel.create({
          order_id: order.id, product_id: line.row.id,
          product_name: line.info.name, product_price: line.unitPrice,
          unit: line.info.unit, quantity: line.quantity, line_total: line.lineTotal,
        }, { transaction: t });
      }
    } else {
      order = await OrderModel.create({
        organization_id: orgId,
        user_id: cardUserId || null,
        type: 'in_store',
        order_source: 'STAFF',
        source: 'POS',
        status: 'delivered',
        total_amount: total,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        cashier_id: req.user.id,
        cash_register_session_id: session?.id || null,
        pickup_code: ticketNumber,
        guest_name: customer?.name || null,
        guest_phone: customer?.phone || null,
        notes: payload.notes || null,
      }, { transaction: t });

      for (const line of lines) {
        await ItemModel.create({
          order_id: order.id, menu_item_id: line.row.id,
          quantity: line.quantity, unit_price: line.unitPrice, notes: null,
        }, { transaction: t });
      }
    }

    if (paymentMethod === 'credit') {
      await applyCreditSale(t, {
        orgId, customerId: customer.id, amount: total, cashierId: req.user.id,
        ticketNumber, posOrderId: order.id, posOrderType: engine === 'hanout' ? 'hanout_order' : 'order',
      });
    }

    const posOrderType = engine === 'hanout' ? 'hanout_order' : 'order';

    let cashbackNewBalance = null;
    if (cashbackAccount && cashbackUsed > 0) {
      cashbackNewBalance = Number((Number(cashbackAccount.balance) - cashbackUsed).toFixed(2));
      await cashbackAccount.update({
        balance: cashbackNewBalance,
        total_used: Number((Number(cashbackAccount.total_used) + cashbackUsed).toFixed(2)),
      }, { transaction: t });
      await CashbackTransaction.create({
        user_id: cardUserId, organization_id: orgId,
        order_id: order.id, pos_order_type: posOrderType,
        type: 'use', amount: cashbackUsed, balance_after: cashbackNewBalance,
        description: `Utilisé en caisse — ticket ${ticketNumber}`,
      }, { transaction: t });
    }

    if (session) {
      const inc = { sales_count: 1 };
      if (paymentMethod === 'cash') inc.total_cash = total;
      else if (paymentMethod === 'card') inc.total_card = total;
      else if (paymentMethod === 'credit') inc.total_credit = total;
      await CashRegisterSession.increment(inc, { where: { id: session.id }, transaction: t });
    }

    // Fidélité — points + cashback gagnés, vente en caisse déjà "delivered" à
    // la création, créditée immédiatement si une carte iFilino a été scannée.
    // pos_order_type désambiguïse order.id entre les deux moteurs (orders.id
    // et hanout_orders.id sont deux séquences AUTO_INCREMENT indépendantes).
    let pointsEarned = null;
    let cashbackEarned = null;
    if (cardUserId) {
      const rule = await resolveLoyaltyRule(orgId);
      const eligibleAmount = computeEligibleAmount(
        lines.map(l => ({ product_id: l.row.id, category_id: l.row.category_id ?? null, line_total: l.lineTotal })),
        rule, total
      );
      pointsEarned = await creditOrderPoints(cardUserId, orgId, order.id, eligibleAmount, posOrderType, t);
      cashbackEarned = await creditOrderCashback(cardUserId, orgId, order.id, posOrderType, eligibleAmount, t);
    }

    await t.commit();

    const fields = ticketFieldsFor(engine, order);
    return {
      sale_id: order.id, engine, ticket_number: fields.ticket_number,
      total_amount: fields.total_amount, payment_method: paymentMethod, payment_status: paymentStatus,
      items: lines.map(l => ({ name: l.info.name, quantity: l.quantity, unit_price: l.unitPrice, line_total: l.lineTotal })),
      cashback_used: cashbackUsed, cashback_new_balance: cashbackNewBalance,
      points_earned: pointsEarned?.points || 0,
      cashback_earned: cashbackEarned?.cashback || 0,
    };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function applyCreditSale(t, { orgId, customerId, amount, cashierId, ticketNumber, posOrderId, posOrderType }) {
  const { HanoutCredit } = require('../../../models');
  const credit = await HanoutCredit.create({
    organization_id: orgId, customer_id: customerId,
    amount, products: `Vente POS #${ticketNumber}`,
    date: today(), created_by: cashierId,
    pos_order_id: posOrderId, pos_order_type: posOrderType,
  }, { transaction: t });

  await recomputeLedger(customerId, orgId, t);
  await logCreditAudit({ organization_id: orgId, user_id: cashierId, action: 'credit_created', entity_id: credit.id, details: { amount, source: 'POS', pos_order_id: posOrderId } });
  return credit;
}

/* ══════════════════════════════════════════════════════════════════════════
   HISTORIQUE / REMBOURSEMENT / RAPPORT
══════════════════════════════════════════════════════════════════════════ */

async function listPosSales(req, { date, cashier_id, payment_method, page = 1, limit = 50 }) {
  const { engine, OrderModel } = await resolvePosEngine(req);
  const orgId = req.user.organization_id;
  const where = { organization_id: orgId, source: 'POS' };
  if (cashier_id) where.cashier_id = cashier_id;
  if (payment_method) where.payment_method = String(payment_method).toLowerCase();
  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    where.created_at = { [Op.between]: [start, end] };
  }

  const p = Math.max(1, Number(page));
  const l = Math.min(200, Number(limit));
  const { count, rows } = await OrderModel.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit: l, offset: (p - 1) * l,
  });

  const sales = rows.map(order => {
    const fields = ticketFieldsFor(engine, order);
    return {
      id: order.id, engine, ticket_number: fields.ticket_number, total_amount: fields.total_amount,
      payment_method: order.payment_method, payment_status: order.payment_status,
      status: order.status, cashier_id: order.cashier_id, created_at: order.createdAt,
    };
  });

  return { total: count, page: p, pages: Math.ceil(count / l) || 1, sales };
}

async function getPosSale(req, saleId) {
  const { engine, OrderModel, ItemModel } = await resolvePosEngine(req);
  const orgId = req.user.organization_id;
  const itemInclude = engine === 'hanout'
    ? { model: ItemModel, as: 'items' } // HanoutOrderItem garde déjà un snapshot (product_name/product_price)
    : { model: ItemModel, as: 'items', include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle'] }] };

  const order = await OrderModel.findOne({
    where: { id: saleId, organization_id: orgId, source: 'POS' },
    include: [itemInclude],
  });
  if (!order) throw new PosError('SALE_NOT_FOUND', 404);
  const fields = ticketFieldsFor(engine, order);
  return { sale: order, engine, ticket: fields };
}

async function refundPosSale(req, saleId, reason) {
  const { engine, OrderModel, ItemModel, CatalogModel } = await resolvePosEngine(req);
  const orgId = req.user.organization_id;
  const catalogIdField = engine === 'hanout' ? 'product_id' : 'menu_item_id';

  const order = await OrderModel.findOne({ where: { id: saleId, organization_id: orgId, source: 'POS' } });
  if (!order) throw new PosError('SALE_NOT_FOUND', 404);
  if (order.status === 'cancelled') throw new PosError('ALREADY_REFUNDED');

  const t = await sequelize.transaction();
  try {
    const items = await ItemModel.findAll({ where: { order_id: order.id }, transaction: t });
    for (const item of items) {
      const catalogId = item[catalogIdField];
      if (catalogId) {
        await CatalogModel.increment('stock_quantity', { by: item.quantity, where: { id: catalogId, track_stock: true }, transaction: t });
      }
    }

    order.status = 'cancelled';
    order.payment_status = 'refunded';
    if (reason) order.notes = `${order.notes ? order.notes + ' | ' : ''}Remboursement : ${reason}`;
    await order.save({ transaction: t });

    if (order.payment_method === 'credit') {
      const { HanoutCredit } = require('../../../models');
      const credit = await HanoutCredit.findOne({
        where: { pos_order_id: order.id, pos_order_type: engine === 'hanout' ? 'hanout_order' : 'order' },
        transaction: t,
      });
      if (credit) {
        const customerId = credit.customer_id;
        await credit.destroy({ transaction: t });
        await recomputeLedger(customerId, orgId, t);
        await logCreditAudit({ organization_id: orgId, user_id: req.user.id, action: 'credit_deleted', entity_id: credit.id, details: { reason: 'pos_refund', pos_order_id: order.id } });
      }
    }

    // Fidélité — annule les points/cashback gagnés sur cette vente et restitue
    // le cashback qui y aurait été dépensé (carte iFilino scannée en caisse).
    await reverseOrderLoyalty(
      order.id, orgId, engine === 'hanout' ? 'hanout_order' : 'order',
      { reason: reason || 'pos_refund', actorUserId: req.user.id }, t
    );

    await t.commit();
    return { ok: true };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function dailyReport(req, dateStr) {
  const { engine, OrderModel, totalField } = await resolvePosEngine(req);
  const orgId = req.user.organization_id;
  const date = dateStr || today();
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);

  const sales = await OrderModel.findAll({
    where: { organization_id: orgId, source: 'POS', created_at: { [Op.between]: [start, end] } },
  });

  const totals = { cash: 0, card: 0, credit: 0, count: sales.length, revenue: 0 };
  const byCashier = {};
  for (const s of sales) {
    const amt = Number(s[totalField] || 0);
    totals.revenue += amt;
    const pm = String(s.payment_method || 'cash').toLowerCase();
    if (totals[pm] !== undefined) totals[pm] += amt;
    const cid = s.cashier_id || 0;
    byCashier[cid] = (byCashier[cid] || 0) + amt;
  }
  Object.keys(totals).forEach(k => { if (typeof totals[k] === 'number') totals[k] = Number(totals[k].toFixed(2)); });

  return {
    date, engine, totals,
    by_cashier: Object.entries(byCashier).map(([cashier_id, revenue]) => ({ cashier_id: Number(cashier_id), revenue: Number(revenue.toFixed(2)) })),
  };
}

module.exports = {
  PosError,
  resolvePosEngine,
  getOpenSession,
  requireOpenSession,
  openSession,
  closeSession,
  getCurrentSession,
  listCatalog,
  searchCustomers,
  lookupCard,
  findBusinessProductByBarcode,
  getBusinessInfo,
  createPosSale,
  listPosSales,
  getPosSale,
  refundPosSale,
  dailyReport,
};
