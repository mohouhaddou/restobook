// Labels/icônes d'affichage uniquement — la catégorisation par mots-clés reste
// 100% côté serveur (shoppingCategoryConfig.js). Ne jamais dupliquer la logique
// de catégorisation ici, seulement le rendu (icône/label/ordre des sections).
export const SHOPPING_CATEGORIES = {
  fruits_legumes: { label: 'Fruits & légumes', icon: '🥦' },
  viandes:        { label: 'Viandes', icon: '🥩' },
  poissons:       { label: 'Poissons', icon: '🐟' },
  laitiers:       { label: 'Produits laitiers', icon: '🧀' },
  boulangerie:    { label: 'Boulangerie', icon: '🥖' },
  boissons:       { label: 'Boissons', icon: '🥤' },
  epicerie:       { label: 'Épicerie', icon: '🛒' },
  hygiene:        { label: 'Hygiène', icon: '🧴' },
  pharmacie:      { label: 'Pharmacie', icon: '💊' },
  animaux:        { label: 'Animaux', icon: '🐾' },
  autre:          { label: 'Autre', icon: '🧺' },
};

export const SHOPPING_CATEGORY_ORDER = [
  'fruits_legumes', 'viandes', 'poissons', 'laitiers', 'boulangerie',
  'boissons', 'epicerie', 'hygiene', 'pharmacie', 'animaux', 'autre',
];

export function categoryMeta(key) {
  return SHOPPING_CATEGORIES[key] || SHOPPING_CATEGORIES.autre;
}
