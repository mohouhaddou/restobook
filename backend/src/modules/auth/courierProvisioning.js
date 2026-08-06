'use strict';

const { DeliveryPerson, User } = require('../../../models');

/**
 * Crée le profil DeliveryPerson (réseau, hors dispatch tant que les documents
 * ne sont pas vérifiés) + notifications, pour un `user` déjà créé avec
 * role='delivery'. Partagé par POST /courier-register (classique) et
 * POST /auth/google/complete-courier-signup (Google).
 */
async function provisionCourier({ user, city }) {
  await DeliveryPerson.create({
    user_id: user.id,
    mode: 'network',
    owner_organization_id: null,
    status: 'offline',
    is_active: false, // exclu du dispatch tant que les documents ne sont pas vérifiés
  });

  require('../../../services/NotificationService').onCourierAccountCreated(user).catch(() => {});

  const superAdmins = await User.findAll({ where: { role: 'superadmin', actif: true }, attributes: ['id'] });
  if (superAdmins.length) {
    const NS = require('../../../services/NotificationService');
    await Promise.all(superAdmins.map(sa => NS.create({
      type: 'ACCOUNT_CREATED',
      recipient_id: sa.id,
      title: '🛵 Nouveau livreur inscrit',
      message: `${user.nom} s'est inscrit comme livreur (${city}) — documents à vérifier.`,
      entity_type: 'ACCOUNT',
      action_url: '/delivery-documents',
      priority: 'normal',
      data: { user_id: user.id, city },
    }).catch(() => {})));
  }

  return {
    message: 'Compte créé — complétez votre profil et vos documents pour commencer à recevoir des livraisons.',
  };
}

module.exports = { provisionCourier };
