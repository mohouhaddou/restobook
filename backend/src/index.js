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
    auth:          require('./modules/auth'),
    admin:         require('./modules/admin'),
    resto:         require('./modules/resto'),
    cantine:       require('./modules/cantine'),
    marketplace:   require('./modules/marketplace'),
    organizations: require('./modules/organizations'),
    orders:        require('./modules/orders'),
    reservations:  require('./modules/reservations'),
    notifications: require('./modules/notifications'),
    businesses:    require('./modules/businesses'),
  },
  services: require('./shared/services'),
};
