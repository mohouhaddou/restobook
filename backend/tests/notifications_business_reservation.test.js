'use strict';

/**
 * Tests — Notifications commerce (commande livrée) + client (statut réservation)
 * Usage : node tests/notifications_business_reservation.test.js
 *
 * Couvre :
 *  1. onOrderDeliveredBusiness → notif broadcast org (recipient_id=null) au
 *     staff quand une commande passe 'delivered', séparée du ORDER_DELIVERED
 *     déjà envoyé au client (pas de collision dedup malgré le même `type`).
 *  2. onReservationStatusChanged('confirmed'/'cancelled') → notif client
 *     personnelle, uniquement si la réservation est liée à un compte
 *     (réservation invité = aucune notif, pas d'erreur).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const { sequelize, User, Organization, Business, Notification, TableReservation } = require('../models');
const NotificationService = require('../src/modules/notifications/NotificationService');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Notifications commerce + réservation');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const sfx = crypto.randomBytes(4).toString('hex');

  const org = await Organization.create({ slug: `notif-test-${sfx}`, name: `Notif Test ${sfx}`, type: 'restaurant', active: true });
  const biz = await Business.create({ organization_id: org.id, name: org.name, business_type: 'restaurant', module: 'resto', status: 'approved', is_public: true });
  const owner = await User.create({ matricule: `notif-owner-${sfx}`, nom: 'Owner Test', email: `notif-owner-${sfx}@test.local`, role: 'restaurant_owner', hash_mdp: 'x', actif: true, organization_id: org.id });
  const customer = await User.create({ matricule: `notif-customer-${sfx}`, nom: 'Client Test', email: `notif-customer-${sfx}@test.local`, role: 'customer', hash_mdp: 'x', actif: true, organization_id: null });

  try {
    // ── Test 1 : commande livrée → notif business ───────────────────────────
    console.log('Test 1 : onOrderDeliveredBusiness — notif broadcast org');
    const fakeOrder = { id: 999001, organization_id: org.id, pickup_code: `PK-${sfx}` };
    await NotificationService.onOrderDeliveredBusiness(fakeOrder);

    const bizNotif = await Notification.findOne({ where: { organization_id: org.id, type: 'ORDER_DELIVERED', recipient_id: null } });
    assert(!!bizNotif, 'notification ORDER_DELIVERED créée avec organization_id, recipient_id=null (broadcast staff)');
    assert(bizNotif?.message?.includes(fakeOrder.pickup_code), 'le message référence le code de la commande');

    // Le client doit pouvoir recevoir SA PROPRE notif ORDER_DELIVERED sans
    // collision de dedup avec celle du commerce (recipient_id différent).
    await NotificationService.onOrderStatusChanged({ id: fakeOrder.id, user_id: customer.id, pickup_code: fakeOrder.pickup_code, type: 'delivery' }, 'delivered');
    const customerNotif = await Notification.findOne({ where: { recipient_id: customer.id, type: 'ORDER_DELIVERED', entity_id: fakeOrder.id } });
    assert(!!customerNotif, "notification ORDER_DELIVERED distincte créée pour le client (recipient_id renseigné)");
    assert(customerNotif.id !== bizNotif.id, 'ce sont bien deux notifications différentes (pas de dedup croisé)');

    // Pas d'organization_id → no-op silencieux, ne doit pas planter.
    await NotificationService.onOrderDeliveredBusiness({ id: 999002, organization_id: null, pickup_code: 'X' });
    assert(true, 'organization_id absent → no-op sans exception');

    // ── Test 2 : statut réservation → notif client ──────────────────────────
    console.log('\nTest 2 : onReservationStatusChanged — notif client personnelle');
    const resvWithAccount = await TableReservation.create({
      organization_id: org.id, user_id: customer.id, guest_name: 'Client Test',
      date_jour: '2026-08-01', time_slot: '20:00', guests_count: 2, status: 'pending',
    });
    await NotificationService.onReservationStatusChanged(resvWithAccount, 'confirmed');
    const confirmedNotif = await Notification.findOne({ where: { recipient_id: customer.id, type: 'RESERVATION_CONFIRMED', entity_id: resvWithAccount.id } });
    assert(!!confirmedNotif, "notification RESERVATION_CONFIRMED créée pour le client");
    assert(confirmedNotif.message.includes('confirmée'), 'message de confirmation cohérent');

    resvWithAccount.status = 'cancelled';
    await resvWithAccount.save();
    await NotificationService.onReservationStatusChanged(resvWithAccount, 'cancelled');
    const cancelledNotif = await Notification.findOne({ where: { recipient_id: customer.id, type: 'RESERVATION_CANCELLED', entity_id: resvWithAccount.id } });
    assert(!!cancelledNotif, "notification RESERVATION_CANCELLED créée pour le client");

    // Réservation invité (pas de compte) → aucune notification, aucune exception.
    const resvGuest = await TableReservation.create({
      organization_id: org.id, user_id: null, guest_name: 'Invité Test',
      date_jour: '2026-08-02', time_slot: '19:00', guests_count: 4, status: 'pending',
    });
    await NotificationService.onReservationStatusChanged(resvGuest, 'confirmed');
    const guestNotif = await Notification.findOne({ where: { entity_id: resvGuest.id, entity_type: 'RESERVATION' } });
    assert(!guestNotif, 'réservation invité (sans compte) → aucune notification créée');

    // status sans message dédié (seated/no_show) → no-op silencieux.
    await NotificationService.onReservationStatusChanged(resvWithAccount, 'seated');
    assert(true, "status='seated' (pas de message dédié) → no-op sans exception");

  } finally {
    await Notification.destroy({ where: { organization_id: org.id } });
    await Notification.destroy({ where: { recipient_id: [owner.id, customer.id] } });
    await TableReservation.destroy({ where: { organization_id: org.id } });
    await Business.destroy({ where: { organization_id: org.id } });
    await owner.destroy();
    await customer.destroy();
    await org.destroy();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  if (fail > 0) {
    console.error(`${fail} test(s) échoué(s).`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch(e => { console.error('ERREUR test notifications_business_reservation:', e); process.exit(1); });
