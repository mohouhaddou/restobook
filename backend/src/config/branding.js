'use strict';

module.exports = {
  APP_NAME:         process.env.APP_NAME         || 'Ifilino',
  APP_TAGLINE:      process.env.APP_TAGLINE       || 'Vos commerces, vos envies, tout près de vous.',
  APP_URL:          process.env.APP_URL           || 'https://ifilino.com',
  API_URL:          process.env.API_URL           || 'https://api.ifilino.com',
  SUPPORT_EMAIL:    process.env.SUPPORT_EMAIL     || 'contact@ifilino.com',
  CONTACT_EMAIL:    process.env.CONTACT_EMAIL     || 'contact@ifilino.com',
  NOREPLY_EMAIL:    process.env.NOREPLY_EMAIL     || 'noreply@ifilino.com',
  PUBLIC_BASE_PATH: process.env.PUBLIC_BASE_PATH  || '/restobook',
  DOMAIN_STATUS:    process.env.DOMAIN_STATUS     || 'active',
};
