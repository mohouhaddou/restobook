#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Organization, Business, HanoutCategory, HanoutProduct } = require('../models');

async function main() {
  // Org hanout
  let org = await Organization.findOne({ where: { slug: 'hanout-brahim' } });
  if (!org) {
    org = await Organization.create({
      name: 'Hanout Brahim',
      slug: 'hanout-brahim',
      org_type: 'restaurant',
      city: 'Casablanca',
      address: '12 Rue des Fleurs, Maârif',
      phone: '0612345678',
      status: 'approved',
      is_marketplace: true,
      is_internal: false,
      module: 'hanout',
    });
    console.log('✅ Org créée id=', org.id);
  } else {
    console.log('✅ Org existante id=', org.id);
  }

  // Business
  let biz = await Business.findOne({ where: { organization_id: org.id } });
  if (!biz) {
    biz = await Business.create({
      organization_id: org.id,
      business_type: 'hanout',
      status: 'approved',
      is_public: true,
      name: 'Hanout Brahim',
      display_name: 'Hanout Brahim',
      district: 'Maârif',
      whatsapp: '212612345678',
    });
    console.log('✅ Business créé id=', biz.id);
  } else {
    console.log('✅ Business existant id=', biz.id);
  }

  // Catégories
  const catData = [
    { name: 'Épicerie', icon: '🛒', sort_order: 0 },
    { name: 'Boissons', icon: '🥤', sort_order: 1 },
    { name: 'Produits laitiers', icon: '🥛', sort_order: 2 },
    { name: 'Snacks', icon: '🍿', sort_order: 3 },
  ];
  const cats = [];
  for (const c of catData) {
    const [cat] = await HanoutCategory.findOrCreate({ where: { organization_id: org.id, name: c.name }, defaults: { ...c, organization_id: org.id } });
    cats.push(cat);
  }
  console.log('✅', cats.length, 'catégories prêtes');

  // Produits
  const products = [
    { name: 'Coca-Cola 33cl', price: 8, category_id: cats[1].id, unit: 'pièce', available: true },
    { name: 'Eau Minérale 1.5L', price: 6, category_id: cats[1].id, unit: 'bouteille', available: true },
    { name: 'Lait Centrale 1L', price: 12, category_id: cats[2].id, unit: 'bouteille', available: true, track_stock: true, stock_quantity: 30 },
    { name: 'Fromage Vache qui Rit 8p', price: 22, category_id: cats[2].id, unit: 'boîte', available: true },
    { name: 'Chips Lay\'s', price: 10, category_id: cats[3].id, unit: 'paquet', available: true },
    { name: 'Biscuits BN', price: 14, category_id: cats[3].id, unit: 'paquet', available: true },
    { name: 'Huile de Table 1L', price: 28, compare_price: 32, category_id: cats[0].id, unit: 'l', available: true },
    { name: 'Sucre 1kg', price: 15, category_id: cats[0].id, unit: 'kg', available: true },
  ];

  let created = 0;
  for (const p of products) {
    const [, isNew] = await HanoutProduct.findOrCreate({ where: { organization_id: org.id, name: p.name }, defaults: { ...p, organization_id: org.id } });
    if (isNew) created++;
  }
  console.log('✅', created, 'produits créés,', products.length - created, 'existants');
  console.log('\n🎉 Seed hanout terminé');
  console.log('   Page client : /h/hanout-brahim');
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
