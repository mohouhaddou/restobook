'use strict';

/**
 * Catégories d'articles de liste de courses — mots-clés appliqués au nom de
 * l'article à la création. Volontairement séparé de NEED_CATEGORIES
 * (productSearchService.js) : ce fichier catégorise des ARTICLES déjà nommés
 * (plus fin, splitte poissons des viandes, a un fallback "autre"), l'autre
 * route des RECHERCHES marketplace par besoin. Pas de champ `module` ici :
 * on ne route rien, on étiquette seulement pour le regroupement visuel.
 */
const ITEM_CATEGORIES = {
  fruits_legumes: { label: 'Fruits & légumes', icon: '🥦', keywords: ['fruit', 'légume', 'legume', 'pomme', 'banane', 'tomate', 'orange', 'salade', 'carotte', 'oignon', 'pomme de terre', 'citron', 'ail', 'poivron', 'concombre', 'courgette', 'avocat', 'datte', 'dattes', 'date', 'dates', 'raisin', 'figue'] },
  viandes:        { label: 'Viandes',          icon: '🥩', keywords: ['viande', 'poulet', 'boeuf', 'bœuf', 'agneau', 'merguez', 'kefta', 'dinde', 'veau', 'escalope', 'steak', 'saucisse'] },
  poissons:       { label: 'Poissons',         icon: '🐟', keywords: ['poisson', 'sardine', 'thon', 'crevette', 'saumon', 'crabe', 'calamar', 'fruits de mer'] },
  laitiers:       { label: 'Produits laitiers', icon: '🧀', keywords: ['lait', 'fromage', 'yaourt', 'yogourt', 'beurre', 'crème', 'creme', 'laban', 'oeuf', 'œuf'] },
  boulangerie:    { label: 'Boulangerie',      icon: '🥖', keywords: ['pain', 'baguette', 'croissant', 'viennoiserie', 'brioche', 'msemen', 'khobz'] },
  boissons:       { label: 'Boissons',         icon: '🥤', keywords: ['jus', 'soda', 'eau', 'café', 'cafe', 'the', 'thé', 'boisson', 'coca', 'lait', 'sirop'] },
  epicerie:       { label: 'Épicerie',         icon: '🛒', keywords: ['riz', 'pâtes', 'pates', 'huile', 'sucre', 'sel', 'farine', 'conserve', 'épice', 'epice', 'semoule', 'lentille', 'pois chiche', 'couscous', 'thé', 'café', 'biscuit', 'chocolat', 'gâteau', 'gateau'] },
  hygiene:        { label: 'Hygiène',          icon: '🧴', keywords: ['savon', 'shampoing', 'dentifrice', 'hygiène', 'hygiene', 'couche', 'gel douche', 'papier toilette', 'lessive', 'déodorant', 'deodorant'] },
  pharmacie:      { label: 'Pharmacie',        icon: '💊', keywords: ['médicament', 'medicament', 'sirop', 'paracétamol', 'paracetamol', 'pansement', 'vitamine', 'doliprane'] },
  animaux:        { label: 'Animaux',          icon: '🐾', keywords: ['chien', 'chat', 'animal', 'croquette', 'litière', 'litiere'] },
  autre:          { label: 'Autre',            icon: '🧺', keywords: [] },
};

const CATEGORY_ORDER = ['fruits_legumes', 'viandes', 'poissons', 'laitiers', 'boulangerie', 'boissons', 'epicerie', 'hygiene', 'pharmacie', 'animaux', 'autre'];

module.exports = { ITEM_CATEGORIES, CATEGORY_ORDER };
