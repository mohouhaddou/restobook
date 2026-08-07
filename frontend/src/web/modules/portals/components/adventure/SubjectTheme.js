// Palette d'accent par matière/catégorie, partagée par Study (subject en texte libre, ex.
// "Mathematics") et Encyclopedia (category fixe : animals/nature/space/science/...). Généralise
// le mécanisme déjà présent dans encyclopedia-reader.css (--ency-accent par
// .encyclopedia--{category}) pour Study, qui n'a aucun équivalent aujourd'hui (tout est violet).
// Encyclopedia garde son propre CSS par classe (mécanisme déjà fonctionnel, catégories fixes) ;
// ce fichier lui sert de référence de valeurs, pas de mécanisme d'injection.
export const ADVENTURE_PALETTE = {
  science: { accent: '#2563eb', deep: '#1e3a8a', soft: '#dbeafe' },
  nature: { accent: '#047857', deep: '#064e3b', soft: '#d1fae5' },
  history: { accent: '#92400e', deep: '#451a03', soft: '#fef3c7' },
  technology: { accent: '#0891b2', deep: '#164e63', soft: '#cffafe' },
  space: { accent: '#1e3a8a', deep: '#172554', soft: '#dbeafe' },
  animals: { accent: '#ea580c', deep: '#9a3412', soft: '#ffedd5' },
  study: { accent: '#7c3aed', deep: '#5b21b6', soft: '#ede9fe' },
  geography: { accent: '#0e7490', deep: '#164e63', soft: '#cffafe' },
};

const DEFAULT_KEY = 'study';

/** Normalise un `subject`/`category` en texte libre vers une clé de palette connue. */
export function normalizeSubjectKey(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return DEFAULT_KEY;
  if (ADVENTURE_PALETTE[v]) return v;
  const match = Object.keys(ADVENTURE_PALETTE).find(key => v.includes(key));
  return match || DEFAULT_KEY;
}

/**
 * Style inline (custom properties CSS) à poser sur un conteneur pour teinter tout son contenu.
 * Surcharge aussi --portal-primary/--portal-primary-strong : la barre de narration Storybook
 * (storybook.css, .storybook-narration-play etc.) est déjà pilotée par ces tokens `--portal-*`
 * (jamais de couleur en dur) — la réutiliser pour Study/Encyclopedia colore automatiquement ses
 * boutons à la couleur de la rubrique, sans toucher storybook.css ni risquer Stories (qui
 * n'applique jamais ce style et garde le violet Kids par défaut de .portal-kids).
 */
export function subjectThemeStyle(subjectOrCategory) {
  const key = normalizeSubjectKey(subjectOrCategory);
  const palette = ADVENTURE_PALETTE[key];
  return {
    '--adv-accent': palette.accent, '--adv-accent-deep': palette.deep, '--adv-accent-soft': palette.soft,
    '--portal-primary': palette.accent, '--portal-primary-strong': palette.deep,
  };
}
