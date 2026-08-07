// Variants d'entrée partagés entre HeroCarousel (marketplace) et
// StoreHeroCarousel (commerce) — chaque élément remonte avec le slide (clé
// `current.id` sur le conteneur AnimatePresence), donc `initial: hidden` se
// rejoue naturellement à chaque changement de slide. Les délais sont
// volontairement décalés élément par élément ("le Hero doit raconter une
// histoire") plutôt que via un orchestrateur staggerChildren, car badge/titre
// et le badge remise / la carte catégories ne partagent pas le même parent
// DOM. Uniquement transform + opacity (GPU-friendly).
const EASE = [0.22, 1, 0.36, 1];

export const heroBadgeVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, delay: 0.05, ease: EASE } },
};

export const heroTitleVariants = {
  hidden: { opacity: 0, x: -26 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.14, ease: EASE } },
};

export const heroSubtitleVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: 0.26 } },
};

export const heroButtonRowVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, delay: 0.36, ease: EASE } },
};

export const heroCardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.5, ease: EASE } },
};

export const heroDiscountVariants = {
  hidden: { opacity: 0, scale: 0.4 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, delay: 0.42, type: 'spring', stiffness: 260, damping: 18 } },
};
