import React from 'react';

export default function Leaderboard({ entries = [], note }) {
  if (note) return <p style={{ color: 'var(--il-muted)', fontSize: 13 }}>Classement amis — bientôt disponible.</p>;
  if (!entries.length) return <p style={{ color: 'var(--il-muted)', fontSize: 13 }}>Pas encore de classement.</p>;
  return (
    <div className="play-leaderboard-list">
      {entries.map(e => (
        <div key={e.rank} className="play-leaderboard-row">
          <span className="rank">{e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span>
          <span style={{ fontSize: 18 }}>{e.avatarIcon || '🎮'}</span>
          <span style={{ flex: 1, fontWeight: 700 }}>{e.displayName}</span>
          <span style={{ fontWeight: 800, color: 'var(--il-primary)' }}>{e.xp} XP</span>
        </div>
      ))}
    </div>
  );
}
