'use strict';

/**
 * Module Crédit Clients (الكريدي) — gestion des ventes à crédit des hanouts.
 * Toutes les routes sont montées sous /api/hanout-pro/credit
 */

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { body, query, param } = require('express-validator');
const { Op, fn, col } = require('sequelize');
const {
  sequelize, HanoutCreditCustomer, HanoutCredit, HanoutCreditPayment, HanoutCreditAuditLog,
} = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const { recomputeLedger, logCreditAudit } = require('./creditLedger');

const ah = fn_ => (req, res, next) => Promise.resolve(fn_(req, res, next)).catch(next);

router.use(requireAuth, requirePermission(PERMISSIONS.HANOUT_CREDIT_VIEW));

const orgId = req => req.user.organization_id;
const today = () => new Date().toISOString().slice(0, 10);

/* ── Upload photo (client / facture) ──────────────────────────────────────── */
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, `credit_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

router.post('/upload', requirePermission(PERMISSIONS.HANOUT_CREDIT_MANAGE), upload.single('image'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  res.json({ url: `/uploads/${req.file.filename}` });
}));

/* ── Statut client (score déterministe) ──────────────────────────────────── */
function computeStatus({ credit_limit, balance, overdueCount }) {
  const limit = Number(credit_limit) || 0;
  const bal   = Number(balance) || 0;
  const ratio = limit > 0 ? bal / limit : (bal > 0 ? 2 : 0);

  if (overdueCount >= 2 || ratio > 1)   return { color: 'red',    label: 'Risque élevé' };
  if (overdueCount === 1 || ratio > .7) return { color: 'orange', label: 'Payeur moyen' };
  if (bal > 0)                          return { color: 'green',  label: 'Bon payeur' };
  return { color: 'green', label: 'Excellent payeur' };
}

async function overdueCountMap(customerIds, t) {
  if (!customerIds.length) return {};
  const rows = await HanoutCredit.findAll({
    where: { customer_id: { [Op.in]: customerIds }, due_date: { [Op.lt]: today() }, status: { [Op.ne]: 'paid' } },
    attributes: ['customer_id', [fn('COUNT', col('id')), 'cnt']],
    group: ['customer_id'], raw: true, transaction: t,
  });
  return Object.fromEntries(rows.map(r => [Number(r.customer_id), Number(r.cnt)]));
}

async function logAudit(req, action, entity_id, details) {
  return logCreditAudit({
    organization_id: orgId(req), user_id: req.user.id, user_name: req.user.nom || null,
    action, entity_id, details,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   CLIENTS
══════════════════════════════════════════════════════════════════════════ */

// GET /customers — liste + recherche + filtre statut
router.get('/customers', [
  query('q').optional().trim().isLength({ max: 100 }),
  query('status').optional().isIn(['green', 'orange', 'red']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid, active: true };
  if (req.query.q) {
    const like = `%${req.query.q}%`;
    where[Op.or] = [{ name: { [Op.like]: like } }, { phone: { [Op.like]: like } }, { district: { [Op.like]: like } }, { address: { [Op.like]: like } }];
  }

  const rows = await HanoutCreditCustomer.findAll({ where, order: [['balance', 'DESC']] });
  const overdueMap = await overdueCountMap(rows.map(r => r.id));

  let customers = rows.map(c => {
    const overdue_count = overdueMap[c.id] || 0;
    const st = computeStatus({ credit_limit: c.credit_limit, balance: c.balance, overdueCount: overdue_count });
    return { ...c.toJSON(), overdue_count, status: st.color, status_label: st.label };
  });
  if (req.query.status) customers = customers.filter(c => c.status === req.query.status);

  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));
  const total = customers.length;
  customers = customers.slice((page - 1) * limit, (page - 1) * limit + limit);

  res.json({ total, page, pages: Math.ceil(total / limit) || 1, customers });
}));

// POST /customers — créer un client
router.post('/customers', requirePermission(PERMISSIONS.HANOUT_CREDIT_MANAGE), [
  body('name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('phone').trim().notEmpty().isLength({ max: 32 }).withMessage('Téléphone requis'),
  body('address').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('district').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('photo_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('credit_limit').optional().isFloat({ min: 0 }),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await HanoutCreditCustomer.create({
    organization_id: oid,
    name: req.body.name, phone: req.body.phone,
    address: req.body.address || null, district: req.body.district || null,
    photo_url: req.body.photo_url || null,
    credit_limit: req.body.credit_limit || 0,
    notes: req.body.notes || null,
  });
  await logAudit(req, 'customer_created', customer.id, { name: customer.name });
  res.status(201).json({ customer });
}));

// GET /customers/:id — fiche détaillée (infos + historique achats/paiements)
router.get('/customers/:id', [param('id').isInt()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await HanoutCreditCustomer.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });

  const [credits, payments] = await Promise.all([
    HanoutCredit.findAll({ where: { customer_id: customer.id }, order: [['date', 'DESC'], ['id', 'DESC']] }),
    HanoutCreditPayment.findAll({ where: { customer_id: customer.id }, order: [['date', 'DESC'], ['id', 'DESC']] }),
  ]);

  const overdue_count = await HanoutCredit.count({ where: { customer_id: customer.id, due_date: { [Op.lt]: today() }, status: { [Op.ne]: 'paid' } } });
  const st = computeStatus({ credit_limit: customer.credit_limit, balance: customer.balance, overdueCount: overdue_count });

  res.json({
    customer: { ...customer.toJSON(), overdue_count, status: st.color, status_label: st.label },
    credits, payments,
  });
}));

// PATCH /customers/:id
router.patch('/customers/:id', requirePermission(PERMISSIONS.HANOUT_CREDIT_MANAGE), [
  param('id').isInt(),
  body('name').optional().trim().isLength({ min: 2, max: 191 }),
  body('phone').optional().trim().isLength({ max: 32 }),
  body('address').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('district').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('photo_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('credit_limit').optional().isFloat({ min: 0 }),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await HanoutCreditCustomer.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });

  const fields = ['name', 'phone', 'address', 'district', 'photo_url', 'credit_limit', 'notes'];
  const changes = {};
  fields.forEach(f => { if (req.body[f] !== undefined) { customer[f] = req.body[f]; changes[f] = req.body[f]; } });
  await customer.save();
  await logAudit(req, 'customer_updated', customer.id, changes);
  res.json({ customer });
}));

// DELETE /customers/:id — refusé si solde non nul
router.delete('/customers/:id', requirePermission(PERMISSIONS.HANOUT_CREDIT_DELETE), ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await HanoutCreditCustomer.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });
  if (Number(customer.balance) !== 0) return res.status(400).json({ error: 'Impossible de supprimer un client avec un solde non nul' });

  await customer.destroy();
  await logAudit(req, 'customer_deleted', customer.id, { name: customer.name });
  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════════════
   CRÉDITS (ventes à crédit)
══════════════════════════════════════════════════════════════════════════ */

router.post('/credits', requirePermission(PERMISSIONS.HANOUT_CREDIT_MANAGE), [
  body('customer_id').isInt({ min: 1 }),
  body('amount').isFloat({ gt: 0 }),
  body('products').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('date').optional().isISO8601(),
  body('due_date').optional({ nullable: true }).isISO8601(),
  body('comment').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('invoice_photo_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await HanoutCreditCustomer.findOne({ where: { id: req.body.customer_id, organization_id: oid } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });

  const t = await sequelize.transaction();
  try {
    const credit = await HanoutCredit.create({
      organization_id: oid, customer_id: customer.id,
      amount: req.body.amount, products: req.body.products || null,
      date: req.body.date || today(),
      due_date: req.body.due_date || null,
      comment: req.body.comment || null,
      invoice_photo_url: req.body.invoice_photo_url || null,
      created_by: req.user.id,
    }, { transaction: t });

    await recomputeLedger(customer.id, oid, t);
    await t.commit();
    await logAudit(req, 'credit_created', credit.id, { amount: credit.amount, customer_id: customer.id });
    res.status(201).json({ credit });
  } catch (e) { await t.rollback(); throw e; }
}));

router.get('/credits', [
  query('customer_id').optional().isInt(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid };
  if (req.query.customer_id) where.customer_id = req.query.customer_id;
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date[Op.gte] = req.query.from;
    if (req.query.to)   where.date[Op.lte] = req.query.to;
  }
  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));
  const { count, rows } = await HanoutCredit.findAndCountAll({
    where,
    include: [{ model: HanoutCreditCustomer, as: 'customer', attributes: ['id', 'name', 'phone'] }],
    order: [['date', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count / limit) || 1, credits: rows });
}));

router.delete('/credits/:id', requirePermission(PERMISSIONS.HANOUT_CREDIT_DELETE), ah(async (req, res) => {
  const oid = orgId(req);
  const credit = await HanoutCredit.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!credit) return res.status(404).json({ error: 'Crédit introuvable' });
  const customerId = credit.customer_id;

  const t = await sequelize.transaction();
  try {
    await credit.destroy({ transaction: t });
    await recomputeLedger(customerId, oid, t);
    await t.commit();
    await logAudit(req, 'credit_deleted', credit.id, { amount: credit.amount, customer_id: customerId });
    res.json({ ok: true });
  } catch (e) { await t.rollback(); throw e; }
}));

/* ══════════════════════════════════════════════════════════════════════════
   ENCAISSEMENTS (paiements)
══════════════════════════════════════════════════════════════════════════ */

router.post('/payments', requirePermission(PERMISSIONS.HANOUT_CREDIT_PAYMENT_MANAGE), [
  body('customer_id').isInt({ min: 1 }),
  body('amount').isFloat({ gt: 0 }),
  body('method').optional().isIn(['cash', 'card', 'transfer', 'mobile_money']),
  body('date').optional().isISO8601(),
  body('comment').optional({ nullable: true }).trim().isLength({ max: 1000 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await HanoutCreditCustomer.findOne({ where: { id: req.body.customer_id, organization_id: oid } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });

  const t = await sequelize.transaction();
  try {
    const payment = await HanoutCreditPayment.create({
      organization_id: oid, customer_id: customer.id,
      amount: req.body.amount, method: req.body.method || 'cash',
      date: req.body.date || today(),
      comment: req.body.comment || null, created_by: req.user.id,
    }, { transaction: t });

    await recomputeLedger(customer.id, oid, t);
    await t.commit();
    await logAudit(req, 'payment_created', payment.id, { amount: payment.amount, customer_id: customer.id, method: payment.method });
    res.status(201).json({ payment });
  } catch (e) { await t.rollback(); throw e; }
}));

router.get('/payments', [
  query('customer_id').optional().isInt(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid };
  if (req.query.customer_id) where.customer_id = req.query.customer_id;
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date[Op.gte] = req.query.from;
    if (req.query.to)   where.date[Op.lte] = req.query.to;
  }
  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));
  const { count, rows } = await HanoutCreditPayment.findAndCountAll({
    where,
    include: [{ model: HanoutCreditCustomer, as: 'customer', attributes: ['id', 'name', 'phone'] }],
    order: [['date', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count / limit) || 1, payments: rows });
}));

router.delete('/payments/:id', requirePermission(PERMISSIONS.HANOUT_CREDIT_DELETE), ah(async (req, res) => {
  const oid = orgId(req);
  const payment = await HanoutCreditPayment.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!payment) return res.status(404).json({ error: 'Paiement introuvable' });
  const customerId = payment.customer_id;

  const t = await sequelize.transaction();
  try {
    await payment.destroy({ transaction: t });
    await recomputeLedger(customerId, oid, t);
    await t.commit();
    await logAudit(req, 'payment_deleted', payment.id, { amount: payment.amount, customer_id: customerId });
    res.json({ ok: true });
  } catch (e) { await t.rollback(); throw e; }
}));

/* ══════════════════════════════════════════════════════════════════════════
   TABLEAU DE BORD
══════════════════════════════════════════════════════════════════════════ */

router.get('/dashboard', ah(async (req, res) => {
  const oid = orgId(req);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today();

  const [totalCreditsAgg, totalPaymentsAgg, monthPaymentsAgg, todayPaymentsAgg, customers, overdueTotal] = await Promise.all([
    HanoutCredit.sum('amount', { where: { organization_id: oid } }),
    HanoutCreditPayment.sum('amount', { where: { organization_id: oid } }),
    HanoutCreditPayment.sum('amount', { where: { organization_id: oid, date: { [Op.gte]: monthStart } } }),
    HanoutCreditPayment.sum('amount', { where: { organization_id: oid, date: todayStr } }),
    HanoutCreditCustomer.findAll({ where: { organization_id: oid, active: true } }),
    HanoutCredit.count({ where: { organization_id: oid, due_date: { [Op.lt]: todayStr }, status: { [Op.ne]: 'paid' } } }),
  ]);

  const totalCredits   = Number(totalCreditsAgg || 0);
  const totalPayments  = Number(totalPaymentsAgg || 0);
  const totalRemaining = Number((totalCredits - totalPayments).toFixed(2));
  const monthPayments  = Number(monthPaymentsAgg || 0);
  const todayPayments  = Number(todayPaymentsAgg || 0);
  const debtorsCount   = customers.filter(c => Number(c.balance) > 0).length;

  // Évolution mensuelle (6 derniers mois)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('fr-FR', { month: 'short' }) });
  }
  const rangeStart = `${months[0].key}-01`;
  const [creditRows, paymentRows] = await Promise.all([
    HanoutCredit.findAll({ where: { organization_id: oid, date: { [Op.gte]: rangeStart } }, attributes: ['date', 'amount'], raw: true }),
    HanoutCreditPayment.findAll({ where: { organization_id: oid, date: { [Op.gte]: rangeStart } }, attributes: ['date', 'amount'], raw: true }),
  ]);
  const creditByMonth = {}, paymentByMonth = {};
  creditRows.forEach(r => { const k = String(r.date).slice(0, 7); creditByMonth[k] = (creditByMonth[k] || 0) + Number(r.amount); });
  paymentRows.forEach(r => { const k = String(r.date).slice(0, 7); paymentByMonth[k] = (paymentByMonth[k] || 0) + Number(r.amount); });
  const monthly = months.map(m => ({
    month: m.label,
    credits:  Number((creditByMonth[m.key] || 0).toFixed(2)),
    payments: Number((paymentByMonth[m.key] || 0).toFixed(2)),
  }));

  // Répartition des dettes par statut + Top 10 débiteurs
  const overdueMap = await overdueCountMap(customers.map(c => c.id));
  const distribution = { green: 0, orange: 0, red: 0 };
  const scored = customers.map(c => {
    const overdue_count = overdueMap[c.id] || 0;
    const st = computeStatus({ credit_limit: c.credit_limit, balance: c.balance, overdueCount: overdue_count });
    distribution[st.color]++;
    return { id: c.id, name: c.name, phone: c.phone, balance: Number(c.balance), status: st.color, status_label: st.label };
  });
  const topDebtors = scored.filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 10);

  res.json({
    kpis: {
      total_credits: totalCredits,
      total_paid:    totalPayments,
      total_remaining: totalRemaining,
      month_payments:  monthPayments,
      today_payments:  todayPayments,
      debtors_count:   debtorsCount,
      overdue_count:   overdueTotal,
    },
    monthly,
    distribution,
    top_debtors: topDebtors,
  });
}));

/* ══════════════════════════════════════════════════════════════════════════
   HISTORIQUE (flux combiné crédits + paiements)
══════════════════════════════════════════════════════════════════════════ */

router.get('/history', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));

  const [credits, payments] = await Promise.all([
    HanoutCredit.findAll({ where: { organization_id: oid }, include: [{ model: HanoutCreditCustomer, as: 'customer', attributes: ['id', 'name'] }], order: [['date', 'DESC']], limit: 300 }),
    HanoutCreditPayment.findAll({ where: { organization_id: oid }, include: [{ model: HanoutCreditCustomer, as: 'customer', attributes: ['id', 'name'] }], order: [['date', 'DESC']], limit: 300 }),
  ]);

  const events = [
    ...credits.map(c => ({ type: 'credit', id: c.id, date: c.date, amount: Number(c.amount), customer: c.customer, comment: c.comment, created_at: c.createdAt })),
    ...payments.map(p => ({ type: 'payment', id: p.id, date: p.date, amount: Number(p.amount), customer: p.customer, method: p.method, comment: p.comment, created_at: p.createdAt })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at));

  const total = events.length;
  const paged = events.slice((page - 1) * limit, (page - 1) * limit + limit);
  res.json({ total, page, pages: Math.ceil(total / limit) || 1, events: paged });
}));

/* ══════════════════════════════════════════════════════════════════════════
   JOURNAL D'AUDIT
══════════════════════════════════════════════════════════════════════════ */

router.get('/audit-log', [query('page').optional().isInt({ min: 1 })], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = 50;
  const { count, rows } = await HanoutCreditAuditLog.findAndCountAll({
    where: { organization_id: oid }, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count / limit) || 1, logs: rows });
}));

module.exports = router;
