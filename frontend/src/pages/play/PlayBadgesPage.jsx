import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../modules/play/play.css';
import { usePlayApi } from '../../modules/play/hooks/usePlayApi';
import BadgeGrid from '../../modules/play/components/BadgeGrid';
import PlaySidebar from '../../modules/play/components/PlaySidebar';

export default function PlayBadgesPage() {
  const { get } = usePlayApi();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get('/play/badges').then(({ badges: b }) => setBadges(b || [])).finally(() => setLoading(false));
  }, [get]);

  return (
    <div className="play-page">
      <div className="play-shell">
      <PlaySidebar/>
      <div className="play-container">
        <div className="play-header">
          <Link to="/play" className="play-btn secondary" style={{ textDecoration: 'none' }}>← Retour</Link>
          <h1 className="play-title" style={{ fontSize: 22 }}>🏅 Badges</h1>
        </div>
        <div className="play-card">
          {loading ? <p style={{ color: 'var(--il-muted)' }}>Chargement…</p> : <BadgeGrid badges={badges} />}
        </div>
      </div>
      </div>
    </div>
  );
}
