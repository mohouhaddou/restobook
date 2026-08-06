import React from 'react';
import { Clock3, Flag, Heart, Maximize2, Minimize2, Moon, PanelBottomClose, Share2, SkipForward, Sun, Trophy, X } from 'lucide-react';

export default function GamePlayerToolbar({ game, elapsed = '00:00', score = null, favorite = false, favoriteLoading = false, dark = false, isFullscreen = false, profile = null, onNext, onFavorite, onBack, onShare, onFullscreen, onDarkToggle, onReport, onHideBar, extraActions }) {
  const xpProgress = profile?.nextLevel ? Math.min(100, Math.max(0, 100 - (profile.nextLevel.xpRemaining / (profile.nextLevel.xpThreshold || 1)) * 100)) : 100;
  return <header className="play-game-shell-bar play-player-toolbar">
    <div className="play-player-title"><span className="play-game-shell-label">En cours</span><h1>{game?.name || 'iFilino Play'}</h1></div>
    <div className="play-game-shell-stats" aria-label="Statistiques de la partie">
      <span title="Temps écoulé"><Clock3 size={16}/>{elapsed}</span>
      {score != null && <strong>{score} pts</strong>}
      {profile && <span className="play-player-level" style={{'--player-xp': `${xpProgress}%`}} title={`${profile.totalXp} XP`}><Trophy size={16}/>Niv. {profile.currentLevel}</span>}
    </div>
    <div className="play-game-shell-actions" aria-label="Actions du lecteur">
      {extraActions}
      <button type="button" onClick={onFavorite} disabled={favoriteLoading} className={favorite?'active':''} aria-pressed={favorite} aria-label={favorite?'Retirer des favoris':'Ajouter aux favoris'} title={favorite?'Retirer des favoris':'Ajouter aux favoris'}><Heart fill={favorite?'currentColor':'none'}/></button>
      <button type="button" onClick={onShare} aria-label="Partager le jeu" title="Partager"><Share2/></button>
      <button type="button" onClick={onFullscreen} className={isFullscreen?'active':''} aria-pressed={isFullscreen} aria-label={isFullscreen?'Quitter le plein écran':'Afficher en plein écran'} title={isFullscreen?'Quitter le plein écran':'Plein écran'}>{isFullscreen?<Minimize2/>:<Maximize2/>}</button>
      <button type="button" onClick={onDarkToggle} className={dark?'active':''} aria-pressed={dark} aria-label={dark?'Contraste jour':'Contraste nuit'} title={dark?'Contraste jour':'Contraste nuit'}>{dark?<Sun/>:<Moon/>}</button>
      <button type="button" onClick={onReport} aria-label="Signaler un problème" title="Signaler un problème"><Flag/></button>
      {onNext&&<button type="button" onClick={onNext} className="play-player-next" aria-label="Jouer au jeu suivant" title="Jeu suivant"><SkipForward/></button>}
      <button type="button" onClick={onHideBar} aria-label="Masquer la barre de contrôle" title="Masquer la barre"><PanelBottomClose/></button>
      <button type="button" onClick={onBack} aria-label="Quitter le jeu" title="Quitter"><X/></button>
    </div>
  </header>;
}
