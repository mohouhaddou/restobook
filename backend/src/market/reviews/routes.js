'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { body, param, query } = require('express-validator');
const { QueryTypes } = require('sequelize');

const validate = require('../../../middleware/validate');
const { requireAuth } = require('../../../middleware/auth');
const { sequelize, Business, User, Notification } = require('../../../models');

const router = express.Router();
const reviewUploadDir = path.join(__dirname, '../../../uploads/reviews');
fs.mkdirSync(reviewUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: reviewUploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { files: 8, fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)),
});

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const currentUserId = req => Number(req.user?.id || req.user?.user_id || req.user?.sub || 0);
const ownerRoles = new Set(['owner', 'admin', 'manager', 'superadmin']);
const schemaCache = new Map();

async function colExists(table, column) {
  const key = `${table}.${column}`;
  if (schemaCache.has(key)) return schemaCache.get(key);
  const rows = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    { replacements: [table, column], type: QueryTypes.SELECT }
  );
  const exists = rows.length > 0;
  schemaCache.set(key, exists);
  return exists;
}

async function tableExists(table) {
  const key = `table.${table}`;
  if (schemaCache.has(key)) return schemaCache.get(key);
  const rows = await sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    { replacements: [table], type: QueryTypes.SELECT }
  );
  const exists = rows.length > 0;
  schemaCache.set(key, exists);
  return exists;
}

async function reviewSchema() {
  return {
    businessId: await colExists('reviews', 'business_id'),
    title: await colExists('reviews', 'title'),
    status: await colExists('reviews', 'status'),
    trustScore: await colExists('reviews', 'trust_score'),
    verified: await colExists('reviews', 'verified'),
    helpfulCount: await colExists('reviews', 'helpful_count'),
    replyCount: await colExists('reviews', 'reply_count'),
    reportCount: await colExists('reviews', 'report_count'),
    updatedAt: await colExists('reviews', 'updated_at'),
    itemRatings: await colExists('reviews', 'item_ratings'),
    aiSummary: await colExists('reviews', 'ai_summary'),
    photos: await tableExists('review_photos'),
    votes: await tableExists('review_votes'),
    replies: await tableExists('business_replies'),
    reports: await tableExists('review_reports'),
  };
}

async function businessById(id) {
  return Business.findByPk(id, { attributes: ['id', 'organization_id', 'name', 'claim_status'] });
}

function canManageBusiness(user, business) {
  if (!user || !business) return false;
  if (user.role === 'superadmin') return true;
  return business.claim_status === 'claimed' && ownerRoles.has(user.role) && Number(user.organization_id) === Number(business.organization_id);
}

function statusClause(schema, alias = 'r') {
  return schema.status ? ` AND ${alias}.status = 'published'` : '';
}

function scopeWhere(schema) {
  return schema.businessId ? 'r.business_id = ?' : 'r.organization_id = ?';
}

function scopeValue(schema, business) {
  return schema.businessId ? business.id : business.organization_id;
}

function distributionFromRows(rows) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const row of rows) {
    const rating = Number(row.rating);
    const count = Number(row.count || 0);
    if (rating >= 1 && rating <= 5) {
      distribution[rating] = count;
      total += count;
      sum += rating * count;
    }
  }
  return {
    rating_distribution: distribution,
    total_reviews: total,
    avg_rating: total > 0 ? Math.round((sum / total) * 100) / 100 : 0,
  };
}

async function loadStats(business, schema) {
  const rows = await sequelize.query(
    `SELECT r.rating, COUNT(*) AS count FROM reviews r WHERE ${scopeWhere(schema)}${statusClause(schema)} GROUP BY r.rating`,
    { replacements: [scopeValue(schema, business)], type: QueryTypes.SELECT }
  );
  return distributionFromRows(rows);
}

async function refreshOrganizationStats(business, schema, transaction = null) {
  const stats = await loadStats(business, schema);
  await sequelize.query(
    `UPDATE businesses SET avg_rating=?, total_reviews=? WHERE id=?`,
    { replacements: [stats.avg_rating, stats.total_reviews, business.id], transaction }
  );
  await sequelize.query(
    `UPDATE organizations SET avg_rating=?, total_reviews=? WHERE id=?`,
    { replacements: [stats.avg_rating, stats.total_reviews, business.organization_id], transaction }
  );
  return stats;
}

