'use strict';

/**
 * Produits numériques — routes consommateur. Montées sous /api/digital-products.
 * `resolveReader` (même middleware que backend/src/modules/portals/routes.js) : un visiteur non
 * connecté peut voir le catalogue (jamais acheté), mais l'achat/le statut/le téléchargement
 * exigent une identité réelle — contrairement aux favoris, on ne peut pas "acheter en local".
 *
 * GET  /story/:portalContentId       — catalogue d'une Story + état effectif par visiteur
 * GET  /purchases                    — bibliothèque "Mes achats" du lecteur connecté (auth requise)
 * POST /:id/purchase                 — achat simulé (auth requise)
 * POST /:id/pay/:provider/create-order — crée une commande chez un provider réel (PayPal...) (auth requise)
 * POST /:id/pay/:provider/capture      — capture la commande approuvée, marque l'achat payé (auth requise)
 * GET  /:id/status                   — statut de génération pollé par le frontend (auth requise)
 * GET  /:id/download                 — téléchargement authentifié (vérifie l'achat)
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { param, body } = require('express-validator');
const validate = require('../../../middleware/validate');
const { resolveReader } = require('../portals/middleware/resolveReader');
const { DigitalProduct, Purchase, GeneratedFile, PortalContent } = require('../../../models');
const { computeEffectiveState } = require('./effectiveState');
const { ensureGeneratedFile, getStatus } = require('./generationService');
const { getProvider } = require('../../shared/payments/registry');
const { getStorageProvider } = require('./storage');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Extension de téléchargement par mime_type — jamais un type de produit codé en dur ici, juste le
// mime_type déjà stocké sur le GeneratedFile (voir generationService.js).
const EXTENSION_BY_MIME = { 'application/pdf': 'pdf', 'audio/wav': 'wav' };

async function latestGeneratedFile(digitalProductId) {
  return GeneratedFile.findOne({ where: { digital_product_id: digitalProductId }, order: [['version', 'DESC']] });
}
async function ownPurchase(readerId, digitalProductId) {
  if (!readerId) return null;
  return Purchase.findOne({
    where: { user_id: readerId, digital_product_id: digitalProductId, purchase_status: 'completed' },
    order: [['purchased_at', 'DESC']],
  });
}

async function resolveProductContent(product) {
  if (product.portal_content_id) return PortalContent.findByPk(product.portal_content_id);
  const lesson = await StudyLesson.findByPk(product.study_lesson_id, { include: [{ model: StudyLessonTranslation, as: "translations" }] });
  if (!lesson) return null;
  const translation = lesson.translations?.find(item => item.language === product.language) || lesson.translations?.[0];
  return { id: lesson.id, slug: lesson.slug, title_fr: translation?.title || product.title, body_fr: translation?.body || product.content_markdown || "", updated_at: lesson.updated_at, isStudyLesson: true };
}

function serializeProduct(product, { purchase, generatedFile }) {
  const effective = computeEffectiveState({ product, purchase, generatedFile });
  return {
    id: product.id,
    type: product.type,
    title: product.title,
    description: product.description,
    coverImageUrl: product.cover_image_url,
    price: product.price,
    currency: product.currency,
    ...effective,
  };
}

async function sendCatalog(req, res, where) {
  const products = await DigitalProduct.findAll({ where: { ...where, status: { [Op.ne]: "disabled" } }, order: [["position", "ASC"], ["id", "ASC"]] });
  const items = await Promise.all(products.map(async product => serializeProduct(product, { purchase: await ownPurchase(req.readerId, product.id), generatedFile: await latestGeneratedFile(product.id) })));
  res.json({ products: items });
}
router.get("/content/:contentType/:contentId", [param("contentType").isIn(["portal", "lesson"]), param("contentId").isInt({ min: 1 })], validate, resolveReader, ah(async (req, res) => sendCatalog(req, res, req.params.contentType === "lesson" ? { study_lesson_id: req.params.contentId } : { portal_content_id: req.params.contentId })));
router.get("/story/:portalContentId", [param("portalContentId").isInt({ min: 1 })], validate, resolveReader, ah(async (req, res) => sendCatalog(req, res, { portal_content_id: req.params.portalContentId })));

// "Mes achats" — tous les produits achetés par le lecteur, toutes Stories confondues, avec de quoi
// filtrer par type côté frontend (jamais un type de produit codé en dur : `type` vient tel quel de
// digital_products, voir config.js). Deux requêtes plutôt qu'une jointure profonde à 3 niveaux —
// plus lisible, et le volume par lecteur reste faible.
router.get('/purchases', resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise' });

  const purchases = await Purchase.findAll({
    where: { user_id: req.readerId, purchase_status: 'completed' },
    include: [{ model: DigitalProduct, as: 'product', include: [{ model: PortalContent, as: 'story', attributes: ['slug', 'title_fr'] }] }],
    order: [['purchased_at', 'DESC']],
  });
  if (!purchases.length) return res.json({ purchases: [] });

  const productIds = purchases.map(p => p.product.id);
  const generatedFiles = await GeneratedFile.findAll({ where: { digital_product_id: productIds }, order: [['version', 'DESC']] });
  const latestByProduct = new Map();
  for (const file of generatedFiles) if (!latestByProduct.has(file.digital_product_id)) latestByProduct.set(file.digital_product_id, file);

  res.json({
    purchases: purchases.map(purchase => {
      const product = purchase.product;
      const generatedFile = latestByProduct.get(product.id);
      const effective = computeEffectiveState({ product, purchase, generatedFile });
      return {
        purchaseId: purchase.id,
        productId: product.id,
        type: product.type,
        title: product.title,
        storySlug: product.story?.slug || null,
        storyTitle: product.story?.title_fr || null,
        price: purchase.price,
        currency: purchase.currency,
        purchasedAt: purchase.purchased_at,
        version: generatedFile?.version || null,
        ...effective,
      };
    }),
  });
}));

router.post('/:id/purchase', [param('id').isInt({ min: 1 })], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour acheter ce contenu' });

  const product = await DigitalProduct.findByPk(req.params.id);
  if (!product || product.status === 'disabled') return res.status(404).json({ error: 'Produit introuvable' });
  if (product.status === 'coming_soon') return res.status(409).json({ error: 'Ce contenu n\'est pas encore disponible à l\'achat' });

  const story = await resolveProductContent(product);
  if (!story) return res.status(422).json({ error: "Contenu introuvable" });

  // Achat déjà existant — on ne recrée jamais un doublon, on relance juste la vérification du
  // fichier (utile si un achat précédent n'avait pas encore de fichier prêt).
  let purchase = await ownPurchase(req.readerId, product.id);
  if (!purchase) {
    const simulatedProvider = await getProvider('simulated');
    const order = await simulatedProvider.createOrder({ amount: product.price, currency: product.currency });
    purchase = await Purchase.create({
      user_id: req.readerId,
      digital_product_id: product.id,
      purchase_status: order.status === 'completed' ? 'completed' : 'failed',
      payment_provider: 'simulated',
      payment_reference: order.providerOrderId,
      price: product.price,
      currency: product.currency,
      purchased_at: new Date(),
    });
  }

  const generatedFile = await ensureGeneratedFile(product, story);
  res.status(201).json({
    ok: true,
    purchase: { id: purchase.id, status: purchase.purchase_status, reference: purchase.payment_reference },
    product: serializeProduct(product, { purchase, generatedFile }),
  });
}));

// ── Paiement réel (PayPal, futurs providers) — flux à deux temps ────────────────────────────
// Jamais d'appel au SDK/API du provider ici : toute la logique passe par getProvider(), qui
// renvoie la même interface quel que soit le fournisseur réellement actif (voir PaymentProvider.js
// pour la marche à suivre pour en ajouter un nouveau).
router.post('/:id/pay/:provider/create-order', [param('id').isInt({ min: 1 })], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour acheter ce contenu' });

  const product = await DigitalProduct.findByPk(req.params.id);
  if (!product || product.status === 'disabled') return res.status(404).json({ error: 'Produit introuvable' });
  if (product.status === 'coming_soon') return res.status(409).json({ error: 'Ce contenu n\'est pas encore disponible à l\'achat' });

  const provider = await getProvider(req.params.provider);
  const order = await provider.createOrder({
    amount: product.price,
    currency: product.currency,
    description: product.title,
    metadata: { digitalProductId: product.id, userId: req.readerId },
  });
  res.status(201).json({ ok: true, providerOrderId: order.providerOrderId });
}));

router.post('/:id/pay/:provider/capture',
  [param('id').isInt({ min: 1 }), body('providerOrderId').trim().notEmpty()],
  validate, resolveReader, ah(async (req, res) => {
    if (req.isGuest) return res.status(401).json({ error: 'Connexion requise' });

    const product = await DigitalProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });
    const story = await resolveProductContent(product);
    if (!story) return res.status(422).json({ error: "Contenu introuvable" });

    // Vérification serveur AVANT tout — jamais de confiance dans une confirmation côté client
    // ("j'ai payé"). L'achat n'est créé que si le provider confirme lui-même la capture.
    const provider = await getProvider(req.params.provider);
    const capture = await provider.captureOrder(req.body.providerOrderId);
    if (capture.status !== 'completed') {
      return res.status(402).json({ error: 'Paiement non confirmé par le fournisseur' });
    }

    let purchase = await ownPurchase(req.readerId, product.id);
    if (!purchase) {
      purchase = await Purchase.create({
        user_id: req.readerId,
        digital_product_id: product.id,
        purchase_status: 'completed',
        payment_provider: req.params.provider,
        payment_reference: capture.providerCaptureId || req.body.providerOrderId,
        price: product.price,
        currency: product.currency,
        purchased_at: new Date(),
      });
    }

    const generatedFile = await ensureGeneratedFile(product, story);
    res.status(201).json({
      ok: true,
      purchase: { id: purchase.id, status: purchase.purchase_status, reference: purchase.payment_reference },
      product: serializeProduct(product, { purchase, generatedFile }),
    });
  })
);

router.get('/:id/status', [param('id').isInt({ min: 1 })], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise' });
  const product = await DigitalProduct.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  const purchase = await ownPurchase(req.readerId, product.id);
  if (!purchase) return res.status(403).json({ error: 'Ce contenu n\'a pas été acheté' });

  const generatedFile = await latestGeneratedFile(product.id);
  res.json({ product: serializeProduct(product, { purchase, generatedFile }) });
}));

router.get('/:id/download', [param('id').isInt({ min: 1 })], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise' });
  const product = await DigitalProduct.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });

  // Le backend "vérifie simplement que le produit est acheté" (cahier des charges) — jamais de
  // fichier servi sans cette vérification, jamais de chemin fourni par le client.
  const purchase = await ownPurchase(req.readerId, product.id);
  if (!purchase) return res.status(403).json({ error: 'Ce contenu n\'a pas été acheté' });

  const generatedFile = await latestGeneratedFile(product.id);
  if (!generatedFile || generatedFile.status !== 'ready' || !generatedFile.storage_path) {
    return res.status(409).json({ error: 'Le fichier n\'est pas encore prêt' });
  }

  const provider = getStorageProvider();
  if (!(await provider.exists(generatedFile.storage_path))) {
    return res.status(404).json({ error: 'Fichier introuvable' });
  }
  // Passe par getStream() (contrat commun à tout StorageProvider, jamais getAbsolutePath() qui
  // n'a de sens que pour le stockage local) — un futur S3Provider/R2Provider n'a qu'à implémenter
  // getStream(), cette route ne change jamais.
  const extension = EXTENSION_BY_MIME[generatedFile.mime_type] || 'bin';
  const filename = `${product.title.replace(/[^a-z0-9]+/gi, '-')}.${extension}`;
  res.setHeader('Content-Type', generatedFile.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  provider.getStream(generatedFile.storage_path).pipe(res);
}));

module.exports = router;
