import type { Variants } from 'framer-motion';

// Même courbe d'accélération que playCardVariants (frontend/src/modules/play/games/playMotion.js)
// — transform+opacity uniquement, animations discrètes plutôt que spectaculaires ("pas de
// surcharge"). Un fichier dédié plutôt qu'un import direct du module Play : Kids a son propre
// système de design (--portal-*) et ne doit rien importer du thème visuel de Play/Gaming.
const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
