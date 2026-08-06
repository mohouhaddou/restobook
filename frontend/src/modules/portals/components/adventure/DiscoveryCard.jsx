import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lightbulb, Pin } from 'lucide-react';
import { fadeUp } from './adventureMotion';
import './discovery-card.css';

const KIND_META = {
  tip: { icon: Lightbulb, defaultLabel: 'Did you know?' },
  note: { icon: Pin, defaultLabel: 'Remember' },
};

/**
 * Upgrade visuel d'un bloc callout `tip`/`note` (déjà produit par le moteur markdown existant,
 * syntaxe `[!TIP]`/`[!NOTE]` — voir backend/src/shared/markdown/markdownEngine.js) en carte
 * "découverte" autonome avec reveal au scroll, plutôt que la pastille pastel du thème Kids
 * standard (CalloutRenderer.tsx). Ne remplace jamais le rendu par défaut pour warning/info.
 */
export function DiscoveryCard({ block, labels }) {
  const reduceMotion = useReducedMotion();
  const meta = KIND_META[block.kind] || KIND_META.tip;
  const Icon = meta.icon;
  const label = block.title || labels?.[block.kind] || meta.defaultLabel;
  const motionProps = reduceMotion
    ? {}
    : { variants: fadeUp, initial: 'hidden', whileInView: 'visible', viewport: { once: true, margin: '-40px' } };
  const Tag = reduceMotion ? 'div' : motion.div;

  return (
    <Tag className={`discovery-card discovery-card--${block.kind}`} {...motionProps}>
      <span className="discovery-card-icon"><Icon size={22} aria-hidden="true"/></span>
      <div className="discovery-card-body">
        <strong>{label}</strong>
        <div dangerouslySetInnerHTML={{ __html: block.html }} />
      </div>
    </Tag>
  );
}

export { KIND_META as DISCOVERY_CALLOUT_KINDS };
