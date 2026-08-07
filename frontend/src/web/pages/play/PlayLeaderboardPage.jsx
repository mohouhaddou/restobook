import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../modules/play/play.css';
import { usePlayApi } from '../../modules/play/hooks/usePlayApi';
import Leaderboard from '../../modules/play/components/Leaderboard';
import PlaySidebar from '../../modules/play/components/PlaySidebar';

const SCOPES = [
  { key: 'world', label: 'Monde' },
  { key: 'friends', label: 'Amis' },
];
const PERIODS = [
  { key: 'global', label: 'Global' },
  { key: 'monthly', label: 'Mensuel' },
  { key: 'weekly', label: 'Hebdomadaire' },
];

export default function PlayLeaderboardPage() {
  const { get } = usePlayApi();
  const [scope, setScope] = useState('world');
  const [period, setPeriod] = useState('global');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get(`/play/leaderboard?scope=${scope}&period=${period}`).then(setData).finally(() => setLoading(false));
  }, [get, scope, period]);

  return (
    <div className="play-page">
      <div className="play-shell">
      <PlaySidebar/>
      <div className="play-container">
        <div className="play-header">
          <Link to="/play" className="play-btn secondary" style={{ textDecoration: 'none' }}>← Retour</Link>
          <h1 className="play-title" style={{ fontSize: 22 }}>🏆 Classement</h1>
        </div>

        <div className="play-tabs">
          {SCOPES.map(s => (
            <button key={s.key} className={`play-tab ${scope === s.key ? 'active' : ''}`} onClick={() => setScope(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className="play-tabs">
          {PERIODS.map(p => (
            <button key={p.key} className={`play-tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>

        <div className="play-card">
          {loading ? <p style={{ color: 'var(--il-muted)' }}>Chargement…</p> : <Leaderboard entries={data?.entries} note={data?.note} />}
        </div>
      </div>
      </div>
    </div>
  );
}
