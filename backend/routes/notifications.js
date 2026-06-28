'use strict';

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { query, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { Notification } = require('../models');
const validate = require('../middleware/validate');
const NotificationService = require('../services/NotificationService');

router.use(requireAuth);

function notifScope(user) {
  if (user.role === 'superadmin') return {};
  if (user.role === 'customer') return { recipient_id: user.id };
  const conditions = [{ recipient_id: user.id }];
  if (user.organization_id) conditions.push({ recipient_id: null, organization_id: user.organization_id });
  return { [Op.or]: conditions };
}

const PRIORITY_ORDER = { urgent: 4, high: 3, normal: 2, low: 1 };

router.get('/',
  [
    query('status').optional().isIn(['unread','read','archived','all']),
    query('entity_type').optional().isIn(['ORDER','RESERVATION','ACCOUNT','SYSTEM']),
    query('priority').optional().isIn(['low','normal','high','urgent']),
    query('limit').optional().isInt({ min:1, max:100 }),
    query('offset').optional().isInt({ min:0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { status='all', entity_type, priority, type } = req.query;
      const limit  = Math.min(100, Number(req.query.limit  || 30));
      const offset = Math.max(0,   Number(req.query.offset || 0));
      const where  = { ...notifScope(req.user) };
      if (status !== 'all') where.status = status;
      if (entity_type)      where.entity_type = entity_type;
      if (priority)         where.priority = priority;
      if (type)             where.type = { [Op.like]: `${type}%` };

      const { count, rows } = await Notification.findAndCountAll({
        where,
        order: [['created_at','DESC']],
        limit, offset,
      });
      res.json({ total: count, notifications: rows });
    } catch (err) { next(err); }
  }
);

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.count({ where: { ...notifScope(req.user), status: 'unread' } });
    res.json({ count });
  } catch (err) { next(err); }
});

router.patch('/mark-all-read', async (req, res, next) => {
  try {
    await NotificationService.markAllAsRead(req.user.id, req.user.organization_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/read',
  [param('id').isInt({ min:1 })],
  validate,
  async (req, res, next) => {
    try {
      const n = await NotificationService.markAsRead(Number(req.params.id), req.user.id, req.user.organization_id);
      if (!n) return res.status(404).json({ error: 'Notification introuvable' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

router.delete('/:id',
  [param('id').isInt({ min:1 })],
  validate,
  async (req, res, next) => {
    try {
      const n = await Notification.findOne({ where: { id: Number(req.params.id), ...notifScope(req.user) } });
      if (!n) return res.status(404).json({ error: 'Notification introuvable' });
      n.status = 'archived';
      await n.save();
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

module.exports = router;
