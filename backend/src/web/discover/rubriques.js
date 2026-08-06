'use strict';

/**
 * Taxonomie de navigation iFilino Discover — SOURCE DE VÉRITÉ backend.
 * Miroir exact (mêmes clés/labels/icônes/ordre) : frontend/src/pages/discover/rubriques.js
 * — garder synchronisé à la main, pas de partage de fichier cross-runtime possible ici.
 * Remplace les anciennes copies dupliquées de la taxonomie `category` (5 endroits
 * différents avant cette refonte).
 *
 * `match` décrit comment retrouver automatiquement des commerces liés à un
 * article de cette rubrique quand aucun `related_business_refs` manuel n'est
 * défini (voir articleService.findMatchingBusinesses) :
 *  - { vertical, productSearch: true } : recherche mot-clé (tags de l'article)
 *    sur les produits du vertical (MenuItem/HanoutProduct/PharmacyMedicine),
 *    remontée aux commerces qui les vendent.
 *  - { vertical, categorySlug } : comme ci-dessus, filtré en plus sur une
 *    Category précise (ex. boucherie sous le vertical hanout). Si la
 *    catégorie n'existe pas encore en base, retourne silencieusement une
 *    liste vide — jamais de contenu fabriqué.
 *  - { vertical, orgTypes } : filtre direct sur le type de commerce, sans
 *    recherche produit (ex. boulangerie/café, qui sont des orgTypes du
 *    vertical restaurant — voir seo/verticals.js).
 *  - { cityShowcase: true } : vitrine générique des commerces de la ville de
 *    l'article (rubrique "Découvrir les villes"), tous verticaux confondus.
 *  - { promotionsShowcase: true } : commerces ayant une promotion active.
 *  - null : pas de matching automatique (rubrique sans équivalent
 *    marketplace — shopping, événements, voyage, conseils).
 */
const RUBRIQUES = {
  restaurants_food:  { order: 1,  label: 'Food & Restaurants', labels: { fr: 'Food & Restaurants', ar: 'المطاعم والأكل', en: 'Food & Restaurants' },   icon: '🍽️', match: { vertical: 'restaurant', productSearch: true } },
  courses_epiceries: { order: 2,  label: 'Courses', labels: { fr: 'Courses', ar: 'المواد الغذائية', en: 'Groceries' },  icon: '🛒', match: { vertical: 'hanout', productSearch: true } },
  boucheries:        { order: 3,  label: 'Boucheries', labels: { fr: 'Boucheries', ar: 'الجزارون', en: 'Butchers' },           icon: '🥩', match: { vertical: 'hanout', categorySlug: 'boucherie', productSearch: true } },
  boulangeries:      { order: 4,  label: 'Boulangeries', labels: { fr: 'Boulangeries', ar: 'المخابز', en: 'Bakeries' },         icon: '🥐', match: { vertical: 'restaurant', orgTypes: ['bakery'] } },
  patisseries:       { order: 5,  label: 'Pâtisseries', labels: { fr: 'Pâtisseries', ar: 'الحلويات', en: 'Pastry Shops' },          icon: '🍰', match: { vertical: 'hanout', categorySlug: 'patisserie', productSearch: true } },
  cafes:             { order: 6,  label: 'Cafés', labels: { fr: 'Cafés', ar: 'المقاهي', en: 'Cafes' },                icon: '☕', match: { vertical: 'restaurant', orgTypes: ['cafe'] } },
  sante_pharmacies:  { order: 7,  label: 'Santé', labels: { fr: 'Santé', ar: 'الصحة', en: 'Health & Pharmacies' },   icon: '💊', match: { vertical: 'pharmacie', productSearch: true } },
  beaute_bien_etre:  { order: 8,  label: 'Beauté & Bien-être', labels: { fr: 'Beauté & Bien-être', ar: 'الجمال والعناية', en: 'Beauty & Wellness' },   icon: '✨', match: { vertical: 'pharmacie', productSearch: true } },
  sport_forme:       { order: 9,  label: 'Sport & Forme', labels: { fr: 'Sport & Forme', ar: 'الرياضة واللياقة', en: 'Sports & Fitness' },        icon: '🏃', match: { vertical: 'pharmacie', productSearch: true } },
  famille_enfants:   { order: 10, label: 'Famille', labels: { fr: 'Famille', ar: 'العائلة', en: 'Family & Kids' },    icon: '👨‍👩‍👧‍👦', match: { vertical: 'pharmacie', productSearch: true } },
  maison_deco:       { order: 11, label: 'Maison', labels: { fr: 'Maison', ar: 'المنزل', en: 'Home & Decor' },        icon: '🏡', match: { vertical: 'hanout', productSearch: true } },
  sorties_loisirs:   { order: 12, label: 'Sorties & Loisirs', labels: { fr: 'Sorties & Loisirs', ar: 'الخروج والترفيه', en: 'Going Out & Leisure' },    icon: '🎭', match: null },
  shopping:          { order: 13, label: 'Shopping', labels: { fr: 'Shopping', ar: 'التسوق', en: 'Shopping' },             icon: '🛍️', match: null },
  evenements:        { order: 14, label: 'Événements', labels: { fr: 'Événements', ar: 'الفعاليات', en: 'Events' },           icon: '🎉', match: null },
  villes:            { order: 15, label: 'Guides locaux', labels: { fr: 'Guides locaux', ar: 'دلائل المدن', en: 'Local Guides' }, icon: '📍', match: { cityShowcase: true } },
  maroc:             { order: 16, label: 'Voyage & Découvertes', labels: { fr: 'Voyage & Découvertes', ar: 'السفر والاكتشاف', en: 'Travel & Discoveries' },   icon: '🌍', match: null },
  conseils_astuces:  { order: 17, label: 'Conseils & Astuces', labels: { fr: 'Conseils & Astuces', ar: 'نصائح وحيل', en: 'Tips & Advice' },   icon: '💡', match: null },
  promotions:        { order: 18, label: 'Bons plans', labels: { fr: 'Bons plans', ar: 'عروض وتخفيضات', en: 'Deals' },           icon: '🎁', match: { promotionsShowcase: true } },
};

const RUBRIQUE_KEYS = Object.keys(RUBRIQUES).sort((a, b) => RUBRIQUES[a].order - RUBRIQUES[b].order);

function rubriqueLabel(key, language = 'fr') {
  const lang = ['ar', 'fr', 'en'].includes(language) ? language : 'fr';
  return RUBRIQUES[key]?.labels?.[lang] || RUBRIQUES[key]?.label || key;
}

module.exports = { RUBRIQUES, RUBRIQUE_KEYS, rubriqueLabel };
