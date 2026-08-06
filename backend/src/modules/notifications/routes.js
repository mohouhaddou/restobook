'use strict';

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { query, param, body } = require('express-validator');
const { requireAuth } = require('../../../middleware/auth');
const { Notification, User, Business, DeliveryPerson } = require('../../../models');
const validate = require('../../../middleware/validate');
const NotificationService = require('../../../services/NotificationService');
const NotificationRouter = require('../../shared/services/NotificationRouter');
const { pushRoleFor } = require('../../shared/utils/pushRole');

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
    query('entity_type').optional().isIn([
      'ORDER','RESERVATION','ACCOUNT','SYSTEM','DELIVERY',
      'PROMOTION','CASHBACK','POINTS','FAMILY','PAYMENT','MESSAGE',
    ]),
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
      // 'all' = tout ce qui est visible (non supprimé) ; 'archived' reste un filtre explicite séparé
      if (status !== 'all') where.status = status;
      else where.status = { [Op.ne]: 'archived' };
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

// Supprimer (archiver) toutes les notifications visibles par l'utilisateur
router.delete('/', async (req, res, next) => {
  try {
    await Notification.update(
      { status: 'archived' },
      { where: { ...notifScope(req.user), status: { [Op.ne]: 'archived' } } }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Push tokens (FCM) ─────────────────────────────────────────────────────────
// user_id / role / business_id / driver_id / session_id ne sont JAMAIS acceptés
// depuis le body : toujours dérivés du JWT vérifié (req.user), pour qu'il soit
// impossible d'enregistrer un token pour un autre compte ou de mentir sur son
// rôle (voir plan "Refonte push FCM").

router.post('/push-tokens',
  [
    body('fcm_token').trim().notEmpty().isLength({ max: 512 }),
    body('device_id').trim().notEmpty().isLength({ max: 191 }),
    body('platform').optional().isIn(['web', 'android', 'ios']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { fcm_token, device_id, platform } = req.body;
      const role = pushRoleFor(req.user.role);

      let businessId = null;
      let driverId = null;
      if (role === 'business' && req.user.organization_id) {
        const business = await Business.findOne({ where: { organization_id: req.user.organization_id }, attributes: ['id'] });
        businessId = business?.id || null;
      } else if (role === 'driver') {
        const driver = await DeliveryPerson.findOne({ where: { user_id: req.user.id }, attributes: ['id'] });
        driverId = driver?.id || null;
      }

      await NotificationRouter.registerToken({
        userId: req.user.id,
        role,
        businessId,
        driverId,
        sessionId: req.user.session_id || null,
        fcmToken: fcm_token,
        deviceId: device_id,
        platform: platform || 'web',
      });
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  }
);

router.post('/push-tokens/revoke', async (req, res, next) => {
  try {
    await NotificationRouter.revokeSession({ userId: req.user.id, sessionId: req.user.session_id || null });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Préférences de canal ──────────────────────────────────────────────────────

router.get('/preferences', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['notification_prefs'] });
    res.json({ prefs: user?.notification_prefs || null, default_channels: NotificationService.DEFAULT_CHANNELS });
  } catch (err) { next(err); }
});

router.patch('/preferences',
  [body('prefs').isObject().withMessage('prefs doit être un objet { categorie: [canaux] }')],
  validate,
  async (req, res, next) => {
    try {
      await User.update({ notification_prefs: req.body.prefs }, { where: { id: req.user.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

module.exports = router;