function serializeRow(row, businessId) {
  return {
    id: row.id,
    business_id: businessId,
    rating: Number(row.rating || 0),
    title: row.title || '',
    comment: row.comment || '',
    trust_score: Number(row.trust_score || 0),
    verified: Boolean(row.verified),
    helpful_count: Number(row.helpful_count || 0),
    reply_count: Number(row.reply_count || 0),
    report_count: Number(row.report_count || 0),
    status: row.status || 'published',
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at || row.created_at || row.createdAt,
    user: {
      id: row.user_id || null,
      name: row.user_name || 'Utilisateur Ifilino',
      avatar_url: row.avatar_url || null,
    },
    photos: row.photos || [],
    my_vote: row.my_vote || null,
    business_reply: row.business_reply || null,
  };
}

router.get('/business/:id/reviews/stats',
  [param('id').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    const business = await businessById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Etablissement introuvable' });
    const schema = await reviewSchema();
    const stats = await loadStats(business, schema);
    res.json({ business_id: business.id, ...stats });
  })
);

router.get('/business/:id/reviews',
  [
    param('id').isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('rating').optional().isInt({ min: 1, max: 5 }),
    query('sort').optional().isIn(['recent', 'helpful', 'rating_desc', 'rating_asc']),
  ],
  validate,
  ah(async (req, res) => {
    const business = await businessById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Etablissement introuvable' });
    const schema = await reviewSchema();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Number(req.query.limit || 8));
    const offset = (page - 1) * limit;

    const ratingClause = req.query.rating ? ' AND r.rating = ?' : '';
    const replacements = [scopeValue(schema, business)];
    if (req.query.rating) replacements.push(Number(req.query.rating));

    const countRows = await sequelize.query(
      `SELECT COUNT(*) AS count FROM reviews r WHERE ${scopeWhere(schema)}${statusClause(schema)}${ratingClause}`,
      { replacements, type: QueryTypes.SELECT }
    );
    const total = Number(countRows[0]?.count || 0);

    const orderMap = {
      helpful: schema.helpfulCount ? 'r.helpful_count DESC, r.created_at DESC' : 'r.created_at DESC',
      rating_desc: 'r.rating DESC, r.created_at DESC',
      rating_asc: 'r.rating ASC, r.created_at DESC',
      recent: 'r.created_at DESC',
    };
    const order = orderMap[req.query.sort || 'recent'] || orderMap.recent;

    const select = [
      'r.id', 'r.organization_id', 'r.user_id', 'r.rating', 'r.comment', 'r.created_at',
      schema.businessId ? 'r.business_id' : 'NULL AS business_id',
      schema.title ? 'r.title' : 'NULL AS title',
      schema.status ? 'r.status' : "'published' AS status",
      schema.trustScore ? 'r.trust_score' : '0 AS trust_score',
      schema.verified ? 'r.verified' : '0 AS verified',
      schema.helpfulCount ? 'r.helpful_count' : '0 AS helpful_count',
      schema.replyCount ? 'r.reply_count' : '0 AS reply_count',
      schema.reportCount ? 'r.report_count' : '0 AS report_count',
      schema.updatedAt ? 'r.updated_at' : 'r.created_at AS updated_at',
      'u.nom AS user_name', 'u.avatar_url',
    ];

    const rows = await sequelize.query(
      `SELECT ${select.join(', ')} FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE ${scopeWhere(schema)}${statusClause(schema)}${ratingClause} ORDER BY ${order} LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset], type: QueryTypes.SELECT }
    );

    let photosByReview = {};
    if (schema.photos && rows.length) {
      const ids = rows.map(r => r.id);
      const photos = await sequelize.query(
        `SELECT id, review_id, image_url, sort_order FROM review_photos WHERE review_id IN (?) ORDER BY sort_order ASC, id ASC`,
        { replacements: [ids], type: QueryTypes.SELECT }
      );
      photosByReview = photos.reduce((acc, photo) => {
        acc[photo.review_id] = acc[photo.review_id] || [];
        acc[photo.review_id].push({ id: photo.id, image_url: photo.image_url, sort_order: photo.sort_order || 0 });
        return acc;
      }, {});
    }

    res.json({
      reviews: rows.map(row => serializeRow({ ...row, photos: photosByReview[row.id] || [] }, business.id)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.post('/reviews',
  requireAuth,
  [
    body('business_id').isInt({ min: 1 }),
    body('rating').isInt({ min: 1, max: 5 }),
    body('title').optional({ nullable: true }).trim().isLength({ max: 191 }),
    body('comment').trim().isLength({ min: 3, max: 5000 }),
  ],
  validate,
  ah(async (req, res) => {
    const userId = currentUserId(req);
    const business = await businessById(req.body.business_id);
    if (!business) return res.status(404).json({ error: 'Etablissement introuvable' });
    const schema = await reviewSchema();

    const duplicate = await sequelize.query(
      `SELECT id FROM reviews r WHERE ${scopeWhere(schema)} AND r.user_id = ? LIMIT 1`,
      { replacements: [scopeValue(schema, business), userId], type: QueryTypes.SELECT }
    );
    if (duplicate.length) return res.status(409).json({ error: 'Vous avez deja publie un avis pour cet etablissement' });

    const columns = ['organization_id', 'user_id', 'rating', 'comment'];
    const values = [business.organization_id, userId, Number(req.body.rating), String(req.body.comment || '').trim()];
    if (schema.businessId) { columns.push('business_id'); values.push(business.id); }
    if (schema.title) { columns.push('title'); values.push(String(req.body.title || '').trim() || null); }
    if (schema.status) { columns.push('status'); values.push('published'); }
    if (schema.trustScore) { columns.push('trust_score'); values.push(55); }
    if (schema.verified) { columns.push('verified'); values.push(0); }
    if (schema.itemRatings) { columns.push('item_ratings'); values.push(JSON.stringify([])); }
    if (schema.aiSummary) { columns.push('ai_summary'); values.push(JSON.stringify({ reviewed_by: 'compat:v1', signals: [] })); }

    const placeholders = columns.map(() => '?').join(', ');
    const result = await sequelize.transaction(async transaction => {
      const [insertResult] = await sequelize.query(
        `INSERT INTO reviews (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
        { replacements: values, transaction }
      );
      const id = insertResult.insertId;
      await refreshOrganizationStats(business, schema, transaction);
      await Notification.create({
        organization_id: business.organization_id,
        recipient_role: 'admin',
        type: 'business.review.created',
        title: 'Nouvel avis client',
        message: `${Number(req.body.rating)}/5 - ${String(req.body.title || 'Avis client').trim()}`,
        entity_type: 'review',
        entity_id: id,
        action_url: `/business/reviews/${id}`,
        priority: Number(req.body.rating) <= 2 ? 'high' : 'normal',
        data: { business_id: business.id, rating: Number(req.body.rating) },
      }, { transaction }).catch(() => null);
      return id;
    });

    const user = await User.findByPk(userId, { attributes: ['id', 'nom', 'avatar_url'] }).catch(() => null);
    res.status(201).json({
      review: {
        id: result,
        business_id: business.id,
        rating: Number(req.body.rating),
        title: String(req.body.title || '').trim(),
        comment: String(req.body.comment || '').trim(),
        trust_score: 55,
        verified: false,
        helpful_count: 0,
        reply_count: 0,
        report_count: 0,
        status: 'published',
        created_at: new Date().toISOString(),
        user: { id: userId, name: user?.nom || 'Utilisateur Ifilino', avatar_url: user?.avatar_url || null },
        photos: [],
        my_vote: null,
        business_reply: null,
      },
    });
  })
);

