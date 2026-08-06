import React from 'react';

export default function RewardCatalog({ rewards = [], icoinsBalance = 0, onClaim, isGuest }) {
  if (!rewards.length) return <p style={{ color: 'var(--il-muted)', fontSize: 13 }}>Aucune récompense disponible pour le moment.</p>;
  return (
    <div className="play-reward-grid">
      {rewards.map(r => {
        const canAfford = icoinsBalance >= r.cost_icoins;
        return (
          <div key={r.id} className="play-reward-card">
            <div style={{ fontSize: 28 }}>{r.icon || '🎁'}</div>
            <div style={{ fontWeight: 800, margin: '6px 0 2px' }}>{r.name}</div>
            {r.description && <div style={{ fontSize: 12.5, color: 'var(--il-muted)', marginBottom: 10 }}>{r.description}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="cost">{r.cost_icoins} iCoins</span>
              <button className="play-btn" disabled={!canAfford} onClick={() => onClaim(r.id)}>
                {isGuest ? 'Connexion requise' : canAfford ? 'Réclamer' : 'Insuffisant'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
