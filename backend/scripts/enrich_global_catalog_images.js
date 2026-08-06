#!/usr/bin/env node
'use strict';

/**
 * Enrichissement catalogue — images + code-barres réels via Open Food Facts
 * (produits alimentaires) / Open Beauty Facts (hygiène/cosmétiques — OFF ne
 * couvre quasiment jamais ces catégories, voir openFoodFactsConnector.js).
 *
 * Traite les GlobalProduct sans `data_source` (jamais encore traités),
 * cherche une correspondance sur la base appropriée (nom + marque), et si le
 * score de confiance est suffisant :
 *   - renseigne toujours l'image (risque faible si le match est approximatif) ;
 *   - ne renseigne le code-barres QUE si la correspondance est forte (marque
 *     confirmée + recouvrement de mots) — jamais de code-barres deviné, voir
 *     mission "Ne pas inventer de codes-barres" : uniquement des codes RÉELS.
 * Marque chaque ligne traitée (data_source='openfoodfacts'/'openbeautyfacts'
 * ou '..._not_found') pour ne jamais retraiter deux fois le même produit.
 * En cas d'erreur réseau/HTTP (après retries du connecteur), NE MARQUE RIEN
 * — la ligne reste `data_source IS NULL` et sera retentée au prochain run
 * (bug corrigé : un 503 de limitation ne doit jamais être confondu avec un
 * "vraiment introuvable" permanent).
 *
 * Idempotent et reprenable. Usage : node scripts/enrich_global_catalog_images.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Op } = require('sequelize');
const { sequelize, GlobalProduct, ProductBrand, ProductCategory } = require('../models');
const { normalizeProductName } = require('../src/market/catalog/productNormalizationService');
const { normalizeBarcode, detectBarcodeType } = require('../src/shared/utils/barcode');
const off = require('../src/market/catalog/openFoodFactsConnector');

// Débit volontairement prudent — les deux projets limitent les utilisateurs
// anonymes en rafale (503 observé en pratique lors du développement).
const REQUEST_DELAY_MS = 1200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Catégories (slugs seedés par migrate_global_catalog.js) relevant d'Open
// Beauty Facts plutôt que d'Open Food Facts.
const BEAUTY_CATEGORY_SLUGS = new Set(['soins-du-corps', 'hygiene-bucco-dentaire', 'parfums', 'maquillage', 'soins-du-visage']);

function scoreMatch(product, brandName, candidate) {
  const nameA = normalizeProductName(product.name);
  const nameB = normalizeProductName(candidate.product_name || '');
  const brandsB = normalizeProductName(candidate.brands || '');
  const brandA = normalizeProductName(brandName || '');

  const brandMatch = !!brandA && brandsB.split(' ').some(tok => tok && brandA.includes(tok));
  const tokensA = new Set(nameA.split(' ').filter(t => t.length > 2));
  const tokensB = new Set(nameB.split(' ').filter(t => t.length > 2));
  const overlap = [...tokensA].filter(t => tokensB.has(t)).length;
  const inMorocco = Array.isArray(candidate.countries_tags) && candidate.countries_tags.includes('en:morocco');

  return { score: (brandMatch ? 2 : 0) + overlap + (inMorocco ? 1 : 0), brandMatch, overlap };
}

async function run() {
  await sequelize.authenticate();
  console.log('✓ DB connectée\n');

  const products = await GlobalProduct.findAll({
    where: { data_source: null },
    include: [
      { model: ProductBrand, as: 'brand', attributes: ['id', 'name'], required: false },
      { model: ProductCategory, as: 'category', attributes: ['id', 'slug'], required: false },
    ],
  });
  console.log(`${products.length} produit(s) à traiter\n`);

  let enriched = 0, notFound = 0, barcoded = 0, errors = 0;
  for (const product of products) {
    const database = BEAUTY_CATEGORY_SLUGS.has(product.category?.slug) ? 'beauty' : 'food';
    try {
      const candidates = await off.searchProduct({ name: product.name, brand: product.brand?.name, database });
      await sleep(REQUEST_DELAY_MS);

      let best = null;
      for (const c of candidates) {
        const { score, brandMatch, overlap } = scoreMatch(product, product.brand?.name, c);
        if (!best || score > best.score) best = { ...c, score, brandMatch, overlap };
      }

      const sourceTag = database === 'beauty' ? 'openbeautyfacts' : 'openfoodfacts';

      if (!best || best.score < 1) {
        await product.update({ data_source: `${sourceTag}_not_found`, imported_at: new Date() });
        console.log(`  · "${product.name}" [${database}] — aucune correspondance fiable, ignoré`);
        notFound++;
        continue;
      }

      const imageUrl = best.image_front_url || best.image_url || null;
      const update = {
        data_source: sourceTag,
        source_external_id: best.code || null,
        source_url: best.code ? off.productUrl(best.code, database) : null,
        license: off.LICENSE_NOTE,
        imported_at: new Date(),
      };
      if (imageUrl) update.image_url = imageUrl;

      // Code-barres réel, jamais deviné — seulement si correspondance forte
      // (marque confirmée + au moins un mot du nom en commun) et si le
      // produit n'a pas déjà un code-barres (jamais de remplacement).
      const highConfidence = best.brandMatch && best.overlap >= 1;
      if (highConfidence && !product.barcode && best.code) {
        const normalized = normalizeBarcode(best.code);
        const existing = await GlobalProduct.findOne({ where: { barcode: normalized, id: { [Op.ne]: product.id } } });
        if (!existing) {
          update.barcode = normalized;
          update.barcode_type = detectBarcodeType(normalized);
          update.barcode_source = 'IMPORT';
          barcoded++;
        }
      }

      await product.update(update);
      console.log(`  ✓ "${product.name}" [${database}] ← "${best.product_name}" (score ${best.score}${imageUrl ? ', image' : ''}${update.barcode ? ', code-barres ' + update.barcode : ''})`);
      enriched++;
    } catch (e) {
      console.log(`  ⚠️  "${product.name}" [${database}] — erreur : ${e.message} (ignoré, relançable)`);
      errors++;
    }
  }

  console.log(`\n✅ Enrichissement terminé — ${enriched} enrichi(s) (dont ${barcoded} avec code-barres réel), ${notFound} sans correspondance, ${errors} erreur(s) réseau (relançables)`);
  await sequelize.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
