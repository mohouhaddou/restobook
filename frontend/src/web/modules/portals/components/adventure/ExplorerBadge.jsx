import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Award, Compass, Rocket, Sparkles, Trophy } from 'lucide-react';
import { popIn } from './adventureMotion';
import { EXPLORER_BADGE_THRESHOLDS } from './useExplorerProgress';
import './explorer-badge.css';

// Une icône par palier — purement décoratif, pas de nouvelle donnée : le palier vient de
// useExplorerProgress (localStorage, sans compte).
const TIER_ICONS = [Compass, Sparkles, Award, Rocket, Trophy];

function tierIndex(tier) {
  const index = EXPLORER_BADGE_THRESHOLDS.indexOf(tier);
  return index === -1 ? 0 : index;
}

/** Badge "explorateur" compact — palier atteint + compteur total, spring pop-in comme les badges Play. */
export function ExplorerBadge({ count, badgeTier, justUnlocked }) {
  const reduceMotion = useReducedMotion();
  const Icon = TIER_ICONS[Math.min(tierIndex(badgeTier || EXPLORER_BADGE_THRESHOLDS[0]), TIER_ICONS.length - 1)];
  const Tag = reduceMotion ? 'div' : motion.div;
  const motionProps = reduceMotion ? {} : { variants: popIn, initial: 'hidden', animate: 'visible' };

  return (
    <Tag className={`explorer-badge${justUnlocked ? ' explorer-badge--fresh' : ''}`} {...motionProps}>
      <span className="explorer-badge-icon"><Icon size={26}/></span>
      <span className="explorer-badge-count">{count}</span>
    </Tag>
  );
}

/** Anneau de progression vers le prochain palier — même technique CSS conic-gradient que BookProgress.tsx. */
export function KnowledgeMeter({ count, nextThreshold }) {
  if (!nextThreshold) return null;
  const previous = [...EXPLORER_BADGE_THRESHOLDS].reverse().find(t => t < nextThreshold) || 0;
  const span = nextThreshold - previous;
  const percent = Math.min(100, Math.round(((count - previous) / span) * 100));
  return (
    <div className="knowledge-meter" style={{ '--km-progress': `${percent}%` }} role="status">
      <span className="knowledge-meter-ring"><strong>{nextThreshold - count}</strong></span>
      <span className="knowledge-meter-label">to your next badge</span>
    </div>
  );
}
