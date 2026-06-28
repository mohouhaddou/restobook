'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Organization, User, MenuItem, DailyMenu, DailyMenuItem, Setting, Reservation } = require('../models');
const crypto = require('crypto');

const genCode = (len = 10) => crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();

async function seed() {
  await sequelize.authenticate();
  console.log('✓ DB connectée\n');

  // ════════════════════════════════════════════════════════════════
  // ORG 1 — Cantine d'entreprise TechCorp
  // ════════════════════════════════════════════════════════════════
  console.log('── Org 1 : Cantine TechCorp ─────────────────────────────');
  const [corp] = await Organization.findOrCreate({
    where: { slug: 'techcorp-canteen' },
    defaults: { name: 'Cantine TechCorp', type: 'canteen', plan: 'pro', active: true }
  });
  console.log(`  id=${corp.id} slug=${corp.slug}`);

  await upsertSettings(corp.id, { cutoff_time: '10:30', allow_cancel_until: '10:00', description: 'Cantine de l\'entreprise TechCorp — 200 employés' });

  const corpItems = await seedItems(corp.id, [
    { libelle: 'Tajine poulet',      description: 'Citron confit, olives vertes',   type: 'plat',    prix: null },
    { libelle: 'Couscous agneau',    description: 'Légumes de saison',              type: 'plat',    prix: null },
    { libelle: 'Poisson grillé',     description: 'Filet de daurade, légumes',      type: 'plat',    prix: null },
    { libelle: 'Salade marocaine',   description: 'Tomate, oignon, poivron',        type: 'entrée',  prix: null },
    { libelle: 'Harira',             description: 'Soupe traditionnelle',           type: 'entrée',  prix: null },
    { libelle: 'Tarte aux pommes',   description: 'Fait maison',                    type: 'dessert', prix: null },
    { libelle: 'Yaourt nature',      description: '',                               type: 'dessert', prix: null },
    { libelle: 'Eau minérale',       description: '50cl',                           type: 'boisson', prix: null },
    { libelle: 'Jus d\'orange',      description: 'Frais pressé',                   type: 'boisson', prix: null },
  ]);

  await seedUsers(corp.id, [
    { matricule: 'owner.corp',   nom: 'Owner TechCorp',    role: 'owner',   pwd: 'owner123'   },
    { matricule: 'admin.corp',   nom: 'Admin TechCorp',    role: 'admin',   pwd: 'admin123'   },
    { matricule: 'manager.corp', nom: 'Manager Cantine',   role: 'manager', pwd: 'manager123' },
    { matricule: 'staff.corp',   nom: 'Agent Validation',  role: 'staff',   pwd: 'staff123'   },
    { matricule: 'EMP001',       nom: 'Alice Martin',      role: 'user',    pwd: 'user123'    },
    { matricule: 'EMP002',       nom: 'Bob Dupont',        role: 'user',    pwd: 'user123'    },
    { matricule: 'EMP003',       nom: 'Carole Leroy',      role: 'user',    pwd: 'user123'    },
  ]);

  // Menus des 3 prochains jours pour TechCorp
  await seedWeekMenus(corp.id, corpItems);
  console.log('  ✓ Menus hebdo créés');

  // ════════════════════════════════════════════════════════════════
  // ORG 2 — École primaire Jules Ferry
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Org 2 : École Jules Ferry ────────────────────────────');
  const [ecole] = await Organization.findOrCreate({
    where: { slug: 'ecole-jules-ferry' },
    defaults: { name: 'École Primaire Jules Ferry', type: 'canteen', plan: 'starter', active: true }
  });
  console.log(`  id=${ecole.id} slug=${ecole.slug}`);

  await upsertSettings(ecole.id, { cutoff_time: '08:30', allow_cancel_until: '08:00', description: 'Cantine de l\'école primaire Jules Ferry' });

  const ecoleItems = await seedItems(ecole.id, [
    { libelle: 'Steak haché',        description: 'Avec frites maison',             type: 'plat',    prix: null },
    { libelle: 'Poisson pané',       description: 'Semoule, petits pois',           type: 'plat',    prix: null },
    { libelle: 'Poulet rôti',        description: 'Purée maison',                   type: 'plat',    prix: null },
    { libelle: 'Carottes râpées',    description: 'Vinaigrette légère',             type: 'entrée',  prix: null },
    { libelle: 'Soupe de légumes',   description: 'Du jardin',                      type: 'entrée',  prix: null },
    { libelle: 'Compote de pommes',  description: 'Sans sucre ajouté',              type: 'dessert', prix: null },
    { libelle: 'Fromage blanc',      description: '0% matière grasse',              type: 'dessert', prix: null },
    { libelle: 'Eau plate',          description: '',                               type: 'boisson', prix: null },
  ]);

  await seedUsers(ecole.id, [
    { matricule: 'owner.ecole',   nom: 'Directrice Dupuis',   role: 'owner',   pwd: 'owner123'   },
    { matricule: 'manager.ecole', nom: 'Gestionnaire Cantine', role: 'manager', pwd: 'manager123' },
    { matricule: 'EL001',         nom: 'Lucas Bernard',        role: 'user',    pwd: 'user123'    },
    { matricule: 'EL002',         nom: 'Emma Moreau',          role: 'user',    pwd: 'user123'    },
    { matricule: 'PROF01',        nom: 'M. Rousseau',          role: 'user',    pwd: 'user123'    },
  ]);

  await seedWeekMenus(ecole.id, ecoleItems);
  console.log('  ✓ Menus hebdo créés');

  // ════════════════════════════════════════════════════════════════
  // ORG 3 — Snack Le Rapide (restaurant)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Org 3 : Snack Le Rapide ──────────────────────────────');
  const [snack] = await Organization.findOrCreate({
    where: { slug: 'snack-le-rapide' },
    defaults: { name: 'Snack Le Rapide', type: 'restaurant', plan: 'pro', active: true }
  });
  console.log(`  id=${snack.id} slug=${snack.slug}`);

  await upsertSettings(snack.id, {
    description: 'Snack & click & collect — ouvert 11h-22h',
    address:     '12 rue de la Paix, Casablanca',
    phone:       '+212 6 00 11 22 33',
    hours:       'Lun-Sam 11h-22h, Dim 12h-20h',
  });

  await seedItems(snack.id, [
    { libelle: 'Burger Classic',     description: 'Steak bœuf, cheddar, salade, tomate',  type: 'plat',    prix: 45.00 },
    { libelle: 'Burger Poulet',      description: 'Blanc de poulet grillé, sauce maison',  type: 'plat',    prix: 40.00 },
    { libelle: 'Wrap Végétarien',    description: 'Légumes grillés, hummus, taboulé',       type: 'plat',    prix: 35.00 },
    { libelle: 'Pizza Margherita',   description: 'Tomate, mozzarella, basilic frais',      type: 'plat',    prix: 55.00 },
    { libelle: 'Sandwich Mixte',     description: 'Jambon, fromage, beurre, cornichons',    type: 'plat',    prix: 28.00 },
    { libelle: 'Salade César',       description: 'Poulet, parmesan, croûtons, sauce',      type: 'entrée',  prix: 32.00 },
    { libelle: 'Soupe du jour',      description: 'Selon arrivage',                          type: 'entrée',  prix: 18.00 },
    { libelle: 'Brownie chocolat',   description: 'Fondant, noix de pécan',                 type: 'dessert', prix: 22.00 },
    { libelle: 'Tiramisu',           description: 'Recette originale',                      type: 'dessert', prix: 25.00 },
    { libelle: 'Coca-Cola',          description: '33cl',                                   type: 'boisson', prix: 12.00 },
    { libelle: 'Jus frais orange',   description: 'Pressé minute',                          type: 'boisson', prix: 20.00 },
    { libelle: 'Eau Sidi Ali',       description: '50cl',                                   type: 'boisson', prix: 8.00  },
  ]);

  await seedUsers(snack.id, [
    { matricule: 'owner.snack',   nom: 'Patron Le Rapide',   role: 'owner',   pwd: 'owner123'   },
    { matricule: 'manager.snack', nom: 'Manager Snack',       role: 'manager', pwd: 'manager123' },
    { matricule: 'staff.snack',   nom: 'Caissier Ali',        role: 'staff',   pwd: 'staff123'   },
  ]);

  console.log('\n✅ Seeders de démo terminés.');
  console.log('\n── Comptes disponibles ──────────────────────────────────');
  console.log('  superadmin     / super123    → accès global');
  console.log('  owner.corp     / owner123    → propriétaire cantine TechCorp');
  console.log('  manager.corp   / manager123  → gestionnaire TechCorp');
  console.log('  EMP001         / user123     → employé TechCorp');
  console.log('  owner.ecole    / owner123    → directrice école Jules Ferry');
  console.log('  owner.snack    / owner123    → patron Snack Le Rapide');
  console.log('  manager.snack  / manager123  → manager snack');

  await sequelize.close();
}

