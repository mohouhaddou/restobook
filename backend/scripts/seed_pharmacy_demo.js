#!/usr/bin/env node
'use strict';
/**
 * Seed démo Pharmacie — catalogue médicaments + parapharmacie avec images,
 * + logo/cover de la pharmacie de test.
 *
 * Cible : org slug 'pharmacie-test-atlas' (créée via le flux d'inscription pro).
 * Idempotent : upsert par (organization_id, name).
 *
 * Usage : node backend/scripts/seed_pharmacy_demo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Organization, Business, PharmacyMedicine, PharmacyMedicineLot } = require('../models');

const img = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=600&q=75`;

const COVER_URL = img('1622253692010-333f2da6031d'); // rayons de pharmacie
const LOGO_URL  = img('1587854692152-cbe660dbde88');  // pilulier / croix pharmacie

const PRODUCTS = [
  // ── Médicaments ──────────────────────────────────────────────────────────
  { name:'Doliprane 1000mg', dci:'Paracétamol', laboratory:'Sanofi', category:'Antalgique', form:'comprime', dosage:'1000mg', purchase_price:15, sale_price:22, vat_rate:7, stock_min:20, requires_prescription:false, marketplace_visible:true, image_url:img('1584017911766-d451b3d0e843'), description:"Antalgique et antipyrétique, traitement symptomatique de la douleur et/ou de la fièvre." },
  { name:'Efferalgan 500mg', dci:'Paracétamol', laboratory:'UPSA', category:'Antalgique', form:'comprime', dosage:'500mg', purchase_price:12, sale_price:18, vat_rate:7, stock_min:20, requires_prescription:false, marketplace_visible:true, image_url:img('1471864190281-a93a3070b6de'), description:"Comprimés effervescents pour douleurs légères à modérées." },
  { name:'Aspirine UPSA 500mg', dci:'Acide acétylsalicylique', laboratory:'UPSA', category:'Antalgique', form:'comprime', dosage:'500mg', purchase_price:10, sale_price:16, vat_rate:7, stock_min:15, requires_prescription:false, marketplace_visible:true, image_url:img('1576602976047-174e57a47881'), description:"Antalgique, antipyrétique et anti-inflammatoire." },
  { name:'Ibuprofène 400mg', dci:'Ibuprofène', laboratory:'Mylan', category:'Anti-inflammatoire', form:'comprime', dosage:'400mg', purchase_price:14, sale_price:20, vat_rate:7, stock_min:15, requires_prescription:false, marketplace_visible:true, image_url:img('1550572017-edd951b55104'), description:"Anti-inflammatoire non stéroïdien." },
  { name:'Amoxicilline 500mg', dci:'Amoxicilline', laboratory:'Sandoz', category:'Antibiotique', form:'comprime', dosage:'500mg', purchase_price:25, sale_price:38, vat_rate:7, stock_min:10, requires_prescription:true, marketplace_visible:false, image_url:img('1607619056574-7b8d3ee536b2'), description:"Antibiotique à large spectre — délivrance sur ordonnance uniquement." },
  { name:'Augmentin 1g', dci:'Amoxicilline/Acide clavulanique', laboratory:'GSK', category:'Antibiotique', form:'comprime', dosage:'1g', purchase_price:45, sale_price:68, vat_rate:7, stock_min:8, requires_prescription:true, marketplace_visible:false, image_url:img('1573883431205-98b5f10aaedb'), description:"Antibiotique — délivrance sur ordonnance uniquement." },
  { name:'Ventoline 100µg', dci:'Salbutamol', laboratory:'GSK', category:'Respiratoire', form:'autre', dosage:'100µg/dose', purchase_price:30, sale_price:45, vat_rate:7, stock_min:5, requires_prescription:true, marketplace_visible:false, image_url:img('1532938911079-1b06ac7ceec7'), description:"Bronchodilatateur inhalé — délivrance sur ordonnance uniquement." },
  { name:'Levothyrox 75µg', dci:'Lévothyroxine', laboratory:'Merck', category:'Hormones', form:'comprime', dosage:'75µg', purchase_price:20, sale_price:30, vat_rate:7, stock_min:10, requires_prescription:true, marketplace_visible:false, image_url:img('1612817288484-6f916006741a'), description:"Hormone thyroïdienne de substitution — délivrance sur ordonnance uniquement." },
  { name:'Smecta', dci:'Diosmectite', laboratory:'Ipsen', category:'Digestif', form:'autre', dosage:'3g/sachet', purchase_price:18, sale_price:27, vat_rate:7, stock_min:15, requires_prescription:false, marketplace_visible:true, image_url:img('1556760544-74068565f05c'), description:"Traitement symptomatique de la diarrhée, sachets." },
  { name:'Spasfon', dci:'Phloroglucinol', laboratory:'Teva', category:'Antispasmodique', form:'comprime', dosage:'80mg', purchase_price:22, sale_price:33, vat_rate:7, stock_min:12, requires_prescription:false, marketplace_visible:true, image_url:img('1571781926291-c477ebfd024b'), description:"Traitement symptomatique des douleurs spasmodiques." },
  { name:'Maalox', dci:'Hydroxyde d\'aluminium/magnésium', laboratory:'Sanofi', category:'Digestif', form:'comprime', dosage:'400mg/400mg', purchase_price:16, sale_price:24, vat_rate:7, stock_min:15, requires_prescription:false, marketplace_visible:true, image_url:img('1576091160550-2173dba999ef'), description:"Traitement symptomatique des brûlures d'estomac." },
  { name:'Fervex', dci:'Paracétamol/Pseudoéphédrine', laboratory:'UPSA', category:'Rhume & grippe', form:'autre', dosage:'sachet', purchase_price:24, sale_price:36, vat_rate:7, stock_min:15, requires_prescription:false, marketplace_visible:true, image_url:img('1599045118108-bf9954418b76'), description:"Traitement symptomatique du rhume avec état grippal." },
  { name:'Toplexil sirop', dci:'Oxomémazine', laboratory:'Sanofi', category:'Antitussif', form:'sirop', dosage:'150ml', purchase_price:28, sale_price:42, vat_rate:7, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1556228720-195a672e8a03'), description:"Sirop antitussif pour toux sèche." },
  { name:'Daflon 500mg', dci:'Diosmine/Hespéridine', laboratory:'Servier', category:'Circulation', form:'comprime', dosage:'500mg', purchase_price:55, sale_price:78, vat_rate:7, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1505751172876-fa1923c5c528'), description:"Traitement des symptômes liés à l'insuffisance veino-lymphatique." },
  { name:'Vitamine C 1000mg', dci:'Acide ascorbique', laboratory:'Upsa', category:'Vitamines', form:'comprime', dosage:'1000mg effervescent', purchase_price:25, sale_price:38, vat_rate:7, stock_min:20, requires_prescription:false, marketplace_visible:true, image_url:img('1631549916768-4119b2e5f926'), description:"Complément en vitamine C, comprimés effervescents." },
  { name:'Vitamine D3 Uvedose', dci:'Cholécalciférol', laboratory:'Crinex', category:'Vitamines', form:'autre', dosage:'100 000 UI', purchase_price:30, sale_price:45, vat_rate:7, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1631815589968-fdb09a223b1e'), description:"Supplémentation en vitamine D, ampoule buvable." },
  { name:'Betadine solution', dci:'Povidone iodée', laboratory:'Mylan', category:'Antiseptique', form:'autre', dosage:'10% — 125ml', purchase_price:20, sale_price:30, vat_rate:7, stock_min:15, requires_prescription:false, marketplace_visible:true, image_url:img('1576426863848-c21f53c60b19'), description:"Antiseptique local à large spectre." },
  { name:'Compeed pansements ampoules', dci:null, laboratory:'Compeed', category:'Premiers secours', form:'autre', dosage:'boîte de 5', purchase_price:35, sale_price:52, vat_rate:20, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1583947581924-860bda6a26df'), description:"Pansements hydrocolloïdes pour ampoules." },

  // ── Parapharmacie ────────────────────────────────────────────────────────
  { name:'Avène Crème Hydratante', dci:null, laboratory:'Avène', category:'Parapharmacie — Soin visage', form:'pommade', dosage:'50ml', purchase_price:60, sale_price:95, vat_rate:20, stock_min:8, requires_prescription:false, marketplace_visible:true, image_url:img('1576091160399-112ba8d25d1d'), description:"Crème hydratante apaisante pour peaux sensibles." },
  { name:'La Roche-Posay Anthelios SPF50+', dci:null, laboratory:'La Roche-Posay', category:'Parapharmacie — Solaire', form:'pommade', dosage:'50ml', purchase_price:90, sale_price:140, vat_rate:20, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1571019613454-1cb2f99b2d8b'), description:"Protection solaire très haute protection visage." },
  { name:'Bioderma Sensibio H2O', dci:null, laboratory:'Bioderma', category:'Parapharmacie — Démaquillant', form:'autre', dosage:'500ml', purchase_price:75, sale_price:115, vat_rate:20, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1556228578-8c89e6adf883'), description:"Eau micellaire démaquillante pour peaux sensibles." },
  { name:'Mustela Lait Hydratant Bébé', dci:null, laboratory:'Mustela', category:'Parapharmacie — Bébé', form:'pommade', dosage:'300ml', purchase_price:65, sale_price:98, vat_rate:20, stock_min:8, requires_prescription:false, marketplace_visible:true, image_url:img('1559757148-5c350d0d3c56'), description:"Lait hydratant corps pour peau de bébé." },
  { name:'Klorane Shampoing Camomille', dci:null, laboratory:'Klorane', category:'Parapharmacie — Cheveux', form:'autre', dosage:'200ml', purchase_price:45, sale_price:68, vat_rate:20, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1556228453-efd6c1ff04f6'), description:"Shampoing illuminateur reflets pour cheveux blonds." },
  { name:'Cetaphil Gel Douche', dci:null, laboratory:'Cetaphil', category:'Parapharmacie — Hygiène', form:'autre', dosage:'500ml', purchase_price:55, sale_price:82, vat_rate:20, stock_min:10, requires_prescription:false, marketplace_visible:true, image_url:img('1599305445671-ac291c95aaa9'), description:"Nettoyant doux pour peaux sensibles, sans savon." },
];

async function main() {
  const org = await Organization.findOne({ where: { slug: 'pharmacie-test-atlas' } });
  if (!org) { console.error("❌ Org 'pharmacie-test-atlas' introuvable — inscris/approuve d'abord le compte pharmacie de test"); process.exit(1); }
  const biz = await Business.findOne({ where: { organization_id: org.id } });

  console.log(`✅ Org trouvée : ${org.name} (id=${org.id})\n`);

  // ── Logo + cover ──────────────────────────────────────────────────────
  await org.update({ logo_url: LOGO_URL, cover_url: COVER_URL });
  if (biz) await biz.update({ logo: LOGO_URL, cover_image: COVER_URL });
  console.log('✅ Logo et photo de couverture mis à jour\n');

  // ── Catalogue produits ────────────────────────────────────────────────
  let created = 0, updated = 0;
  for (const p of PRODUCTS) {
    const [row, wasCreated] = await PharmacyMedicine.findOrCreate({
      where: { organization_id: org.id, name: p.name },
      defaults: { organization_id: org.id, ...p },
    });
    if (wasCreated) { created++; console.log(`  ➕ ${p.name}`); }
    else {
      await row.update(p);
      updated++; console.log(`  ↻ ${p.name}`);
    }
  }

  console.log(`\n🎉 Catalogue : ${created} créé(s), ${updated} mis à jour, ${PRODUCTS.length} produits au total.\n`);

  // ── Lots de stock (pour les produits qui n'en ont aucun) ─────────────────
  const allMeds = await PharmacyMedicine.findAll({ where: { organization_id: org.id } });
  const today = new Date();
  let lotsCreated = 0;
  for (let i = 0; i < allMeds.length; i++) {
    const med = allMeds[i];
    const existing = await PharmacyMedicineLot.count({ where: { medicine_id: med.id } });
    if (existing > 0) continue;

    // Quelques lots proches péremption pour démontrer les alertes, le reste à échéance saine
    const expiryDays = i % 7 === 0 ? 25 : i % 5 === 0 ? 75 : 365 + (i * 11) % 300;
    const expiry = new Date(today); expiry.setDate(expiry.getDate() + expiryDays);
    const entry = new Date(today); entry.setDate(entry.getDate() - (10 + i));
    const qty = 8 + (i * 7) % 40;

    await PharmacyMedicineLot.create({
      organization_id: org.id, medicine_id: med.id,
      lot_number: `LOT-${String(med.id).padStart(3,'0')}-${today.getFullYear()}`,
      quantity_initial: qty, quantity_remaining: qty,
      entry_date: entry.toISOString().slice(0,10), expiry_date: expiry.toISOString().slice(0,10),
      purchase_price: Number(med.purchase_price) || 0, status: 'active',
    });
    await med.update({ stock_quantity: qty });
    lotsCreated++;
  }
  console.log(`✅ ${lotsCreated} lot(s) de stock créé(s) (certains à péremption proche pour tester les alertes).`);
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
