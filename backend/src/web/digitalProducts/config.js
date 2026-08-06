'use strict';

// Liste curée des types de produits numériques vendables — seule source de vérité, utilisée par
// le formulaire admin ET la validation serveur. `digital_products.type` reste une colonne VARCHAR
// libre (jamais un ENUM) : ajouter un type = ajouter une ligne ici, jamais de migration.
const DIGITAL_PRODUCT_TYPES = [
  { value: 'pdf',            labelKey: 'kids.digitalProducts.types.pdf' },
  { value: 'audiobook',      labelKey: 'kids.digitalProducts.types.audiobook' },
  { value: 'coloring',       labelKey: 'kids.digitalProducts.types.coloring' },
  { value: 'activity_pack',  labelKey: 'kids.digitalProducts.types.activityPack' },
  { value: 'teacher_guide',  labelKey: 'kids.digitalProducts.types.teacherGuide' },
  { value: 'parent_guide',   labelKey: 'kids.digitalProducts.types.parentGuide' },
  { value: 'stickers',       labelKey: 'kids.digitalProducts.types.stickers' },
  { value: 'wallpapers',     labelKey: 'kids.digitalProducts.types.wallpapers' },
  { value: 'bundle',         labelKey: 'kids.digitalProducts.types.bundle' },
];

const DIGITAL_PRODUCT_TYPE_VALUES = DIGITAL_PRODUCT_TYPES.map(t => t.value);

module.exports = { DIGITAL_PRODUCT_TYPES, DIGITAL_PRODUCT_TYPE_VALUES };
