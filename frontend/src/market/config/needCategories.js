import {
  MealIcon, MeatIcon, DairyIcon, ProduceIcon, BreadIcon,
  DrinkIcon, DessertIcon, PharmacyIcon, HygieneIcon, PetIcon,
} from '../../shared/icons/categories';

// Catégories "besoin" — parallèle à businessConfig.js (qui reste inchangé,
// il modélise les TYPES DE COMMERCE pour la section commerces/carte). Ici on
// modélise le BESOIN du client. Pas de nouveau champ en base : chaque
// catégorie n'est qu'une liste de mots-clés appliquée à la recherche
// existante côté serveur (voir productSearchService.js), résultat approximatif
// assumé pour cette phase.
export const NEED_CATEGORIES = [
  { id: 'repas',          label: 'Repas', labelKey: 'marketplace.need.meals',             icon: MealIcon },
  { id: 'viandes',        label: 'Viandes', labelKey: 'marketplace.need.meat',           icon: MeatIcon },
  { id: 'laitiers',       label: 'Produits laitiers', labelKey: 'marketplace.need.dairy', icon: DairyIcon },
  { id: 'fruits_legumes', label: 'Fruits & légumes', labelKey: 'marketplace.need.produce',  icon: ProduceIcon },
  { id: 'boulangerie',    label: 'Boulangerie', labelKey: 'marketplace.need.bakery',       icon: BreadIcon },
  { id: 'boissons',       label: 'Boissons', labelKey: 'marketplace.need.drinks',          icon: DrinkIcon },
  { id: 'desserts',       label: 'Desserts', labelKey: 'marketplace.need.desserts',          icon: DessertIcon },
  { id: 'pharmacie',      label: 'Pharmacie', labelKey: 'marketplace.need.pharmacy',         icon: PharmacyIcon },
  { id: 'hygiene',        label: 'Hygiène', labelKey: 'marketplace.need.hygiene',           icon: HygieneIcon },
  { id: 'animaux',        label: 'Animaux', labelKey: 'marketplace.need.pets',           icon: PetIcon },
];