router.post('/reviews/:id/photos', requireAuth, upload.array('photos', 8), [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const schema = await reviewSchema();
  if (!schema.photos) return res.status(202).json({ photos: [], message: 'Photos disponibles apres migration avis' });
  const urls = (req.files || []).map((file, index) => ({ review_id: req.params.id, image_url: `/uploads/reviews/${file.filename}`, sort_order: index }));
  for (const row of urls) await sequelize.query('INSERT INTO review_photos (review_id, image_url, sort_order) VALUES (?, ?, ?)', { replacements: [row.review_id, row.image_url, row.sort_order] });
  res.status(201).json({ photos: urls });
}));

router.post('/reviews/:id/vote', requireAuth, [param('id').isInt({ min: 1 }), body('type').isIn(['helpful', 'not_helpful'])], validate, ah(async (req, res) => {
  const schema = await reviewSchema();
  if (!schema.votes || !schema.helpfulCount) return res.json({ helpful_count: 0, my_vote: req.body.type });
  const userId = currentUserId(req);
  await sequelize.query('INSERT INTO review_votes (review_id, user_id, type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE type=VALUES(type)', { replacements: [req.params.id, userId, req.body.type] });
  const rows = await sequelize.query("SELECT COUNT(*) AS count FROM review_votes WHERE review_id=? AND type='helpful'", { replacements: [req.params.id], type: QueryTypes.SELECT });
  const count = Number(rows[0]?.count || 0);
  await sequelize.query('UPDATE reviews SET helpful_count=? WHERE id=?', { replacements: [count, req.params.id] });
  res.json({ helpful_count: count, my_vote: req.body.type });
}));

