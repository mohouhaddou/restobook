'use strict';

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { Op } = require('sequelize');

const { TableReservation } = require('../models');
const { requireAuth, requirePermission, requireOrganizationAccess, orgScope } = require('../middleware/auth');
const { PERMISSIONS } = require('../auth/permissions');
const validate = require('../middleware/validate');

router.use(requireAuth, requireOrganizationAccess);

const reservationRules = [
  body('guest_name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('date_jour').isISO8601().withMessage('Date invalide (YYYY-MM-DD)'),
  body('time_slot').matches(/^\d{2}:\d{2}$/).withMessage('Heure invalide (HH:MM)'),
  body('guests_count').optional().isInt({ min: 1, max: 50 }).withMessage('Nombre de couverts invalide'),
  body('guest_phone').optional().trim().isLength({ max: 32 }),
  body('guest_email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('table_label').optional().trim().isLength({ max: 64 }),
  body('notes').optional().trim().isLength({ max: 500 }),
];

/* ── POST /api/tables — Créer une réservation de table ─────────────────── */
router.post('/', reservationRules, validate, async (req, res, next) => {
  try {
    const { guest_name, date_jour, time_slot, guests_count = 2,
            guest_phone, guest_email, table_label, notes } = req.body;
    const orgId = req.user.organization_id;

    const resv = await TableReservation.create({
      organization_id: orgId,
      guest_name, date_jour, time_slot,
      guests_count: Number(guests_count),
      guest_phone:  guest_phone  || null,
      guest_email:  guest_email  || null,
      table_label:  table_label  || null,
      notes:        notes        || null,
      status: 'pending',
    });

    res.status(201).json({ ok: true, id: resv.id });
  } catch (e) { next(e); }
});

/* ── GET /api/tables — Liste des réservations ──────────────────────────── */
router.get('/',
  requirePermission(PERMISSIONS.RESTAURANT_TABLES_MANAGE),
  [
    query('date').optional().isISO8601(),
    query('status').optional().isIn(['pending','confirmed','seated','cancelled','no_show','all']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orgId  = req.user.organization_id;
      const where  = { organization_id: orgId };
      const status = req.query.status || 'all';
      if (req.query.date) where.date_jour = req.query.date;
      if (status !== 'all') where.status = status;

      const reservations = await TableReservation.findAll({
        where,
        order: [['date_jour','ASC'], ['time_slot','ASC']],
        limit: 200,
      });
      res.json({ reservations });
    } catch (e) { next(e); }
  }
);

/* ── PATCH /api/tables/:id/status ──────────────────────────────────────── */
router.patch('/:id/status',
  requirePermission(PERMISSIONS.RESTAURANT_TABLES_MANAGE),
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(['confirmed','seated','cancelled','no_show']).withMessage('Statut invalide'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const resv = await TableReservation.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });
      if (!resv) return res.status(404).json({ error: 'Réservation introuvable' });
      resv.status = req.body.status;
      await resv.save();
      res.json({ ok: true, status: resv.status });
    } catch (e) { next(e); }
  }
);

/* ── DELETE /api/tables/:id ─────────────────────────────────────────────── */
router.delete('/:id',
  requirePermission(PERMISSIONS.RESTAURANT_TABLES_MANAGE),
  [param('id').isInt({ min: 1 })], validate,
  async (req, res, next) => {
    try {
      const resv = await TableReservation.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });
      if (!resv) return res.status(404).json({ error: 'Réservation introuvable' });
      await resv.destroy();
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

module.exports = router;
