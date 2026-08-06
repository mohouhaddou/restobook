'use strict';

/**
 * Routes POS / Caisse — montées sous /api/pos.
 * Ventes en magasin, sessions de caisse, historique, remboursement, rapport journalier.
 */

const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { requireAuth, requirePermission, requireOrganizationAccess } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const svc = require('./service');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireOrganizationAccess);

function fail(res, e) {
  if (e instanceof svc.PosError) return res.status(e.status).json({ error: e.code });
  throw e;
}

/* ── Session de caisse ───────────────────────────────────────────────────── */

router.post('/session/open', requirePermission(PERMISSIONS.POS_SESSION_OPEN), [
  body('opening_amount').optional().isFloat({ min: 0 }),
], validate, ah(async (req, res) => {
  try {
    const session = await svc.openSession(req, { opening_amount: req.body.opening_amount });
    res.status(201).json({ session });
  } catch (e) { fail(res, e); }
}));

router.post('/session/close', requirePermission(PERMISSIONS.POS_SESSION_CLOSE), [
  body('counted_cash').isFloat({ min: 0 }).withMessage('counted_cash requis'),
  body('notes').optional().trim().isLength({ max: 1000 }),
], validate, ah(async (req, res) => {
  try {
    const session = await svc.closeSession(req, { counted_cash: req.body.counted_cash, notes: req.body.notes });
    res.json({ session });
  } catch (e) { fail(res, e); }
}));

router.get('/session/current', requirePermission(PERMISSIONS.POS_SELL), ah(async (req, res) => {
  const session = await svc.getCurrentSession(req);
  res.json({ session: session || null });
}));

/* ── Catalogue / clients (lecture, pour la grille de vente) ─────────────── */

router.get('/business', requirePermission(PERMISSIONS.POS_SELL), ah(async (req, res) => {
  try {
    const business = await svc.getBusinessInfo(req);
    res.json({ business });
  } catch (e) { fail(res, e); }
}));

router.get('/products', requirePermission(PERMISSIONS.POS_SELL), [
  query('q').optional().trim().isLength({ max: 100 }),
], validate, ah(async (req, res) => {
  try {
    const result = await svc.listCatalog(req, { q: req.query.q });
    res.json(result);
  } catch (e) { fail(res, e); }
}));

router.get('/customers', requirePermission(PERMISSIONS.POS_SELL), [
  query('q').optional().trim().isLength({ max: 100 }),
], validate, ah(async (req, res) => {
  const result = await svc.searchCustomers(req, { q: req.query.q });
  res.json(result);
}));

// POST — scan code-barres (douchette USB/Bluetooth = clavier + Enter, ou saisie manuelle)
router.post('/scan', requirePermission(PERMISSIONS.POS_SELL), [
  body('barcode').trim().notEmpty().withMessage('Code-barres requis').isLength({ max: 64 }),
], validate, ah(async (req, res) => {
  try {
    const product = await svc.findBusinessProductByBarcode(req, req.body.barcode);
    if (!product) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ product });
  } catch (e) { fail(res, e); }
}));

// POST — scan/saisie carte iFilino (client marketplace), pour identification + cashback en caisse
router.post('/card/lookup', requirePermission(PERMISSIONS.POS_SELL), [
  body('card_code').trim().notEmpty().withMessage('Code carte requis').isLength({ max: 64 }),
], validate, ah(async (req, res) => {
  try {
    const card = await svc.lookupCard(req, req.body.card_code);
    res.json(card);
  } catch (e) { fail(res, e); }
}));

/* ── Ventes ──────────────────────────────────────────────────────────────── */

router.post('/sale', requirePermission(PERMISSIONS.POS_SELL), [
  body('items').isArray({ min: 1 }).withMessage('Panier vide'),
  body('items.*.catalog_item_id').isInt({ min: 1 }),
  body('items.*.quantity').optional().isInt({ min: 1, max: 999 }),
  body('items.*.discount_percent').optional().isFloat({ min: 0, max: 100 }),
  body('payment_method').isIn(['CASH', 'CARD', 'CREDIT', 'ONLINE', 'cash', 'card', 'credit', 'online']),
  body('customer_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('discount_amount').optional().isFloat({ min: 0 }),
  body('customer_user_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('cashback_used').optional().isFloat({ min: 0 }),
  body('notes').optional().trim().isLength({ max: 500 }),
], validate, ah(async (req, res) => {
  try {
    const result = await svc.createPosSale(req, req.body);
    res.status(201).json(result);
  } catch (e) { fail(res, e); }
}));

router.get('/sales', requirePermission(PERMISSIONS.POS_HISTORY_VIEW), [
  query('date').optional().isISO8601(),
  query('cashier_id').optional().isInt(),
  query('payment_method').optional().isIn(['cash', 'card', 'credit', 'online', 'CASH', 'CARD', 'CREDIT', 'ONLINE']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const result = await svc.listPosSales(req, req.query);
  res.json(result);
}));

router.get('/sales/:id', requirePermission(PERMISSIONS.POS_HISTORY_VIEW), [
  param('id').isInt({ min: 1 }),
], validate, ah(async (req, res) => {
  try {
    const result = await svc.getPosSale(req, req.params.id);
    res.json(result);
  } catch (e) { fail(res, e); }
}));

router.post('/sales/:id/refund', requirePermission(PERMISSIONS.POS_REFUND), [
  param('id').isInt({ min: 1 }),
  body('reason').optional().trim().isLength({ max: 500 }),
], validate, ah(async (req, res) => {
  try {
    const result = await svc.refundPosSale(req, req.params.id, req.body.reason);
    res.json(result);
  } catch (e) { fail(res, e); }
}));

/* ── Rapport journalier ──────────────────────────────────────────────────── */

router.get('/report/daily', requirePermission(PERMISSIONS.POS_REPORT_VIEW), [
  query('date').optional().isISO8601(),
], validate, ah(async (req, res) => {
  try {
    const result = await svc.dailyReport(req, req.query.date);
    res.json(result);
  } catch (e) { fail(res, e); }
}));

module.exports = router;
