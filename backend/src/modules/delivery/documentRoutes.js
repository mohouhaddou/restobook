'use strict';

/**
 * Routes Module Delivery — Documents (Phase 6)
 * GET    /api/delivery/documents/me         — mes documents
 * POST   /api/delivery/documents            — déposer un document (upload)
 * DELETE /api/delivery/documents/:id        — supprimer mon document (si pas encore vérifié)
 * GET    /api/delivery/documents            — file de vérification (SuperAdmin)
 * PATCH  /api/delivery/documents/:id/verify — valider (SuperAdmin)
 * PATCH  /api/delivery/documents/:id/reject — refuser (SuperAdmin)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, param, query } = require('express-validator');
const { Op } = require('sequelize');

const { DeliveryPerson, DeliveryDocument, User } = require('../../../models');
const { requireAuth, requirePermission, requireSuperAdmin } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');

const DOCUMENT_TYPES = ['license', 'registration_card', 'insurance', 'national_id', 'background_check', 'other'];

router.use(requireAuth);

// ── Upload ───────────────────────────────────────────────────────────────────
// Même convention que marketplaceHero/routes.js : memoryStorage + écriture
// manuelle, dossier auto-réparé s'il a disparu. Pas de transformation sharp
// ici (documents = photos/scans tels quels, pas des assets marketing).
const uploadDir = path.join(__dirname, '../../../uploads', 'delivery-documents');
function ensureUploadDir() { fs.mkdirSync(uploadDir, { recursive: true }); }
ensureUploadDir();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype);
    cb(ok ? null : new Error('Type de fichier non supporté (image ou PDF uniquement)'), ok);
  },
});

async function myDeliveryPerson(req, res) {
  const dp = await DeliveryPerson.findOne({ where: { user_id: req.user.id } });
  if (!dp) { res.status(404).json({ error: 'Profil livreur introuvable' }); return null; }
  return dp;
}

router.get('/documents/me', requirePermission(PERMISSIONS.DELIVERY_MANAGE), async (req, res, next) => {
  try {
    const dp = await myDeliveryPerson(req, res);
    if (!dp) return;
    const documents = await DeliveryDocument.findAll({ where: { delivery_person_id: dp.id }, order: [['createdAt', 'DESC']] });
    res.json({ documents });
  } catch (e) { next(e); }
});

router.post('/documents',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  upload.single('file'),
  [
    body('type').isIn(DOCUMENT_TYPES),
    body('number').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('issued_at').optional({ nullable: true }).isISO8601(),
    body('expires_at').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const dp = await myDeliveryPerson(req, res);
      if (!dp) return;

      let file_url = null;
      if (req.file) {
        ensureUploadDir();
        const ext = req.file.mimetype === 'application/pdf' ? 'pdf' : (req.file.mimetype.split('/')[1] || 'bin');
        const filename = `${dp.id}_${req.body.type}_${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
        file_url = `/uploads/delivery-documents/${filename}`;
      }

      const document = await DeliveryDocument.create({
        delivery_person_id: dp.id,
        type: req.body.type, file_url, number: req.body.number || null,
        issued_at: req.body.issued_at || null, expires_at: req.body.expires_at || null,
        status: 'pending',
      });
      res.status(201).json({ document });
    } catch (e) { next(e); }
  }
);

router.delete('/documents/:id', requirePermission(PERMISSIONS.DELIVERY_MANAGE), async (req, res, next) => {
  try {
    const dp = await myDeliveryPerson(req, res);
    if (!dp) return;
    const n = await DeliveryDocument.destroy({ where: { id: req.params.id, delivery_person_id: dp.id, status: { [Op.ne]: 'verified' } } });
    if (!n) return res.status(404).json({ error: 'Document introuvable ou déjà vérifié' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── File de vérification (SuperAdmin) ────────────────────────────────────────

router.get('/documents',
  requireSuperAdmin,
  [query('status').optional().isIn(['pending', 'verified', 'expired', 'rejected'])],
  validate,
  async (req, res, next) => {
    try {
      const where = req.query.status ? { status: req.query.status } : {};
      const documents = await DeliveryDocument.findAll({
        where,
        include: [{ model: DeliveryPerson, as: 'deliveryPerson', include: [{ model: User, as: 'user', attributes: ['nom', 'matricule'] }] }],
        order: [['createdAt', 'ASC']],
        limit: 100,
      });
      res.json({ documents });
    } catch (e) { next(e); }
  }
);

router.patch('/documents/:id/verify', requireSuperAdmin, [param('id').isInt({ min: 1 })], validate, async (req, res, next) => {
  try {
    const document = await DeliveryDocument.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document introuvable' });
    await document.update({ status: 'verified', verified_by_user_id: req.user.id, verified_at: new Date() });
    res.json({ document });
  } catch (e) { next(e); }
});

router.patch('/documents/:id/reject',
  requireSuperAdmin,
  [param('id').isInt({ min: 1 }), body('notes').optional().trim().isLength({ max: 500 })],
  validate,
  async (req, res, next) => {
    try {
      const document = await DeliveryDocument.findByPk(req.params.id);
      if (!document) return res.status(404).json({ error: 'Document introuvable' });
      await document.update({ status: 'rejected', verified_by_user_id: req.user.id, verified_at: new Date(), notes: req.body.notes || null });
      res.json({ document });
    } catch (e) { next(e); }
  }
);

module.exports = router;
