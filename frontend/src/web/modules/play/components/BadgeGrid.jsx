import React from 'react';
import { motion } from 'framer-motion';
import { playBadgeUnlockVariants } from '../games/playMotion';

export default function BadgeGrid({ badges = [] }) {
  if (!badges.length) return <p style={{ color: 'var(--il-muted)', fontSize: 13 }}>Aucun badge pour le moment.</p>;
  return (
    <div className="play-badge-grid">
      {badges.map(b => (
        <motion.div
          key={b.id}
          className={`play-badge-card ${b.earned ? 'earned' : ''}`}
          initial="hidden"
          animate="visible"
          variants={playBadgeUnlockVariants}
        >
          <div className="icon">{b.icon || '🏅'}</div>
          <div className="name">{b.name}</div>
        </motion.div>
      ))}
    </div>
  );
}
