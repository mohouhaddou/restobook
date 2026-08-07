import React from 'react';

export default function MissionList({ missions = [], onClaim }) {
  if (!missions.length) return <p style={{ color: 'var(--il-muted)', fontSize: 13 }}>Pas de défi disponible aujourd'hui.</p>;
  return (
    <div className="play-mission-list">
      {missions.map(m => {
        const pct = Math.min(100, Math.round((m.progressValue / m.targetValue) * 100));
        return (
          <div key={m.id} className="play-mission-item">
            <div className="icon">{m.icon || '🎯'}</div>
            <div className="body">
              <div className="title">{m.title}</div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            </div>
            {m.status === 'claimed' ? (
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-muted)' }}>✓ Réclamée</span>
            ) : m.status === 'completed' ? (
              <button className="play-btn" onClick={() => onClaim(m.id)}>+{m.xpReward} XP</button>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--il-muted)' }}>{m.progressValue}/{m.targetValue}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
