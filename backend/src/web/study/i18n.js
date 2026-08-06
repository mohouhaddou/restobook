'use strict';

// backend/src/modules/portals/i18n.js est déjà module-agnostique (aucune logique propre à
// Kids/Sports) : Study le réutilise tel quel plutôt que de dupliquer
// normalizeLanguage/isRtlLanguage/localeForLanguage/ogLocaleForLanguage.
module.exports = require('../portals/i18n');