router.post('/reviews/:id/report', requireAuth, [param('id').isInt({ min: 1 }), body('reason').trim().isLength({ min: 2, max: 80 }), body('comment').optional({ nullable: true }).trim().isLength({ max: 1000 })], validate, ah(async (req, res) => {
  const schema = await reviewSchema();
  if (!schema.reports) return res.status(202).json({ report: null, message: 'Signalements disponibles apres migration avis' });
  await sequelize.query('INSERT INTO review_reports (review_id, user_id, reason, comment) VALUES (?, ?, ?, ?)', { replacements: [req.params.id, currentUserId(req), req.body.reason, req.body.comment || null] });
  res.status(201).json({ ok: true });
}));

router.post('/reviews/:id/reply', requireAuth, [param('id').isInt({ min: 1 }), body('reply').trim().isLength({ min: 2, max: 3000 })], validate, ah(async (req, res) => {
  const schema = await reviewSchema();
  if (!schema.replies) return res.status(202).json({ reply: null, message: 'Reponses professionnelles disponibles apres migration avis' });
  const rows = await sequelize.query('SELECT r.id, r.organization_id, b.id AS business_id, b.claim_status FROM reviews r JOIN businesses b ON b.organization_id = r.organization_id WHERE r.id=? LIMIT 1', { replacements: [req.params.id], type: QueryTypes.SELECT });
  const row = rows[0];
  if (!row || !canManageBusiness(req.user, row)) return res.status(403).json({ error: 'Reserve au professionnel revendique' });
  await sequelize.query('INSERT INTO business_replies (review_id, business_id, user_id, reply) VALUES (?, ?, ?, ?)', { replacements: [req.params.id, row.business_id, currentUserId(req), req.body.reply] });
  res.status(201).json({ ok: true });
}));

router.get('/my/reviews', requireAuth, [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })], validate, ah(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Number(req.query.limit || 10));
  const offset = (page - 1) * limit;
  const rows = await sequelize.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, b.id AS business_id, b.name AS business_name, b.logo, b.city FROM reviews r LEFT JOIN businesses b ON b.organization_id = r.organization_id WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    { replacements: [currentUserId(req), limit, offset], type: QueryTypes.SELECT }
  );
  res.json({ reviews: rows.map(r => ({ ...serializeRow(r, r.business_id), business: { id: r.business_id, name: r.business_name, logo: r.logo, city: r.city } })), pagination: { page, limit, total: rows.length, pages: page } });
}));

router.put('/reviews/:id', requireAuth, [param('id').isInt({ min: 1 }), body('rating').optional().isInt({ min: 1, max: 5 }), body('comment').optional().trim().isLength({ min: 3, max: 5000 })], validate, ah(async (req, res) => {
  const updates = [];
  const values = [];
  if (req.body.rating !== undefined) { updates.push('rating=?'); values.push(Number(req.body.rating)); }
  if (req.body.comment !== undefined) { updates.push('comment=?'); values.push(String(req.body.comment).trim()); }
  if (!updates.length) return res.status(400).json({ error: 'Aucune modification' });
  values.push(req.params.id, currentUserId(req));
  await sequelize.query(`UPDATE reviews SET ${updates.join(', ')} WHERE id=? AND user_id=?`, { replacements: values });
  res.json({ ok: true });
}));

router.delete('/reviews/:id', requireAuth, [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  await sequelize.query('DELETE FROM reviews WHERE id=? AND user_id=?', { replacements: [req.params.id, currentUserId(req)] });
  res.json({ ok: true });
}));

module.exports = router;
