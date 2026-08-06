import React from 'react';
import { motion } from 'framer-motion';

export default function XpBar({ totalXp, currentLevel, levelName, nextLevel }) {
  const pct = nextLevel
    ? Math.min(100, Math.max(0, 100 - (nextLevel.xpRemaining / (nextLevel.xpThreshold || 1)) * 100))
    : 100;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>Niveau {currentLevel} {levelName ? `— ${levelName}` : ''}</span>
        <span style={{ fontSize: 12, color: 'var(--il-muted)' }}>
          {nextLevel ? `${nextLevel.xpRemaining} XP avant le niveau ${nextLevel.levelNumber}` : 'Niveau max'}
        </span>
      </div>
      <div className="play-xpbar-track">
        <motion.div
          className="play-xpbar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
