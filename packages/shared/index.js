'use strict';

// Exports nommés statiques (pas de spread) : Vite/esbuild (cjs-module-lexer)
// n'arrive à détecter les named exports d'un module CJS que si l'objet
// exporté a des clés statiques — un `...require(...)` casse cette détection
// et ne laisse passer qu'un export default, cassant `import { X } from ...`
// côté frontend. Vérifié en conditions réelles (vite dev + navigateur).
const { PERMISSIONS, ROLE_LABELS, ASSIGNABLE_ROLES } = require('./permissions');

module.exports = { PERMISSIONS, ROLE_LABELS, ASSIGNABLE_ROLES };
