// Variants Framer Motion partagés par les lecteurs "adventure" (Study, Encyclopedia) — mêmes
// constantes que book/bookMotion.ts et play/games/playMotion.js (transform+opacity ou spring
// léger, jamais d'orchestrateur lourd). Fichier dédié plutôt qu'un import direct de l'un des deux
// : chaque module Kids garde son propre système de design, seule la courbe d'animation est
// partagée.
const EASE = [0.22, 1, 0.36, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

// Même spring que playBadgeUnlockVariants — utilisé pour le popup de badge/célébration.
export const popIn = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 16 } },
};

export const modalPop = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE } },
};
