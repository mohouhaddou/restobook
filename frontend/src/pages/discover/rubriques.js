// Taxonomie de navigation iFilino Discover — MIROIR EXACT de
// backend/src/modules/discover/rubriques.js (mêmes clés/labels/icônes/ordre).
// Garder synchronisé à la main — deux runtimes séparés, pas de fichier partagé
// possible ici. Remplace les anciennes copies dupliquées de `category`.
export const RUBRIQUES = {
  restaurants_food:  { order: 1,  label: 'Food & Restaurants', labels: { fr: 'Food & Restaurants', ar: 'المطاعم والأكل', en: 'Food & Restaurants' },   icon: '🍽️' },
  courses_epiceries: { order: 2,  label: 'Courses', labels: { fr: 'Courses', ar: 'المواد الغذائية', en: 'Groceries' },  icon: '🛒' },
  boucheries:        { order: 3,  label: 'Boucheries', labels: { fr: 'Boucheries', ar: 'الجزارون', en: 'Butchers' },           icon: '🥩' },
  boulangeries:      { order: 4,  label: 'Boulangeries', labels: { fr: 'Boulangeries', ar: 'المخابز', en: 'Bakeries' },         icon: '🥐' },
  patisseries:       { order: 5,  label: 'Pâtisseries', labels: { fr: 'Pâtisseries', ar: 'الحلويات', en: 'Pastry Shops' },          icon: '🍰' },
  cafes:             { order: 6,  label: 'Cafés', labels: { fr: 'Cafés', ar: 'المقاهي', en: 'Cafes' },                icon: '☕' },
  sante_pharmacies:  { order: 7,  label: 'Santé', labels: { fr: 'Santé', ar: 'الصحة', en: 'Health & Pharmacies' },   icon: '💊' },
  beaute_bien_etre:  { order: 8,  label: 'Beauté & Bien-être', labels: { fr: 'Beauté & Bien-être', ar: 'الجمال والعناية', en: 'Beauty & Wellness' },   icon: '✨' },
  sport_forme:       { order: 9,  label: 'Sport & Forme', labels: { fr: 'Sport & Forme', ar: 'الرياضة واللياقة', en: 'Sports & Fitness' },        icon: '🏃' },
  famille_enfants:   { order: 10, label: 'Famille', labels: { fr: 'Famille', ar: 'العائلة', en: 'Family & Kids' },    icon: '👨‍👩‍👧‍👦' },
  maison_deco:       { order: 11, label: 'Maison', labels: { fr: 'Maison', ar: 'المنزل', en: 'Home & Decor' },        icon: '🏡' },
  sorties_loisirs:   { order: 12, label: 'Sorties & Loisirs', labels: { fr: 'Sorties & Loisirs', ar: 'الخروج والترفيه', en: 'Going Out & Leisure' },    icon: '🎭' },
  shopping:          { order: 13, label: 'Shopping', labels: { fr: 'Shopping', ar: 'التسوق', en: 'Shopping' },             icon: '🛍️' },
  evenements:        { order: 14, label: 'Événements', labels: { fr: 'Événements', ar: 'الفعاليات', en: 'Events' },           icon: '🎉' },
  villes:            { order: 15, label: 'Guides locaux', labels: { fr: 'Guides locaux', ar: 'دلائل المدن', en: 'Local Guides' }, icon: '📍' },
  maroc:             { order: 16, label: 'Voyage & Découvertes', labels: { fr: 'Voyage & Découvertes', ar: 'السفر والاكتشاف', en: 'Travel & Discoveries' },   icon: '🌍' },
  conseils_astuces:  { order: 17, label: 'Conseils & Astuces', labels: { fr: 'Conseils & Astuces', ar: 'نصائح وحيل', en: 'Tips & Advice' },   icon: '💡' },
  promotions:        { order: 18, label: 'Bons plans', labels: { fr: 'Bons plans', ar: 'عروض وتخفيضات', en: 'Deals' },           icon: '🎁' },
};

export const RUBRIQUE_KEYS = Object.keys(RUBRIQUES).sort((a, b) => RUBRIQUES[a].order - RUBRIQUES[b].order);

export function rubriqueLabel(key, language = 'fr') {
  const lang = ['ar', 'fr', 'en'].includes(language) ? language : 'fr';
  return RUBRIQUES[key]?.labels?.[lang] || RUBRIQUES[key]?.label || key;
}
