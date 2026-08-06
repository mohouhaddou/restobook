// PERMISSIONS/ROLE_LABELS/ASSIGNABLE_ROLES vivent maintenant dans @ifilino/shared
// (packages/shared/permissions.js) — source canonique unique, aussi consommée
// par le backend. Avant ce changement, cette copie locale avait dérivé : il
// manquait 12 permissions (COMICS_*, MEDIA_*, PHARMACY_ORDER_MANAGE) par
// rapport au backend. Voir docs/PLATFORM_SPLIT_WEB_MARKET.md, Phase 5a.
export { PERMISSIONS, ROLE_LABELS, ASSIGNABLE_ROLES } from '@ifilino/shared';
