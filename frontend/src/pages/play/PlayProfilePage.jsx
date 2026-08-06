import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3, Gamepad2, Heart, Medal, Pencil, RotateCcw, Trophy, UserRound } from 'lucide-react';
import '../../modules/play/play.css';
import { usePlayApi } from '../../modules/play/hooks/usePlayApi';
import { usePlayContext } from '../../modules/play/PlayContext';
import XpBar from '../../modules/play/components/XpBar';
import BadgeGrid from '../../modules/play/components/BadgeGrid';
import PlaySidebar from '../../modules/play/components/PlaySidebar';
import ShareButtons from '../../shared/components/social/ShareButtons';

const formatDuration = seconds => { const minutes = Math.round((seconds || 0) / 60); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`; };
const dateLabel = value => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function PlayProfilePage() {
  const { get, request, isGuest } = usePlayApi();
  const { profile, refreshProfile } = usePlayContext();
  const [history, setHistory] = useState([]), [summary, setSummary] = useState({}), [badges, setBadges] = useState([]), [favorites, setFavorites] = useState([]), [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { let active = true; Promise.all([get('/play/history?limit=30'), get('/play/badges'), get('/play/favorites'), get('/play/games')]).then(([activity, badgeData, favoriteData, gameData]) => { if (!active) return; const games = new Map((gameData.games || []).map(game => [game.slug, game])); setHistory(activity.history || []); setSummary(activity.summary || {}); setBadges(badgeData.badges || []); setFavorites((favoriteData.favorites || []).map(item => games.get(item.slug)).filter(Boolean)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [get]);
  useEffect(() => { setNameDraft(profile?.displayName || ''); }, [profile?.displayName]);

  const earned = badges.filter(badge => badge.earned);
  const favoriteCategory = useMemo(() => { const counts = new Map(); history.forEach(item => { const type = item.game?.game_type; if (type) counts.set(type, (counts.get(type) || 0) + 1); }); return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]?.replaceAll('_', ' ') || 'À découvrir'; }, [history]);
  const cards = [
    { icon: Gamepad2, label: 'Parties', value: summary.totalPlays || 0 },
    { icon: Clock3, label: 'Temps joué', value: formatDuration(summary.totalTimeSeconds) },
    { icon: Trophy, label: 'Terminées', value: summary.completed || 0 },
    { icon: RotateCcw, label: 'À reprendre', value: summary.abandoned || 0 },
    { icon: Heart, label: 'Favoris', value: favorites.length },
    { icon: Medal, label: 'Badges obtenus', value: earned.length },
  ];

  async function saveProfile(patch) {
    setSaving(true);
    try { await request('/play/profile', { method: 'PATCH', body: JSON.stringify(patch) }); await refreshProfile(); }
    catch {}
    finally { setSaving(false); }
  }

  async function handleNameSave() {
    await saveProfile({ displayName: nameDraft.trim() });
    setEditing(false);
  }

  if (loading) return <div className="play-page"><div className="play-shell"><PlaySidebar/><div className="play-container"><div className="play-game-loading" role="status"><span className="play-loader"/><strong>Préparation de votre profil…</strong></div></div></div></div>;
  return <div className="play-page"><div className="play-shell"><PlaySidebar/><main className="play-container play-profile">
    <Link to="/play" className="play-details-back">← Retour au catalogue</Link>
    <section className="play-profile-hero">
      <div className="play-profile-avatar">
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt=""/> : profile?.avatarIcon ? <span className="play-profile-avatar-icon">{profile.avatarIcon}</span> : <UserRound aria-hidden="true"/>}
      </div>
      <div>
        <span>{isGuest ? 'Profil invité' : 'Profil joueur'}</span>
        {editing ? (
          <div className="play-profile-name-edit">
            <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} maxLength={40} autoFocus/>
            <button type="button" onClick={handleNameSave} disabled={saving} aria-label="Enregistrer"><Check size={16}/></button>
          </div>
        ) : (
          <h1>{profile?.displayName || (isGuest ? 'Joueur invité' : 'Joueur iFilino')}{!isGuest && <button type="button" className="play-profile-name-btn" onClick={() => setEditing(true)} aria-label="Modifier le pseudo"><Pencil size={14}/></button>}</h1>
        )}
        <p>Niveau {profile?.currentLevel || 1} · {profile?.levelName || 'Explorateur'} · Catégorie favorite : <strong>{favoriteCategory}</strong></p>
      </div>
      {isGuest && <Link to="/play/login" className="play-btn">Créer mon compte joueur</Link>}
    </section>

    {!isGuest && profile?.availableAvatarIcons?.length > 0 && (
      <section className="play-profile-panel play-profile-avatars">
        <header><div><span>Personnalisation</span><h2>Choisir un avatar</h2></div></header>
        <div className="play-avatar-picker">
          {profile.availableAvatarIcons.map(icon => (
            <button key={icon} type="button" className={profile.avatarIcon === icon ? 'active' : ''} disabled={saving} onClick={() => saveProfile({ avatarIcon: icon })} aria-pressed={profile.avatarIcon === icon} aria-label={`Avatar ${icon}`}>{icon}</button>
          ))}
        </div>
      </section>
    )}

    <section className="play-profile-progress" aria-labelledby="profile-progress-title"><div><span>Progression</span><h2 id="profile-progress-title">{profile?.totalXp || 0} XP · {profile?.icoinsBalance || 0} iCoins</h2></div><XpBar totalXp={profile?.totalXp || 0} currentLevel={profile?.currentLevel || 1} levelName={profile?.levelName} nextLevel={profile?.nextLevel}/>
      <div style={{ marginTop: 14 }}>
        <ShareButtons
          compact
          title="Ma progression iFilino Play"
          text={`Niveau ${profile?.currentLevel || 1} · ${profile?.levelName || 'Explorateur'} · ${profile?.totalXp || 0} XP sur iFilino Play !`}
          url={typeof window !== 'undefined' ? `${window.location.origin}/play` : undefined}
        />
      </div>
    </section>
    <section className="play-profile-kpis" aria-label="Statistiques du joueur">{cards.map(({ icon: Icon, label, value }) => <div key={label}><Icon aria-hidden="true"/><span>{label}</span><strong>{value}</strong></div>)}</section>
    <div className="play-profile-grid"><section className="play-profile-panel"><header><div><span>30 dernières sessions</span><h2>Historique</h2></div></header>{history.length ? <div className="play-profile-history">{history.slice(0, 12).map(item => <Link key={item.id} to={`/play/${item.game?.slug || ''}`}><div><strong>{item.game?.name || 'Jeu indisponible'}</strong><span>{dateLabel(item.playedAt)} · {formatDuration(item.durationSeconds)}</span></div><small className={item.status}>{item.status === 'completed' ? 'Terminée' : item.status === 'abandoned' ? 'À reprendre' : 'En cours'}</small></Link>)}</div> : <p className="play-profile-empty">Votre historique apparaîtra après votre première partie.</p>}</section>
    <section className="play-profile-panel"><header><div><span>Collection</span><h2>Badges obtenus</h2></div><Link to="/play/badges">Voir tout</Link></header><BadgeGrid badges={earned.slice(0, 8)}/></section></div>
  </main></div></div>;
}
