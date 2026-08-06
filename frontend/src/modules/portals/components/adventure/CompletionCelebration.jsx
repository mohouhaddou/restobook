import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { modalPop } from './adventureMotion';
import { useExplorerProgress } from './useExplorerProgress';
import { ExplorerBadge, KnowledgeMeter } from './ExplorerBadge';
import './completion-celebration.css';

const CONFETTI_COLORS = ['#7c3aed', '#ec4899', '#fbbf24', '#22c55e', '#2563eb'];

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${(i * 37) % 100}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 6) * 0.06,
    rotate: (i * 53) % 360,
    drift: ((i % 5) - 2) * 24,
  })), []);
  return (
    <div className="celebration-confetti" aria-hidden="true">
      {pieces.map(piece => (
        <motion.span
          key={piece.id}
          style={{ left: piece.left, background: piece.color }}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 220, x: piece.drift, opacity: 0, rotate: piece.rotate }}
          transition={{ duration: 1.1, delay: piece.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

/**
 * Écran de fin de leçon/article — remplace le "Terminer" silencieux qui se contentait
 * d'enregistrer la progression. Pas de compte requis : la progression "explorateur" vient de
 * useExplorerProgress (localStorage), mêmes principes que les favoris Kids.
 */
export function CompletionCelebration({ open, onClose, slug, title, objectives, nextLessons, buildNextHref, copy }) {
  const reduceMotion = useReducedMotion();
  const { count, badgeTier, nextThreshold, markCompleted } = useExplorerProgress();
  const [unlockedTier, setUnlockedTier] = useState(null);
  const markedRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open || !slug || markedRef.current === slug) return;
    markedRef.current = slug;
    const result = markCompleted(slug);
    setUnlockedTier(result.justUnlockedTier);
  }, [open, slug, markCompleted]);

  useEffect(() => {
    if (open) dialogRef.current?.focus({ preventScroll: true });
  }, [open]);

  const t = copy || {
    heading: 'You did it!', subheading: 'Lesson complete', learned: 'What you learned',
    explored: 'lessons explored', unlocked: 'New explorer badge unlocked!', next: 'Next adventure', close: 'Close',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="celebration-backdrop" role="presentation"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="celebration-dialog" role="dialog" aria-modal="true" aria-label={t.heading}
            tabIndex="-1" ref={dialogRef} onClick={event => event.stopPropagation()}
            variants={reduceMotion ? undefined : modalPop} initial="hidden" animate="visible" exit="hidden"
          >
            {!reduceMotion && <Confetti/>}
            <button type="button" className="celebration-close" onClick={onClose} aria-label={t.close}><X size={18}/></button>

            <div className="celebration-badge-row">
              <ExplorerBadge count={count} badgeTier={badgeTier} justUnlocked={Boolean(unlockedTier)}/>
              <KnowledgeMeter count={count} nextThreshold={nextThreshold}/>
            </div>

            <h2>{t.heading}</h2>
            <p className="celebration-subheading">{t.subheading}{title ? ` — ${title}` : ''}</p>

            {unlockedTier && (
              <div className="celebration-unlock" role="status">
                <Sparkles size={16}/><span>{t.unlocked}</span>
              </div>
            )}
            <p className="celebration-count">{count} {t.explored}</p>

            {objectives?.length > 0 && (
              <div className="celebration-recap">
                <strong>{t.learned}</strong>
                <ul>{objectives.map(o => <li key={o}><CheckCircle2 size={15}/><span>{o}</span></li>)}</ul>
              </div>
            )}

            {nextLessons?.length > 0 && buildNextHref && (
              <div className="celebration-next">
                <strong>{t.next}</strong>
                <div>
                  {nextLessons.slice(0, 2).map(card => (
                    <Link key={card.slug} to={buildNextHref(card.slug)} className="celebration-next-card">{card.title}</Link>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