async function upsertSettings(orgId, dict) {
  for (const [key, value] of Object.entries(dict)) {
    if (value === undefined || value === null) continue;
    // UPDATE … ON DUPLICATE KEY pour éviter tout conflit d'index
    await Setting.upsert({ key, value, organization_id: orgId });
  }
}

async function seedItems(orgId, list) {
  const created = [];
  for (const it of list) {
    const [item] = await MenuItem.findOrCreate({
      where: { libelle: it.libelle, organization_id: orgId },
      defaults: { ...it, actif: true, organization_id: orgId }
    });
    created.push(item);
  }
  return created;
}

async function seedUsers(orgId, list) {
  for (const u of list) {
    const hash = await bcrypt.hash(u.pwd, 10);
    await User.findOrCreate({
      where: { matricule: u.matricule },
      defaults: { nom: u.nom, role: u.role, hash_mdp: hash, actif: true, organization_id: orgId }
    });
  }
}

async function seedWeekMenus(orgId, items) {
  const plats    = items.filter(i => i.type === 'plat');
  const entrees  = items.filter(i => i.type === 'entrée');
  const desserts = items.filter(i => i.type === 'dessert');
  const boissons = items.filter(i => i.type === 'boisson');

  // 5 jours à partir d'aujourd'hui (lun–ven)
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0,10);

    const [daily] = await DailyMenu.findOrCreate({
      where: { date_jour: dateStr, organization_id: orgId },
      defaults: { locked: false, organization_id: orgId }
    });

    // Ne pas écraser les menus existants
    const existCount = await DailyMenuItem.count({ where: { daily_menu_id: daily.id } });
    if (existCount > 0) continue;

    // 2 plats, 1 entrée, 1 dessert, 2 boissons par jour (rotation circulaire)
    const itemsForDay = [
      plats[i % plats.length],
      plats[(i + 1) % plats.length],
      entrees[i % entrees.length],
      desserts[i % desserts.length],
      ...(boissons.length ? [boissons[0]] : []),
    ].filter(Boolean);

    for (const it of itemsForDay) {
      await DailyMenuItem.create({
        daily_menu_id: daily.id,
        menu_item_id:  it.id,
        stock_quota:   null // illimité pour la démo
      });
    }
  }
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
