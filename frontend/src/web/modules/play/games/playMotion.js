// Variants Framer Motion légers pour iFilino Play — même esprit que
// shared/components/marketplace/heroMotion.js (transform + opacity only,
// GPU-friendly, pas d'orchestrateur lourd).
const EASE = [0.22, 1, 0.36, 1];

export const playCardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

export const playCardGridContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

export const playBadgeUnlockVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 16 } },
};

export const playModalVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE } },
};
