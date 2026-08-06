#!/usr/bin/env node
'use strict';

/**
 * Seed de démonstration — catalogue produit partagé.
 * ~30 produits réels et courants au Maroc, saisis manuellement par l'équipe
 * (status='verified' directement — pas une soumission commerçant), sans
 * code-barres (aucun code n'est inventé, voir contrainte §19 de la mission
 * "Ne pas inventer de codes-barres") et sans image (aucune image scrapée —
 * l'UI retombe sur l'icône 📦 par défaut tant qu'aucune image fiable n'est
 * fournie). But : rendre la recherche/l'autocomplétion utilisables dès la
 * première démo, avant tout connecteur d'import réel (Phase 3, non construit).
 *
 * Idempotent : ignore silencieusement un produit dont le slug existe déjà.
 * Usage : node scripts/seed_global_catalog_sample.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, GlobalProduct, ProductBrand, ProductCategory } = require('../models');
const { generateUniqueSlug, slugify } = require('../src/shared/utils/slug');
const { normalizeProductName } = require('../src/modules/catalog/productNormalizationService');

// { name, brand, category (slug), unit }
const PRODUCTS = [
  // ── Boissons gazeuses ──────────────────────────────────────────────────
  { name: 'Coca-Cola 1.5L', brand: 'Coca-Cola', category: 'boissons-gazeuses', unit: 'bouteille' },
  { name: 'Coca-Cola Zero 1.5L', brand: 'Coca-Cola', category: 'boissons-gazeuses', unit: 'bouteille' },
  { name: 'Fanta Orange 1.5L', brand: 'Fanta', category: 'boissons-gazeuses', unit: 'bouteille' },
  { name: 'Sprite 1.5L', brand: 'Sprite', category: 'boissons-gazeuses', unit: 'bouteille' },
  { name: 'Hawai Orange 1L', brand: 'Hawai', category: 'boissons-gazeuses', unit: 'bouteille' },

  // ── Eau ────────────────────────────────────────────────────────────────
  { name: 'Eau Sidi Ali 1.5L', brand: 'Sidi Ali', category: 'eau', unit: 'bouteille' },
  { name: 'Eau Sidi Ali 0.5L', brand: 'Sidi Ali', category: 'eau', unit: 'bouteille' },
  { name: 'Eau Sidi Harazem 1.5L', brand: 'Sidi Harazem', category: 'eau', unit: 'bouteille' },
  { name: 'Eau Oulmès 1L', brand: 'Oulmès', category: 'eau', unit: 'bouteille' },
  { name: 'Eau Ain Saiss 1.5L', brand: 'Ain Saiss', category: 'eau', unit: 'bouteille' },

  // ── Jus ────────────────────────────────────────────────────────────────
  { name: 'Jus Marrakech Orange 1L', brand: 'Marrakech', category: 'jus', unit: 'bouteille' },
  { name: 'Jus Rani Pêche 1L', brand: 'Rani', category: 'jus', unit: 'bouteille' },
  { name: "Jus Pom's Multifruits 1L", brand: "Pom's", category: 'jus', unit: 'bouteille' },

  // ── Pâtes et riz ───────────────────────────────────────────────────────
  { name: 'Riz Dari 1kg', brand: 'Dari', category: 'pates-et-riz', unit: 'sac' },
  { name: 'Pâtes Dari Spaghetti 500g', brand: 'Dari', category: 'pates-et-riz', unit: 'paquet' },

  // ── Conserves ──────────────────────────────────────────────────────────
  { name: 'Aïcha Tomate Concentrée 400g', brand: 'Aïcha', category: 'conserves', unit: 'boîte' },
  { name: 'Aïcha Haricots Blancs 400g', brand: 'Aïcha', category: 'conserves', unit: 'boîte' },
  { name: 'Aïcha Thon Naturel 160g', brand: 'Aïcha', category: 'conserves', unit: 'boîte' },

  // ── Huiles ─────────────────────────────────────────────────────────────
  { name: 'Huile Lesieur Tournesol 1L', brand: 'Lesieur', category: 'huiles', unit: 'bouteille' },
  { name: "Huile d'Olive Lesieur 1L", brand: 'Lesieur', category: 'huiles', unit: 'bouteille' },
  { name: 'Huile El Ouali 1L', brand: 'El Ouali', category: 'huiles', unit: 'bouteille' },
  { name: 'Huile Afia 1L', brand: 'Afia', category: 'huiles', unit: 'bouteille' },

  // ── Soins du corps ─────────────────────────────────────────────────────
  { name: 'Savon Dove Original 100g', brand: 'Dove', category: 'soins-du-corps', unit: 'pièce' },
  { name: 'Gel Douche Palmolive 250ml', brand: 'Palmolive', category: 'soins-du-corps', unit: 'bouteille' },
  { name: 'Lait Corporel Nivea 400ml', brand: 'Nivea', category: 'soins-du-corps', unit: 'bouteille' },
  { name: 'Déodorant Nivea Men 150ml', brand: 'Nivea', category: 'soins-du-corps', unit: 'pièce' },

  // ── Hygiène bucco-dentaire ─────────────────────────────────────────────
  { name: 'Dentifrice Signal 75ml', brand: 'Signal', category: 'hygiene-bucco-dentaire', unit: 'pièce' },
  { name: 'Dentifrice Colgate Total 75ml', brand: 'Colgate', category: 'hygiene-bucco-dentaire', unit: 'pièce' },
  { name: 'Dentifrice Sensodyne 75ml', brand: 'Sensodyne', category: 'hygiene-bucco-dentaire', unit: 'pièce' },

  // ── Soins du visage ────────────────────────────────────────────────────
  { name: 'Crème Nivea Soft 200ml', brand: 'Nivea', category: 'soins-du-visage', unit: 'pièce' },
  { name: "Crème Pond's 50g", brand: "Pond's", category: 'soins-du-visage', unit: 'pièce' },
];

async function run() {
  await sequelize.authenticate();
  console.log('✓ DB connectée\n');

  const brandCache = new Map();
  async function resolveBrand(name) {
    if (brandCache.has(name)) return brandCache.get(name);
    const slug = await generateUniqueSlug(ProductBrand, name);
    const [brand] = await ProductBrand.findOrCreate({ where: { name }, defaults: { name, slug, status: 'active' } });
    brandCache.set(name, brand.id);
    return brand.id;
  }

  const categoryCache = new Map();
  async function resolveCategory(slug) {
    if (categoryCache.has(slug)) return categoryCache.get(slug);
    const cat = await ProductCategory.findOne({ where: { slug } });
    if (!cat) console.log(`  ⚠️  catégorie "${slug}" introuvable — exécutez d'abord migrate:global-catalog`);
    categoryCache.set(slug, cat ? cat.id : null);
    return cat ? cat.id : null;
  }

  let created = 0, skipped = 0;
  for (const p of PRODUCTS) {
    const rootSlug = slugify(p.name);
    const existing = await GlobalProduct.findOne({ where: { slug: rootSlug } });
    if (existing) { console.log(`  · "${p.name}" déjà présent — ignoré`); skipped++; continue; }

    const brandId = await resolveBrand(p.brand);
    const categoryId = await resolveCategory(p.category);
    const slug = await generateUniqueSlug(GlobalProduct, p.name, { disambiguator: p.brand });

    await GlobalProduct.create({
      name: p.name,
      normalized_name: normalizeProductName(p.name),
      slug,
      brand_id: brandId,
      category_id: categoryId,
      unit: p.unit,
      status: 'verified',
      verified_at: new Date(),
    });
    console.log(`  ✓ "${p.name}" créé`);
    created++;
  }

  console.log(`\n✅ Seed terminé — ${created} créé(s), ${skipped} déjà présent(s)`);
  await sequelize.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
