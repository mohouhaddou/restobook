import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../modules/play/play.css';
import { usePlayApi } from '../../modules/play/hooks/usePlayApi';
import { usePlayContext } from '../../modules/play/PlayContext';
import RewardCatalog from '../../modules/play/components/RewardCatalog';
import PlaySidebar from '../../modules/play/components/PlaySidebar';

export default function PlayRewardsPage() {
  const { get, post, isGuest } = usePlayApi();
  const { profile, refreshProfile } = usePlayContext();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    get('/play/rewards').then(({ rewards: r }) => setRewards(r || [])).finally(() => setLoading(false));
  }, [get]);

  async function handleClaim(rewardId) {
    setMessage('');
    try {
      const { userReward } = await post(`/play/rewards/${rewardId}/claim`);
      setMessage(`Récompense réclamée ! Code : ${userReward.coupon_code}`);
      refreshProfile();
    } catch (e) {
      setMessage(e.message);
    }
  }

  return (
    <div className="play-page">
      <div className="play-shell">
      <PlaySidebar/>
      <div className="play-container">
        <div className="play-header">
          <Link to="/play" className="play-btn secondary" style={{ textDecoration: 'none' }}>← Retour</Link>
          <h1 className="play-title" style={{ fontSize: 22 }}>🎁 Récompenses</h1>
        </div>
        {message && <div className="play-card" style={{ marginBottom: 16, fontWeight: 700 }}>{message}</div>}
        <div className="play-card">
          {loading ? (
            <p style={{ color: 'var(--il-muted)' }}>Chargement…</p>
          ) : (
            <RewardCatalog rewards={rewards} icoinsBalance={profile?.icoinsBalance || 0} onClaim={handleClaim} isGuest={isGuest} />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
