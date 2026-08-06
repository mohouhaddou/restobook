// Palette de data-viz pour InsightsPage — instance de référence de la skill
// dataviz (references/palette.md), validée avec scripts/validate_palette.js
// contre les surfaces réelles de l'app (--mk-card clair #FFFFFF, sombre #162032).
// Ordre des slots catégoriels fixe — jamais réordonné dynamiquement.
export const CATEGORICAL = {
  light: ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'],
  dark:  ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'],
};

// Slots avec contraste < 3:1 sur la surface claire (aqua/jaune/magenta) —
// la "relief rule" de la skill impose un label direct visible pour ces séries.
export const NEEDS_DIRECT_LABEL_LIGHT = new Set([1, 2, 6]);

// Un seul hue séquentiel (bleu) pour les séries uniques (tendance mensuelle).
export const SEQUENTIAL = { light: '#2a78d6', dark: '#3987e5' };

export const INK = {
  light: { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
  dark:  { primary: '#ffffff', secondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835' },
};

// Ordre fixe des catégories (types d'organisation) → index de slot catégoriel.
export const CATEGORY_ORDER = ['restaurant', 'cafe', 'hanout', 'pharmacie', 'canteen', 'snack', 'bakery', 'dark_kitchen'];
export const CATEGORY_LABELS = {
  restaurant: 'Restaurants', cafe: 'Cafés', hanout: 'Épiceries', pharmacie: 'Pharmacies',
  canteen: 'Cantines', snack: 'Snacks', bakery: 'Boulangeries', dark_kitchen: 'Dark kitchens',
};

export function categoryColor(type, theme) {
  const idx = CATEGORY_ORDER.indexOf(type);
  const set = CATEGORICAL[theme] || CATEGORICAL.light;
  return set[idx >= 0 ? idx : set.length - 1];
}

export function categoryNeedsDirectLabel(type, theme) {
  if (theme === 'dark') return false; // dark set all clears 3:1 contrast
  return NEEDS_DIRECT_LABEL_LIGHT.has(CATEGORY_ORDER.indexOf(type));
}
