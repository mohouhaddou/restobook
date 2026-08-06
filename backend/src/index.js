'use strict';
// Barrel src/ — point d'entrée de l'architecture modulaire
module.exports = {
  config:     require('./config/branding'),
  middleware: {
    auth:               require('./middleware/auth'),
    errorHandler:       require('./middleware/errorHandler'),
    subscriptionGuard:  require('./middleware/subscriptionGuard'),
    validate:           require('./middleware/validate'),
  },
  modules: {
    auth:          require('./shared/auth'),
    admin:         require('./shared/admin'),
    resto:         require('./market/resto'),
    cantine:       require('./market/cantine'),
    marketplace:   require('./market/marketplace'),
    organizations: require('./shared/organizations'),
    orders:        require('./market/orders'),
    reservations:  require('./market/reservations'),
    notifications: require('./shared/notifications'),
    businesses:    require('./market/businesses'),
  },
  services: require('./shared/services'),
};
