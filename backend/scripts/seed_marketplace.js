'use strict';

/**
 * Seeder marketplace enrichi — Phase H
 * Ajoute : clients, livreurs, profils restaurants complets, commandes exemple, coupons, avis
 * Idempotent (findOrCreate + upsert)
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  sequelize, Organization, User, MenuItem, MenuCategory,
  Order, OrderItem, Coupon, Review, Delivery
} = require('../models');

const genCode = (len = 8) =>
  crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();

async function seed() {
  await sequelize.authenticate();
  console.log('✓ DB connectée\n');

  // ════════════════════════════════════════════════════════════════
  // 1. Enrichir les restaurants existants avec données marketplace
  // ════════════════════════════════════════════════════════════════
  console.log('── 1. Enrichissement restaurants ────────────────────────────');

  const snack = await Organization.findOne({ where: { slug: 'snack-le-rapide' } });
  if (snack) {
    await snack.update({
      city:             'Casablanca',
      zone:             'Maarif',
      cuisine_type:     'Burger, Pizza, Sandwichs',
      logo_url:         null,
      cover_url:        null,
      opening_hours:    { mon:{open:'11:00',close:'22:00'}, tue:{open:'11:00',close:'22:00'}, wed:{open:'11:00',close:'22:00'}, thu:{open:'11:00',close:'22:00'}, fri:{open:'11:00',close:'23:00'}, sat:{open:'11:00',close:'23:00'}, sun:{open:'12:00',close:'20:00'} },
      accepts_delivery: true,
      accepts_takeaway: true,
      accepts_dine_in:  true,
      delivery_fee:     15.00,
      min_order_amount: 30.00,
      avg_prep_time:    20,
      latitude:         33.5731,
      longitude:        -7.5898,
      is_featured:      true,
    });
    console.log('  ✓ Snack Le Rapide enrichi');
  }

  // ════════════════════════════════════════════════════════════════
  // 2. Nouveau restaurant demo
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 2. Nouveau restaurant Pizza Express ──────────────────────');
  const [pizza] = await Organization.findOrCreate({
    where: { slug: 'pizza-express-casa' },
    defaults: {
      name:             'Pizza Express Casa',
      type:             'restaurant',
      plan:             'pro',
      active:           true,
      city:             'Casablanca',
      zone:             'Ain Diab',
      cuisine_type:     'Pizza, Pasta, Italien',
      description:      'Pizzas artisanales cuites au feu de bois. Livraison rapide en 30 min.',
      phone:            '+212 5 22 44 55 66',
      email:            'contact@pizzaexpress.ma',
      address:          '45 boulevard de la Corniche',
      opening_hours:    { mon:{open:'12:00',close:'23:00'}, tue:{open:'12:00',close:'23:00'}, wed:{open:'12:00',close:'23:00'}, thu:{open:'12:00',close:'23:00'}, fri:{open:'12:00',close:'00:00'}, sat:{open:'11:00',close:'00:00'}, sun:{open:'12:00',close:'22:00'} },
      accepts_delivery: true,
      accepts_takeaway: true,
      accepts_dine_in:  true,
      delivery_fee:     20.00,
      min_order_amount: 50.00,
      avg_prep_time:    30,
      avg_rating:       4.3,
      total_reviews:    47,
      latitude:         33.5950,
      longitude:        -7.6328,
      is_featured:      true,
    }
  });
  console.log(`  id=${pizza.id} slug=${pizza.slug}`);

  // Catégories et items Pizza Express
  const cats = ['Pizzas', 'Pastas', 'Desserts', 'Boissons'];
  const catMap = {};
  let sortOrder = 0;
  for (const name of cats) {
    const [cat] = await MenuCategory.findOrCreate({
      where: { organization_id: pizza.id, name },
      defaults: { organization_id: pizza.id, name, sort_order: sortOrder++, active: true }
    });
    catMap[name] = cat;
  }

  const pizzaItems = [
    { libelle: 'Pizza Margherita',    description: 'Tomate, mozzarella, basilic', type: 'plat', prix: 65, cat: 'Pizzas' },
    { libelle: 'Pizza 4 Fromages',    description: 'Mozzarella, gorgonzola, parmesan, chèvre', type: 'plat', prix: 80, cat: 'Pizzas' },
    { libelle: 'Pizza Jambon',        description: 'Tomate, mozzarella, jambon, champignons', type: 'plat', prix: 75, cat: 'Pizzas' },
    { libelle: 'Penne Arrabiata',     description: 'Sauce tomate épicée, ail, huile d\'olive', type: 'plat', prix: 55, cat: 'Pastas' },
    { libelle: 'Spaghetti Bolognaise', description: 'Sauce viande maison mijotée', type: 'plat', prix: 60, cat: 'Pastas' },
    { libelle: 'Tiramisu Maison',     description: 'Mascarpone, café, biscuits savoia', type: 'dessert', prix: 35, cat: 'Desserts' },
    { libelle: 'Eau plate 50cl',      description: '', type: 'boisson', prix: 8, cat: 'Boissons' },
    { libelle: 'Coca-Cola 33cl',      description: '', type: 'boisson', prix: 15, cat: 'Boissons' },
  ];
  for (let i = 0; i < pizzaItems.length; i++) {
    const it = pizzaItems[i];
    await MenuItem.findOrCreate({
      where: { libelle: it.libelle, organization_id: pizza.id },
      defaults: {
        libelle: it.libelle, description: it.description, type: it.type, prix: it.prix,
        organization_id: pizza.id, category_id: catMap[it.cat]?.id, sort_order: i,
        actif: true, is_available: true
      }
    });
  }
  console.log('  ✓ Catégories + plats Pizza Express créés');

  // ════════════════════════════════════════════════════════════════
  // 3. Clients & livreurs
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 3. Clients & livreurs ────────────────────────────────────');

  const customers = [
    { matricule: 'client1', nom: 'Yasmine Benali',    role: 'customer', pwd: 'client123', phone: '+212600001111' },
    { matricule: 'client2', nom: 'Omar Tazi',         role: 'customer', pwd: 'client123', phone: '+212600002222' },
    { matricule: 'client3', nom: 'Sofia Chraibi',     role: 'customer', pwd: 'client123', phone: '+212600003333' },
    { matricule: 'client4', nom: 'Karim Idrissi',     role: 'customer', pwd: 'client123', phone: '+212600004444' },
    { matricule: 'client5', nom: 'Nadia Lahlou',      role: 'customer', pwd: 'client123', phone: '+212600005555' },
  ];
  const livreurs = [
    { matricule: 'livreur1', nom: 'Abdellah Moumen', role: 'delivery', pwd: 'livreur123', phone: '+212611111111' },
    { matricule: 'livreur2', nom: 'Rachid Alami',    role: 'delivery', pwd: 'livreur123', phone: '+212622222222' },
    { matricule: 'livreur3', nom: 'Hassan Idrissi',  role: 'delivery', pwd: 'livreur123', phone: '+212633333333' },
  ];

  const userMap = {};
  for (const u of [...customers, ...livreurs]) {
    const hash = await bcrypt.hash(u.pwd, 10);
    const [user] = await User.findOrCreate({
      where: { matricule: u.matricule },
      defaults: { nom: u.nom, role: u.role, hash_mdp: hash, actif: true, phone: u.phone, organization_id: null }
    });
    userMap[u.matricule] = user;
  }
  console.log(`  ✓ ${customers.length} clients + ${livreurs.length} livreurs créés`);

  // ════════════════════════════════════════════════════════════════
  // 4. Coupons
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 4. Coupons ───────────────────────────────────────────────');

  const coupons = [
    { code: 'BIENVENUE10', type: 'percent', value: 10, min_order: 0,   max_uses: 1000, organization_id: null },
    { code: 'WEEKEND20',   type: 'percent', value: 20, min_order: 80,  max_uses: 200,  organization_id: null },
    { code: 'LIVGRATUIT',  type: 'fixed',   value: 20, min_order: 50,  max_uses: 500,  organization_id: null },
    { code: 'PIZZA15',     type: 'percent', value: 15, min_order: 100, max_uses: 100,  organization_id: pizza.id },
    { code: 'SNACK5',      type: 'fixed',   value: 5,  min_order: 30,  max_uses: 300,  organization_id: snack?.id || null },
  ];
  for (const c of coupons) {
    await Coupon.findOrCreate({
      where: { code: c.code },
      defaults: { ...c, active: true }
    });
  }
  console.log('  ✓ 5 coupons créés');

  // ════════════════════════════════════════════════════════════════
  // 5. Commandes exemple avec statuts variés
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 5. Commandes exemple ─────────────────────────────────────');

  if (snack) {
    const snackItems = await MenuItem.findAll({ where: { organization_id: snack.id, actif: true }, limit: 4 });
    if (snackItems.length >= 2) {
      const orderExamples = [
        { status: 'delivered', type: 'delivery', customer: 'client1', items: [snackItems[0]], review: { rating: 5, comment: 'Livraison rapide, plats délicieux !' } },
        { status: 'preparing', type: 'click_collect', customer: 'client2', items: [snackItems[1], snackItems[0]] },
        { status: 'pending',   type: 'delivery', customer: 'client3', items: [snackItems[0]] },
        { status: 'ready',     type: 'dine_in',  customer: 'client4', items: [snackItems[1]] },
        { status: 'cancelled', type: 'delivery', customer: 'client5', items: [snackItems[0]] },
      ];

      for (const ex of orderExamples) {
        const customer = userMap[ex.customer];
        let total = ex.items.reduce((s, it) => s + Number(it.prix || 0), 0);
        const deliveryFee = ex.type === 'delivery' ? Number(snack.delivery_fee || 0) : 0;
        total += deliveryFee;

        const code = genCode(8);
        const order = await Order.create({
          organization_id: snack.id,
          user_id:    customer?.id || null,
          type:       ex.type,
          status:     ex.status,
          total_amount: total,
          delivery_fee: deliveryFee,
          guest_name:   customer?.nom || 'Client',
          guest_phone:  customer?.phone || '+212600000000',
          pickup_code:  code,
          delivery_address: ex.type === 'delivery' ? '12 rue des Orangers, Casablanca' : null,
          payment_method: 'cash',
          payment_status: ex.status === 'delivered' ? 'paid' : 'pending',
        });
        for (const item of ex.items) {
          await OrderItem.create({
            order_id: order.id, menu_item_id: item.id,
            quantity: 1, unit_price: Number(item.prix || 0)
          });
        }
        // Avis si livré
        if (ex.review && ex.status === 'delivered') {
          try {
            await Review.create({
              organization_id: snack.id,
              user_id:    customer?.id,
              order_id:   order.id,
              pickup_code: code,
              rating:     ex.review.rating,
              comment:    ex.review.comment,
            });
            await snack.update({ avg_rating: ex.review.rating, total_reviews: 1 });
          } catch {}
        }
        // Delivery record si delivery
        if (ex.type === 'delivery') {
          try {
            const partnerId = ex.status === 'delivered' ? userMap['livreur1']?.id : null;
            await Delivery.create({
              order_id:    order.id,
              partner_id:  partnerId,
              status:      ex.status === 'delivered' ? 'delivered' : 'pending',
              fee:         deliveryFee,
              delivered_at: ex.status === 'delivered' ? new Date() : null,
            });
          } catch {}
        }
      }
      console.log(`  ✓ ${orderExamples.length} commandes exemple créées (Snack Le Rapide)`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  console.log('\n✅ Seeders marketplace terminés !');
  console.log('\n── Comptes clients ───────────────────────────────────────────');
  console.log('  client1 / client123   → Yasmine Benali (customer)');
  console.log('  client2 / client123   → Omar Tazi (customer)');
  console.log('  client3..5 / client123');
  console.log('\n── Livreurs ──────────────────────────────────────────────────');
  console.log('  livreur1 / livreur123 → Abdellah Moumen');
  console.log('  livreur2 / livreur123 → Rachid Alami');
  console.log('  livreur3 / livreur123 → Hassan Idrissi');
  console.log('\n── Coupons ───────────────────────────────────────────────────');
  console.log('  BIENVENUE10 → -10% sans minimum');
  console.log('  WEEKEND20   → -20% dès 80 MAD');
  console.log('  LIVGRATUIT  → -20 MAD frais de livraison dès 50 MAD');
  console.log('  PIZZA15     → -15% Pizza Express dès 100 MAD');
  console.log('  SNACK5      → -5 MAD Snack Le Rapide dès 30 MAD');

  await sequelize.close();
}

seed().catch(err => {
  console.error('❌', err.message);
  console.error(err.stack);
  process.exit(1);
});
